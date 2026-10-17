import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
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
import { createReminderRepository } from '../reminders/reminders.repository.js';
import { createReminderStateRepository } from '../reminders/reminderState.repository.js';
import { DEFAULT_REMINDER_PREFERENCES } from '../reminders/reminders.constants.js';
import { runReminderScan } from '../reminders/reminderDelivery.js';
import { createScheduleService } from './schedule.service.js';
import { createScheduleRepository } from './schedule.repository.js';
const testRoot = resolve('.test-data');
const accountId = '11111111-1111-4111-8111-111111111111';
const recurringId = '22222222-2222-4222-8222-222222222222';
const template = {
  id: recurringId,
  name: 'Rent',
  amount: 10000,
  type: 'expense' as const,
  category: 'Housing',
  accountId,
  destinationAccountId: null,
  date: '2026-01-31',
  notes: '',
  frequency: 'monthly' as const,
  reminderDays: 2,
};
let client: DatabaseClient;
let directory: string;
beforeEach(() => {
  mkdirSync(testRoot, { recursive: true });
  directory = mkdtempSync(join(testRoot, 'schedules-'));
  client = openDatabase({ filePath: join(directory, 'app.sqlite'), busyTimeout: 0 }, true);
  applyMigrations(client);
  client.database.insert(accounts).values({ id: accountId, name: 'Everyday', openingBalance: 100000 }).run();
  client.database.insert(recurring).values(template).run();
});
afterEach(() => {
  if (client.sqlite.open) {
    client.sqlite.close();
  }
  if (directory === testRoot || relative(testRoot, directory).startsWith('..')) {
    throw new Error('Unsafe cleanup');
  }
  rmSync(directory, { recursive: true, force: true });
});
/** Construct a real HTTP boundary without a listener. @returns {import('express').Express} App. */
function app() {
  return createApp(client, loadEnvironment(), createLogger('silent'));
}
/** Set complete control state. @param {boolean} isPaused - Pause flag. @param {string | null} endDate - Inclusive end.
 * @returns {Promise<request.Response>} Response. */
