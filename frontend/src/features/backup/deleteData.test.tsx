// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { webcrypto } from 'node:crypto';
import type { BudgetData } from '../../types/budget';
import { createDemoSeed } from '../transactions/demoSeed.constants';
import { readDemo, writeDemo } from '../../lib/storage/demoStore';
import { DeleteAllData } from './DeleteAllData';
import { reviewDeletion, deleteAllData } from './workspaceDeleteService';
import { APP } from '../../constants/app.constants';
import { REMINDER_STORAGE } from '../reminders/reminders.constants';
const workspace = vi.hoisted(() => ({
  data: {} as BudgetData,
  reload: vi.fn(),
  setNotice: vi.fn(),
  setError: vi.fn(),
}));
const configuration = vi.hoisted(() => ({ isDemo: true, apiBaseUrl: '/api/v1' }));
const api = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../../app/config/environment', () => ({ environment: configuration }));
vi.mock('../../lib/api/client', () => api);
vi.mock('../../app/WorkspaceContext', () => ({ useWorkspace: () => workspace }));
beforeEach(() => {
  configuration.isDemo = true;
  api.request.mockReset();
  localStorage.clear();
  vi.stubGlobal('crypto', webcrypto);
  workspace.data = createDemoSeed();
  writeDemo(workspace.data);
  workspace.reload.mockImplementation(async () => {
    workspace.data = readDemo();
  });
  workspace.setNotice.mockClear();
  workspace.setError.mockClear();
  HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.open = true;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});
describe('complete deletion in the browser', () => {
  it('does nothing on opening/cancel, and requires both a checkbox and exact DELETE before clearing', async () => {
    localStorage.setItem(APP.preferencesKey, 'dark');
    localStorage.setItem(APP.notificationsKey, 'enabled');
    localStorage.setItem(REMINDER_STORAGE, '{}');
    localStorage.setItem('unrelated-app', 'keep');
    const before = localStorage.getItem(APP.storageKey);
    render(<DeleteAllData />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete all app data' }));
    await waitFor(() => expect(screen.getByLabelText('Type DELETE to confirm')).toBeEnabled());
    expect(localStorage.getItem(APP.storageKey)).toBe(before);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(APP.storageKey)).toBe(before);
    fireEvent.click(screen.getByRole('button', { name: 'Delete all app data' }));
    await waitFor(() => expect(screen.getByLabelText('Type DELETE to confirm')).toBeEnabled());
    const remove = screen.getByRole('button', { name: 'Delete all data permanently' });
    expect(remove).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value: 'DELETE' } });
    expect(remove).toBeDisabled();
    fireEvent.click(screen.getByLabelText('I understand that deleting all app data cannot be undone.'));
    for (const value of ['delete', 'DELETE ', ' DELETE']) {
      fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value } });
      expect(remove).toBeDisabled();
    }
    fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value: 'DELETE' } });
    fireEvent.click(remove);
    await waitFor(() => expect(readDemo().accounts).toHaveLength(0));
    expect(Object.values(readDemo()).every((rows) => Array.isArray(rows) && rows.length === 0)).toBe(true);
    expect(localStorage.getItem(APP.preferencesKey)).toBeNull();
    expect(localStorage.getItem(APP.notificationsKey)).toBeNull();
    expect(localStorage.getItem(REMINDER_STORAGE)).toBeNull();
    expect(localStorage.getItem('unrelated-app')).toBe('keep');
    expect(workspace.setNotice).toHaveBeenCalledWith('All app data deleted.');
  });
  it('rejects missing consent and stale reviews without deleting anything', async () => {
    const review = await reviewDeletion();
    const before = localStorage.getItem(APP.storageKey);
    await expect(deleteAllData(review, 'delete', true)).rejects.toThrow(/exactly/);
    await expect(deleteAllData(review, 'DELETE', false)).rejects.toThrow(/Confirm/);
    expect(localStorage.getItem(APP.storageKey)).toBe(before);
    localStorage.setItem(APP.preferencesKey, 'dark');
    await expect(deleteAllData(review, 'DELETE', true)).rejects.toThrow(/changed/);
    expect(localStorage.getItem(APP.storageKey)).toBe(before);
  });
  it('rejects another tab changing data while the confirmation revision is being hashed', async () => {
    const review = await reviewDeletion();
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    vi.spyOn(crypto.subtle, 'digest').mockImplementationOnce(async (algorithm, bytes) => {
      const hash = await digest(algorithm, bytes);
      const changed = readDemo();
      changed.accounts[0]!.name = 'Edited in another tab';
      writeDemo(changed);
      return hash;
    });
    await expect(deleteAllData(review, 'DELETE', true)).rejects.toThrow(/changed/);
    expect(readDemo().accounts[0]!.name).toBe('Edited in another tab');
    expect(readDemo().transactions.length).toBeGreaterThan(0);
  });
  it('keeps financial data and preferences when the primary write fails', async () => {
    localStorage.setItem(APP.preferencesKey, 'dark');
    const review = await reviewDeletion();
    const before = localStorage.getItem(APP.storageKey);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('Quota exceeded');
    });
    await expect(deleteAllData(review, 'DELETE', true)).rejects.toThrow('Quota exceeded');
    expect(localStorage.getItem(APP.storageKey)).toBe(before);
    expect(localStorage.getItem(APP.preferencesKey)).toBe('dark');
  });
  it('reports a preference cleanup failure separately after durable financial deletion', async () => {
    const review = await reviewDeletion();
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementationOnce(() => {
      throw new Error('Denied');
    });
    expect(await deleteAllData(review, 'DELETE', true)).toBe(false);
    expect(readDemo().accounts).toEqual([]);
  });
});

describe('self-hosted deletion boundary', () => {
  it('sends the actual typed word and acknowledgment with the server review revision', async () => {
    configuration.isDemo = false;
    api.request.mockResolvedValueOnce({ revision: 'a'.repeat(64), counts: [] }).mockResolvedValueOnce({ counts: [] });
    const review = await reviewDeletion();
    expect(api.request).toHaveBeenCalledWith('/workspace/delete/preview', { method: 'POST', body: '{}' });
    await expect(deleteAllData(review, 'delete', true)).rejects.toThrow();
    expect(api.request).toHaveBeenCalledTimes(1);
    await deleteAllData(review, 'DELETE', true);
    expect(JSON.parse(api.request.mock.calls[1]![1].body)).toEqual({
      revision: 'a'.repeat(64),
      confirmation: 'DELETE',
      acknowledged: true,
    });
    expect(readDemo().accounts).toEqual([]);
  });
  it('preserves all browser data when the server rejects deletion', async () => {
    configuration.isDemo = false;
    api.request
      .mockResolvedValueOnce({ revision: 'a'.repeat(64), counts: [] })
      .mockRejectedValueOnce(new Error('The app data changed.'));
    localStorage.setItem(APP.preferencesKey, 'dark');
    const review = await reviewDeletion();
    const before = localStorage.getItem(APP.storageKey);
    await expect(deleteAllData(review, 'DELETE', true)).rejects.toThrow(/changed/);
    expect(localStorage.getItem(APP.storageKey)).toBe(before);
    expect(localStorage.getItem(APP.preferencesKey)).toBe('dark');
  });
});
