import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import webpush from 'web-push';
import { mkdirSync, mkdtempSync, rmSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { openDatabase } from '../../db/client.js';
import type { DatabaseClient } from '../../db/client.js';
import { applyMigrations } from '../../db/migrations.js';
import { loadEnvironment, parseDatabaseEnvironment } from '../../app/config/environment.js';
import { createApp } from '../../app/createApp.js';
import { createLogger } from '../../lib/logger/logger.js';
import { subscriptions } from '../../db/schema/budget.js';
import { createDeviceRepository } from './device.repository.js';
import { createDeviceService } from './device.service.js';
import { generatePushConfiguration } from './generatePushKeys.js';
const root = parseDatabaseEnvironment().testDirectory;
const path = '/api/v1/notifications';
const endpoint = 'https://fcm.googleapis.com/fcm/send/browser-fixture';
const phone = 'https://web.push.apple.com/phone-fixture';
const push = { publicKey: 'fixture-public', privateKey: 'fixture-private', subject: 'mailto:operator@example.com' };
let directory: string;
let client: DatabaseClient;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-17T12:00:00Z'));
  mkdirSync(root, { recursive: true });
  directory = mkdtempSync(join(root, 'devices-'));
  client = openDatabase({ filePath: resolve(directory, 'app.sqlite'), busyTimeout: 0 }, true);
  applyMigrations(client);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  if (client.sqlite.open) {
    client.sqlite.close();
  }
  if (!directory.startsWith(`${root}/devices-`)) {
    throw new Error('Unsafe cleanup');
  }
  rmSync(directory, { recursive: true, force: true });
});
/** Construct the real notification HTTP boundary with optional signing disabled.
 * @param {boolean} enabled - Configured signing pair. @returns {import('express').Express} Application. */
function app(enabled = true) {
  return createApp(
    client,
    { ...loadEnvironment(), apiPrefix: '/api/v1', push: enabled ? push : { ...push, publicKey: '', privateKey: '' } },
    createLogger('silent'),
  );
}
/** Opt one fictional browser into Web Push without contacting a provider.
 * @param {string} target - Allowlisted provider endpoint. @returns {Promise<void>} Stored subscription. */
