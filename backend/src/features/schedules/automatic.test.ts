import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { openDatabase } from '../../db/client.js';
import type { DatabaseClient } from '../../db/client.js';
import { applyMigrations } from '../../db/migrations.js';
import { createApp } from '../../app/createApp.js';
import { loadEnvironment } from '../../app/config/environment.js';
import { createLogger } from '../../lib/logger/logger.js';
import { accounts, recurring, transactions } from '../../db/schema/budget.js';
import { createBudgetRepository } from '../budget/budget.repository.js';
import { createBudgetService } from '../budget/budget.service.js';
import { patchScheduleControls } from './scheduleControls.repository.js';
import { runAutomaticConfirmation } from './automaticConfirmation.js';
import { startAutomaticWorker } from './automatic.worker.js';
import { createScheduleRepository } from './schedule.repository.js';
import { createScheduleService } from './schedule.service.js';
import { workspaceSnapshot } from '../receipts/workspaceSnapshot.js';
import { pauseImportedSchedules } from '../workspace/workspaceImportPlan.js';
import { workspaceSchema } from '../workspace/backupSchema.js';
const root = resolve('.test-data');
const accountId = '11111111-1111-4111-8111-111111111111';
const recurringId = '22222222-2222-4222-8222-222222222222';
const rule = {
  id: recurringId,
  name: 'Automatic bill',
  amount: 1200,
  type: 'expense' as const,
  category: 'Housing',
  accountId,
  destinationAccountId: null,
  date: '2026-01-31',
  notes: 'Retain notes',
  frequency: 'monthly' as const,
  reminderDays: 2,
};
let client: DatabaseClient;
let directory: string;
beforeEach(() => {
  mkdirSync(root, { recursive: true });
  directory = mkdtempSync(join(root, 'automatic-'));
  client = openDatabase({ filePath: join(directory, 'app.sqlite'), busyTimeout: 0 }, true);
  applyMigrations(client);
  client.database.insert(accounts).values({ id: accountId, name: 'Everyday', openingBalance: 100000 }).run();
  client.database.insert(recurring).values(rule).run();
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date('2026-02-28T12:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  if (client.sqlite.open) {
    client.sqlite.close();
  }
  if (directory === root || relative(root, directory).startsWith('..')) {
    throw new Error('Unsafe cleanup');
  }
  rmSync(directory, { recursive: true, force: true });
});
/** Call the scanner at a deterministic instant. @param {string} day - Date/time.
 * @returns {number} Newly posted occurrences. */
