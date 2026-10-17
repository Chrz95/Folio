import { environment } from '../../app/config/environment';
import { request } from '../../lib/api/client';
import { APP } from '../../constants/app.constants';
import { readDemo, writeDemo } from '../../lib/storage/demoStore';
import { actualInputSchema, actualCommitSchema } from './actualSchema';
import type { ActualFile } from './actualSchema';
import { actualPlan, canonical, mergeActual } from './actualMerge';
import type { ActualReview } from './actualMerge';
import { ACTUAL } from './actual.constants';
/** Bind a review to the exact source and destination. @param {unknown} value - Snapshot pair.
 * @returns {Promise<string>} SHA-256 revision. */
async function digest(value: unknown) {
  const bytes = new TextEncoder().encode(canonical(value));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((byte) => byte.toString(ACTUAL.hexRadix).padStart(ACTUAL.hexDigits, '0'))
    .join('');
}
/** Enforce the same request size as the API before sending normalized fields.
 * @param {unknown} value - Validated body. @returns {string} Bounded JSON. */
function body(value: unknown) {
  const json = JSON.stringify(value);
  if (new TextEncoder().encode(json).length > ACTUAL.bodyBytes) {
    throw new Error('Normalized import exceeds 8 MiB. Export a smaller budget.');
  }
  return json;
}
/** Build an authoritative read-only review. @param {ActualFile} file - Source.
 * @returns {Promise<ActualReview>} Additions and balances. */
export async function previewActual(file: ActualFile): Promise<ActualReview> {
  const input = actualInputSchema.parse({ file, currencyConfirmed: true });
  const payload = body(input);
  if (!environment.isDemo) {
    return request(`${ACTUAL.path}/preview`, { method: 'POST', body: payload });
  }
  const data = readDemo();
  const plan = actualPlan(data, input.file);
  const revision = await digest([data, input.file]);
  return { ...plan, revision };
}
/** Recheck the exact review and persist all additions atomically.
 * @param {ActualFile} file - Reviewed source. @param {string} revision - Review identity.
 * @returns {Promise<ActualReview['added']>} Actual insertion counts. */
export async function commitActual(file: ActualFile, revision: string): Promise<ActualReview['added']> {
  const input = actualCommitSchema.parse({ file, revision, currencyConfirmed: true });
  const payload = body(input);
  if (!environment.isDemo) {
    return request(`${ACTUAL.path}/commit`, { method: 'POST', body: payload });
  }
  const previous = localStorage.getItem(APP.storageKey);
  const data = readDemo();
  const current = await digest([data, input.file]);
  if (current !== revision || localStorage.getItem(APP.storageKey) !== previous) {
    throw new Error('The workspace changed. Review this import again.');
  }
  const plan = actualPlan(data, input.file);
  writeDemo(mergeActual(data, plan.rows));
  return plan.added;
}
