import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { openDatabase, verifySchema } from '../../db/client.js';
import type { DatabaseClient } from '../../db/client.js';
import { applyMigrations } from '../../db/migrations.js';
import { parseDatabaseEnvironment, loadEnvironment } from '../../app/config/environment.js';
import { createApp } from '../../app/createApp.js';
import { createLogger } from '../../lib/logger/logger.js';
import { accounts, transactions } from '../../db/schema/budget.js';
import { occurrenceDate } from './recurrence.js';
const accountId = '11111111-1111-4111-8111-111111111111';
const destinationId = '22222222-2222-4222-8222-222222222222';
const fixture = {
  name: 'Groceries',
  amount: 1250,
  type: 'expense',
  category: 'Groceries',
  accountId,
  destinationAccountId: null,
  date: '2026-10-16',
  notes: '',
};
const settings = parseDatabaseEnvironment({
  DATABASE_FILE_PATH: './data/app.sqlite',
  TEST_DATABASE_DIRECTORY: './.test-data',
});
let client: DatabaseClient;
let directory: string;
/** Create a unique test-owned file beneath the dedicated test directory. */
beforeEach(() => {
  mkdirSync(settings.testDirectory, { recursive: true });
  directory = mkdtempSync(join(settings.testDirectory, 'budget-'));
  const path = resolve(directory, 'test.sqlite');
  if (path === settings.filePath || relative(settings.testDirectory, path).startsWith('..')) {
    throw new Error('Refusing unsafe test database path.');
  }
  client = openDatabase({ filePath: path, busyTimeout: 0 }, true);
  applyMigrations(client);
  client.database
    .insert(accounts)
    .values([
      { id: accountId, name: 'Everyday', openingBalance: 0 },
      { id: destinationId, name: 'Savings', openingBalance: 0 },
    ])
    .run();
});
afterEach(() => {
  if (client.sqlite.open) {
    client.sqlite.close();
  }
  if (relative(settings.testDirectory, directory).startsWith('..') || directory === settings.testDirectory) {
    throw new Error('Refusing unsafe cleanup.');
  }
  rmSync(directory, { recursive: true, force: true });
});
/** Construct the injectable HTTP app for this isolated file.
 * @returns {import('express').Express} Test application without a bound listener. */
