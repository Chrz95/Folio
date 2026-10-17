// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createDemoSeed } from './demoSeed.constants';
import { readDemo, writeDemo } from '../../lib/storage/demoStore';
import { mutateBudget } from './budgetService';
import { editorOccurrences } from './editorOccurrences';
import { APP } from '../../constants/app.constants';
vi.mock('../../app/config/environment', () => ({ environment: { isDemo: true, apiBaseUrl: '/api/v1' } }));
beforeEach(() => {
  localStorage.clear();
  writeDemo(createDemoSeed());
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});
describe('counted browser persistence', () => {
  it('stores rule and ending in one write and retains the finite boundary through an export round-trip', async () => {
    const data = readDemo(),
      template = data.recurring[0]!;
    const input = { ...template, date: '2028-01-31', repetitions: 3, countFrom: '2028-01-31' };
    const writing = vi.spyOn(Storage.prototype, 'setItem');
    await mutateBudget('recurring', 'PUT', input, template.id);
    expect(writing).toHaveBeenCalledTimes(1);
    const saved = readDemo();
    expect(saved.recurring.find((row) => row.id === template.id)).not.toHaveProperty('repetitions');
    expect(saved.scheduleSettings).toContainEqual({ recurringId: template.id, isPaused: false, endDate: '2028-03-31' });
    const reopened = JSON.parse(JSON.stringify(saved));
    expect(
      editorOccurrences(
        reopened,
        reopened.recurring.find((row: { id: string }) => row.id === template.id)!,
      ).map((row) => row.date),
    ).toEqual(['2028-01-31', '2028-02-29', '2028-03-31']);
  });
  it('keeps pause and skips when ending changes and preserves data after a failed save', async () => {
    const data = readDemo(),
      template = data.recurring[0]!;
    template.date = '2028-01-31';
    template.frequency = 'monthly';
    data.scheduleSettings = [{ recurringId: template.id, isPaused: true, endDate: '2028-03-31' }];
    data.skippedOccurrences = [{ recurringId: template.id, date: '2028-02-29' }];
    writeDemo(data);
    const input = { ...template, repetitions: 3, countFrom: '2028-02-29' };
    const before = localStorage.getItem(APP.storageKey);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('Quota exceeded');
    });
    await expect(mutateBudget('recurring', 'PUT', input, template.id)).rejects.toThrow('Quota exceeded');
    expect(localStorage.getItem(APP.storageKey)).toBe(before);
    await mutateBudget('recurring', 'PUT', input, template.id);
    expect(readDemo().scheduleSettings).toEqual([{ recurringId: template.id, isPaused: true, endDate: '2028-04-30' }]);
    expect(readDemo().skippedOccurrences).toEqual(data.skippedOccurrences);
  });
});
