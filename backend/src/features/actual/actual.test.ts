import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { openDatabase } from '../../db/client.js';
import type { DatabaseClient } from '../../db/client.js';
import { applyMigrations } from '../../db/migrations.js';
import { loadEnvironment, parseDatabaseEnvironment } from '../../app/config/environment.js';
import { createApp } from '../../app/createApp.js';
import { createLogger } from '../../lib/logger/logger.js';
import { accounts, transactions } from '../../db/schema/budget.js';
import { receipts } from '../../db/schema/receipts.js';
import { scheduleSettings } from '../../db/schema/schedules.js';
import { actualFixture } from '../../../../scripts/actualFixtures';
import { convertActual } from '../../../../frontend/src/features/actual/convertActual';
const settings = parseDatabaseEnvironment();
const accountId = '11111111-1111-4111-8111-111111111111';
const transactionId = '22222222-2222-4222-8222-222222222222';
const path = '/api/v1/imports/actual';
const file = convertActual(actualFixture(), JSON.stringify({ id: 'backend-fixture', budgetName: 'Backend fixture' }));
const input = { file, currencyConfirmed: true };
let client: DatabaseClient;
let directory: string;
beforeEach(() => {
  mkdirSync(settings.testDirectory, { recursive: true });
  directory = mkdtempSync(join(settings.testDirectory, 'actual-api-'));
  client = openDatabase({ filePath: resolve(directory, 'app.sqlite'), busyTimeout: 0 }, true);
  applyMigrations(client);
  client.database.insert(accounts).values({ id: accountId, name: 'Existing', openingBalance: 10000 }).run();
  client.database
    .insert(transactions)
    .values({
      id: transactionId,
      name: 'Keep',
      amount: 500,
      type: 'expense',
      category: 'Other',
      accountId,
      destinationAccountId: null,
      date: '2026-10-01',
      notes: 'Original',
      createdAt: 123,
      recurringId: null,
    })
    .run();
  client.database
    .insert(receipts)
    .values({
      id: '33333333-3333-4333-8333-333333333333',
      transactionId,
      name: 'receipt.pdf',
      mimeType: 'application/pdf',
      content: btoa('%PDF-1.4\nfixture'),
      size: 16,
      createdAt: 1,
    })
    .run();
});
afterEach(() => {
  if (client.sqlite.open) {
    client.sqlite.close();
  }
  if (!directory.startsWith(`${settings.testDirectory}/actual-api-`)) {
    throw new Error('Unsafe cleanup');
  }
  rmSync(directory, { recursive: true, force: true });
});
/** Construct an injectable HTTP boundary. @returns {import('express').Express} Application. */
function app() {
  return createApp(client, { ...loadEnvironment(), apiPrefix: '/api/v1' }, createLogger('silent'));
}
/** Read current posting rows. @returns {object[]} Persisted ledger. */
function postings() {
  return client.database.select().from(transactions).all();
}
/** Review the same fictional native conversion. @returns {Promise<object>} Current API plan. */
async function review() {
  return (await request(app()).post(`${path}/preview`).send(input).expect(200)).body.data;
}
describe('atomic native Actual import API on file-backed SQLite', () => {
  it('reviews without writes, commits related rows, preserves existing records and persists after reopen', async () => {
    const before = postings();
    const files = client.database.select().from(receipts).all();
    const preview = await review();
    expect(postings()).toEqual(before);
    expect(preview.accountRows.every((row) => row.source === row.after)).toBe(true);
    const added = (
      await request(app())
        .post(`${path}/commit`)
        .send({ ...input, revision: preview.revision })
        .expect(200)
    ).body.data;
    expect(added.transactions).toBe(4);
    expect(postings()).toHaveLength(5);
    expect(postings().find((row) => row.id === transactionId)).toEqual(before[0]);
    expect(client.database.select().from(receipts).all()).toEqual(files);
    client.sqlite.close();
    client = openDatabase({ filePath: resolve(directory, 'app.sqlite'), busyTimeout: 0 });
    expect(postings()).toHaveLength(5);
    const repeated = await review();
    expect(Object.values(repeated.added).every((count) => count === 0)).toBe(true);
    expect(repeated.reused).toBe(4);
    await request(app())
      .post(`${path}/commit`)
      .send({ ...input, revision: repeated.revision })
      .expect(200);
    expect(postings()).toHaveLength(5);
  });
  it('rejects stale reviews after a destination edit and forged revisions without partial writes', async () => {
    const preview = await review();
    client.database.update(transactions).set({ notes: 'Later edit' }).where(eq(transactions.id, transactionId)).run();
    for (const revision of [preview.revision, 'a'.repeat(64)]) {
      await request(app())
        .post(`${path}/commit`)
        .send({ ...input, revision })
        .expect(409);
    }
    expect(postings()).toHaveLength(1);
    expect(client.database.select().from(accounts).all()).toHaveLength(1);
  });
  it('rolls back earlier account/category/schedule/posting inserts if a later posting fails', async () => {
    const preview = await review();
    client.sqlite.exec(`CREATE TRIGGER fail_import BEFORE INSERT ON transactions
      WHEN NEW.id = '${file.transactions[1]!.id}' BEGIN SELECT RAISE(ABORT, 'test rollback'); END;`);
    await request(app())
      .post(`${path}/commit`)
      .send({ ...input, revision: preview.revision })
      .expect(409);
    expect(postings()).toHaveLength(1);
    expect(client.database.select().from(accounts).all()).toHaveLength(1);
    expect(client.database.select().from(scheduleSettings).all()).toHaveLength(0);
  });
  it('preserves user clearing and resumed schedules on reimport, and blocks changed imported postings', async () => {
    const preview = await review();
    await request(app())
      .post(`${path}/commit`)
      .send({ ...input, revision: preview.revision })
      .expect(200);
    client.database.update(scheduleSettings).set({ isPaused: false }).run();
    expect((await review()).added.scheduleSettings).toBe(0);
    client.database
      .update(transactions)
      .set({ notes: 'Edited import' })
      .where(eq(transactions.id, file.transactions[0]!.id))
      .run();
    await request(app()).post(`${path}/preview`).send(input).expect(409);
    expect(postings()).toHaveLength(5);
  });
  it('validates currency consent, graph integrity, duplicates, paused controls and source balances', async () => {
    for (const body of [
      { file },
      { ...input, currencyConfirmed: false },
      { ...input, extra: true },
      { ...input, file: { ...file, transactions: [...file.transactions, file.transactions[0]] } },
      { ...input, file: { ...file, scheduleSettings: [] } },
      { ...input, file: { ...file, balances: file.balances.map((row) => ({ ...row, amount: 0 })) } },
    ]) {
      const response = await request(app()).post(`${path}/preview`).send(body);
      expect([400, 409]).toContain(response.status);
    }
    expect(postings()).toHaveLength(1);
  });
});
