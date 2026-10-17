import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import request from 'supertest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { openDatabase, verifySchema } from '../../db/client.js';
import type { DatabaseClient } from '../../db/client.js';
import { applyMigrations } from '../../db/migrations.js';
import { createApp } from '../../app/createApp.js';
import { loadEnvironment } from '../../app/config/environment.js';
import { createLogger } from '../../lib/logger/logger.js';
import { accounts, transactions, recurring } from '../../db/schema/budget.js';
import { importLinks, reconciliations } from '../../db/schema/operations.js';
import { createReminderRepository } from '../reminders/reminders.repository.js';
import { runReminderScan } from '../reminders/reminderDelivery.js';
import { createReminderStateRepository } from '../reminders/reminderState.repository.js';
import { DEFAULT_REMINDER_PREFERENCES } from '../reminders/reminders.constants.js';
const accountId = '11111111-1111-4111-8111-111111111111';
const destinationId = '22222222-2222-4222-8222-222222222222';
const row = {
  transaction: {
    name: 'Market',
    amount: 1000,
    type: 'expense',
    category: 'Groceries',
    accountId,
    destinationAccountId: null,
    date: '2026-10-16',
    notes: '',
  },
  bankId: 'bank-001',
};
let client: DatabaseClient;
let directory: string;
const testRoot = resolve('.test-data');
beforeEach(() => {
  mkdirSync(testRoot, { recursive: true });
  directory = mkdtempSync(join(testRoot, 'operations-'));
  client = openDatabase({ filePath: join(directory, 'test.sqlite'), busyTimeout: 0 }, true);
  applyMigrations(client);
  client.database
    .insert(accounts)
    .values([
      { id: accountId, name: 'Everyday', openingBalance: 100000 },
      { id: destinationId, name: 'Savings', openingBalance: 20000 },
    ])
    .run();
});
afterEach(() => {
  vi.useRealTimers();
  if (client.sqlite.open) {
    client.sqlite.close();
  }
  if (relative(testRoot, directory).startsWith('..') || directory === testRoot) {
    throw new Error('Unsafe cleanup');
  }
  rmSync(directory, { recursive: true, force: true });
});
/** Build a no-listener application for this disposable database. @returns {import('express').Express} Test app. */
function app() {
  return createApp(client, loadEnvironment(), createLogger('silent'));
}
describe('atomic bank imports', () => {
  it('previews repeated rows, imports once, clears the account and deduplicates retries', async () => {
    const preview = await request(app())
      .post('/api/v1/imports/preview')
      .send({ accountId, rows: [row, row] })
      .expect(200);
    expect(preview.body.data[0].action).toBe('new');
    expect(preview.body.data[1].isDuplicate).toBe(true);
    const payload = {
      accountId,
      rows: [
        { ...row, action: 'new' },
        { ...row, action: 'new' },
      ],
    };
    const first = await request(app()).post('/api/v1/imports/commit').send(payload).expect(200);
    expect(first.body.data).toEqual({ imported: 1, matched: 0, skipped: 1 });
    const retry = await request(app()).post('/api/v1/imports/commit').send(payload).expect(200);
    expect(retry.body.data).toEqual({ imported: 0, matched: 0, skipped: 2 });
    const state = await request(app()).get('/api/v1/reconciliation').expect(200);
    expect(state.body.data.clearances).toHaveLength(1);
    expect(client.database.select().from(transactions).all()).toHaveLength(1);
  });
  it('matches both bank sides of an existing transfer without turning it into income or expense', async () => {
    const created = await request(app())
      .post('/api/v1/transactions')
      .send({
        ...row.transaction,
        name: 'Savings transfer',
        category: 'Savings',
        type: 'transfer',
        destinationAccountId: destinationId,
      })
      .expect(201);
    const { id } = created.body.data as { id: string };
    await request(app())
      .post('/api/v1/imports/commit')
      .send({ accountId, rows: [{ ...row, action: 'match', matchId: id }] })
      .expect(200);
    const incoming = {
      ...row,
      bankId: 'bank-destination',
      transaction: { ...row.transaction, accountId: destinationId, type: 'income' },
    };
    const preview = await request(app())
      .post('/api/v1/imports/preview')
      .send({ accountId: destinationId, rows: [incoming] });
    expect(preview.body.data[0].matchId).toBe(id);
    await request(app())
      .post('/api/v1/imports/commit')
      .send({ accountId: destinationId, rows: [{ ...incoming, action: 'match', matchId: id }] })
      .expect(200);
    const ledger = client.database.select().from(transactions).all();
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.type).toBe('transfer');
    const metadata = await request(app()).get('/api/v1/reconciliation');
    expect(metadata.body.data.clearances).toHaveLength(2);
  });
  it('rolls back the entire file on a stale match', async () => {
    await request(app())
      .post('/api/v1/imports/commit')
      .send({
        accountId,
        rows: [
          { ...row, action: 'new' },
          { ...row, bankId: 'bank-002', action: 'match', matchId: crypto.randomUUID() },
        ],
      })
      .expect(409);
    expect(client.database.select().from(transactions).all()).toHaveLength(0);
    expect(client.database.select().from(importLinks).all()).toHaveLength(0);
  });
  it('rejects forged accounts, invalid amounts and oversized batches before persistence', async () => {
    await request(app())
      .post('/api/v1/imports/preview')
      .send({ accountId: destinationId, rows: [row] })
      .expect(400);
    await request(app())
      .post('/api/v1/imports/commit')
      .send({ accountId, rows: [{ ...row, transaction: { ...row.transaction, amount: 0 }, action: 'new' }] })
      .expect(400);
    await request(app())
      .post('/api/v1/imports/preview')
      .send({ accountId, rows: Array.from({ length: 501 }, () => row) })
      .expect(400);
  });
});
describe('statement reconciliation integrity', () => {
  it('requires an exact cleared balance and protects reconciled entries until undo', async () => {
    const entry = await request(app()).post('/api/v1/transactions').send(row.transaction).expect(201);
    const { id } = entry.body.data as { id: string };
    await request(app())
      .put('/api/v1/reconciliation/clearance')
      .send({ accountId, transactionId: id, isCleared: true })
      .expect(204);
    await request(app())
      .post('/api/v1/reconciliation')
      .send({ accountId, date: '2026-10-16', statementBalance: 100000 })
      .expect(409);
    const statement = await request(app())
      .post('/api/v1/reconciliation')
      .send({ accountId, date: '2026-10-16', statementBalance: 99000 })
      .expect(201);
    await request(app()).delete(`/api/v1/transactions/${id}`).expect(409);
    await request(app())
      .put(`/api/v1/transactions/${id}`)
      .send({ ...row.transaction, name: 'Changed' })
      .expect(409);
    await request(app())
      .put('/api/v1/reconciliation/clearance')
      .send({ accountId, transactionId: id, isCleared: false })
      .expect(409);
    await request(app()).delete(`/api/v1/reconciliation/${statement.body.data.id}`).expect(204);
    const metadata = await request(app()).get('/api/v1/reconciliation');
    expect(metadata.body.data.clearances[0].reconciliationId).toBeNull();
    await request(app()).delete(`/api/v1/transactions/${id}`).expect(204);
  });
  it('keeps transfer clearing independent across accounts and refuses unrelated account legs', async () => {
    const transfer = await request(app())
      .post('/api/v1/transactions')
      .send({ ...row.transaction, type: 'transfer', destinationAccountId: destinationId })
      .expect(201);
    const { id } = transfer.body.data as { id: string };
    await request(app())
      .put('/api/v1/reconciliation/clearance')
      .send({ accountId, transactionId: id, isCleared: true })
      .expect(204);
    const metadata = await request(app()).get('/api/v1/reconciliation');
    expect(metadata.body.data.clearances.map((entry: { accountId: string }) => entry.accountId)).toEqual([accountId]);
    await request(app())
      .put('/api/v1/reconciliation/clearance')
      .send({ accountId: crypto.randomUUID(), transactionId: id, isCleared: true })
      .expect(404);
  });
  it('permits chronological statements and only undoes the latest one', async () => {
    const first = await request(app())
      .post('/api/v1/reconciliation')
      .send({ accountId, date: '2026-10-16', statementBalance: 100000 })
      .expect(201);
    const second = await request(app())
      .post('/api/v1/reconciliation')
      .send({ accountId, date: '2026-10-17', statementBalance: 100000 })
      .expect(201);
    await request(app()).delete(`/api/v1/reconciliation/${first.body.data.id}`).expect(409);
    await request(app())
      .post('/api/v1/reconciliation')
      .send({ accountId, date: '2026-10-16', statementBalance: 100000 })
      .expect(409);
    await request(app()).delete(`/api/v1/reconciliation/${second.body.data.id}`).expect(204);
    expect(client.database.select().from(reconciliations).all()).toHaveLength(1);
  });
});
describe('timezone preferences and durable reminders', () => {
  it('validates timezones, time formats and overdue bounds', async () => {
    await request(app())
      .put('/api/v1/notifications/preferences')
      .send({ ...DEFAULT_REMINDER_PREFERENCES, timeZone: 'Mars/Olympus' })
      .expect(400);
    await request(app())
      .put('/api/v1/notifications/preferences')
      .send({ ...DEFAULT_REMINDER_PREFERENCES, deliveryTime: '25:00' })
      .expect(400);
    await request(app())
      .put('/api/v1/notifications/preferences')
      .send({ ...DEFAULT_REMINDER_PREFERENCES, overdueDays: 31 })
      .expect(400);
    await request(app())
      .put('/api/v1/notifications/preferences')
      .send({ ...DEFAULT_REMINDER_PREFERENCES, timeZone: 'America/New_York', mode: 'digest' })
      .expect(204);
    expect((await request(app()).get('/api/v1/notifications/state')).body.data.preferences.timeZone).toBe(
      'America/New_York',
    );
  });
  it('snoozes only valid unpaid occurrences and retains the financial due date', async () => {
    const template = await request(app())
      .post('/api/v1/recurring')
      .send({ ...row.transaction, frequency: 'monthly', reminderDays: 2 })
      .expect(201);
    const { id } = template.body.data as { id: string };
    await request(app())
      .post('/api/v1/notifications/snooze')
      .send({ recurringId: id, date: '2026-10-17', minutes: 60 })
      .expect(400);
    await request(app())
      .post('/api/v1/notifications/snooze')
      .send({ recurringId: id, date: '2026-10-16', minutes: 60 })
      .expect(204);
    const state = await request(app()).get('/api/v1/notifications/state');
    expect(state.body.data.snoozes[0].until).toBeGreaterThan(Date.now());
    expect(client.database.select().from(recurring).get()?.date).toBe('2026-10-16');
    await request(app()).post(`/api/v1/recurring/${id}/pay`).send({ date: '2026-10-16' }).expect(200);
    await request(app())
      .post('/api/v1/notifications/snooze')
      .send({ recurringId: id, date: '2026-10-16', minutes: 60 })
      .expect(400);
  });
  it('persists send acknowledgments and does not send a successful job twice', async () => {
    client.database
      .insert(recurring)
      .values({
        ...row.transaction,
        type: 'expense',
        id: crypto.randomUUID(),
        frequency: 'once',
        reminderDays: 2,
        date: '2026-10-18',
      })
      .run();
    createReminderRepository(client).save({
      endpoint: 'https://fcm.googleapis.com/test',
      p256dh: 'test-key',
      auth: 'test-auth',
    });
    const send = vi.fn().mockResolvedValue({ statusCode: 201, body: '', headers: {} });
    const now = Date.parse('2026-10-16T07:00:00Z');
    await runReminderScan(client, createLogger('silent'), now, send);
    await runReminderScan(client, createLogger('silent'), now, send);
    expect(send).toHaveBeenCalledOnce();
    expect(createReminderStateRepository(client).history()[0]?.status).toBe('sent');
    const path = join(directory, 'test.sqlite');
    client.sqlite.close();
    client = openDatabase({ filePath: path, busyTimeout: 0 });
    await runReminderScan(client, createLogger('silent'), now, send);
    expect(send).toHaveBeenCalledOnce();
  });
  it('records failed delivery and bounds retry frequency and total attempts', async () => {
    client.database
      .insert(recurring)
      .values({
        ...row.transaction,
        type: 'expense',
        id: crypto.randomUUID(),
        frequency: 'once',
        reminderDays: 2,
        date: '2026-10-18',
      })
      .run();
    createReminderRepository(client).save({
      endpoint: 'https://fcm.googleapis.com/test',
      p256dh: 'test-key',
      auth: 'test-auth',
    });
    const send = vi.fn().mockRejectedValue(new Error('Provider unavailable'));
    const now = Date.parse('2026-10-16T07:00:00Z');
    await runReminderScan(client, createLogger('silent'), now, send);
    await runReminderScan(client, createLogger('silent'), now + 1000, send);
    expect(send).toHaveBeenCalledOnce();
    await runReminderScan(client, createLogger('silent'), now + 900000, send);
    await runReminderScan(client, createLogger('silent'), now + 1800000, send);
    await runReminderScan(client, createLogger('silent'), now + 2700000, send);
    expect(send).toHaveBeenCalledTimes(3);
    expect(createReminderStateRepository(client).history()[0]?.status).toBe('failed');
  });
});
it('upgrades a populated v1 SQLite file without changing money or recurring links', () => {
  const folder = join(directory, 'v1-migrations');
  mkdirSync(join(folder, 'meta'), { recursive: true });
  const original = 'backend/src/db/migrations';
  const journal = JSON.parse(readFileSync(join(original, 'meta/_journal.json'), 'utf8'));
  const [initial] = journal.entries;
  writeFileSync(join(folder, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: [initial] }));
  copyFileSync(join(original, `${initial.tag}.sql`), join(folder, `${initial.tag}.sql`));
  const legacy = openDatabase({ filePath: join(directory, 'legacy.sqlite'), busyTimeout: 0 }, true);
  try {
    migrate(legacy.database, { migrationsFolder: folder });
    legacy.database.insert(accounts).values({ id: accountId, name: 'Legacy account', openingBalance: 123456 }).run();
    const recurringId = crypto.randomUUID();
    const transactionId = crypto.randomUUID();
    legacy.database
      .insert(recurring)
      .values({ ...row.transaction, type: 'expense', id: recurringId, frequency: 'monthly', reminderDays: 2 })
      .run();
    legacy.database
      .insert(transactions)
      .values({ ...row.transaction, type: 'expense', id: transactionId, recurringId, createdAt: 0 })
      .run();
    applyMigrations(legacy);
    verifySchema(legacy);
    expect(legacy.database.select().from(accounts).get()?.openingBalance).toBe(123456);
    expect(legacy.database.select().from(transactions).get()?.recurringId).toBe(recurringId);
    expect(legacy.sqlite.pragma('foreign_key_check')).toEqual([]);
  } finally {
    legacy.sqlite.close();
  }
});
