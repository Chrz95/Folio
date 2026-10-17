import type { SourceRow } from './source';
import type { ActualFile } from './actualSchema';
import { ACTUAL } from './actual.constants';
/** Preserve bounded failed rule definitions without any historical transactions or credentials.
 * @param {SourceRow} schedule - Failed schedule. @param {SourceRow | undefined} rule - Source rule.
 * @returns {string} JSON diagnostic, or an explicit omission for unusually large rules. */
export function scheduleDiagnostic(schedule: SourceRow, rule: SourceRow | undefined): string {
  const diagnostic = JSON.stringify({
    scheduleId: schedule.id,
    name: schedule.name,
    ruleId: schedule.rule,
    conditionsOp: rule?.conditions_op,
    conditions: rule?.conditions,
    actions: rule?.actions,
  });
  return diagnostic.length <= ACTUAL.diagnosticBytes
    ? diagnostic
    : JSON.stringify({ scheduleId: schedule.id, omitted: 'Rule exceeds the diagnostic size limit.' });
}
/** Decode only diagnostic strings for a readable download, never evaluate source rules.
 * @param {string | undefined} value - Optional diagnostic. @returns {unknown} Decoded JSON or original text. */
function readable(value: string | undefined): unknown {
  if (!value) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') {
      return parsed;
    }
    const result = { ...parsed } as Record<string, unknown>;
    for (const key of ['conditions', 'actions']) {
      if (typeof result[key] === 'string') {
        try {
          result[key] = JSON.parse(result[key]);
        } catch {
          // Keep malformed source JSON visible as text for diagnosis.
        }
      }
    }
    return result;
  } catch {
    return value;
  }
}
/** Download failed schedule definitions only, after an explicit user click.
 * @param {ActualFile} file - Current compatibility report. @returns {void} Local JSON download. */
export function downloadScheduleDiagnostics(file: ActualFile): void {
  const report = {
    format: 'folio-actual-schedule-diagnostics',
    version: 1,
    importerVersion: ACTUAL.importerVersion,
    schedules: file.exclusions.map((row) => ({ name: row.name, reason: row.reason, source: readable(row.diagnostic) })),
  };
  const blob = new Blob([JSON.stringify(report, null, ACTUAL.jsonIndent)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'folio-actual-schedule-diagnostics.json';
  link.click();
  URL.revokeObjectURL(url);
}
