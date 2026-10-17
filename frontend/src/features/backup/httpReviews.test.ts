// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDemoSeed } from '../transactions/demoSeed.constants';
import { readDemo, writeDemo } from '../../lib/storage/demoStore';
import { reviewDeletion, deleteAllData } from './workspaceDeleteService';
import { reviewWorkspace, importWorkspace } from './workspaceImportService';
import { previewActual, commitActual } from '../actual/actualService';
import { convertActual } from '../actual/convertActual';
import { actualFixture } from '../../../../scripts/actualFixtures';
import { workspaceFixture } from '../../../../scripts/workspaceFixture';
import { parseBackup } from './backupService';
import { APP } from '../../constants/app.constants';
const configuration = vi.hoisted(() => ({ isDemo: true, apiBaseUrl: '/api/v1' }));
const api = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../../app/config/environment', () => ({ environment: configuration }));
vi.mock('../../lib/api/client', () => api);
beforeEach(() => {
  configuration.isDemo = true;
  api.request.mockReset();
  localStorage.clear();
  writeDemo(createDemoSeed());
  vi.stubGlobal('crypto', { getRandomValues: vi.fn() });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});
describe('HTTP browsers with crypto.subtle unavailable', () => {
  it.each([true, false])('keeps deletion consent and stale guards in demo=%s', async (isDemo) => {
    configuration.isDemo = isDemo;
    api.request.mockResolvedValue({ revision: 'a'.repeat(64), counts: [] });
    const before = localStorage.getItem(APP.storageKey);
    const review = await reviewDeletion();
    expect(review.localRevision).toMatch(/^[0-9a-f]{64}$/);
    expect(localStorage.getItem(APP.storageKey)).toBe(before);
    await expect(deleteAllData(review, 'delete', true)).rejects.toThrow(/exactly/);
    await expect(deleteAllData(review, 'DELETE', false)).rejects.toThrow(/Confirm/);
    localStorage.setItem(APP.preferencesKey, 'changed');
    await expect(deleteAllData(review, 'DELETE', true)).rejects.toThrow(/changed/);
    expect(localStorage.getItem(APP.storageKey)).toBe(before);
    const fresh = await reviewDeletion();
    expect(await deleteAllData(fresh, 'DELETE', true)).toBe(true);
    expect(readDemo().accounts).toEqual([]);
    if (!isDemo) {
      expect(api.request).toHaveBeenLastCalledWith('/workspace/delete/commit', {
        method: 'POST',
        body: JSON.stringify({ revision: 'a'.repeat(64), confirmation: 'DELETE', acknowledged: true }),
      });
    }
  });
  it('keeps the concurrent-tab guard during the fallback hashing await', async () => {
    const review = await reviewDeletion();
    const pending = deleteAllData(review, 'DELETE', true);
    localStorage.setItem(APP.preferencesKey, 'other tab');
    await expect(pending).rejects.toThrow(/changed/);
    expect(readDemo().transactions.length).toBeGreaterThan(0);
  });
  it('reviews and restores a workspace while rejecting a changed source', async () => {
    const source = parseBackup(JSON.stringify(workspaceFixture()));
    const review = await reviewWorkspace(source);
    const before = localStorage.getItem(APP.storageKey);
    const changed = structuredClone(source);
    changed.transactions[0]!.notes = 'Changed after review';
    await expect(importWorkspace(changed, review.revision)).rejects.toThrow(/changed/);
    expect(localStorage.getItem(APP.storageKey)).toBe(before);
    await importWorkspace(source, review.revision);
    expect(readDemo().transactions).toEqual(source.transactions);
    expect(readDemo().scheduleSettings?.every((setting) => setting.isPaused)).toBe(true);
  });
  it('reviews and merges Actual data while rejecting a changed destination', async () => {
    const source = convertActual(actualFixture(), JSON.stringify({ id: 'http-fixture', budgetName: 'Fixture' }));
    const review = await previewActual(source);
    const changed = readDemo();
    changed.accounts[0]!.name = 'Changed after review';
    writeDemo(changed);
    await expect(commitActual(source, review.revision)).rejects.toThrow(/changed/);
    expect(readDemo()).toEqual(changed);
    const fresh = await previewActual(source);
    await commitActual(source, fresh.revision);
    expect(readDemo().recurring.some((row) => row.id === source.recurring[0]!.id)).toBe(true);
  });
});
