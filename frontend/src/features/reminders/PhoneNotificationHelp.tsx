import { useState } from 'react';
import { NOTIFICATIONS } from './notification.constants';
import { environment } from '../../app/config/environment';
/** Explain per-device phone enrollment and the server requirements without claiming cross-device preview sync.
 * @returns {JSX.Element} Phone setup guide. */
export function PhoneNotificationHelp() {
  const [copied, setCopied] = useState('');
  const { origin } = window.location;
  const canShare =
    window.location.protocol === 'https:' && !NOTIFICATIONS.loopback.some((host) => host === window.location.hostname);
  /** Copy only this app's origin for use on a separately opted-in phone.
   * @returns {Promise<void>} Clipboard feedback. */
  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(origin);
      setCopied('Address copied. Open it on your phone.');
    } catch {
      setCopied(`Open ${origin} on your phone.`);
    }
  }
  return (
    <details className="phone-notification-help">
      <summary>Set up notifications on my phone</summary>
      {canShare ? (
        <div>
          <p>
            App address: <code>{origin}</code>
          </p>
          <button
            className="button secondary"
            onClick={() => void copyAddress()}
          >
            Copy app address
          </button>
          {copied && <output className="settings-feedback">{copied}</output>}
        </div>
      ) : (
        <p>This address is local to this device or uses HTTP. Configure a reachable HTTPS address for phone setup.</p>
      )}
      <ol>
        <li>Open the same self-hosted Folio HTTPS address on your phone. It must reach your Pi’s server.</li>
        <li>
          On iPhone/iPad (iOS 16.4+), use Share → Add to Home Screen, then open Folio from that icon. On Android, use a
          browser that supports Web Push; installing Folio is optional.
        </li>
        <li>Open Settings → Browser & phone notifications, tap Enable this device and allow notifications.</li>
        <li>Tap Send test notification. Enable your computer separately to receive reminders on both devices.</li>
      </ol>
      <p>
        Keep the server running. OS notification settings, Focus and battery controls can delay or suppress display.
        Notifications contain no payee names or amounts.
      </p>
      {environment.isDemo && (
        <p>
          This hosted preview stores a separate workspace on each device and sends reminders only while open. Use the
          self-hosted server for shared data and background phone reminders.
        </p>
      )}
    </details>
  );
}
