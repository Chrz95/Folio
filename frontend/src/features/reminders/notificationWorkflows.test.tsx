// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReminderSettings } from './ReminderSettings';
import { request } from '../../lib/api/client';
vi.mock('../../app/config/environment', () => ({ environment: { isDemo: false } }));
vi.mock('../../app/WorkspaceContext', () => ({
  useWorkspace: () => ({ data: { accounts: [], recurring: [], transactions: [], budgets: [] } }),
}));
vi.mock('../../lib/api/client', () => ({ request: vi.fn() }));
const config = { enabled: true, publicKey: 'AQID', subscriptions: 0 };
const endpoint = 'https://fcm.googleapis.com/fcm/send/ui-device';
let subscribed = false;
let registered = false;
const permission = vi.fn();
const subscription = {
  endpoint,
  options: {},
  toJSON: () => ({ endpoint, keys: { p256dh: 'key', auth: 'auth' } }),
  unsubscribe: async () => {
    subscribed = false;
    return true;
  },
};
const registration = {
  pushManager: {
    getSubscription: async () => (subscribed ? subscription : null),
    subscribe: async () => {
      subscribed = true;
      return subscription;
    },
  },
};
beforeEach(() => {
  subscribed = false;
  registered = false;
  config.enabled = true;
  localStorage.clear();
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('PushManager', class {});
  permission.mockReset().mockImplementation(async () => {
    Object.defineProperty(Notification, 'permission', { configurable: true, value: 'granted' });
    return 'granted';
  });
  vi.stubGlobal(
    'Notification',
    class {
      static permission = 'default';
      static requestPermission = permission;
    },
  );
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve(registration),
      getRegistration: async () => registration,
    },
  });
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false }) });
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Desktop test browser' });
  vi.mocked(request)
    .mockReset()
    .mockImplementation(async (path, options) => {
      if (path.endsWith('/config')) {
        return { ...config, subscriptions: registered ? 1 : 0 };
      }
      if (path.endsWith('/status')) {
        return { registered };
      }
      if (path.endsWith('/subscriptions')) {
        registered = options?.method !== 'DELETE';
        return { subscribed: registered };
      }
      return { accepted: true };
    });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});
/** Render the actual setup controls and subscription service with only the browser/provider boundary simulated.
 * @returns {Promise<HTMLElement>} Ready permission button. */
async function setup() {
  render(
    <MemoryRouter>
      <ReminderSettings />
    </MemoryRouter>,
  );
  const button = await screen.findByRole('button', { name: 'Enable this device' });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}
describe('browser and phone setup interactions', () => {
  it('never prompts on load, enrolls on click, sends a current-device test and disconnects', async () => {
    const button = await setup();
    expect(permission).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(permission).toHaveBeenCalledOnce();
    await screen.findByRole('button', { name: 'Disconnect this device' });
    const test = screen.getByRole('button', { name: 'Send test notification' });
    expect(test).toBeEnabled();
    fireEvent.click(test);
    await screen.findByText(/push provider accepted the test/);
    expect(request).toHaveBeenCalledWith(
      '/notifications/test',
      expect.objectContaining({ body: JSON.stringify({ endpoint }) }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect this device' }));
    await screen.findByRole('button', { name: 'Enable this device' });
    expect(subscribed).toBe(false);
  });
  it('shows actionable HTTPS and phone guidance while keeping permission requests disabled', async () => {
    vi.stubGlobal('isSecureContext', false);
    render(
      <MemoryRouter>
        <ReminderSettings />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/HTTP address on your Pi/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enable this device' })).toBeDisabled();
    fireEvent.click(screen.getByText('Set up notifications on my phone'));
    expect(screen.getByText(/iPhone\/iPad/)).toBeVisible();
    expect(permission).not.toHaveBeenCalled();
  });
  it('refreshes server capability after VAPID setup without requesting permission automatically', async () => {
    config.enabled = false;
    render(
      <MemoryRouter>
        <ReminderSettings />
      </MemoryRouter>,
    );
    await screen.findByText(/Configure VAPID keys on your server/);
    expect(screen.getByRole('button', { name: 'Enable this device' })).toBeDisabled();
    config.enabled = true;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh device status' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enable this device' })).toBeEnabled());
    expect(permission).not.toHaveBeenCalled();
  });
  it('keeps a provider failure visible without falsely reporting that a notification was displayed', async () => {
    fireEvent.click(await setup());
    await screen.findByRole('button', { name: 'Disconnect this device' });
    const previous = vi.mocked(request).getMockImplementation()!;
    vi.mocked(request).mockImplementation(async (path, options) => {
      if (path.endsWith('/test')) {
        throw new Error('Provider unavailable');
      }
      return previous(path, options);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send test notification' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Provider unavailable');
    expect(screen.queryByText(/push provider accepted the test/)).not.toBeInTheDocument();
  });
});
