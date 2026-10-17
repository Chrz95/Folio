import type { ActualSource, SourceRow } from './source';
import type { ActualFile } from './actualSchema';
import { ACTUAL } from './actual.constants';
import { identity, label, text } from './source';
import { readScheduleRule } from './actualScheduleRule';
import { readScheduleDate } from './actualScheduleDate';
import { scheduleDiagnostic } from './actualScheduleDiagnostics';
/** Convert supported recurrence rules to paused templates; disclose approximate amounts and retain exclusions.
 * @param {ActualSource} source - Native rows. @param {string} budget - Stable identity.
 * @param {Map<string, string>} accounts - Source account mapping.
 * @param {(id: unknown) => string} payee - Resolved payee names.
 * @param {(id: unknown) => string} category - Resolved categories.
 * @param {(id: unknown) => string | null} transfer - Transfer account, if any.
 * @returns {object} Paused rules and exclusions. */
export function convertSchedules(
  source: ActualSource,
  budget: string,
  accounts: Map<string, string>,
  payee: (id: unknown) => string,
  category: (id: unknown) => string,
  transfer: (id: unknown) => string | null,
) {
  const recurring: ActualFile['recurring'] = [];
  const scheduleSettings: ActualFile['scheduleSettings'] = [];
  const exclusions: ActualFile['exclusions'] = [];
  const rules = new Map(source.rules.map((row) => [text(row.id), row]));
  for (const row of source.schedules) {
    const name = label(row.name || 'Actual schedule', ACTUAL.name);
    let rule: SourceRow | undefined;
    try {
      rule = rules.get(text(row.rule));
      const { fields, amount, sets, estimate } = readScheduleRule(rule, text(row.id));
      const sourceAccount = accounts.get(text(fields.get('acct')?.value));
      if (!sourceAccount) {
        throw new Error('Schedule account is unavailable.');
      }
      const { start, frequency, endDate } = readScheduleDate(fields.get('date')?.value);
      const id = identity(budget, 'schedule', row.id);
      const payeeId = fields.get('description')?.value;
      const transferAccount = transfer(payeeId);
      if (transferAccount === sourceAccount) {
        throw new Error('A transfer schedule requires two different accounts.');
      }
      const payeeName = transferAccount ? 'Actual transfer' : payee(payeeId);
      const notes = [
        sets.has('notes') ? text(sets.get('notes')) : '',
        estimate,
        fields.get('date')?.op === 'isapprox'
          ? 'Actual date matching tolerance is not imported; review the scheduled date before resuming.'
          : '',
      ]
        .filter(Boolean)
        .join('\n');
      if (notes.length > ACTUAL.notes) {
        throw new Error('Schedule notes exceed 1,000 characters.');
      }
      recurring.push({
        id,
        name: row.name ? name : payeeName,
        amount: Math.abs(amount),
        type: transferAccount ? 'transfer' : amount > 0 ? 'income' : 'expense',
        category: transferAccount ? 'Other' : category(sets.get('category')),
        accountId: transferAccount && amount > 0 ? transferAccount : sourceAccount,
        destinationAccountId: transferAccount ? (amount > 0 ? sourceAccount : transferAccount) : null,
        date: start,
        notes,
        frequency,
        reminderDays: 0,
      });
      scheduleSettings.push({ recurringId: id, isPaused: true, endDate: endDate ?? null });
    } catch (error) {
      const reason =
        error instanceof Error && !('issues' in error)
          ? error.message
          : 'The schedule could not be decoded. Download its schedule diagnostics for the exact source definition.';
      exclusions.push({
        id: text(row.id),
        name,
        reason: reason.slice(0, ACTUAL.notes),
        diagnostic: scheduleDiagnostic(row, rule),
      });
    }
  }
  return { recurring, scheduleSettings, exclusions };
}
