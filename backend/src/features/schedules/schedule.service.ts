import type { z } from 'zod';
import type { ScheduleRepository } from './schedule.repository.js';
import type { scheduleSettingsInputSchema, skipOccurrenceSchema } from './schedule.schema.js';
import { isOccurrence } from '../budget/recurrence.js';
import { AppError } from '../../lib/errors/AppError.js';
import { HTTP } from '../../constants/http.constants.js';
/** Change future planning without inventing or deleting financial postings.
 * @param {ScheduleRepository} repository - Persistence boundary. @returns {object} Schedule actions. */
export function createScheduleService(repository: ScheduleRepository) {
  /** Fetch a current anchor. @param {string} id - Schedule ID. @returns {object} Existing schedule. */
  function requireTemplate(id: string) {
    const template = repository.template(id);
    if (!template) {
      throw new AppError(HTTP.notFound, 'NOT_FOUND', 'This schedule no longer exists.');
    }
    return template;
  }
  return {
    state: repository.state,
    /** Pause/resume and set an inclusive end date. @param {z.infer<typeof scheduleSettingsInputSchema>} input - Controls.
     * @returns {object} Persisted settings. */
    saveSettings: (input: z.infer<typeof scheduleSettingsInputSchema>) =>
      repository.atomic(() => {
        const template = requireTemplate(input.recurringId);
        if (input.endDate && input.endDate < template.date) {
          throw new AppError(
            HTTP.badRequest,
            'INVALID_END_DATE',
            'The end date must be on or after the schedule start.',
          );
        }
        return repository.saveSettings(input);
      }),
    /** Skip or restore one valid unpaid occurrence. @param {z.infer<typeof skipOccurrenceSchema>} input - Exception.
     * @returns {void} Durable skip state. */
    setSkipped: (input: z.infer<typeof skipOccurrenceSchema>) =>
      repository.atomic(() => {
        const template = requireTemplate(input.recurringId);
        if (!isOccurrence(template.date, template.frequency, input.date)) {
          throw new AppError(HTTP.badRequest, 'INVALID_OCCURRENCE', 'Choose a date in this recurring schedule.');
        }
        if (input.isSkipped && repository.hasOccurrence(template.id, input.date)) {
          throw new AppError(
            HTTP.conflict,
            'ALREADY_PAID',
            'This occurrence is already recorded and cannot be skipped.',
          );
        }
        if (input.isSkipped) {
          repository.skip({ recurringId: input.recurringId, date: input.date });
        } else {
          repository.restore(input.recurringId, input.date);
        }
      }),
  };
}