async function register(target = endpoint) {
  await request(app())
    .post(`${path}/subscriptions`)
    .send({ endpoint: target, keys: { p256dh: 'fictional-encryption-key', auth: 'fictional-auth' } })
    .expect(201);
}
describe('per-device browser and phone notifications', () => {
  it('registers two devices, reports only counts/status and disconnects just one device', async () => {
    await register();
    await register(phone);
    const config = (await request(app()).get(`${path}/config`).expect(200)).body.data;
    expect(config).toEqual({ enabled: true, publicKey: push.publicKey, subscriptions: 2 });
    expect(JSON.stringify(config)).not.toContain(push.privateKey);
    expect(
      (await request(app()).post(`${path}/subscriptions/status`).send({ endpoint }).expect(200)).body.data.registered,
    ).toBe(true);
    await request(app()).delete(`${path}/subscriptions`).send({ endpoint }).expect(204);
    expect(
      client.database
        .select()
        .from(subscriptions)
        .all()
        .map((row) => row.endpoint),
    ).toEqual([phone]);
  });
  it('tests only the registered current device with generic payload and explicit VAPID settings', async () => {
    const sender = vi.spyOn(webpush, 'sendNotification').mockResolvedValue({ statusCode: 201, headers: {}, body: '' });
    await register();
    await register(phone);
    await request(app())
      .post(`${path}/test`)
      .send({ endpoint })
      .expect(200, { data: { accepted: true } });
    expect(sender).toHaveBeenCalledOnce();
    expect(sender.mock.calls[0]![0].endpoint).toBe(endpoint);
    expect(sender.mock.calls[0]![2]?.vapidDetails).toEqual(push);
    const payload = JSON.parse(String(sender.mock.calls[0]![1]));
    expect(payload.body).not.toContain('€');
    expect(payload.title).toBe('Folio notifications are connected');
  });
  it('persists the cooldown across reopen and accepts a later test', async () => {
    const sender = vi.spyOn(webpush, 'sendNotification').mockResolvedValue({ statusCode: 201, headers: {}, body: '' });
    await register();
    await request(app()).post(`${path}/test`).send({ endpoint }).expect(200);
    client.sqlite.close();
    client = openDatabase({ filePath: resolve(directory, 'app.sqlite'), busyTimeout: 0 });
    await request(app()).post(`${path}/test`).send({ endpoint }).expect(429);
    vi.setSystemTime(new Date('2026-10-17T12:00:31Z'));
    await request(app()).post(`${path}/test`).send({ endpoint }).expect(200);
    expect(sender).toHaveBeenCalledTimes(2);
  });
  it('reserves before a pending send, preventing concurrent duplicate tests', async () => {
    await register();
    let finish: (value: { statusCode: number; headers: {}; body: string }) => void = () => undefined;
    const send = vi.fn(
      () =>
        new Promise<{ statusCode: number; headers: {}; body: string }>((resolve) => {
          finish = resolve;
        }),
    );
    const service = createDeviceService(createDeviceRepository(client), push, send);
    const pending = service.test(endpoint);
    await expect(service.test(endpoint)).rejects.toMatchObject({ code: 'TEST_COOLDOWN' });
    finish({ statusCode: 201, headers: {}, body: '' });
    await expect(pending).resolves.toEqual({ accepted: true });
    expect(send).toHaveBeenCalledOnce();
  });
  it('rejects disabled, unregistered and arbitrary provider targets without network calls', async () => {
    const sender = vi.spyOn(webpush, 'sendNotification');
    await request(app(false)).post(`${path}/test`).send({ endpoint }).expect(503);
    await request(app()).post(`${path}/test`).send({ endpoint }).expect(404);
    for (const target of [
      'not-a-url',
      'http://127.0.0.1:3001/',
      'https://attacker.example/push',
      'https://fcm.googleapis.com.attacker.example/push',
      'https://user:secret@fcm.googleapis.com/push',
    ]) {
      await request(app()).post(`${path}/test`).send({ endpoint: target }).expect(400);
    }
    expect(sender).not.toHaveBeenCalled();
  });
  it('removes expired registrations and reports provider failures without leaking provider responses', async () => {
    const sender = vi
      .spyOn(webpush, 'sendNotification')
      .mockRejectedValue(new webpush.WebPushError('Expired', 410, {}, 'provider-secret', endpoint));
    await register();
    const response = await request(app()).post(`${path}/test`).send({ endpoint }).expect(410);
    expect(JSON.stringify(response.body)).not.toContain('provider-secret');
    expect(client.database.select().from(subscriptions).all()).toHaveLength(0);
    sender.mockRejectedValue(new Error('Private provider response'));
    await register(phone);
    const failed = await request(app()).post(`${path}/test`).send({ endpoint: phone }).expect(502);
    expect(JSON.stringify(failed.body)).not.toContain('Private provider response');
    expect(client.database.select().from(subscriptions).all()).toHaveLength(1);
  });
  it('writes stable private key configuration only to a new owner-readable file', () => {
    const destination = join(directory, 'push.env');
    generatePushConfiguration(destination, 'mailto:operator@example.com');
    const original = readFileSync(destination, 'utf8');
    expect(original).toMatch(/VAPID_PUBLIC_KEY=[A-Za-z0-9_-]+/);
    expect(original).toMatch(/VAPID_PRIVATE_KEY=[A-Za-z0-9_-]+/);
    expect(statSync(destination).mode & 0o777).toBe(0o600);
    expect(() => generatePushConfiguration(destination, 'mailto:operator@example.com')).toThrow();
    expect(readFileSync(destination, 'utf8')).toBe(original);
  });
});
