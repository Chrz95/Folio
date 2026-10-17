// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, cleanup, render, screen } from '@testing-library/react';
import { useOnlineStatus } from './useOnlineStatus';
import { useInstallPrompt } from './useInstallPrompt';
import { InstallPrompt } from '../components/InstallPrompt';
import { PWA } from '../pwa.constants';
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('PWA interaction states', () => {
  it('updates offline feedback on real browser connectivity events', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);
  });
  it('captures install eligibility and invokes the browser prompt only after a user action', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const event = new Event('beforeinstallprompt', { cancelable: true });
    const prompt = vi.fn().mockResolvedValue(undefined);
    Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) });
    act(() => window.dispatchEvent(event));
    expect(result.current.canInstall).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
    await act(async () => result.current.install());
    expect(prompt).toHaveBeenCalledOnce();
  });
  it('remembers dismissals and suppresses repeated suggestions', () => {
    const { result } = renderHook(() => useInstallPrompt());
    act(() => result.current.dismiss());
    expect(Number(localStorage.getItem(PWA.dismissalKey))).toBeGreaterThan(0);
    render(<InstallPrompt />);
    expect(screen.queryByText('Install Folio')).toBeNull();
  });
});
