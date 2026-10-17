import { z } from 'zod';
import type { ActualSource } from './source';
import type { ActualFile } from './actualSchema';
import { ACTUAL } from './actual.constants';
import { date, identity, label, text } from './source';
import { readScheduleRule } from './actualScheduleRule';
const recurrenceSchema = z
  .object({
    start: z.iso.date(),
    frequency: z.enum(['weekly', 'monthly', 'yearly']),
    interval: z.literal(1).optional(),
    patterns: z.array(z.never()).optional(),
    skipWeekend: z.literal(false).optional(),
    weekendSolveMode: z.enum(['before', 'after']).optional(),
    endMode: z.enum(['never', 'on_date']).optional(),
    endDate: z.iso.date().optional(),
  })
  .strict();
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
    try {
      const { fields, amount, sets, estimate } = readScheduleRule(rules.get(text(row.rule)), text(row.id));
      const sourceAccount = accounts.get(text(fields.get('acct')?.value));
      if (!sourceAccount) {
        throw new Error('Schedule account is unavailable.');
      }
      const rawDate = fields.get('date')?.value;
      const repeat = typeof rawDate === 'string' ? null : recurrenceSchema.parse(rawDate);
      const start = repeat ? repeat.start : date(rawDate);
      const day = new Date(`${start}T12:00:00Z`).getUTCDate();
      const month = new Date(`${start}T12:00:00Z`).getUTCMonth() + 1;
      if (
        (repeat?.frequency === 'monthly' && day > ACTUAL.monthEnd) ||
        (repeat?.frequency === 'yearly' && month === ACTUAL.february && day === ACTUAL.leapDay)
      ) {
        throw new Error('Month-end and leap-day schedules require manual recreation.');
      }
      const endDate = repeat?.endMode === 'on_date' ? repeat.endDate : null;
      if ((repeat?.endMode === 'on_date' && !endDate) || (endDate && endDate < start)) {
        throw new Error('Schedule end date is invalid.');
      }
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
        frequency: repeat?.frequency ?? 'once',
        reminderDays: 0,
      });
      scheduleSettings.push({ recurringId: id, isPaused: true, endDate: endDate ?? null });
    } catch (error) {
      const reason =
        error instanceof Error && !('issues' in error)
          ? error.message
          : 'Unsupported conditions, complex dates or rule actions require manual recreation.';
      exclusions.push({ id: text(row.id), name, reason });
    }
  }
  return { recurring, scheduleSettings, exclusions };
}
