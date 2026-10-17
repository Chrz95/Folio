// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { workspaceFixture } from '../../../../scripts/workspaceFixture';
import { createDemoSeed } from '../transactions/demoSeed.constants';
import { readDemo, writeDemo } from '../../lib/storage/demoStore';
import { APP } from '../../constants/app.constants';
import { REMINDER_STORAGE } from '../reminders/reminders.constants';
import { parseBackup } from './backupService';
import { reviewWorkspace, importWorkspace } from './workspaceImportService';
vi.mock('../../app/config/environment', () => ({ environment: { isDemo: true } }));
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('crypto', webcrypto);
  writeDemo(createDemoSeed());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});
describe('reviewed preview workspace import adapter', () => {
  it('reviews read-only, retains nonfinancial browser settings and pauses all imported schedules', async () => {
    const data = parseBackup(JSON.stringify(workspaceFixture()));
    const before = localStorage.getItem(APP.storageKey);
    localStorage.setItem(APP.notificationsKey, 'enabled');
    localStorage.setItem(REMINDER_STORAGE, 'retained');
    const review = await reviewWorkspace(data);
    expect(localStorage.getItem(APP.storageKey)).toBe(before);
    await importWorkspace(data, review.revision);
    expect(readDemo().transactions).toEqual(data.transactions);
    expect(readDemo().receipts).toEqual(data.receipts);
    expect(readDemo().scheduleSettings?.every((row) => row.isPaused)).toBe(true);
    expect(localStorage.getItem(APP.notificationsKey)).toBe('enabled');
    expect(localStorage.getItem(REMINDER_STORAGE)).toBe('retained');
  });
  it('rejects a changed source and destination before touching storage', async () => {
    const data = parseBackup(JSON.stringify(workspaceFixture()));
    const review = await reviewWorkspace(data);
    const before = localStorage.getItem(APP.storageKey);
    const changed = structuredClone(data);
    changed.transactions[0]!.notes = 'Changed source';
    await expect(importWorkspace(changed, review.revision)).rejects.toThrow(/workspace changed/);
    expect(localStorage.getItem(APP.storageKey)).toBe(before);
    const edited = readDemo();
    edited.transactions[0]!.notes = 'Late destination';
    writeDemo(edited);
    await expect(importWorkspace(data, review.revision)).rejects.toThrow(/workspace changed/);
    expect(readDemo()).toEqual(edited);
  });
  it('keeps the old snapshot on quota failure and permits a freshly reviewed retry', async () => {
    const data = parseBackup(JSON.stringify(workspaceFixture()));
    const review = await reviewWorkspace(data);
    const before = localStorage.getItem(APP.storageKey);
    const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('Quota full');
    });
    await expect(importWorkspace(data, review.revision)).rejects.toThrow('Quota full');
    expect(localStorage.getItem(APP.storageKey)).toBe(before);
    failure.mockRestore();
    const retry = await reviewWorkspace(data);
    await importWorkspace(data, retry.revision);
    expect(readDemo().accounts).toEqual(data.accounts);
  });
});
