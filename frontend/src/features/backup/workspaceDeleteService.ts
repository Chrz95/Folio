import { environment } from '../../app/config/environment';
import { APP } from '../../constants/app.constants';
import { PWA } from '../../pwa/pwa.constants';
import { REMINDER_STORAGE, REMINDER_EVENT } from '../reminders/reminders.constants';
import { request } from '../../lib/api/client';
import { sha256 } from '../../lib/sha256';
import { readDemo, writeDemo } from '../../lib/storage/demoStore';
import { BACKUP } from './backup.constants';
import { workspaceCanonical } from './workspaceImportPlan';
import { emptyWorkspace } from './emptyWorkspace';
const LOCAL_KEYS = [APP.storageKey, APP.preferencesKey, APP.notificationsKey, REMINDER_STORAGE, PWA.dismissalKey];
export interface DeletionReview {
  revision: string;
  localRevision: string;
  counts: { key: string; before: number; after: number }[];
}
/** Read owned keys for a synchronous concurrent-tab guard. @returns {string} Canonical local state. */
function localState(): string {
  return workspaceCanonical(LOCAL_KEYS.map((key) => [key, localStorage.getItem(key)]));
}
/** Bind deletion to this browser's exact Folio data and preferences without retaining raw private values.
 * @returns {Promise<string>} SHA-256 revision. */
async function localRevision(): Promise<string> {
  return sha256(localState());
}
/** Preview owned data only; no deletion or subscription changes occur here.
 * @returns {Promise<DeletionReview>} Private-value-free summary. */
export async function reviewDeletion(): Promise<DeletionReview> {
  const revision = await localRevision();
  if (!environment.isDemo) {
    const server = await request<Omit<DeletionReview, 'localRevision'>>(`${BACKUP.deletePath}/preview`, {
      method: 'POST',
      body: '{}',
    });
    return { ...server, localRevision: revision };
  }
  const counts = Object.entries(readDemo())
    .filter(([, rows]) => Array.isArray(rows))
    .map(([key, rows]) => ({ key, before: rows.length, after: 0 }));
  return { revision, localRevision: revision, counts };
}
/** Clear only owned browser preferences after durable deletion; report cleanup failures separately.
 * @returns {boolean} Whether every local cleanup succeeded. */
function clearLocalPreferences(): boolean {
  let cleared = true;
  for (const key of LOCAL_KEYS.filter((key) => key !== APP.storageKey)) {
    try {
      localStorage.removeItem(key);
    } catch {
      cleared = false;
    }
  }
  window.dispatchEvent(new Event(REMINDER_EVENT));
  return cleared;
}
/** Require exact typed consent and a fresh review before the one destructive write.
 * @param {DeletionReview} review - Current summary. @param {string} word - User-entered confirmation.
 * @param {boolean} acknowledged - Explicit checkbox. @returns {Promise<boolean>} Local cleanup success. */
export async function deleteAllData(review: DeletionReview, word: string, acknowledged: boolean): Promise<boolean> {
  if (word !== BACKUP.deleteWord || !acknowledged) {
    throw new Error('Confirm deletion and enter DELETE exactly.');
  }
  const previous = localState();
  if ((await localRevision()) !== review.localRevision || localState() !== previous) {
    throw new Error('The app data changed. Review deletion again.');
  }
  if (!environment.isDemo) {
    await request(`${BACKUP.deletePath}/commit`, {
      method: 'POST',
      body: JSON.stringify({ revision: review.revision, confirmation: word, acknowledged }),
    });
    try {
      writeDemo(emptyWorkspace());
    } catch {
      return false;
    }
  } else {
    writeDemo(emptyWorkspace());
  }
  return clearLocalPreferences();
}
