import { request } from '../../lib/api/client';
import { environment } from '../../app/config/environment';
import { APP, PATH } from '../../constants/app.constants';
/** Convert the VAPID public key into the exact application-server byte array.
 * @param {string} value - URL-safe base64 key.
 * @returns {Uint8Array<ArrayBuffer>} Browser subscription key. */
function decodeKey(value: string): Uint8Array<ArrayBuffer> {
  const base = 4;
  const padding = '='.repeat((base - (value.length % base)) % base);
  const raw = atob((value + padding).replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}
/** Opt into reminders only after an explicit user action.
 * @returns {Promise<string>} Accurate capability feedback. */
export async function enableReminders() {
  if (!('Notification' in window)) {
    throw new Error('Notifications are unavailable in this browser. Export the calendar instead.');
  }
  if (environment.isDemo) {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Notifications were not allowed. You can change this in browser settings.');
    }
    localStorage.setItem(APP.notificationsKey, 'enabled');
    return 'Reminders are enabled while Folio is open. For reminders when closed, export your calendar.';
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Background reminders are unavailable here. Export your calendar instead.');
  }
  const config = await request<{ enabled: boolean; publicKey: string }>(`${PATH.notifications}/config`);
  if (!config.enabled) {
    throw new Error(
      'Your server needs VAPID keys for background reminders. Export the calendar or contact your administrator.',
    );
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notifications were not allowed in this browser.');
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeKey(config.publicKey),
    }));
  const serialized = subscription.toJSON();
  await request(`${PATH.notifications}/subscriptions`, {
    method: 'POST',
    body: JSON.stringify({
      endpoint: serialized.endpoint,
      keys: serialized.keys,
    }),
  });
  localStorage.setItem(APP.notificationsKey, 'enabled');
  return 'Background reminders are enabled for this browser.';
}
/** Unsubscribe this browser and delete its server subscription before local cleanup.
 * @returns {Promise<void>} Opt-out confirmation. */
export async function disableReminders() {
  if (!environment.isDemo && 'serviceWorker' in navigator && 'PushManager' in window) {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await request(`${PATH.notifications}/subscriptions`, {
        method: 'DELETE',
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
    }
  }
  localStorage.removeItem(APP.notificationsKey);
}
