import type { useNotificationDevice } from './useNotificationDevice';
/** Show current-device state and explicit permission, test and refresh actions.
 * @param {ReturnType<typeof useNotificationDevice>} device - Current setup state.
 * @returns {JSX.Element} Device controls and accurate feedback. */
export function NotificationDeviceControls({ device }: { device: ReturnType<typeof useNotificationDevice> }) {
  const { status } = device;
  const disconnect = Boolean(status?.hasSubscription || status?.isEnabled);
  return (
    <div className="notification-device">
      <dl>
        <div>
          <dt>This device</dt>
          <dd>{!status ? 'Checking…' : status.isEnabled ? 'Enabled' : 'Not enabled'}</dd>
        </div>
        <div>
          <dt>Browser permission</dt>
          <dd>{status?.permission ?? 'Checking…'}</dd>
        </div>
        <div>
          <dt>Server registrations</dt>
          <dd>{status?.configuration.subscriptions ?? 'Checking…'}</dd>
        </div>
      </dl>
      {status?.blocker && <p className="settings-feedback">{status.blocker}</p>}
      {status?.hasSubscription && !status.registered && (
        <p>The browser subscription is not saved on this server. Disconnect it, then enable this device again.</p>
      )}
      <div className="settings-actions">
        <button
          className="button primary"
          disabled={device.busy || !status || (!disconnect && Boolean(status.blocker))}
          onClick={() => void device.perform('toggle')}
        >
          {device.busy ? 'Working…' : disconnect ? 'Disconnect this device' : 'Enable this device'}
        </button>
        <button
          className="button secondary"
          disabled={device.busy || !status?.isEnabled}
          onClick={() => void device.perform('test')}
        >
          Send test notification
        </button>
        <button
          className="button secondary"
          disabled={device.busy}
          onClick={() => void device.perform('refresh')}
        >
          Refresh device status
        </button>
      </div>
      {device.message && <output className="settings-feedback">{device.message}</output>}
      {device.error && (
        <p
          className="error-message"
          role="alert"
        >
          {device.error}
        </p>
      )}
    </div>
  );
}
