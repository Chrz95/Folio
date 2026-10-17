import { environment } from '../../app/config/environment';
import { APP } from '../../constants/app.constants';
import { request } from '../../lib/api/client';
import { readDemo, writeDemo } from '../../lib/storage/demoStore';
import { workspaceSchema } from './backupSchema';
import type { RestorableWorkspace } from './backupSchema';
import { parseBackup } from './backupService';
import { BACKUP } from './backup.constants';
import { pauseImportedSchedules, workspaceCanonical, workspaceCounts } from './workspaceImportPlan';
import type { WorkspaceImportReview } from './workspaceImportPlan';
/** Hash the exact financial state and effective import. @param {unknown} value - Snapshot pair.
 * @returns {Promise<string>} SHA-256 review identity. */
async function revisionFor(value: unknown) {
  const hex = { radix: 16, width: 2 };
  const bytes = new TextEncoder().encode(workspaceCanonical(value));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((byte) => byte.toString(hex.radix).padStart(hex.width, '0'))
    .join('');
}
/** Enforce the JSON body boundary before making a network request. @param {unknown} input - Contract.
 * @returns {string} Bounded serialized payload. */
function body(input: unknown) {
  const value = JSON.stringify(input);
  const limit = environment.isDemo ? BACKUP.maximumBytes : BACKUP.maximumServerBytes;
  if (new TextEncoder().encode(value).length > limit) {
    throw new Error('The normalized import is too large.');
  }
  return value;
}
/** Validate and preview a replacement without changing any financial or notification data.
 * @param {RestorableWorkspace} data - Validated source.
 * @returns {Promise<WorkspaceImportReview>} Authoritative review. */
export async function reviewWorkspace(data: RestorableWorkspace): Promise<WorkspaceImportReview> {
  const source = parseBackup(JSON.stringify(data));
  const payload = body({ data: source });
  if (!environment.isDemo) {
    return request(`${BACKUP.importPath}/preview`, { method: 'POST', body: payload });
  }
  const before = workspaceSchema.parse(readDemo());
  const after = pauseImportedSchedules(source);
  return { revision: await revisionFor([before, after]), counts: workspaceCounts(before, after) };
}
/** Commit only an acknowledged current review, preserving browser settings outside the financial key.
 * @param {RestorableWorkspace} data - Source. @param {string} revision - Reviewed identity.
 * @returns {Promise<void>} Durable completion; failed writes leave the previous snapshot intact. */
export async function importWorkspace(data: RestorableWorkspace, revision: string): Promise<void> {
  const source = parseBackup(JSON.stringify(data));
  const payload = body({ data: source, revision, confirmation: BACKUP.confirmation });
  if (!environment.isDemo) {
    await request(`${BACKUP.importPath}/commit`, { method: 'POST', body: payload });
    return;
  }
  const previous = localStorage.getItem(APP.storageKey);
  const before = workspaceSchema.parse(readDemo());
  const after = pauseImportedSchedules(source);
  const current = await revisionFor([before, after]);
  if (current !== revision || localStorage.getItem(APP.storageKey) !== previous) {
    throw new Error('The workspace changed. Review the import again.');
  }
  writeDemo(after);
}
