import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import { mkdirSync, mkdtempSync, rmSync, readFileSync, writeFileSync, cpSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { openDatabase, verifySchema } from '../../db/client.js';
import type { DatabaseClient } from '../../db/client.js';
import { applyMigrations } from '../../db/migrations.js';
import { parseDatabaseEnvironment, loadEnvironment } from '../../app/config/environment.js';
import { createApp } from '../../app/createApp.js';
import { createLogger } from '../../lib/logger/logger.js';
import { accounts, budgets, transactions } from '../../db/schema/budget.js';
const accountId = '11111111-1111-4111-8111-111111111111';
const settings = parseDatabaseEnvironment();
const posting = {
  name: 'Vet',
  amount: 2500,
  type: 'expense',
  category: 'Pets',
  accountId,
  destinationAccountId: null,
  date: '2026-10-16',
  notes: '',
};
const allocation = { month: '2026-10-01', category: 'Groceries', amount: 45000, rollover: true };
const goal = { name: 'Emergency fund', targetAmount: 100000, targetDate: '2027-01-31', isArchived: false };
let client: DatabaseClient;
let directory: string;
beforeEach(() => {
  mkdirSync(settings.testDirectory, { recursive: true });
  directory = mkdtempSync(join(settings.testDirectory, 'planning-'));
  client = openDatabase({ filePath: resolve(directory, 'test.sqlite'), busyTimeout: 0 }, true);
  applyMigrations(client);
  client.database.insert(accounts).values({ id: accountId, name: 'Everyday', openingBalance: 10000 }).run();
});
afterEach(() => {
  if (client.sqlite.open) {
    client.sqlite.close();
  }
  if (directory === settings.testDirectory || relative(settings.testDirectory, directory).startsWith('..')) {
    throw new Error('Refusing unsafe cleanup.');
  }
  rmSync(directory, { recursive: true, force: true });
});
/** Construct an application without binding a network listener. @returns {import('express').Express} App. */
function app() {
  return createApp(client, { ...loadEnvironment(), apiPrefix: '/api/v1' }, createLogger('silent'));
}
/** Read planning state through the HTTP boundary. @returns {Promise<any>} Public snapshot. */
async function state() {
  return (await request(app()).get('/api/v1/planning').expect(200)).body.data;
}
/** Create a goal through validation and real persistence. @returns {Promise<string>} Goal UUID. */
async function createGoal() {
  return (await request(app()).post('/api/v1/planning/goals').send(goal).expect(201)).body.data.id;
}
describe('planning API with file-backed SQLite', () => {
  it('keeps exact-month overrides separate from earlier months and legacy defaults, including zero caps', async () => {
    client.database.insert(budgets).values({ category: 'Groceries', amount: 50000 }).run();
    await request(app()).put('/api/v1/planning/monthly-budgets').send(allocation).expect(200);
    await request(app())
      .put('/api/v1/planning/monthly-budgets')
      .send({ ...allocation, month: '2026-11-01', amount: 0, rollover: false })
      .expect(200);
    await request(app())
      .put('/api/v1/planning/monthly-budgets')
      .send({ ...allocation, amount: 40000 })
      .expect(200);
    const data = await state();
    expect(data.monthlyBudgets).toHaveLength(2);
    expect(data.monthlyBudgets.find((entry: { month: string }) => entry.month === '2026-11-01').amount).toBe(0);
    expect(client.database.select().from(budgets).all()).toEqual([{ category: 'Groceries', amount: 50000 }]);
    await request(app())
      .put('/api/v1/planning/monthly-budgets')
      .send({ ...allocation, month: '2026-11-02' })
      .expect(400);
    await request(app())
      .put('/api/v1/planning/monthly-budgets')
      .send({ ...allocation, amount: -1 })
      .expect(400);
  });
  it('validates custom categories and archives without rewriting actual or scheduled history', async () => {
    await request(app()).post('/api/v1/transactions').send(posting).expect(400);
    const category = (await request(app()).post('/api/v1/planning/categories').send({ name: ' Pets ' }).expect(201))
      .body.data;
    await request(app()).post('/api/v1/planning/categories').send({ name: 'pets' }).expect(409);
    await request(app()).post('/api/v1/planning/categories').send({ name: 'groceries' }).expect(409);
    const actual = (await request(app()).post('/api/v1/transactions').send(posting).expect(201)).body.data;
    const schedule = (
      await request(app())
        .post('/api/v1/recurring')
        .send({ ...posting, frequency: 'monthly', reminderDays: 2 })
        .expect(201)
    ).body.data;
    await request(app())
      .put('/api/v1/planning/monthly-budgets')
      .send({ ...allocation, category: 'Pets' })
      .expect(200);
    await request(app()).put(`/api/v1/planning/categories/${category.id}`).send({ isArchived: true }).expect(200);
    await request(app()).post('/api/v1/transactions').send(posting).expect(400);
    await request(app())
      .put(`/api/v1/transactions/${actual.id}`)
      .send({ ...posting, notes: 'Receipt retained' })
      .expect(200);
    await request(app())
      .put('/api/v1/planning/monthly-budgets')
      .send({ ...allocation, category: 'Pets', amount: 30000 })
      .expect(200);
    await request(app()).post(`/api/v1/recurring/${schedule.id}/pay`).send({ date: posting.date }).expect(200);
    expect(
      client.database
        .select()
        .from(transactions)
        .all()
        .every((entry) => entry.category === 'Pets'),
    ).toBe(true);
    await request(app()).put(`/api/v1/planning/categories/${category.id}`).send({ isArchived: false }).expect(200);
    await request(app()).post('/api/v1/transactions').send(posting).expect(201);
  });
  it('accepts custom CSV categories and rejects forged import categories before any writes', async () => {
    await request(app()).post('/api/v1/planning/categories').send({ name: 'Pets' }).expect(201);
    const row = { transaction: posting, bankId: 'bank-vet', action: 'new' };
    await request(app())
      .post('/api/v1/imports/commit')
      .send({ accountId, rows: [row] })
      .expect(200);
    await request(app())
      .post('/api/v1/imports/commit')
      .send({ accountId, rows: [{ ...row, bankId: 'forged', transaction: { ...posting, category: 'Unrecognized' } }] })
      .expect(400);
    expect(client.database.select().from(transactions).all()).toHaveLength(1);
  });
  it('records idempotent positive and negative goal progress without creating financial transactions', async () => {
    const id = await createGoal();
    const input = { id: crypto.randomUUID(), amount: 30000, date: '2026-10-16', notes: 'Saved this month' };
    const path = `/api/v1/planning/goals/${id}/contributions`;
    await request(app()).post(path).send(input).expect(200);
    await request(app()).post(path).send(input).expect(200);
    await request(app())
      .post(path)
      .send({ ...input, amount: 40000 })
      .expect(409);
    await request(app())
      .post(path)
      .send({ ...input, id: crypto.randomUUID(), amount: -10000 })
      .expect(200);
    await request(app())
      .post(path)
      .send({ ...input, id: crypto.randomUUID(), amount: -25000 })
      .expect(409);
    expect((await state()).contributions).toHaveLength(2);
    expect(client.database.select().from(transactions).all()).toHaveLength(0);
    expect(client.database.select().from(accounts).get()?.openingBalance).toBe(10000);
    client.sqlite.close();
    client = openDatabase({ filePath: resolve(directory, 'test.sqlite'), busyTimeout: 0 });
    expect(
      (await state()).contributions.reduce((sum: number, entry: { amount: number }) => sum + entry.amount, 0),
    ).toBe(20000);
  });
  it('archives and restores goals with progress intact; retries remain safe after archive', async () => {
    const id = await createGoal();
    const input = { id: crypto.randomUUID(), amount: 10000, date: '2026-10-16', notes: '' };
    const path = `/api/v1/planning/goals/${id}/contributions`;
    await request(app()).post(path).send(input).expect(200);
    await request(app())
      .put(`/api/v1/planning/goals/${id}`)
      .send({ ...goal, isArchived: true })
      .expect(200);
    await request(app()).post(path).send(input).expect(200);
    await request(app())
      .post(path)
      .send({ ...input, id: crypto.randomUUID() })
      .expect(409);
    await request(app())
      .put(`/api/v1/planning/goals/${id}`)
      .send({ ...goal, name: 'Safety net' })
      .expect(200);
    await request(app())
      .post(path)
      .send({ ...input, id: crypto.randomUUID() })
      .expect(200);
    expect((await state()).contributions).toHaveLength(2);
  });
  it('validates dates, strict payloads, IDs, nonzero contributions and safe progress totals', async () => {
    const id = await createGoal();
    const path = `/api/v1/planning/goals/${id}/contributions`;
    const input = { id: crypto.randomUUID(), amount: 0, date: '2026-10-16', notes: '' };
    await request(app()).post(path).send(input).expect(400);
    await request(app())
      .post(path)
      .send({ ...input, amount: 1.5 })
      .expect(400);
    await request(app())
      .post(path)
      .send({ ...input, amount: 1, date: '2026-02-30' })
      .expect(400);
    await request(app())
      .post('/api/v1/planning/goals')
      .send({ ...goal, extra: true })
      .expect(400);
    await request(app()).put('/api/v1/planning/categories/bad-id').send({ isArchived: true }).expect(400);
    await request(app())
      .post(`/api/v1/planning/goals/${crypto.randomUUID()}/contributions`)
      .send({ ...input, amount: 1 })
      .expect(404);
    await request(app())
      .post(path)
      .send({ ...input, amount: 100000000000 })
      .expect(200);
    await request(app())
      .post(path)
      .send({ ...input, id: crypto.randomUUID(), amount: 1 })
      .expect(409);
    expect((await state()).contributions).toHaveLength(1);
  });
  it('fills missing budgets atomically while preserving carry and unrelated categories', async () => {
    client.database.insert(budgets).values({ category: 'Groceries', amount: 50000 }).run();
    await request(app()).post('/api/v1/planning/categories').send({ name: 'Pets' }).expect(201);
    for (const input of [
      { ...allocation, amount: 0 },
      { ...allocation, category: 'Pets', amount: 12000 },
      { ...allocation, month: '2026-11-01', amount: 90000 },
      { ...allocation, month: '2026-11-01', category: 'Salary', amount: 17000 },
    ]) {
      await request(app()).put('/api/v1/planning/monthly-budgets').send(input).expect(200);
    }
    const selection = { fromMonth: '2026-10-01', toMonth: '2026-11-01', mode: 'missing' };
    const before = await state();
    const plan = (await request(app()).post('/api/v1/planning/budget-copy/preview').send(selection).expect(200)).body
      .data;
    expect(await state()).toEqual(before);
    expect(plan.rows.find((row: { category: string }) => row.category === 'Groceries')).toMatchObject({
      amount: 0,
      action: 'keep',
    });
    expect(plan.rows.find((row: { category: string }) => row.category === 'Pets')).not.toHaveProperty('carry');
    const result = await request(app())
      .post('/api/v1/planning/budget-copy/commit')
      .send({ ...selection, revision: plan.revision })
      .expect(200);
    expect(result.body.data).toBe(1);
    const after = await state();
    expect(after.monthlyBudgets.filter((row: { month: string }) => row.month === '2026-11-01')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'Groceries', amount: 90000 }),
        expect.objectContaining({ category: 'Salary', amount: 17000 }),
        expect.objectContaining({ category: 'Pets', amount: 12000, rollover: true }),
      ]),
    );
    expect(client.database.select().from(budgets).get()?.amount).toBe(50000);
    expect(client.database.select().from(transactions).all()).toHaveLength(0);
  });
  it('replaces only matching categories after explicit review, while archived categories are skipped', async () => {
    const category = (await request(app()).post('/api/v1/planning/categories').send({ name: 'Pets' }).expect(201)).body
      .data;
    for (const input of [
      allocation,
      { ...allocation, category: 'Pets' },
      { ...allocation, month: '2026-11-01', amount: 10000, rollover: false },
    ]) {
      await request(app()).put('/api/v1/planning/monthly-budgets').send(input).expect(200);
    }
    await request(app()).put(`/api/v1/planning/categories/${category.id}`).send({ isArchived: true }).expect(200);
    const selection = { fromMonth: '2026-10-01', toMonth: '2026-11-01', mode: 'replace' };
    const plan = (await request(app()).post('/api/v1/planning/budget-copy/preview').send(selection).expect(200)).body
      .data;
    expect(plan.rows.find((row: { category: string }) => row.category === 'Pets')?.action).toBe('archived');
    await request(app())
      .post('/api/v1/planning/budget-copy/commit')
      .send({ ...selection, revision: plan.revision })
      .expect(200);
    const destination = (await state()).monthlyBudgets.filter((row: { month: string }) => row.month === '2026-11-01');
    expect(destination).toEqual([{ ...allocation, month: '2026-11-01' }]);
  });
  it('rejects stale copy reviews after source, destination or archive changes without partial writes', async () => {
    await request(app()).put('/api/v1/planning/monthly-budgets').send(allocation).expect(200);
    const selection = { fromMonth: '2026-10-01', toMonth: '2026-11-01', mode: 'replace' };
    const plan = (await request(app()).post('/api/v1/planning/budget-copy/preview').send(selection).expect(200)).body
      .data;
    await request(app())
      .put('/api/v1/planning/monthly-budgets')
      .send({ ...allocation, amount: 10000 })
      .expect(200);
    const before = await state();
    const conflict = await request(app())
      .post('/api/v1/planning/budget-copy/commit')
      .send({ ...selection, revision: plan.revision })
      .expect(409);
    expect(conflict.body.error.code).toBe('STALE_COPY');
    expect(await state()).toEqual(before);
    const fresh = (await request(app()).post('/api/v1/planning/budget-copy/preview').send(selection).expect(200)).body
      .data;
    await request(app())
      .put('/api/v1/planning/monthly-budgets')
      .send({ ...allocation, month: '2026-11-01', amount: 20000 })
      .expect(200);
    await request(app())
      .post('/api/v1/planning/budget-copy/commit')
      .send({ ...selection, revision: fresh.revision })
      .expect(409);
    expect((await state()).monthlyBudgets.find((row: { month: string }) => row.month === '2026-11-01').amount).toBe(
      20000,
    );
    const category = (await request(app()).post('/api/v1/planning/categories').send({ name: 'Pets' }).expect(201)).body
      .data;
    await request(app())
      .put('/api/v1/planning/monthly-budgets')
      .send({ ...allocation, category: 'Pets' })
      .expect(200);
    const active = (await request(app()).post('/api/v1/planning/budget-copy/preview').send(selection).expect(200)).body
      .data;
    await request(app()).put(`/api/v1/planning/categories/${category.id}`).send({ isArchived: true }).expect(200);
    const archivedState = await state();
    await request(app())
      .post('/api/v1/planning/budget-copy/commit')
      .send({ ...selection, revision: active.revision })
      .expect(409);
    expect(await state()).toEqual(archivedState);
  });
  it('rolls back a budget copy if SQLite rejects a later write in the batch', async () => {
    await request(app()).post('/api/v1/planning/categories').send({ name: 'Pets' }).expect(201);
    for (const input of [allocation, { ...allocation, category: 'Pets' }]) {
      await request(app()).put('/api/v1/planning/monthly-budgets').send(input).expect(200);
    }
    const selection = { fromMonth: '2026-10-01', toMonth: '2026-11-01', mode: 'missing' };
    const plan = (await request(app()).post('/api/v1/planning/budget-copy/preview').send(selection).expect(200)).body
      .data;
    client.sqlite.exec(`CREATE TRIGGER reject_second_copy BEFORE INSERT ON monthly_budgets
      WHEN NEW.month = '2026-11-01' AND NEW.category = 'Pets'
      BEGIN SELECT RAISE(ABORT, 'test copy failure'); END;`);
    const before = await state();
    await request(app())
      .post('/api/v1/planning/budget-copy/commit')
      .send({ ...selection, revision: plan.revision })
      .expect(409);
    expect(await state()).toEqual(before);
  });
  it('validates copy dates, policy, revision and strict payloads at the HTTP boundary', async () => {
    const selection = { fromMonth: '2026-10-01', toMonth: '2026-11-01', mode: 'missing' };
    await request(app())
      .post('/api/v1/planning/budget-copy/preview')
      .send({ ...selection, toMonth: selection.fromMonth })
      .expect(400);
    await request(app())
      .post('/api/v1/planning/budget-copy/preview')
      .send({ ...selection, fromMonth: '2026-10-02' })
      .expect(400);
    await request(app())
      .post('/api/v1/planning/budget-copy/preview')
      .send({ ...selection, mode: 'wipe' })
      .expect(400);
    await request(app()).post('/api/v1/planning/budget-copy/commit').send(selection).expect(400);
    await request(app())
      .post('/api/v1/planning/budget-copy/commit')
      .send({ ...selection, revision: 'bad', rows: [] })
      .expect(400);
    await request(app())
      .post('/api/v1/planning/budget-copy/commit')
      .send({ ...selection, revision: 'bad' })
      .expect(409);
  });
  it('migrates a v1.1 database additively while retaining accounts, caps and actual transactions', () => {
    const legacyFolder = join(directory, 'legacy-migrations');
    cpSync(resolve('backend/src/db/migrations'), legacyFolder, { recursive: true });
    const journalPath = join(legacyFolder, 'meta/_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx < 2);
    writeFileSync(journalPath, JSON.stringify(journal));
    const legacy = openDatabase({ filePath: join(directory, 'legacy.sqlite'), busyTimeout: 0 }, true);
    try {
      migrate(legacy.database, { migrationsFolder: legacyFolder });
      legacy.database.insert(accounts).values({ id: accountId, name: 'Original', openingBalance: 42 }).run();
      legacy.database.insert(budgets).values({ category: 'Groceries', amount: 10000 }).run();
      legacy.database
        .insert(transactions)
        .values({ ...posting, type: 'expense', category: 'Groceries', id: crypto.randomUUID(), createdAt: 1 })
        .run();
      applyMigrations(legacy);
      verifySchema(legacy);
      expect(legacy.database.select().from(transactions).all()).toHaveLength(1);
      expect(legacy.database.select().from(budgets).get()?.amount).toBe(10000);
      expect(legacy.database.select().from(accounts).get()?.name).toBe('Original');
    } finally {
      legacy.sqlite.close();
    }
  });
});
