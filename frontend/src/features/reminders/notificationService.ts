import { request } from '../../lib/api/client';
import { environment } from '../../app/config/environment';
import { APP, PATH } from '../../constants/app.constants';
import { NOTIFICATIONS } from './notification.constants';
import type { DeviceStatus, NotificationConfiguration } from './notification.constants';
import { notificationBlocker, readyNotificationWorker } from './notificationCapabilities';
/** Decode the VAPID public key into application-server bytes.
 * @param {string} value - URL-safe base64. @returns {Uint8Array<ArrayBuffer>} Subscription key. */
function decodeKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((NOTIFICATIONS.keyBase - (value.length % NOTIFICATIONS.keyBase)) % NOTIFICATIONS.keyBase);
  const raw = atob((value + padding).replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}
/** Read actual browser and server registration state; a saved local flag alone is never authoritative.
 * @returns {Promise<DeviceStatus>} Device capability and registration status. */
export async function loadNotificationStatus(): Promise<DeviceStatus> {
  const configuration = environment.isDemo
    ? { enabled: true, publicKey: '', subscriptions: 0 }
    : await request<NotificationConfiguration>(`${PATH.notifications}/config`);
  const blocker = notificationBlocker(environment.isDemo);
  const permission = 'Notification' in window ? Notification.permission : 'unsupported';
  let hasSubscription = false;
  let registered = false;
  if (!environment.isDemo && window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window) {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    hasSubscription = Boolean(subscription);
    if (subscription) {
      const result = await request<{ registered: boolean }>(`${PATH.notifications}/subscriptions/status`, {
        method: 'POST',
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      ({ registered } = result);
    }
  }
  const isEnabled =
    permission === 'granted' &&
    (environment.isDemo
      ? localStorage.getItem(APP.notificationsKey) === 'enabled'
      : hasSubscription && registered && configuration.enabled);
  return {
    configuration,
    permission,
    hasSubscription,
    registered,
    isEnabled,
    blocker:
      blocker ||
      (!configuration.enabled ? 'Configure VAPID keys on your server to enable background notifications.' : ''),
  };
}
/** Request permission immediately in the click handler using preloaded configuration, preserving iOS user activation.
 * @param {NotificationConfiguration} configuration - Previously loaded public server configuration.
 * @returns {Promise<string>} Acknowledged subscription feedback. */
export async function enableReminders(configuration: NotificationConfiguration) {
  const blocker = notificationBlocker(environment.isDemo);
  if (blocker) {
    throw new Error(blocker);
  }
  if (!configuration.enabled) {
    throw new Error('Configure VAPID keys on the server first.');
  }
  const permissionPromise = Notification.requestPermission();
  if ((await permissionPromise) !== 'granted') {
    throw new Error('Notifications were not allowed on this device.');
  }
  if (environment.isDemo) {
    localStorage.setItem(APP.notificationsKey, 'enabled');
    return 'Notifications enabled while this preview is open. Background delivery needs the self-hosted server.';
  }
  const registration = await readyNotificationWorker();
  const key = decodeKey(configuration.publicKey);
  const existing = await registration.pushManager.getSubscription();
  const previousKey = existing?.options.applicationServerKey;
  if (previousKey && new Uint8Array(previousKey).some((byte, index) => byte !== key[index])) {
    throw new Error('The server signing key changed. Disconnect this device, then enable it again.');
  }
  const subscription =
    existing ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
  const serialized = subscription.toJSON();
  await request(`${PATH.notifications}/subscriptions`, {
    method: 'POST',
    body: JSON.stringify({ endpoint: serialized.endpoint, keys: serialized.keys }),
  });
  localStorage.setItem(APP.notificationsKey, 'enabled');
  return 'This device is registered for background reminders. Send a test notification to check delivery.';
}
/** Disconnect only the current browser; other opted-in devices remain registered.
 * @returns {Promise<void>} Server and local opt-out. */
export async function disableReminders() {
  if (!environment.isDemo && 'serviceWorker' in navigator && 'PushManager' in window) {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await request(`${PATH.notifications}/subscriptions`, {
        method: 'DELETE',
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      if (!(await subscription.unsubscribe())) {
        throw new Error('Browser opt-out was not confirmed. Refresh and retry.');
      }
    }
  }
  localStorage.removeItem(APP.notificationsKey);
}
/** Send a user-requested test only to this device, without broadcasting to other subscribers.
 * @returns {Promise<string>} Provider acceptance rather than an unverified display claim. */
export async function testNotification(): Promise<string> {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    throw new Error('Allow notifications on this device first.');
  }
  if (environment.isDemo) {
    if ('serviceWorker' in navigator) {
      const registration = await readyNotificationWorker();
      await registration.showNotification(NOTIFICATIONS.testTitle, {
        body: NOTIFICATIONS.testBody,
        tag: NOTIFICATIONS.testTag,
      });
    } else {
      new Notification(NOTIFICATIONS.testTitle, { body: NOTIFICATIONS.testBody });
    }
    return 'Test requested on this device. Check your system notification center.';
  }
  const registration = await readyNotificationWorker();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    throw new Error('Enable this device first.');
  }
  await request(`${PATH.notifications}/test`, {
    method: 'POST',
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  return 'The push provider accepted the test. Check this device’s notification center; display is not guaranteed.';
}
