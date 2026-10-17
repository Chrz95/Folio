import { createReminderStateRoutes } from './reminderState.routes.js';
import { Router } from 'express';
import type { DatabaseClient } from '../../db/client.js';
import { createReminderRepository } from './reminders.repository.js';
import { HTTP } from '../../constants/http.constants.js';
import { AppError } from '../../lib/errors/AppError.js';
import { pushEndpointSchema, subscriptionSchema } from './push.schema.js';
import { createDeviceRepository } from './device.repository.js';
import { createDeviceService } from './device.service.js';
import type { PushConfiguration } from './device.service.js';
/** Register opt-in device controls and current-device tests; push payloads contain no financial details.
 * @param {DatabaseClient} client - Application connection. @param {PushConfiguration} push - Server signing config.
 * @returns {Router} Notification endpoints. */
export function createNotificationRoutes(client: DatabaseClient, push: PushConfiguration) {
  const router = Router();
  const repository = createReminderRepository(client);
  const devices = createDeviceService(createDeviceRepository(client), push);
  router.get('/config', (_request, response) => response.json({ data: devices.config() }));
  router.post('/subscriptions/status', (request, response) => {
    response.json({ data: devices.status(pushEndpointSchema.parse(request.body).endpoint) });
  });
  router.post('/subscriptions', (request, response) => {
    if (!push.publicKey || !push.privateKey) {
      throw new AppError(HTTP.unavailable, 'PUSH_DISABLED', 'Push reminders are not configured.');
    }
    const value = subscriptionSchema.parse(request.body);
    repository.save({ endpoint: value.endpoint, p256dh: value.keys.p256dh, auth: value.keys.auth });
    response.status(HTTP.created).json({ data: { subscribed: true } });
  });
  router.delete('/subscriptions', (request, response) => {
    repository.remove(pushEndpointSchema.parse(request.body).endpoint);
    response.status(HTTP.noContent).end();
  });
  router.post('/test', async (request, response) => {
    response.json({ data: await devices.test(pushEndpointSchema.parse(request.body).endpoint) });
  });
  router.use(createReminderStateRoutes(client));
  return router;
}
