import { environment } from '../../app/config/environment';
import { request } from '../../lib/api/client';
import { readDemo, writeDemo } from '../../lib/storage/demoStore';
import { scheduleSettingsSchema, skipOccurrenceSchema } from './scheduleValidation';
import { isOccurrence } from '../transactions/recurrence';
import type { ScheduleData } from './schedulePolicy';
export type ScheduleResource = 'scheduleSettings' | 'skippedOccurrences';
/** Load optional schedule controls through the selected adapter. @param {AbortSignal} signal - Cancellation.
 * @returns {Promise<ScheduleData>} Pause, end dates and skipped dates. */
export async function loadSchedules(signal?: AbortSignal): Promise<ScheduleData> {
  return request('/schedules', { signal });
}
/** Persist controls with the same validation and paid-date protection as SQLite.
 * @param {ScheduleResource} resource - Control collection. @param {object} value - Complete input.
 * @returns {Promise<void>} Durable metadata change. */
export async function mutateSchedule(resource: ScheduleResource, value?: object): Promise<void> {
  const schema = resource === 'scheduleSettings' ? scheduleSettingsSchema : skipOccurrenceSchema;
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error('Choose a valid schedule and calendar date.');
  }
  if (!environment.isDemo) {
    await request(`/schedules/${resource === 'scheduleSettings' ? 'settings' : 'occurrences'}`, {
      method: 'PUT',
      body: JSON.stringify(parsed.data),
    });
    return;
  }
  const data = readDemo();
  const input = parsed.data;
  const template = data.recurring.find((entry) => entry.id === input.recurringId);
  if (!template) {
    throw new Error('This schedule no longer exists.');
  }
  if ('isPaused' in input) {
    if (input.endDate && input.endDate < template.date) {
      throw new Error('The end date must be on or after the schedule start.');
    }
    data.scheduleSettings = [
      ...(data.scheduleSettings ?? []).filter((entry) => entry.recurringId !== input.recurringId),
      input,
    ];
  } else {
    if (!isOccurrence(template.date, template.frequency, input.date)) {
      throw new Error('Choose a date in this recurring schedule.');
    }
    if (
      input.isSkipped &&
      data.transactions.some((entry) => entry.recurringId === input.recurringId && entry.date === input.date)
    ) {
      throw new Error('This occurrence is already recorded and cannot be skipped.');
    }
    data.skippedOccurrences = (data.skippedOccurrences ?? []).filter(
      (entry) => entry.recurringId !== input.recurringId || entry.date !== input.date,
    );
    if (input.isSkipped) {
      data.skippedOccurrences.push({ recurringId: input.recurringId, date: input.date });
    }
  }
  writeDemo(data);
}
