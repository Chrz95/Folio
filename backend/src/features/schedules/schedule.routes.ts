import { Router } from 'express';
import type { DatabaseClient } from '../../db/client.js';
import { HTTP } from '../../constants/http.constants.js';
import { createScheduleRepository } from './schedule.repository.js';
import { createScheduleService } from './schedule.service.js';
import { scheduleSettingsInputSchema, skipOccurrenceSchema } from './schedule.schema.js';
/** Bind validated schedule control operations. @param {DatabaseClient} client - Existing connection.
 * @returns {Router} Schedule routes. */
export function createScheduleRoutes(client: DatabaseClient) {
  const router = Router();
  const service = createScheduleService(createScheduleRepository(client));
  router.get('/schedules', (_request, response) => response.json({ data: service.state() }));
  router.put('/schedules/settings', (request, response) => {
    response.json({ data: service.saveSettings(scheduleSettingsInputSchema.parse(request.body)) });
  });
  router.put('/schedules/occurrences', (request, response) => {
    service.setSkipped(skipOccurrenceSchema.parse(request.body));
    response.status(HTTP.noContent).end();
  });
  return router;
}
