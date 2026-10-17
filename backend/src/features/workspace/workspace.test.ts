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
import { accounts, transactions, subscriptions } from '../../db/schema/budget.js';
import { reminderPreferences, reminderAttempts, reminderSnoozes } from '../../db/schema/operations.js';
import { workspaceSnapshot } from '../receipts/workspaceSnapshot.js';
import { workspaceSchema } from './backupSchema.js';
import { validateBackupRelations } from './backupRelations.js';
import { workspaceFixture } from '../../../../scripts/workspaceFixture';
import { actualFixture } from '../../../../scripts/actualFixtures';
import { convertActual } from '../../../../frontend/src/features/actual/convertActual';
import { actualReplacement } from '../../../../frontend/src/features/actual/actualReplacement';
import { createWorkspaceRepository } from './workspace.repository.js';
const root = parseDatabaseEnvironment().testDirectory;
const path = '/api/v1/workspace/import';
let directory: string;
let client: DatabaseClient;
const data = workspaceSchema.parse(workspaceFixture());
const input = { data };
const previousId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
beforeEach(() => {
  mkdirSync(root, { recursive: true });
  directory = mkdtempSync(join(root, 'workspace-import-'));
  client = openDatabase({ filePath: resolve(directory, 'app.sqlite'), busyTimeout: 0 }, true);
  applyMigrations(client);
  client.database.insert(accounts).values({ id: previousId, name: 'Previous bank', openingBalance: 2000 }).run();
  client.database
    .insert(transactions)
    .values({
      id: previousId,
      name: 'Previous posting',
      amount: 100,
      type: 'income',
      category: 'Other',
      accountId: previousId,
      destinationAccountId: null,
      date: '2026-09-01',
      notes: 'Keep on rollback',
      createdAt: 20,
      recurringId: null,
    })
    .run();
  client.database
    .insert(subscriptions)
    .values({ endpoint: 'https://fcm.googleapis.com/fcm/send/device', p256dh: 'fictional', auth: 'fictional' })
    .run();
  client.database
    .insert(reminderPreferences)
    .values({ id: 1, timeZone: 'Europe/Athens', deliveryTime: '12:00', mode: 'digest', overdueDays: 2 })
    .run();
  client.database
    .insert(reminderAttempts)
    .values({
      id: 'previous-delivery',
      title: 'Folio reminder',
      date: '2026-09-01',
      status: 'sent',
      attemptedAt: 1,
      retryAfter: 1,
      count: 1,
    })
    .run();
});
afterEach(() => {
  if (client.sqlite.open) {
    client.sqlite.close();
  }
  if (!directory.startsWith(`${root}/workspace-import-`)) {
    throw new Error('Unsafe cleanup');
  }
  rmSync(directory, { recursive: true, force: true });
});
/** Build a production HTTP boundary without listening. @returns {import('express').Express} Application. */
function app() {
  return createApp(client, { ...loadEnvironment(), apiPrefix: '/api/v1' }, createLogger('silent'));
}
/** Review a complete source. @param {unknown} source - Candidate workspace. @returns {Promise<object>} Review. */
async function review(source: unknown = data) {
  return (await request(app()).post(`${path}/preview`).send({ data: source }).expect(200)).body.data;
}
describe('reviewed workspace replacement on real file-backed SQLite', () => {
  it('reviews read-only, replaces every financial collection, pauses rules and preserves device metadata', async () => {
    const before = workspaceSnapshot(client);
    const devices = client.database.select().from(subscriptions).all();
    const preferences = client.database.select().from(reminderPreferences).all();
    const attempts = client.database.select().from(reminderAttempts).all();
    const preview = await review();
    expect(workspaceSnapshot(client)).toEqual(before);
    expect(JSON.stringify(preview)).not.toContain(data.receipts[0]!.content);
    await request(app())
      .post(`${path}/commit`)
      .send({ ...input, revision: preview.revision, confirmation: 'REPLACE' })
      .expect(200);
    const after = workspaceSchema.parse(workspaceSnapshot(client));
    validateBackupRelations(after);
    expect(after.accounts).toEqual(data.accounts);
    expect(after.transactions).toEqual(data.transactions);
    expect(after.receipts).toEqual(data.receipts);
    expect(after.clearances).toEqual(data.clearances);
    expect(after.reconciliations).toEqual(data.reconciliations);
    expect(after.contributions).toEqual(data.contributions);
    expect(after.importLinks).toEqual(data.importLinks);
    expect(after.skippedOccurrences).toEqual(data.skippedOccurrences);
    expect(after.scheduleSettings.every((row) => row.isPaused)).toBe(true);
    expect(client.database.select().from(subscriptions).all()).toEqual(devices);
    expect(client.database.select().from(reminderPreferences).all()).toEqual(preferences);
    expect(client.database.select().from(reminderAttempts).all()).toEqual(attempts);
    client.sqlite.close();
    client = openDatabase({ filePath: resolve(directory, 'app.sqlite'), busyTimeout: 0 });
    expect(workspaceSchema.parse(workspaceSnapshot(client))).toEqual(after);
  });
  it('requires an explicit literal confirmation and rejects stale or changed source reviews', async () => {
    const preview = await review();
    const before = workspaceSnapshot(client);
    await request(app())
      .post(`${path}/commit`)
      .send({ ...input, revision: preview.revision })
      .expect(400);
    const changed = structuredClone(data);
    changed.transactions[0]!.notes = 'Changed source';
    await request(app())
      .post(`${path}/commit`)
      .send({ data: changed, revision: preview.revision, confirmation: 'REPLACE' })
      .expect(409);
    expect(workspaceSnapshot(client)).toEqual(before);
    client.database.update(transactions).set({ notes: 'Late edit' }).where(eq(transactions.id, previousId)).run();
    await request(app())
      .post(`${path}/commit`)
      .send({ ...input, revision: preview.revision, confirmation: 'REPLACE' })
      .expect(409);
    expect(workspaceSnapshot(client).transactions[0]?.notes).toBe('Late edit');
  });
  it('rolls back all deletions and inserts when a late receipt insert fails', async () => {
    const before = workspaceSnapshot(client);
    const preview = await review();
    client.sqlite.exec(
      "CREATE TRIGGER reject_receipt BEFORE INSERT ON receipts BEGIN SELECT RAISE(ABORT,'fixture'); END;",
    );
    await request(app())
      .post(`${path}/commit`)
      .send({ ...input, revision: preview.revision, confirmation: 'REPLACE' })
      .expect(409);
    expect(workspaceSnapshot(client)).toEqual(before);
    expect(client.database.select().from(subscriptions).all()).toHaveLength(1);
  });
  it.each(['duplicate', 'account', 'statement', 'fingerprint', 'receipt', 'goal', 'skipped'])(
    'rejects corrupt %s data before deleting anything',
    async (kind) => {
      const source = structuredClone(data);
      const before = workspaceSnapshot(client);
      if (kind === 'duplicate') {
        source.accounts.push(source.accounts[0]!);
      }
      if (kind === 'account') {
        source.transactions[0]!.accountId = previousId;
      }
      if (kind === 'statement') {
        source.reconciliations[0]!.statementBalance += 1;
      }
      if (kind === 'fingerprint') {
        source.importLinks[0]!.fingerprint = 'broken';
      }
      if (kind === 'receipt') {
        source.receipts[0]!.content = 'not-base64';
      }
      if (kind === 'goal') {
        source.contributions[0]!.amount = -1;
      }
      if (kind === 'skipped') {
        source.skippedOccurrences[0]!.date = source.transactions[0]!.date;
      }
      await request(app()).post(`${path}/preview`).send({ data: source }).expect(400);
      expect(workspaceSnapshot(client)).toEqual(before);
    },
  );
  it('clears old financial snoozes while retaining notification preferences and history', async () => {
    const repository = createWorkspaceRepository(client);
    repository.atomic(() => repository.replace(data));
    client.database
      .insert(reminderSnoozes)
      .values({ recurringId: data.recurring[0]!.id, date: '2026-12-01', until: 100 })
      .run();
    const preview = await review();
    await request(app())
      .post(`${path}/commit`)
      .send({ ...input, revision: preview.revision, confirmation: 'REPLACE' })
      .expect(200);
    expect(client.database.select().from(reminderSnoozes).all()).toHaveLength(0);
    expect(client.database.select().from(reminderAttempts).all()).toHaveLength(1);
  });
  it('accepts server receipt capacity above the preview limit and rejects bodies above 16 MiB', async () => {
    const source = structuredClone(data);
    const content = '%PDF-1.4\n' + 'x'.repeat(524288 - '%PDF-1.4\n'.length);
    source.receipts = Array.from({ length: 5 }, (_unused, index) => ({
      ...data.receipts[0]!,
      id: `eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee${index}`,
      content: btoa(content),
      size: content.length,
    }));
    const preview = await review(source);
    expect(preview.counts.find((row) => row.key === 'receipts').after).toBe(5);
    expect(workspaceSnapshot(client).receipts).toHaveLength(0);
    await request(app())
      .post(`${path}/preview`)
      .set('Content-Type', 'application/json')
      .send(' '.repeat(16777216 + 1))
      .expect(413);
  });
});