function scan(day: string) {
  return runAutomaticConfirmation(client, Date.parse(day));
}
describe('opt-in automatic confirmation on durable SQLite', () => {
  it('defaults to manual and starts at activation, retaining clamped dates, skips and inclusive endings', () => {
    expect(scan('2026-05-31T12:00:00Z')).toBe(0);
    patchScheduleControls(client, recurringId, { autoConfirm: true, endDate: '2026-04-30' });
    createScheduleService(createScheduleRepository(client)).setSkipped({
      recurringId,
      date: '2026-03-31',
      isSkipped: true,
    });
    expect(scan('2026-02-27T12:00:00Z')).toBe(0);
    expect(scan('2026-05-31T12:00:00Z')).toBe(2);
    const rows = client.database.select().from(transactions).all();
    expect(rows.map((row) => row.date)).toEqual(['2026-02-28', '2026-04-30']);
    expect(rows.every((row) => row.amount === rule.amount && row.notes === rule.notes)).toBe(true);
    createBudgetService(createBudgetRepository(client)).payOccurrence(recurringId, '2026-02-28');
    expect(scan('2026-05-31T12:00:00Z')).toBe(0);
    const path = join(directory, 'app.sqlite');
    client.sqlite.close();
    client = openDatabase({ filePath: path, busyTimeout: 0 });
    expect(scan('2026-05-31T12:00:00Z')).toBe(0);
    expect(client.database.select().from(transactions).all()).toHaveLength(2);
  });
  it('preserves settings on old writes, pauses completely, and restarts today when explicitly resumed', () => {
    patchScheduleControls(client, recurringId, { autoConfirm: true });
    const service = createScheduleService(createScheduleRepository(client));
    service.saveSettings({ recurringId, isPaused: true, endDate: null });
    expect(scan('2026-03-31T12:00:00Z')).toBe(0);
    vi.setSystemTime(new Date('2026-04-30T12:00:00Z'));
    service.saveSettings({ recurringId, isPaused: false, endDate: null });
    expect(scan('2026-04-30T12:00:00Z')).toBe(1);
    expect(
      client.database
        .select()
        .from(transactions)
        .all()
        .map((row) => row.date),
    ).toEqual(['2026-04-30']);
    patchScheduleControls(client, recurringId, { autoConfirm: false });
    expect(scan('2026-05-31T12:00:00Z')).toBe(0);
    expect(workspaceSnapshot(client).scheduleSettings[0]?.autoConfirm).toBeUndefined();
  });
  it('posts expense, income and transfer instances once with the same fields as manual confirmation', () => {
    const destination = '33333333-3333-4333-8333-333333333333';
    client.database.insert(accounts).values({ id: destination, name: 'Savings', openingBalance: 0 }).run();
    const service = createBudgetService(createBudgetRepository(client));
    for (const type of ['expense', 'income', 'transfer'] as const) {
      service.createRecurring({
        ...rule,
        name: type,
        type,
        date: '2026-02-28',
        frequency: 'once',
        destinationAccountId: type === 'transfer' ? destination : null,
        autoConfirm: true,
      });
    }
    expect(scan('2026-02-28T12:00:00Z')).toBe(3);
    expect(scan('2026-03-01T12:00:00Z')).toBe(0);
    const rows = client.database.select().from(transactions).all();
    expect(rows.map((row) => row.type).sort()).toEqual(['expense', 'income', 'transfer']);
    expect(rows.find((row) => row.type === 'transfer')?.destinationAccountId).toBe(destination);
  });
  it('rolls back the complete scan after a late insertion failure and retries without duplicates', () => {
    const service = createBudgetService(createBudgetRepository(client));
    for (const name of ['First', 'Second']) {
      service.createRecurring({ ...rule, name, date: '2026-02-28', frequency: 'once', autoConfirm: true });
    }
    client.sqlite.exec(
      "CREATE TRIGGER fail_auto BEFORE INSERT ON transactions WHEN NEW.name = 'Second' BEGIN SELECT RAISE(ABORT, 'fail'); END;",
    );
    expect(() => scan('2026-02-28T12:00:00Z')).toThrow();
    expect(client.database.select().from(transactions).all()).toEqual([]);
    client.sqlite.exec('DROP TRIGGER fail_auto');
    expect(scan('2026-02-28T12:00:00Z')).toBe(2);
    expect(scan('2026-02-28T12:00:00Z')).toBe(0);
  });
  it('uses the Athens calendar date near UTC midnight and stops its independent background worker', () => {
    vi.setSystemTime(new Date('2026-10-21T21:10:00Z'));
    createBudgetService(createBudgetRepository(client)).createRecurring({
      ...rule,
      date: '2026-10-22',
      frequency: 'weekly',
      autoConfirm: true,
    });
    const stop = startAutomaticWorker(client, createLogger('silent'));
    expect(client.database.select().from(transactions).all()).toHaveLength(1);
    vi.setSystemTime(new Date('2026-10-28T22:10:00Z'));
    vi.advanceTimersByTime(60000);
    expect(client.database.select().from(transactions).all()).toHaveLength(2);
    stop();
    vi.setSystemTime(new Date('2026-11-05T22:10:00Z'));
    vi.advanceTimersByTime(60000);
    expect(client.database.select().from(transactions).all()).toHaveLength(2);
  });
  it('exports automation settings but disables them on replacement import for review', () => {
    patchScheduleControls(client, recurringId, { autoConfirm: true });
    const exported = workspaceSchema.parse(workspaceSnapshot(client));
    expect(exported.scheduleSettings[0]).toMatchObject({ autoConfirm: true, autoConfirmFrom: '2026-02-28' });
    const imported = pauseImportedSchedules(exported);
    expect(imported.scheduleSettings[0]).toEqual({ recurringId, isPaused: true, endDate: null });
  });
  it('validates explicit boolean consent and rejects forged activation dates at the HTTP boundary', async () => {
    const app = createApp(client, loadEnvironment(), createLogger('silent'));
    await request(app)
      .put('/api/v1/schedules/settings')
      .send({ recurringId, isPaused: false, endDate: null, autoConfirm: 'yes' })
      .expect(400);
    await request(app)
      .put('/api/v1/schedules/settings')
      .send({ recurringId, isPaused: false, endDate: null, autoConfirm: true, autoConfirmFrom: '2000-01-01' })
      .expect(400);
    await request(app)
      .put('/api/v1/schedules/settings')
      .send({ recurringId, isPaused: false, endDate: null, autoConfirm: true })
      .expect(200);
    expect(createScheduleRepository(client).state().scheduleSettings[0]).toMatchObject({
      autoConfirm: true,
      autoConfirmFrom: '2026-02-28',
    });
  });
});
