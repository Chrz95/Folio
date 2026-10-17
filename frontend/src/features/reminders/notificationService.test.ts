// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { APP } from '../../constants/app.constants';
import { NOTIFICATIONS } from './notification.constants';
import { enableReminders, disableReminders, loadNotificationStatus, testNotification } from './notificationService';
import { readyNotificationWorker } from './notificationCapabilities';
import { request } from '../../lib/api/client';
const mode = vi.hoisted(() => ({ isDemo: false }));
vi.mock('../../app/config/environment', () => ({ environment: mode }));
vi.mock('../../lib/api/client', () => ({ request: vi.fn() }));
const config = { enabled: true, publicKey: 'AQID', subscriptions: 2 };
const endpoint = 'https://fcm.googleapis.com/fcm/send/current-device';
const subscription = {
  endpoint,
  options: { applicationServerKey: new Uint8Array([1, 2, 3]).buffer },
  toJSON: vi.fn(() => ({ endpoint, keys: { p256dh: 'key', auth: 'auth' } })),
  unsubscribe: vi.fn(async () => true),
};
const registration = { pushManager: { getSubscription: vi.fn(), subscribe: vi.fn() }, showNotification: vi.fn() };
const permission = vi.fn();
beforeEach(() => {
  mode.isDemo = false;
  localStorage.clear();
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('PushManager', class {});
  vi.stubGlobal(
    'Notification',
    class {
      static permission = 'default';
      static requestPermission = permission;
    },
  );
  permission.mockReset().mockResolvedValue('granted');
  registration.pushManager.getSubscription.mockReset().mockResolvedValue(null);
  registration.pushManager.subscribe.mockReset().mockResolvedValue(subscription);
  registration.showNotification.mockReset().mockResolvedValue(undefined);
  subscription.unsubscribe.mockClear();
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve(registration),
      getRegistration: vi.fn(async () => registration),
    },
  });
  vi.mocked(request)
    .mockReset()
    .mockImplementation(async (path) => (path.endsWith('/config') ? config : { registered: true }));
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Desktop test browser' });
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false })) });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
});
describe('explicit per-device notification enrollment', () => {
  it('requests permission before awaiting network work and registers the device', async () => {
    const pending = enableReminders(config);
    expect(permission).toHaveBeenCalledOnce();
    expect(request).not.toHaveBeenCalled();
    await expect(pending).resolves.toContain('registered');
    expect(registration.pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([1, 2, 3]),
    });
    expect(request).toHaveBeenCalledWith('/notifications/subscriptions', expect.objectContaining({ method: 'POST' }));
    expect(localStorage.getItem(APP.notificationsKey)).toBe('enabled');
  });
  it('ignores stale local flags when checking actual registration', async () => {
    localStorage.setItem(APP.notificationsKey, 'enabled');
    expect((await loadNotificationStatus()).isEnabled).toBe(false);
    expect(permission).not.toHaveBeenCalled();
    Object.defineProperty(Notification, 'permission', { value: 'granted' });
    registration.pushManager.getSubscription.mockResolvedValue(subscription);
    expect((await loadNotificationStatus()).isEnabled).toBe(true);
    vi.mocked(request).mockImplementation(async (path) => (path.endsWith('/config') ? config : { registered: false }));
    const status = await loadNotificationStatus();
    expect(status.isEnabled).toBe(false);
    expect(status.hasSubscription).toBe(true);
  });
  it('explains insecure HTTP, denied permission, missing VAPID and iPhone home-screen requirements', async () => {
    vi.stubGlobal('isSecureContext', false);
    await expect(enableReminders(config)).rejects.toThrow(/HTTPS/);
    expect(permission).not.toHaveBeenCalled();
    vi.stubGlobal('isSecureContext', true);
    Object.defineProperty(Notification, 'permission', { configurable: true, value: 'denied' });
    await expect(enableReminders(config)).rejects.toThrow(/blocked/);
    Object.defineProperty(Notification, 'permission', { configurable: true, value: 'default' });
    await expect(enableReminders({ ...config, enabled: false })).rejects.toThrow(/VAPID/);
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'iPhone' });
    await expect(enableReminders(config)).rejects.toThrow(/Home Screen/);
    expect(permission).not.toHaveBeenCalled();
  });
  it('does not mark permission denial or server-save failure as a successful enrollment', async () => {
    permission.mockResolvedValueOnce('denied');
    await expect(enableReminders(config)).rejects.toThrow(/not allowed/);
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
    vi.mocked(request).mockRejectedValueOnce(new Error('Server unavailable'));
    await expect(enableReminders(config)).rejects.toThrow('Server unavailable');
    expect(localStorage.getItem(APP.notificationsKey)).toBeNull();
  });
  it('disconnects only the current device and sends tests only to its registered endpoint', async () => {
    Object.defineProperty(Notification, 'permission', { value: 'granted' });
    registration.pushManager.getSubscription.mockResolvedValue(subscription);
    await expect(testNotification()).resolves.toContain('provider accepted');
    expect(request).toHaveBeenCalledWith('/notifications/test', { method: 'POST', body: JSON.stringify({ endpoint }) });
    localStorage.setItem(APP.notificationsKey, 'enabled');
    await disableReminders();
    expect(request).toHaveBeenCalledWith('/notifications/subscriptions', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint }),
    });
    expect(subscription.unsubscribe).toHaveBeenCalledOnce();
    expect(localStorage.getItem(APP.notificationsKey)).toBeNull();
  });
  it('uses service-worker notification display for preview tests on mobile without calling the server', async () => {
    mode.isDemo = true;
    Object.defineProperty(Notification, 'permission', { value: 'granted' });
    await expect(testNotification()).resolves.toContain('Test requested');
    expect(registration.showNotification).toHaveBeenCalledWith(
      NOTIFICATIONS.testTitle,
      expect.objectContaining({ body: NOTIFICATIONS.testBody }),
    );
    expect(request).not.toHaveBeenCalled();
  });
  it('times out an unready app worker rather than hanging the setup screen', async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: new Promise(() => undefined) },
    });
    const outcome = expect(readyNotificationWorker()).rejects.toThrow(/not ready/);
    await vi.advanceTimersByTimeAsync(NOTIFICATIONS.workerTimeout);
    await outcome;
  });
});
