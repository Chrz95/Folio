import { createReminderStateRoutes } from './reminderState.routes.js';
import { Router } from 'express';
import { z } from 'zod';
import type { DatabaseClient } from '../../db/client.js';
import { createReminderRepository } from './reminders.repository.js';
import { HTTP } from '../../constants/http.constants.js';
import { AppError } from '../../lib/errors/AppError.js';
const PUSH_LIMITS = { endpoint: 2048, publicKey: 200, auth: 100 };
/** Restrict Web Push targets to known browser push providers, avoiding arbitrary server requests. */
const endpointSchema = z
  .url()
  .max(PUSH_LIMITS.endpoint)
  .refine((value) => {
    const url = new URL(value);
    const host = url.hostname;
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === '443') &&
      (host === 'fcm.googleapis.com' ||
        host === 'updates.push.services.mozilla.com' ||
        host.endsWith('.notify.windows.com') ||
        host.endsWith('.push.apple.com'))
    );
  }, 'Unsupported push provider.');
const subscriptionSchema = z
  .object({
    endpoint: endpointSchema,
    keys: z
      .object({ p256dh: z.string().min(1).max(PUSH_LIMITS.publicKey), auth: z.string().min(1).max(PUSH_LIMITS.auth) })
      .strict(),
  })
  .strict();
const deleteSchema = z.object({ endpoint: endpointSchema }).strict();
/** Register opt-in subscription controls; financial details are not put in notifications.
 * @param {DatabaseClient} client - Application connection.
 * @param {object} push - VAPID configuration.
 * @param {string} push.publicKey - Public application-server key.
 * @returns {Router} Notification endpoints. */
export function createNotificationRoutes(client: DatabaseClient, push: { publicKey: string }) {
  const router = Router();
  const repository = createReminderRepository(client);
  router.get('/config', (_request, response) =>
    response.json({ data: { publicKey: push.publicKey, enabled: Boolean(push.publicKey) } }),
  );
  router.post('/subscriptions', (request, response) => {
    if (!push.publicKey) {
      throw new AppError(HTTP.unavailable, 'PUSH_DISABLED', 'Push reminders are not configured.');
    }
    const value = subscriptionSchema.parse(request.body);
    repository.save({ endpoint: value.endpoint, p256dh: value.keys.p256dh, auth: value.keys.auth });
    response.status(HTTP.created).json({ data: { subscribed: true } });
  });
  router.delete('/subscriptions', (request, response) => {
    repository.remove(deleteSchema.parse(request.body).endpoint);
    response.status(HTTP.noContent).end();
  });
  router.use(createReminderStateRoutes(client));
  return router;
}
