import { isScheduleDateEnabled } from '../schedules/schedulePolicy.js';
import { Router } from 'express';
import type { DatabaseClient } from '../../db/client.js';
import { createReminderStateRepository } from './reminderState.repository.js';
import { preferencesSchema, snoozeSchema } from './reminders.schema.js';
import { createBudgetRepository } from '../budget/budget.repository.js';
import { isOccurrence } from '../budget/recurrence.js';
import { AppError } from '../../lib/errors/AppError.js';
import { HTTP } from '../../constants/http.constants.js';
import { REMINDERS } from './reminders.constants.js';
/** Validate preference/snooze actions separately from browser subscription permission.
 * @param {DatabaseClient} client - Migrated connection. @returns {Router} Notification state routes. */
export function createReminderStateRoutes(client: DatabaseClient) {
  const router = Router();
  const state = createReminderStateRepository(client);
  const budget = createBudgetRepository(client);
  router.get('/state', (_request, response) =>
    response.json({ data: { preferences: state.preferences(), snoozes: state.snoozes(), attempts: state.history() } }),
  );
  router.put('/preferences', (request, response) => {
    state.savePreferences(preferencesSchema.parse(request.body));
    response.status(HTTP.noContent).end();
  });
  router.post('/snooze', (request, response) => {
    const input = snoozeSchema.parse(request.body);
    const template = budget.getRecurring(input.recurringId);
    if (
      !template ||
      !isOccurrence(template.date, template.frequency, input.date) ||
      !isScheduleDateEnabled(template.id, input.date, budget.scheduleState()) ||
      budget.hasOccurrence(template.id, input.date)
    ) {
      throw new AppError(HTTP.badRequest, 'INVALID_SNOOZE', 'Choose an unpaid scheduled occurrence.');
    }
    state.snooze({
      recurringId: input.recurringId,
      date: input.date,
      until: Date.now() + input.minutes * REMINDERS.minuteMilliseconds,
    });
    response.status(HTTP.noContent).end();
  });
  return router;
}
