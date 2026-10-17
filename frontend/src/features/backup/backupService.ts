import { z } from 'zod';
import { BACKUP } from './backup.constants';
import { workspaceSchema } from './backupSchema';
import type { RestorableWorkspace } from './backupSchema';
import { validateBackupRelations } from './backupRelations';
import { environment } from '../../app/config/environment';
import { request } from '../../lib/api/client';
import { readDemo, writeDemo } from '../../lib/storage/demoStore';
import { APP } from '../../constants/app.constants';
import type { BudgetData } from '../../types/budget';
const envelope = z
  .object({
    format: z.literal(BACKUP.format),
    version: z.literal(BACKUP.version),
    exportedAt: z.iso.datetime(),
    data: z.unknown(),
  })
  .strict();
/** Validate a legacy raw export or a versioned backup without touching storage.
 * @param {string} text - User-selected JSON. @returns {RestorableWorkspace} Complete reviewed data. */
export function parseBackup(text: string): RestorableWorkspace {
  if (new TextEncoder().encode(text).length > BACKUP.maximumBytes) {
    throw new Error('Choose a workspace backup of up to 8 MiB.');
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (value && typeof value === 'object' && 'format' in value) {
    const wrapped = envelope.safeParse(value);
    if (!wrapped.success) {
      throw new Error('This backup format or version is not supported.');
    }
    value = wrapped.data.data;
  }
  const parsed = workspaceSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('The backup contains missing fields, invalid values or unsupported data.');
  }
  validateBackupRelations(parsed.data);
  return parsed.data;
}
/** Export one fresh financial snapshot including receipt bytes. @returns {Promise<string>} Portable JSON. */
export async function exportBackup(): Promise<string> {
  const data = environment.isDemo ? readDemo() : await request<BudgetData>('/workspace/export');
  return JSON.stringify({ format: BACKUP.format, version: BACKUP.version, exportedAt: new Date().toISOString(), data });
}
/** Apply a reviewed replacement only if this preview has not changed since review.
 * @param {RestorableWorkspace} reviewed - Validated snapshot. @param {string | null} previous - Exact prior storage.
 * @returns {void} A single atomic browser storage replacement. */
export function restoreBackup(reviewed: RestorableWorkspace, previous: string | null) {
  if (!environment.isDemo) {
    throw new Error('Restore a complete SQLite backup in the self-hosted application.');
  }
  if (localStorage.getItem(APP.storageKey) !== previous) {
    throw new Error('The preview changed. Select and review the backup again.');
  }
  const validated = parseBackup(JSON.stringify(reviewed));
  writeDemo(validated);
}
