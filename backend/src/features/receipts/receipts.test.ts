import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { openDatabase } from '../../db/client.js';
import type { DatabaseClient } from '../../db/client.js';
import { applyMigrations } from '../../db/migrations.js';
import { parseDatabaseEnvironment, loadEnvironment } from '../../app/config/environment.js';
import { createApp } from '../../app/createApp.js';
import { createLogger } from '../../lib/logger/logger.js';
import { accounts, transactions } from '../../db/schema/budget.js';
import { receipts } from '../../db/schema/receipts.js';
const settings = parseDatabaseEnvironment();
const accountId = '11111111-1111-4111-8111-111111111111';
const transactionId = '22222222-2222-4222-8222-222222222222';
const bytes = '%PDF-1.4\nFolio receipt fixture';
const upload = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'receipt.pdf',
  mimeType: 'application/pdf',
  size: bytes.length,
  content: btoa(bytes),
};
const path = `/api/v1/transactions/${transactionId}/attachments`;
let client: DatabaseClient;
let directory: string;
beforeEach(() => {
  mkdirSync(settings.testDirectory, { recursive: true });
  directory = mkdtempSync(join(settings.testDirectory, 'receipts-'));
  client = openDatabase({ filePath: resolve(directory, 'app.sqlite'), busyTimeout: 0 }, true);
  applyMigrations(client);
  client.database.insert(accounts).values({ id: accountId, name: 'Everyday', openingBalance: 10000 }).run();
  client.database
    .insert(transactions)
    .values({
      id: transactionId,
      name: 'Market',
      amount: 1250,
      type: 'expense',
      category: 'Groceries',
      accountId,
      destinationAccountId: null,
      date: '2026-10-16',
      notes: '',
      createdAt: 1,
    })
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
/** Construct the real HTTP boundary. @returns {import('express').Express} Injectable app. */
function app() {
  return createApp(client, { ...loadEnvironment(), apiPrefix: '/api/v1' }, createLogger('silent'));
}
describe('SQLite receipt storage', () => {
  it('persists retry-safe bytes, lists metadata only and exports a consistent financial snapshot', async () => {
    await request(app()).post(path).send(upload).expect(201);
    await request(app()).post(path).send(upload).expect(201);
    await request(app())
      .post(path)
      .send({ ...upload, name: 'different.pdf' })
      .expect(409);
    const list = (await request(app()).get(path).expect(200)).body.data;
    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty('content');
    client.sqlite.close();
    client = openDatabase({ filePath: resolve(directory, 'app.sqlite'), busyTimeout: 0 });
    const file = (await request(app()).get(`/api/v1/attachments/${upload.id}`).expect(200)).body.data;
    expect(atob(file.content)).toBe(bytes);
    const snapshot = (await request(app()).get('/api/v1/workspace/export').expect(200)).body.data;
    expect(snapshot.receipts).toHaveLength(1);
    expect(snapshot.transactions).toHaveLength(1);
    expect(snapshot.accounts[0].openingBalance).toBe(10000);
    expect(snapshot).not.toHaveProperty('subscriptions');
  });
  it('rejects spoofed formats, invalid names, bad sizes and unknown fields before persistence', async () => {
    for (const value of [
      { ...upload, content: btoa('<html>not a receipt') },
      { ...upload, size: 1 },
      { ...upload, name: '../receipt.pdf' },
      { ...upload, name: 'bad\\name.pdf' },
      { ...upload, name: 'bad\u0000name.pdf' },
      { ...upload, mimeType: 'image/svg+xml' },
      { ...upload, size: 524289 },
      { ...upload, extra: true },
    ]) {
      await request(app()).post(path).send(value).expect(400);
    }
    expect(client.database.select().from(receipts).all()).toHaveLength(0);
  });
  it('accepts PNG and JPEG signatures and forbids an absent posting', async () => {
    for (const [mimeType, content, name] of [
      ['image/png', '\x89PNG\r\n\x1a\nfixture', 'receipt.png'],
      ['image/jpeg', '\xff\xd8\xfffixture', 'receipt.jpg'],
    ]) {
      await request(app())
        .post(path)
        .send({ id: crypto.randomUUID(), name, mimeType, size: content?.length, content: btoa(content ?? '') })
        .expect(201);
    }
    await request(app()).post(`/api/v1/transactions/${crypto.randomUUID()}/attachments`).send(upload).expect(404);
    await request(app()).get('/api/v1/attachments/bad-id').expect(400);
    await request(app()).get(`/api/v1/attachments/${crypto.randomUUID()}`).expect(404);
  });
  it('enforces per-posting and total byte quotas without partial uploads', async () => {
    for (let index = 0; index < 5; index += 1) {
      await request(app())
        .post(path)
        .send({ ...upload, id: crypto.randomUUID() })
        .expect(201);
    }
    await request(app())
      .post(path)
      .send({ ...upload, id: crypto.randomUUID() })
      .expect(409);
    client.database.delete(receipts).run();
    const content = btoa('%PDF-' + ' '.repeat(524283));
    client.database
      .insert(receipts)
      .values(
        Array.from({ length: 16 }, () => ({
          ...upload,
          id: crypto.randomUUID(),
          transactionId,
          size: 524288,
          content,
          createdAt: 1,
        })),
      )
      .run();
    const otherId = crypto.randomUUID();
    const original = client.database.select().from(transactions).get();
    if (!original) {
      throw new Error('Missing fixture');
    }
    client.database
      .insert(transactions)
      .values({ ...original, id: otherId })
      .run();
    await request(app())
      .post(`/api/v1/transactions/${otherId}/attachments`)
      .send({ ...upload, id: crypto.randomUUID() })
      .expect(409);
    expect(client.database.select().from(receipts).all()).toHaveLength(16);
  });
  it('protects reconciled attachments, retains downloads and accepts an acknowledged retry after locking', async () => {
    await request(app()).post(path).send(upload).expect(201);
    await request(app())
      .put('/api/v1/reconciliation/clearance')
      .send({ transactionId, accountId, isCleared: true })
      .expect(204);
    const statement = (
      await request(app())
        .post('/api/v1/reconciliation')
        .send({ accountId, date: '2026-10-16', statementBalance: 8750 })
        .expect(201)
    ).body.data;
    await request(app()).post(path).send(upload).expect(201);
    await request(app())
      .post(path)
      .send({ ...upload, id: crypto.randomUUID() })
      .expect(409);
    await request(app()).delete(`/api/v1/attachments/${upload.id}`).expect(409);
    await request(app()).get(`/api/v1/attachments/${upload.id}`).expect(200);
    await request(app()).delete(`/api/v1/reconciliation/${statement.id}`).expect(204);
    await request(app()).delete(`/api/v1/attachments/${upload.id}`).expect(204);
    expect(client.database.select().from(transactions).get()?.amount).toBe(1250);
  });
  it('cascades documents on transaction deletion and includes bytes in an online SQLite backup', async () => {
    await request(app()).post(path).send(upload).expect(201);
    await client.sqlite.backup(join(directory, 'copy.sqlite'));
    const copy = openDatabase({ filePath: join(directory, 'copy.sqlite'), busyTimeout: 0 });
    try {
      expect(copy.database.select().from(receipts).get()?.content).toBe(upload.content);
    } finally {
      copy.sqlite.close();
    }
    await request(app()).delete(`/api/v1/transactions/${transactionId}`).expect(204);
    expect(client.database.select().from(receipts).all()).toHaveLength(0);
  });
});
