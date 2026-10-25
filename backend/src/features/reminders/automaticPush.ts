import webpush from 'web-push';
import type { Logger } from 'pino';
import type { DatabaseClient } from '../../db/client.js';
import type { loadEnvironment } from '../../app/config/environment.js';
import type { PushConfiguration } from './device.service.js';
import { createDeviceRepository } from './device.repository.js';
import { VAPID } from './vapid.constants.js';
import { readVapidFile, persistVapidFile } from './vapidFile.js';
import { validateSigningKeys } from './vapidKeys.js';
import type { SigningKeys } from './vapidKeys.js';
type PushEnvironment = Pick<ReturnType<typeof loadEnvironment>, 'database' | 'push' | 'origins'>;
/** Prefer an explicit contact, then the configured HTTPS app origin; avoid localhost URL subjects on Safari.
 * @param {PushEnvironment} configuration - Validated server settings. @returns {string} VAPID identity URI. */
function signingSubject(configuration: PushEnvironment): string {
  if (configuration.push.subject && configuration.push.subject !== VAPID.fallbackSubject) {
    return configuration.push.subject;
  }
  const origin = configuration.origins.find((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && !VAPID.loopback.some((host) => host === url.hostname);
  });
  return origin ? new URL(origin).origin : VAPID.fallbackSubject;
}
/** Validate the complete signing identity before replacing any durable server key.
 * @param {SigningKeys} keys - Curve-validated pair. @param {string} subject - Operator identity.
 * @returns {SigningKeys} Pair whose local VAPID header can be generated without network access. */
function validatePushIdentity(keys: SigningKeys, subject: string): SigningKeys {
  webpush.getVapidHeaders(VAPID.validationAudience, subject, keys.publicKey, keys.privateKey, 'aes128gcm');
  return keys;
}
/** Resolve and durably initialize signing once; explicit pairs override and are retained for subsequent restarts.
 * @param {DatabaseClient} client - Existing migrated database. @param {PushEnvironment} configuration - Settings.
 * @returns {PushConfiguration} Validated, persistent credentials for both API enrollment and background delivery. */
export function resolveServerPush(client: DatabaseClient, configuration: PushEnvironment): PushConfiguration {
  const path = `${configuration.database.filePath}${VAPID.suffix}`;
  const explicit = Boolean(configuration.push.publicKey || configuration.push.privateKey);
  const subject = signingSubject(configuration);
  let keys;
  if (explicit) {
    keys = persistVapidFile(path, validatePushIdentity(validateSigningKeys(configuration.push), subject), true);
  } else {
    keys = readVapidFile(path);
    if (!keys) {
      if (createDeviceRepository(client).count()) {
        throw new Error(VAPID.missingKeys);
      }
      keys = persistVapidFile(path, validatePushIdentity(webpush.generateVAPIDKeys(), subject));
    }
  }
  return { ...validatePushIdentity(keys, subject), subject };
}
/** Keep the budget available after a storage/configuration failure, without using ephemeral or rotated keys.
 * @param {DatabaseClient} client - Migrated database. @param {PushEnvironment} configuration - Settings.
 * @param {Logger} logger - Safe logger. @returns {PushConfiguration} Enabled credentials or disabled push only. */
export function configureServerPush(client: DatabaseClient, configuration: PushEnvironment, logger: Logger) {
  try {
    return resolveServerPush(client, configuration);
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : '';
    logger.error(message === VAPID.invalidKeys || message === VAPID.missingKeys ? message : VAPID.setupFailed);
    return { publicKey: '', privateKey: '', subject: VAPID.fallbackSubject };
  }
}
