import type { RestorableWorkspace } from './backupSchema';
/** Stable object serialization binds reviewed bytes and destination rows independent of key order.
 * @param {unknown} value - Validated snapshot pair. @returns {string} Canonical JSON. */
export function workspaceCanonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(workspaceCanonical).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${workspaceCanonical(object[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
/** All imported schedules remain paused until the user deliberately resumes them.
 * @param {RestorableWorkspace} data - Validated source. @returns {RestorableWorkspace} Effective replacement. */
export function pauseImportedSchedules(data: RestorableWorkspace): RestorableWorkspace {
  return {
    ...data,
    scheduleSettings: data.recurring.map((row) => ({
      recurringId: row.id,
      isPaused: true,
      endDate: data.scheduleSettings.find((setting) => setting.recurringId === row.id)?.endDate ?? null,
    })),
  };
}
/** Describe every replaced collection without exposing file bytes in review responses.
 * @param {RestorableWorkspace} before - Current workspace. @param {RestorableWorkspace} after - Effective source.
 * @returns {object[]} Collection counts. */
export function workspaceCounts(before: RestorableWorkspace, after: RestorableWorkspace) {
  return (Object.keys(after) as (keyof RestorableWorkspace)[]).map((key) => ({
    key,
    before: before[key].length,
    after: after[key].length,
  }));
}
export interface WorkspaceImportReview {
  revision: string;
  counts: ReturnType<typeof workspaceCounts>;
}
