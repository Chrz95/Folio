import { z } from 'zod';
import { PUSH } from './push.constants.js';
/** Restrict outgoing requests to supported browser push providers.
 * @param {string} value - Subscription endpoint. @returns {boolean} Allowed HTTPS provider. */
function allowedProvider(value: string) {
  try {
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
  } catch {
    return false;
  }
}
export const endpointSchema = z.url().max(PUSH.endpoint).refine(allowedProvider, 'Unsupported push provider.');
export const pushEndpointSchema = z.object({ endpoint: endpointSchema }).strict();
export const subscriptionSchema = pushEndpointSchema
  .extend({
    keys: z
      .object({
        p256dh: z.string().min(1).max(PUSH.publicKey),
        auth: z.string().min(1).max(PUSH.auth),
      })
      .strict(),
  })
  .strict();
