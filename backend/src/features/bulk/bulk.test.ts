import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { openDatabase } from '../../db/client.js';
import type { DatabaseClient } from '../../db/client.js';
import { applyMigrations } from '../../db/migrations.js';
import { loadEnvironment, parseDatabaseEnvironment } from '../../app/config/environment.js';
import { createApp } from '../../app/createApp.js';
import { createLogger } from '../../lib/logger/logger.js';
import { accounts, recurring, transactions } from '../../db/schema/budget.js';
import { receipts } from '../../db/schema/receipts.js';
import { clearances, importLinks, reconciliations } from '../../db/schema/operations.js';
import { customCategories } from '../../db/schema/planning.js';
const settings = parseDatabaseEnvironment();
const accountId = '11111111-1111-4111-8111-111111111111';
const destinationId = '22222222-2222-4222-8222-222222222222';
const firstId = '33333333-3333-4333-8333-333333333333';
const secondId = '44444444-4444-4444-8444-444444444444';
const thirdId = '55555555-5555-4555-8555-555555555555';
const recurringId = '66666666-6666-4666-8666-666666666666';
const ids = [firstId, secondId];
const path = '/api/v1/transactions/bulk';
const categorizing = { ids, action: 'categorize', category: 'Health' };
let client: DatabaseClient;
let directory: string;
beforeEach(() => {
  mkdirSync(settings.testDirectory, { recursive: true });
  directory = mkdtempSync(join(settings.testDirectory, 'bulk-'));
  client = openDatabase({ filePath: resolve(directory, 'app.sqlite'), busyTimeout: 0 }, true);
  applyMigrations(client);
  client.database
    .insert(accounts)
    .values([
      { id: accountId, name: 'Everyday', openingBalance: 10000 },
      { id: destinationId, name: 'Savings', openingBalance: 20000 },
    ])
    .run();
  const base = {
    name: 'Market',
    amount: 1250,
    type: 'expense' as const,
    category: 'Groceries',
    accountId,
    destinationAccountId: null,
    date: '2026-10-01',
    notes: 'Keep original notes',
  };
  client.database
    .insert(recurring)
    .values({ ...base, id: recurringId, frequency: 'monthly', reminderDays: 1 })
    .run();
  client.database
    .insert(transactions)
    .values([
      { ...base, id: firstId, createdAt: 1, recurringId },
      {
        ...base,
        id: secondId,
        name: 'Savings transfer',
        type: 'transfer',
        destinationAccountId: destinationId,
        date: '2026-10-02',
        createdAt: 2,
      },
      { ...base, id: thirdId, name: 'Unselected', type: 'income', date: '2026-10-03', createdAt: 3 },
    ])
    .run();
  client.database
    .insert(receipts)
    .values({
      id: randomUUID(),
      transactionId: firstId,
      name: 'receipt.pdf',
      mimeType: 'application/pdf',
      content: btoa('%PDF-1.4\nfixture'),
      size: 16,
      createdAt: 1,
    })
    .run();
  client.database
    .insert(clearances)
    .values([
      { transactionId: secondId, accountId, reconciliationId: null },
      { transactionId: secondId, accountId: destinationId, reconciliationId: null },
    ])
    .run();
  client.database
    .insert(importLinks)
    .values({ fingerprint: 'bank:stable', transactionId: firstId, createdAt: 1 })
    .run();
});
afterEach(() => {
  if (client.sqlite.open) {
    client.sqlite.close();
  }
  if (directory === settings.testDirectory || relative(settings.testDirectory, directory).startsWith('..')) {
    throw new Error('Unsafe cleanup');
  }
  rmSync(directory, { recursive: true, force: true });
});
/** Construct an injectable production HTTP boundary. @returns {import('express').Express} Application. */
function app() {
  return createApp(client, { ...loadEnvironment(), apiPrefix: '/api/v1' }, createLogger('silent'));
}
/** Snapshot rows in deterministic identity order. @returns {object[]} Actual postings. */
function postings() {
  return client.database.select().from(transactions).orderBy(transactions.id).all();
}
/** Complete a statement on the transfer's destination leg. @returns {void} A reconciled lock. */
function lockTransfer() {
  const id = randomUUID();
  client.database
    .insert(reconciliations)
    .values({ id, accountId: destinationId, date: '2026-10-31', statementBalance: 21250, createdAt: 1 })
    .run();
  client.database.update(clearances).set({ reconciliationId: id }).where(eq(clearances.accountId, destinationId)).run();
}
describe('atomic bulk operations on real file-backed SQLite', () => {
  it('previews without writes or file bytes, then categorizes selected rows and retains audit links', async () => {
    const before = postings();
    const files = client.database.select().from(receipts).all();
    const review = (await request(app()).post(`${path}/preview`).send(categorizing).expect(200)).body.data;
    expect(postings()).toEqual(before);
    expect(review.rows).toHaveLength(2);
    expect(review.rows[0].receipts[0]).not.toHaveProperty('content');
    expect(review.revision).not.toContain(btoa('%PDF-1.4\nfixture'));
    await request(app())
      .post(`${path}/commit`)
      .send({ selection: review.selection, revision: review.revision })
      .expect(200);
    expect(postings()).toEqual(
      before.map((entry) => (ids.includes(entry.id) ? { ...entry, category: 'Health' } : entry)),
    );
    expect(client.database.select().from(receipts).all()).toEqual(files);
    expect(client.database.select().from(clearances).all()).toHaveLength(2);
    expect(client.database.select().from(importLinks).all()).toHaveLength(1);
    expect(client.database.select().from(recurring).get()?.category).toBe('Groceries');
    client.sqlite.close();
    client = openDatabase({ filePath: resolve(directory, 'app.sqlite'), busyTimeout: 0 });
    expect(postings().filter((entry) => entry.category === 'Health')).toHaveLength(2);
  });
  it('deletes both transfer legs and metadata, preserving accounts, schedules and other rows', async () => {
    const beforeAccounts = client.database.select().from(accounts).all();
    const review = (await request(app()).post(`${path}/preview`).send({ ids, action: 'delete' }).expect(200)).body.data;
    const response = await request(app())
      .post(`${path}/commit`)
      .send({ selection: review.selection, revision: review.revision })
      .expect(200);
    expect(response.body.data).toBe(2);
    expect(postings().map((entry) => entry.id)).toEqual([thirdId]);
    expect(client.database.select().from(receipts).all()).toHaveLength(0);
    expect(client.database.select().from(clearances).all()).toHaveLength(0);
    expect(client.database.select().from(importLinks).all()).toHaveLength(0);
    expect(client.database.select().from(accounts).all()).toEqual(beforeAccounts);
    expect(client.database.select().from(recurring).all()).toHaveLength(1);
    await request(app()).post(`/api/v1/recurring/${recurringId}/pay`).send({ date: '2026-10-01' }).expect(200);
    expect(postings().filter((entry) => entry.recurringId === recurringId)).toHaveLength(1);
  });
  it('rejects a destination-leg reconciliation added after review without changing other entries', async () => {
    const review = (await request(app()).post(`${path}/preview`).send({ ids, action: 'delete' }).expect(200)).body.data;
    lockTransfer();
    const before = postings();
    await request(app())
      .post(`${path}/commit`)
      .send({ selection: review.selection, revision: review.revision })
      .expect(409);
    await request(app()).post(`${path}/preview`).send(categorizing).expect(409);
    expect(postings()).toEqual(before);
    expect(client.database.select().from(receipts).all()).toHaveLength(1);
  });
  it.each(['notes', 'receipt', 'clearance', 'import link', 'removed entry'])(
    'rejects stale %s reviews',
    async (change) => {
      const review = (await request(app()).post(`${path}/preview`).send(categorizing).expect(200)).body.data;
      if (change === 'notes') {
        client.database.update(transactions).set({ notes: 'Changed' }).where(eq(transactions.id, firstId)).run();
      } else if (change === 'receipt') {
        client.database
          .insert(receipts)
          .values({
            id: randomUUID(),
            transactionId: secondId,
            name: 'new.pdf',
            mimeType: 'application/pdf',
            content: btoa('%PDF-1.4\nfixture'),
            size: 16,
            createdAt: 2,
          })
          .run();
      } else if (change === 'clearance') {
        client.database.delete(clearances).where(eq(clearances.accountId, accountId)).run();
      } else if (change === 'import link') {
        client.database
          .insert(importLinks)
          .values({ fingerprint: 'bank:new', transactionId: firstId, createdAt: 2 })
          .run();
      } else {
        client.database.delete(transactions).where(eq(transactions.id, firstId)).run();
      }
      const before = postings();
      await request(app())
        .post(`${path}/commit`)
        .send({ selection: review.selection, revision: review.revision })
        .expect(409);
      expect(postings()).toEqual(before);
    },
  );
  it('requires an active target category again at commit time', async () => {
    const categoryId = randomUUID();
    client.database
      .insert(customCategories)
      .values({ id: categoryId, name: 'Pets', normalizedName: 'pets', isArchived: false })
      .run();
    const review = (
      await request(app())
        .post(`${path}/preview`)
        .send({ ...categorizing, category: 'Pets' })
        .expect(200)
    ).body.data;
    client.database.update(customCategories).set({ isArchived: true }).where(eq(customCategories.id, categoryId)).run();
    const before = postings();
    await request(app())
      .post(`${path}/commit`)
      .send({ selection: review.selection, revision: review.revision })
      .expect(400);
    await request(app())
      .post(`${path}/preview`)
      .send({ ...categorizing, category: 'Pets' })
      .expect(400);
    expect(postings()).toEqual(before);
  });
  it.each(['delete', 'categorize'])('rolls back every %s and its cascades if a later write fails', async (action) => {
    const review = (
      await request(app())
        .post(`${path}/preview`)
        .send(action === 'delete' ? { ids, action } : categorizing)
        .expect(200)
    ).body.data;
    client.sqlite.exec(`CREATE TRIGGER reject_bulk BEFORE ${action === 'delete' ? 'DELETE' : 'UPDATE'} ON transactions
      WHEN OLD.id = '${secondId}' BEGIN SELECT RAISE(ABORT, 'test rollback'); END;`);
    const before = postings();
    const files = client.database.select().from(receipts).all();
    await request(app())
      .post(`${path}/commit`)
      .send({ selection: review.selection, revision: review.revision })
      .expect(409);
    expect(postings()).toEqual(before);
    expect(client.database.select().from(receipts).all()).toEqual(files);
    expect(client.database.select().from(importLinks).all()).toHaveLength(1);
  });
  it('strictly bounds and validates every batch before any writes', async () => {
    const before = postings();
    for (const input of [
      { ids: [], action: 'delete' },
      { ids: [firstId, firstId], action: 'delete' },
      { ids: ['not-uuid'], action: 'delete' },
      { ids, action: 'delete', category: 'Health' },
      { ids, action: 'categorize' },
      { ids, action: 'categorize', category: 'Unknown' },
      { ids: Array.from({ length: 101 }, () => randomUUID()), action: 'delete' },
    ]) {
      await request(app()).post(`${path}/preview`).send(input).expect(400);
    }
    await request(app()).post(`${path}/commit`).send({ selection: categorizing, revision: 'forged' }).expect(409);
    expect(postings()).toEqual(before);
  });
});
