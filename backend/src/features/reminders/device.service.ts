import webpush from 'web-push';
import { AppError } from '../../lib/errors/AppError.js';
import { HTTP } from '../../constants/http.constants.js';
import { PUSH } from './push.constants.js';
import { REMINDERS } from './reminders.constants.js';
import type { DeviceRepository } from './device.repository.js';
export interface PushConfiguration {
  publicKey: string;
  privateKey: string;
  subject: string;
}
/** Send a user-triggered test only to a previously registered current device.
 * @param {DeviceRepository} repository - Device persistence. @param {PushConfiguration} push - Server VAPID config.
 * @param {typeof webpush.sendNotification} send - Injectable provider boundary.
 * @param {() => number} now - Clock. @returns {object} Device use cases. */
export function createDeviceService(
  repository: DeviceRepository,
  push: PushConfiguration,
  send: typeof webpush.sendNotification = webpush.sendNotification,
  now: () => number = Date.now,
) {
  return {
    /** Report server capability and count without exposing device endpoints.
     * @returns {object} Public push configuration. */
    config: () => ({
      publicKey: push.publicKey,
      enabled: Boolean(push.publicKey && push.privateKey),
      subscriptions: repository.count(),
    }),
    /** Confirm that this exact browser subscription is saved. @param {string} endpoint - Submitted endpoint.
     * @returns {object} Registration status. */
    status: (endpoint: string) => ({ registered: Boolean(repository.get(endpoint)) }),
    /** Acknowledge provider acceptance separately from device display; never claim that the user saw the test.
     * @param {string} endpoint - Current registered endpoint. @returns {Promise<object>} Provider acceptance. */
    test: async (endpoint: string) => {
      if (!push.publicKey || !push.privateKey) {
        throw new AppError(
          HTTP.unavailable,
          'PUSH_DISABLED',
          'Background notification setup is unavailable on this server.',
        );
      }
      const subscription = repository.get(endpoint);
      if (!subscription) {
        throw new AppError(HTTP.notFound, 'DEVICE_NOT_REGISTERED', 'Enable this device first.');
      }
      if (!repository.reserveTest(endpoint, now())) {
        throw new AppError(PUSH.rateLimited, 'TEST_COOLDOWN', 'Wait 30 seconds between test notifications.');
      }
      try {
        await send(
          { endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          JSON.stringify({ title: PUSH.title, body: PUSH.body, tag: PUSH.testTag }),
          { TTL: PUSH.testTtl, timeout: PUSH.testTimeout, vapidDetails: push },
        );
      } catch (error) {
        const status = error instanceof webpush.WebPushError ? error.statusCode : 0;
        if (status === REMINDERS.notFound || status === REMINDERS.gone) {
          repository.remove(endpoint);
          throw new AppError(REMINDERS.gone, 'DEVICE_EXPIRED', 'This device subscription expired. Enable it again.');
        }
        throw new AppError(
          PUSH.gatewayFailure,
          'PUSH_PROVIDER_FAILED',
          'The push provider did not accept the test. Check connectivity and VAPID configuration.',
        );
      }
      return { accepted: true };
    },
  };
}