describe('confirmed complete app-data deletion', () => {
  const deletePath = '/api/v1/workspace/delete';
  it('previews without private values and rejects missing, lowercase or padded consent', async () => {
    const before = workspaceSnapshot(client);
    const preview = (await request(app()).post(`${deletePath}/preview`).send({}).expect(200)).body.data;
    expect(JSON.stringify(preview)).not.toContain('Previous posting');
    expect(JSON.stringify(preview)).not.toContain('fcm.googleapis.com');
    for (const confirmation of [undefined, '', 'delete', ' DELETE', 'DELETE ']) {
      await request(app())
        .post(`${deletePath}/commit`)
        .send({ revision: preview.revision, confirmation, acknowledged: true })
        .expect(400);
    }
    await request(app())
      .post(`${deletePath}/commit`)
      .send({ revision: preview.revision, confirmation: 'DELETE', acknowledged: false })
      .expect(400);
    expect(workspaceSnapshot(client)).toEqual(before);
    expect(client.database.select().from(subscriptions).all()).toHaveLength(1);
  });
  it('deletes every user table, preserves migrations and reopens empty', async () => {
    createWorkspaceRepository(client).atomic(() => createWorkspaceRepository(client).replace(data));
    const preview = (await request(app()).post(`${deletePath}/preview`).send({}).expect(200)).body.data;
    await request(app())
      .post(`${deletePath}/commit`)
      .send({ revision: preview.revision, confirmation: 'DELETE', acknowledged: true })
      .expect(200);
    const tables = client.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
      name: string;
    }[];
    for (const { name } of tables.filter((row) => !row.name.startsWith('sqlite_') && !row.name.includes('drizzle'))) {
      const count = client.sqlite.prepare(`SELECT COUNT(*) AS count FROM "${name}"`).get() as { count: number };
      expect(count.count, name).toBe(0);
    }
    expect(client.sqlite.prepare('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' });
    client.sqlite.close();
    client = openDatabase({ filePath: resolve(directory, 'app.sqlite'), busyTimeout: 0 });
    expect(workspaceSnapshot(client).accounts).toEqual([]);
    const repeat = (await request(app()).post(`${deletePath}/preview`).send({}).expect(200)).body.data;
    expect(repeat.counts.every((row: { before: number }) => row.before === 0)).toBe(true);
    await request(app())
      .post(`${deletePath}/commit`)
      .send({ revision: repeat.revision, confirmation: 'DELETE', acknowledged: true })
      .expect(200);
  });
  it.each(['financial', 'notifications'])('rejects a changed %s revision before deleting any rows', async (kind) => {
    const preview = (await request(app()).post(`${deletePath}/preview`).send({}).expect(200)).body.data;
    if (kind === 'financial') {
      client.database.update(transactions).set({ notes: 'Late edit' }).where(eq(transactions.id, previousId)).run();
    } else {
      client.database.update(reminderPreferences).set({ deliveryTime: '13:00' }).run();
    }
    const before = workspaceSnapshot(client);
    await request(app())
      .post(`${deletePath}/commit`)
      .send({ revision: preview.revision, confirmation: 'DELETE', acknowledged: true })
      .expect(409);
    expect(workspaceSnapshot(client)).toEqual(before);
    expect(client.database.select().from(subscriptions).all()).toHaveLength(1);
  });
  it('rolls back financial deletion when a later notification-table deletion fails', async () => {
    const before = workspaceSnapshot(client);
    const preview = (await request(app()).post(`${deletePath}/preview`).send({}).expect(200)).body.data;
    client.sqlite.exec(
      'CREATE TRIGGER reject_delete BEFORE DELETE ON reminder_preferences ' +
        "BEGIN SELECT RAISE(ABORT, 'simulated delete failure'); END",
    );
    await request(app())
      .post(`${deletePath}/commit`)
      .send({ revision: preview.revision, confirmation: 'DELETE', acknowledged: true })
      .expect(409);
    expect(workspaceSnapshot(client)).toEqual(before);
    expect(client.database.select().from(subscriptions).all()).toHaveLength(1);
    expect(client.database.select().from(reminderAttempts).all()).toHaveLength(1);
  });
});

