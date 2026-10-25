import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import webpush from 'web-push';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
  statSync,
  existsSync,
  chmodSync,
  symlinkSync,
  readdirSync,
} from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { openDatabase } from '../../db/client.js';
import type { DatabaseClient } from '../../db/client.js';
import { applyMigrations } from '../../db/migrations.js';
import { loadEnvironment } from '../../app/config/environment.js';
import { createApp } from '../../app/createApp.js';
import { createLogger } from '../../lib/logger/logger.js';
import { createDeviceRepository } from './device.repository.js';
import { createReminderRepository } from './reminders.repository.js';
import { createWorkspaceRepository } from '../workspace/workspace.repository.js';
import { createWorkspaceDeletion } from '../workspace/workspaceDelete.service.js';
import { configureServerPush, resolveServerPush } from './automaticPush.js';
import { VAPID } from './vapid.constants.js';
import { validateSigningKeys } from './vapidKeys.js';
import * as vapidFile from './vapidFile.js';
const root = resolve('.test-data');
const endpoint = 'https://fcm.googleapis.com/fcm/send/automatic-fixture';
let directory: string;
let client: DatabaseClient;
let file: string;
/** Isolate every key and database from the real app volume. @returns {ReturnType<typeof loadEnvironment>} Settings. */
function configuration() {
  const base = loadEnvironment();
  return {
    ...base,
    database: { ...base.database, filePath: join(directory, 'app.sqlite') },
    origins: ['https://folio.example'],
    push: { publicKey: '', privateKey: '', subject: '' },
  };
}
beforeEach(() => {
  mkdirSync(root, { recursive: true });
  directory = mkdtempSync(join(root, 'auto-vapid-'));
  client = openDatabase({ filePath: join(directory, 'app.sqlite'), busyTimeout: 0 }, true);
  applyMigrations(client);
  file = `${join(directory, 'app.sqlite')}${VAPID.suffix}`;
});
afterEach(() => {
  vi.restoreAllMocks();
  if (client.sqlite.open) {
    client.sqlite.close();
  }
  if (directory === root || relative(root, directory).startsWith('..')) {
    throw new Error('Unsafe cleanup');
  }
  rmSync(directory, { recursive: true, force: true });
});
describe('automatic server VAPID initialization', () => {
  it('generates a valid owner-only identity and exposes only the public key without any manual configuration', async () => {
    const cfg = configuration();
    const push = configureServerPush(client, cfg, createLogger('silent'));
    expect(push.publicKey.length).toBeGreaterThan(0);
    expect(push.subject).toBe('https://folio.example');
    expect(validateSigningKeys(push).publicKey).toBe(push.publicKey);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    const sender = vi.spyOn(webpush, 'sendNotification').mockResolvedValue({ statusCode: 201, headers: {}, body: '' });
    const app = createApp(client, { ...cfg, push }, createLogger('silent'));
    const result = await request(app).get('/api/v1/notifications/config').expect(200);
    expect(result.body.data).toEqual({ enabled: true, publicKey: push.publicKey, subscriptions: 0 });
    expect(JSON.stringify(result.body).includes(push.privateKey)).toBe(false);
    const headers = webpush.getVapidHeaders(
      'https://fcm.googleapis.com',
      push.subject,
      push.publicKey,
      push.privateKey,
      'aes128gcm',
    );
    expect(headers.Authorization.startsWith('vapid t=')).toBe(true);
    await request(app)
      .post('/api/v1/notifications/subscriptions')
      .send({ endpoint, keys: { p256dh: 'fictional-encryption-key', auth: 'fictional-auth' } })
      .expect(201);
    await request(app).post('/api/v1/notifications/test').send({ endpoint }).expect(200);
    expect(sender).toHaveBeenCalledOnce();
    expect(sender.mock.calls[0]![2]?.vapidDetails?.publicKey).toBe(push.publicKey);
  });
  it('reuses the identical persisted pair across database/process replacement and retains registered devices', () => {
    const cfg = configuration();
    const first = resolveServerPush(client, cfg);
    createReminderRepository(client).save({ endpoint, p256dh: 'fictional-key', auth: 'fictional-auth' });
    const bytes = readFileSync(file, 'utf8');
    client.sqlite.close();
    client = openDatabase({ filePath: cfg.database.filePath, busyTimeout: 0 });
    const generate = vi.spyOn(webpush, 'generateVAPIDKeys');
    chmodSync(file, 0o644);
    const second = resolveServerPush(client, cfg);
    expect(second.publicKey === first.publicKey && second.privateKey === first.privateKey).toBe(true);
    expect(readFileSync(file, 'utf8') === bytes).toBe(true);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(createDeviceRepository(client).count()).toBe(1);
    expect(generate).not.toHaveBeenCalled();
  });
  it('adopts explicit existing keys and persists an explicit replacement without falling back to an older pair', () => {
    const cfg = configuration();
    const first = resolveServerPush(client, cfg);
    const invalid = { ...webpush.generateVAPIDKeys(), subject: 'invalid-contact' };
    expect(() => resolveServerPush(client, { ...cfg, push: invalid })).toThrow();
    expect(vapidFile.readVapidFile(file)?.publicKey).toBe(first.publicKey);
    const explicit = { ...webpush.generateVAPIDKeys(), subject: 'mailto:owner@example.com' };
    const next = resolveServerPush(client, { ...cfg, push: explicit });
    expect(next.publicKey).toBe(explicit.publicKey);
    expect(next.publicKey === first.publicKey).toBe(false);
    expect(next.subject).toBe(explicit.subject);
    expect(resolveServerPush(client, cfg).publicKey).toBe(explicit.publicKey);
  });
  it('never overwrites damaged saved keys or generates replacement keys for existing unbound devices', () => {
    const cfg = configuration();
    writeFileSync(file, 'malformed private configuration', { mode: 0o600 });
    const generate = vi.spyOn(webpush, 'generateVAPIDKeys');
    expect(() => resolveServerPush(client, cfg)).toThrow(VAPID.invalidKeys);
    expect(readFileSync(file, 'utf8')).toBe('malformed private configuration');
    rmSync(file);
    createReminderRepository(client).save({ endpoint, p256dh: 'fictional-key', auth: 'fictional-auth' });
    expect(() => resolveServerPush(client, cfg)).toThrow(VAPID.missingKeys);
    expect(existsSync(file)).toBe(false);
    expect(generate).not.toHaveBeenCalled();
    const restored = webpush.generateVAPIDKeys();
    expect(resolveServerPush(client, { ...cfg, push: { ...restored, subject: '' } }).publicKey).toBe(
      restored.publicKey,
    );
  });
  it('rejects mismatched/incomplete configured pairs and unsafe symlink storage without disclosing secrets', () => {
    const first = webpush.generateVAPIDKeys();
    const other = webpush.generateVAPIDKeys();
    expect(() => validateSigningKeys({ ...first, publicKey: other.publicKey })).toThrow(VAPID.invalidKeys);
    expect(() =>
      resolveServerPush(client, { ...configuration(), push: { ...first, privateKey: '', subject: '' } }),
    ).toThrow(VAPID.invalidKeys);
    expect(existsSync(file)).toBe(false);
    const target = join(directory, 'unrelated-private');
    writeFileSync(target, 'Keep this file');
    symlinkSync(target, file);
    const logger = createLogger('silent');
    const error = vi.spyOn(logger, 'error');
    const disabled = configureServerPush(client, configuration(), logger);
    expect(disabled.publicKey).toBe('');
    expect(error).toHaveBeenCalledWith(VAPID.setupFailed);
    expect(readFileSync(target, 'utf8')).toBe('Keep this file');
  });
  it('keeps the budget available after a durable-write failure and logs no provider or private-key values', async () => {
    const cfg = configuration();
    const secret = webpush.generateVAPIDKeys().privateKey;
    vi.spyOn(vapidFile, 'persistVapidFile').mockImplementation(() => {
      throw new Error(secret);
    });
    const logger = createLogger('silent');
    const error = vi.spyOn(logger, 'error');
    const push = configureServerPush(client, cfg, logger);
    const app = createApp(client, { ...cfg, push }, logger);
    await request(app).get('/api/v1/health').expect(200);
    const response = await request(app).get('/api/v1/notifications/config').expect(200);
    expect(response.body.data.enabled).toBe(false);
    expect(JSON.stringify(error.mock.calls).includes(secret)).toBe(false);
    expect(existsSync(file)).toBe(false);
  });
  it('keeps server signing configuration across the explicitly confirmed deletion of all user data', () => {
    const cfg = configuration();
    const first = resolveServerPush(client, cfg);
    createReminderRepository(client).save({ endpoint, p256dh: 'fictional-key', auth: 'fictional-auth' });
    const deletion = createWorkspaceDeletion(createWorkspaceRepository(client));
    const review = deletion.preview();
    deletion.commit(review.revision);
    expect(createDeviceRepository(client).count()).toBe(0);
    expect(resolveServerPush(client, cfg).publicKey).toBe(first.publicKey);
    expect(JSON.stringify(review).includes(first.privateKey)).toBe(false);
  });
  it('publishes exactly one complete identity during concurrent first starts without leaving temporary files', async () => {
    const module = pathToFileURL(resolve('backend/src/features/reminders/vapidFile.ts')).href;
    const script = `import webpush from 'web-push'; import {persistVapidFile} from ${JSON.stringify(module)};
      process.stdout.write(persistVapidFile(${JSON.stringify(file)}, webpush.generateVAPIDKeys()).publicKey);`;
    const run = promisify(execFile);
    const values = await Promise.all(
      [0, 1, 2].map(() => run(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script])),
    );
    expect(new Set(values.map((result) => result.stdout)).size).toBe(1);
    expect(vapidFile.readVapidFile(file)?.publicKey).toBe(values[0]!.stdout);
    expect(readdirSync(directory).some((name) => name.endsWith('.tmp'))).toBe(false);
  });
});