function app() {
  return createApp(client, { ...loadEnvironment(), apiPrefix: '/api/v1' }, createLogger('silent'));
}
describe('SQLite-backed budget API', () => {
  it('applies migrations and verifies FK, WAL, FULL durability and lock timeout', () => {
    verifySchema(client);
    expect(client.sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(client.sqlite.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(client.sqlite.pragma('synchronous', { simple: true })).toBe(2);
    expect(client.sqlite.pragma('busy_timeout', { simple: true })).toBe(0);
  });
  it('provides consistent envelopes, security headers and a non-cacheable readiness check', async () => {
    const response = await request(app()).get('/api/v1/ready').expect(200);
    expect(response.body.data.status).toBe('ready');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-request-id']).toBeTruthy();
  });
  it('validates bodies and identifiers before persistence', async () => {
    const response = await request(app())
      .post('/api/v1/transactions')
      .send({ ...fixture, amount: -1 })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    await request(app()).put('/api/v1/transactions/not-an-id').send(fixture).expect(400);
    await request(app())
      .post('/api/v1/transactions')
      .send({ ...fixture, unexpected: true })
      .expect(400);
    expect(client.database.select().from(transactions).all()).toHaveLength(0);
  });
  it('creates, updates, paginates, deletes and persists after reopening the same file', async () => {
    const created = await request(app()).post('/api/v1/transactions').send(fixture).expect(201);
    const { id } = created.body.data;
    await request(app())
      .put(`/api/v1/transactions/${id}`)
      .send({ ...fixture, name: 'Market' })
      .expect(200);
    const page = await request(app()).get('/api/v1/transactions?limit=1&offset=0').expect(200);
    expect(page.body.meta.total).toBe(1);
    expect(page.body.data[0].name).toBe('Market');
    client.sqlite.close();
    client = openDatabase({ filePath: join(directory, 'test.sqlite'), busyTimeout: 0 });
    expect(client.database.select().from(transactions).all()).toHaveLength(1);
    await request(app()).delete(`/api/v1/transactions/${id}`).expect(204);
    await request(app()).delete(`/api/v1/transactions/${id}`).expect(404);
  });
  it('enforces foreign keys, nonnegative amounts and transfers at both boundaries', async () => {
    await request(app())
      .post('/api/v1/transactions')
      .send({ ...fixture, accountId: crypto.randomUUID() })
      .expect(409);
    await request(app())
      .post('/api/v1/transactions')
      .send({ ...fixture, type: 'transfer', destinationAccountId: accountId })
      .expect(400);
    const transfer = await request(app())
      .post('/api/v1/transactions')
      .send({ ...fixture, type: 'transfer', destinationAccountId: destinationId })
      .expect(201);
    expect(transfer.body.data.destinationAccountId).toBe(destinationId);
    expect(() =>
      client.database
        .insert(transactions)
        .values({ ...fixture, type: 'expense', amount: 0, id: crypto.randomUUID(), createdAt: 0 })
        .run(),
    ).toThrow();
  });
  it('posts valid occurrences once and preserves history after rule deletion', async () => {
    const rule = await request(app())
      .post('/api/v1/recurring')
      .send({ ...fixture, date: '2026-01-31', frequency: 'monthly', reminderDays: 2 })
      .expect(201);
    const { id } = rule.body.data;
    const first = await request(app()).post(`/api/v1/recurring/${id}/pay`).send({ date: '2026-02-28' }).expect(200);
    const duplicate = await request(app()).post(`/api/v1/recurring/${id}/pay`).send({ date: '2026-02-28' }).expect(200);
    expect(first.body.data.id).toBe(duplicate.body.data.id);
    await request(app()).post(`/api/v1/recurring/${id}/pay`).send({ date: '2026-02-27' }).expect(400);
    await request(app()).delete(`/api/v1/recurring/${id}`).expect(204);
    expect(client.database.select().from(transactions).get()?.recurringId).toBeNull();
  });
  it('rolls back failed multi-write operations without partial persistence', () => {
    expect(() =>
      client.database.transaction((database) => {
        database
          .insert(transactions)
          .values({ ...fixture, type: 'expense', id: crypto.randomUUID(), createdAt: 0 })
          .run();
        database
          .insert(transactions)
          .values({
            ...fixture,
            type: 'expense',
            id: crypto.randomUUID(),
            createdAt: 0,
            accountId: crypto.randomUUID(),
          })
          .run();
      }),
    ).toThrow();
    expect(client.database.select().from(transactions).all()).toHaveLength(0);
  });
  it('translates bounded writer contention to a safe conflict response', async () => {
    const other = openDatabase({ filePath: join(directory, 'test.sqlite'), busyTimeout: 0 });
    other.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const response = await request(app()).post('/api/v1/transactions').send(fixture).expect(409);
      expect(response.body.error.code).toBe('STORAGE_CONFLICT');
    } finally {
      other.sqlite.exec('ROLLBACK');
      other.sqlite.close();
    }
  });
  it('keeps liveness up while readiness reports a closed database', async () => {
    const application = app();
    client.sqlite.close();
    await request(application).get('/api/v1/health').expect(200);
    await request(application).get('/api/v1/ready').expect(503);
  });
  it('rejects missing storage and unmigrated schema separately', () => {
    expect(() => openDatabase({ filePath: join(directory, 'missing.sqlite'), busyTimeout: 0 })).toThrow();
    expect(existsSync(join(directory, 'missing.sqlite'))).toBe(false);
    const unmigrated = openDatabase({ filePath: join(directory, 'empty.sqlite'), busyTimeout: 0 }, true);
    try {
      expect(() => verifySchema(unmigrated)).toThrow();
    } finally {
      unmigrated.sqlite.close();
    }
  });
  it('restores an online backup into a separate file and verifies the ledger', async () => {
    await request(app()).post('/api/v1/transactions').send(fixture).expect(201);
    const backupPath = join(directory, 'restored.sqlite');
    await client.sqlite.backup(backupPath);
    const restored = openDatabase({ filePath: backupPath, busyTimeout: 0 });
    try {
      verifySchema(restored);
      expect(restored.database.select().from(transactions).all()).toHaveLength(1);
    } finally {
      restored.sqlite.close();
    }
  });
  it('handles unknown routes, malformed JSON, bounded pages and CORS', async () => {
    await request(app()).get('/api/v1/missing').expect(404);
    await request(app()).post('/api/v1/transactions').set('Content-Type', 'application/json').send('{').expect(400);
    await request(app()).get('/api/v1/transactions?limit=501').expect(400);
    const allowed = await request(app()).get('/api/v1/health').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const denied = await request(app()).get('/api/v1/health').set('Origin', 'https://untrusted.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
  it('upserts budgets and creates accounts through validated routes', async () => {
    await request(app()).put('/api/v1/budgets').send({ category: 'Groceries', amount: 50000 }).expect(200);
    await request(app()).put('/api/v1/budgets').send({ category: 'Groceries', amount: 40000 }).expect(200);
    const response = await request(app()).get('/api/v1/budgets').expect(200);
    expect(response.body.data).toEqual([{ category: 'Groceries', amount: 40000 }]);
    await request(app()).post('/api/v1/accounts').send({ name: 'Cash', openingBalance: 5000 }).expect(201);
    const allAccounts = await request(app()).get('/api/v1/accounts');
    expect(allAccounts.body.data).toHaveLength(3);
  });
});
describe('recurrence calculations', () => {
  it('posts one-time scheduled payments only on their due date', async () => {
    const rule = await request(app())
      .post('/api/v1/recurring')
      .send({ ...fixture, frequency: 'once', reminderDays: 2 })
      .expect(201);
    await request(app()).post(`/api/v1/recurring/${rule.body.data.id}/pay`).send({ date: fixture.date }).expect(200);
    await request(app()).post(`/api/v1/recurring/${rule.body.data.id}/pay`).send({ date: '2026-10-17' }).expect(400);
  });
  it('clamps month ends without drifting the anchor', () => {
    expect(occurrenceDate('2026-01-31', 'monthly', 1)).toBe('2026-02-28');
    expect(occurrenceDate('2026-01-31', 'monthly', 2)).toBe('2026-03-31');
  });
  it('clamps leap-day annual rules and advances weekly rules', () => {
    expect(occurrenceDate('2024-02-29', 'yearly', 1)).toBe('2025-02-28');
    expect(occurrenceDate('2026-10-16', 'weekly', 1)).toBe('2026-10-23');
  });
});