describe('Actual financial overwrite through the workspace API', () => {
  it('replaces colliding edited identities and removes unrelated data while retaining device settings', async () => {
    const incoming = actualReplacement(convertActual(actualFixture(), JSON.stringify({ id: 'actual-overwrite-api' })));
    const repository = createWorkspaceRepository(client);
    repository.atomic(() => repository.replace(incoming));
    client.database
      .update(accounts)
      .set({ name: 'Edited imported account' })
      .where(eq(accounts.id, incoming.accounts[0]!.id))
      .run();
    const old = workspaceSnapshot(client);
    const preview = (await request(app()).post(`${path}/preview`).send({ data: incoming }).expect(200)).body.data;
    expect(workspaceSnapshot(client)).toEqual(old);
    await request(app())
      .post(`${path}/commit`)
      .send({ data: incoming, revision: preview.revision, confirmation: 'REPLACE' })
      .expect(200);
    expect(workspaceSchema.parse(workspaceSnapshot(client)).accounts).toEqual(incoming.accounts);
    expect(workspaceSnapshot(client).transactions).toEqual(incoming.transactions);
    expect(client.database.select().from(subscriptions).all()).toHaveLength(1);
    expect(client.database.select().from(reminderPreferences).all()[0]!.deliveryTime).toBe('12:00');
    client.sqlite.close();
    client = openDatabase({ filePath: resolve(directory, 'app.sqlite'), busyTimeout: 0 });
    expect(workspaceSnapshot(client).accounts).toEqual(incoming.accounts);
  });
});