async function control(isPaused: boolean, endDate: string | null = null) {
  return request(app()).put('/api/v1/schedules/settings').send({ recurringId, isPaused, endDate }).expect(200);
}
describe('durable schedule controls', () => {
  it('pauses unpaid posting while preserving acknowledged payment retries and durable state', async () => {
    const first = await request(app())
      .post(`/api/v1/recurring/${recurringId}/pay`)
      .send({ date: '2026-01-31' })
      .expect(200);
    await control(true);
    const retry = await request(app())
      .post(`/api/v1/recurring/${recurringId}/pay`)
      .send({ date: '2026-01-31' })
      .expect(200);
    expect(retry.body.data.id).toBe(first.body.data.id);
    await request(app()).post(`/api/v1/recurring/${recurringId}/pay`).send({ date: '2026-02-28' }).expect(409);
    client.sqlite.close();
    client = openDatabase({ filePath: join(directory, 'app.sqlite'), busyTimeout: 0 });
    expect((await request(app()).get('/api/v1/schedules').expect(200)).body.data.scheduleSettings[0].isPaused).toBe(
      true,
    );
    await control(false);
    await request(app()).post(`/api/v1/recurring/${recurringId}/pay`).send({ date: '2026-02-28' }).expect(200);
    expect(client.database.select().from(transactions).all()).toHaveLength(2);
  });
  it('keeps end dates inclusive and validates anchor changes without rewriting actual history', async () => {
    await control(false, '2026-02-28');
    await request(app()).post(`/api/v1/recurring/${recurringId}/pay`).send({ date: '2026-02-28' }).expect(200);
    await request(app()).post(`/api/v1/recurring/${recurringId}/pay`).send({ date: '2026-03-31' }).expect(409);
    const { id: _id, ...input } = template;
    await request(app())
      .put(`/api/v1/recurring/${recurringId}`)
      .send({ ...input, date: '2026-03-01' })
      .expect(400);
    await request(app())
      .put('/api/v1/schedules/settings')
      .send({ recurringId, isPaused: false, endDate: '2026-01-30' })
      .expect(400);
    expect(client.database.select().from(transactions).get()?.date).toBe('2026-02-28');
  });
  it('protects paid dates, restores skips idempotently and cascades only schedule metadata', async () => {
    const skip = { recurringId, date: '2026-02-28', isSkipped: true };
    await request(app()).put('/api/v1/schedules/occurrences').send(skip).expect(204);
    await request(app()).put('/api/v1/schedules/occurrences').send(skip).expect(204);
    await request(app()).post(`/api/v1/recurring/${recurringId}/pay`).send({ date: skip.date }).expect(409);
    await request(app())
      .put('/api/v1/schedules/occurrences')
      .send({ ...skip, isSkipped: false })
      .expect(204);
    await request(app()).post(`/api/v1/recurring/${recurringId}/pay`).send({ date: skip.date }).expect(200);
    await request(app()).put('/api/v1/schedules/occurrences').send(skip).expect(409);
    await control(true);
    await request(app())
      .put('/api/v1/schedules/occurrences')
      .send({ ...skip, date: '2026-03-31' })
      .expect(204);
    await request(app()).delete(`/api/v1/recurring/${recurringId}`).expect(204);
    const state = (await request(app()).get('/api/v1/schedules').expect(200)).body.data;
    expect(state).toEqual({ scheduleSettings: [], skippedOccurrences: [] });
    expect(client.database.select().from(transactions).get()?.recurringId).toBeNull();
  });
  it('clears skips only when the start or frequency changes and includes controls in portable export', async () => {
    await control(false, '2027-12-31');
    await request(app())
      .put('/api/v1/schedules/occurrences')
      .send({ recurringId, date: '2026-02-28', isSkipped: true })
      .expect(204);
    const { id: _id, ...input } = template;
    await request(app())
      .put(`/api/v1/recurring/${recurringId}`)
      .send({ ...input, name: 'Rent updated' })
      .expect(200);
    const exported = (await request(app()).get('/api/v1/workspace/export').expect(200)).body.data;
    expect(exported.scheduleSettings).toHaveLength(1);
    expect(exported.skippedOccurrences).toHaveLength(1);
    await request(app())
      .put(`/api/v1/recurring/${recurringId}`)
      .send({ ...input, frequency: 'weekly' })
      .expect(200);
    expect((await request(app()).get('/api/v1/schedules').expect(200)).body.data.skippedOccurrences).toHaveLength(0);
  });
  it('validates IDs, dates and strict payloads and refuses snoozing disabled occurrences', async () => {
    await request(app())
      .put('/api/v1/schedules/settings')
      .send({ recurringId: 'bad', isPaused: false, endDate: null })
      .expect(400);
    await request(app())
      .put('/api/v1/schedules/settings')
      .send({ recurringId, isPaused: false, endDate: null, extra: true })
      .expect(400);
    await request(app())
      .put('/api/v1/schedules/occurrences')
      .send({ recurringId, date: '2026-02-27', isSkipped: true })
      .expect(400);
    await request(app())
      .put('/api/v1/schedules/settings')
      .send({ recurringId: crypto.randomUUID(), isPaused: true, endDate: null })
      .expect(404);
    await control(true);
    await request(app())
      .post('/api/v1/notifications/snooze')
      .send({ recurringId, date: '2026-02-28', minutes: 60 })
      .expect(400);
  });
  it('rechecks the current schedule policy before each provider send in an in-flight scan', async () => {
    client.database.update(recurring).set({ date: '2026-10-16', frequency: 'once' }).run();
    const laterId = crypto.randomUUID();
    client.database
      .insert(recurring)
      .values({ ...template, id: laterId, date: '2026-10-17', frequency: 'once' })
      .run();
    createReminderRepository(client).save({
      endpoint: 'https://push.example.test/schedule',
      p256dh: 'public',
      auth: 'auth',
    });
    createReminderStateRepository(client).savePreferences({
      ...DEFAULT_REMINDER_PREFERENCES,
      timeZone: 'Europe/Athens',
      deliveryTime: '09:00',
    });
    const service = createScheduleService(createScheduleRepository(client));
    const send = vi.fn().mockImplementation(async () => {
      service.saveSettings({ recurringId: laterId, isPaused: true, endDate: null });
      return { statusCode: 201, body: '', headers: {} };
    });
    await runReminderScan(client, createLogger('silent'), Date.parse('2026-10-16T07:00:00Z'), send);
    expect(send).toHaveBeenCalledOnce();
    const history = createReminderStateRepository(client).history();
    expect(history).toHaveLength(1);
  });
});
