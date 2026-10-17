import { NOTIFICATIONS } from './notification.constants';
/** Explain the next actionable requirement without requesting notification permission.
 * @param {boolean} preview - Whether this build has only foreground reminders.
 * @returns {string} Blocker or empty text. */
export function notificationBlocker(preview: boolean): string {
  if (!window.isSecureContext) {
    return 'Open Folio through HTTPS. An HTTP address on your Pi’s LAN cannot enable push.';
  }
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia?.(NOTIFICATIONS.standalone).matches ||
    ('standalone' in navigator && Boolean(navigator.standalone));
  if (isIos && !standalone) {
    return 'On iPhone or iPad, add Folio to the Home Screen, open it there, then enable notifications (iOS 16.4+).';
  }
  if (!('Notification' in window)) {
    return 'This browser does not support notifications. Try a supported browser.';
  }
  if (Notification.permission === 'denied') {
    return 'Notifications are blocked. Allow them in this browser’s site settings, then refresh device status.';
  }
  if (!preview && (!('serviceWorker' in navigator) || !('PushManager' in window))) {
    return 'This browser does not support background Web Push. Use a supported browser or the calendar export.';
  }
  return '';
}
/** Await a registered worker with a deadline instead of hanging forever on serviceWorker.ready.
 * @returns {Promise<ServiceWorkerRegistration>} Active app registration. */
export async function readyNotificationWorker(): Promise<ServiceWorkerRegistration> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('The app worker is not ready. Refresh Folio, wait for it to load, then try again.')),
          NOTIFICATIONS.workerTimeout,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
