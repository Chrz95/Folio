import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import {
  constants,
  openSync,
  closeSync,
  fstatSync,
  fchmodSync,
  readFileSync,
  writeFileSync,
  fsyncSync,
  linkSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { VAPID } from './vapid.constants.js';
import { validateSigningKeys } from './vapidKeys.js';
import type { SigningKeys } from './vapidKeys.js';
/** Make an atomically published key name durable, including concurrent initial readers.
 * @param {string} path - Key file. @returns {void} Flushes the existing data directory. */
function flushKeyDirectory(path: string): void {
  const directory = openSync(dirname(path), constants.O_RDONLY);
  try {
    fsyncSync(directory);
  } finally {
    closeSync(directory);
  }
}
/** Read only a bounded regular file, never a symlink or an incomplete temporary file.
 * @param {string} path - Sidecar in the existing SQLite volume.
 * @returns {SigningKeys | undefined} Existing pair or absent file; invalid files are retained for recovery. */
export function readVapidFile(path: string): SigningKeys | undefined {
  let handle: number;
  try {
    handle = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
  try {
    const stat = fstatSync(handle);
    if (!stat.isFile() || stat.size > VAPID.maximumFileBytes) {
      throw new Error(VAPID.invalidKeys);
    }
    fchmodSync(handle, VAPID.privateMode);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(readFileSync(handle, 'utf8')) as Record<string, unknown>;
    } catch {
      throw new Error(VAPID.invalidKeys);
    }
    if (!parsed || parsed.version !== VAPID.version) {
      throw new Error(VAPID.invalidKeys);
    }
    const keys = validateSigningKeys(parsed);
    flushKeyDirectory(path);
    return keys;
  } finally {
    closeSync(handle);
  }
}
/** Publish a fully flushed private file atomically; concurrent first starts reuse the winning pair.
 * @param {string} path - Persistent sidecar. @param {SigningKeys} input - Validated signing pair.
 * @param {boolean} replace - Only explicit environment configuration may replace a stored identity.
 * @returns {SigningKeys} Durable pair that callers may safely use for new subscriptions. */
export function persistVapidFile(path: string, input: SigningKeys, replace = false): SigningKeys {
  const keys = validateSigningKeys(input);
  const temporary = `${path}.${randomUUID()}.tmp`;
  const handle = openSync(temporary, 'wx', VAPID.privateMode);
  try {
    try {
      writeFileSync(handle, JSON.stringify({ version: VAPID.version, ...keys }));
      fsyncSync(handle);
    } finally {
      closeSync(handle);
    }
    try {
      if (replace) {
        renameSync(temporary, path);
      } else {
        linkSync(temporary, path);
      }
    } catch (error) {
      if (!replace && (error as NodeJS.ErrnoException).code === 'EEXIST') {
        const existing = readVapidFile(path);
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
    flushKeyDirectory(path);
    return keys;
  } finally {
    rmSync(temporary, { force: true });
  }
}
