import { z } from 'zod';
import type { ActualSource } from './source';
import type { ActualFile } from './actualSchema';
import { ACTUAL } from './actual.constants';
import { cents, date, identity, label, text } from './source';
const conditionSchema = z
  .object({ op: z.literal('is'), field: z.enum(['acct', 'description', 'date', 'amount']), value: z.unknown() })
  .strict();
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
/** Convert only recurrence rules with exactly representable dates and amounts; retain exclusions for review.
 * @param {ActualSource} source - Native rows. @param {string} budget - Stable identity.
 * @param {Map<string, string>} accounts - Source account mapping.
 * @param {(id: unknown) => string} payee - Resolved payee names. @returns {object} Paused rules and exclusions. */
export function convertSchedules(
  source: ActualSource,
  budget: string,
  accounts: Map<string, string>,
  payee: (id: unknown) => string,
) {
  const recurring: ActualFile['recurring'] = [];
  const scheduleSettings: ActualFile['scheduleSettings'] = [];
  const exclusions: ActualFile['exclusions'] = [];
  const rules = new Map(source.rules.map((row) => [text(row.id), row]));
  for (const row of source.schedules) {
    const name = label(row.name || 'Actual schedule', ACTUAL.name);
    try {
      const rule = rules.get(text(row.rule));
      if (!rule || rule.conditions_op !== 'and') {
        throw new Error('Requires a simple AND rule.');
      }
      const conditions = z
        .array(conditionSchema)
        .length(ACTUAL.requiredConditions)
        .parse(JSON.parse(text(rule.conditions)));
      const fields = new Map(conditions.map((item) => [item.field, item.value]));
      if (fields.size !== conditions.length) {
        throw new Error('Repeated conditions are unsupported.');
      }
      const actions = z
        .array(z.object({ op: z.literal('link-schedule'), value: z.literal(text(row.id)) }).strict())
        .length(1)
        .safeParse(JSON.parse(text(rule.actions)));
      if (!actions.success) {
        throw new Error('Additional rule actions are unsupported.');
      }
      const accountId = accounts.get(text(fields.get('acct')));
      if (!accountId) {
        throw new Error('Schedule account is unavailable.');
      }
      const amount = cents(fields.get('amount'));
      if (!amount) {
        throw new Error('Zero or variable amounts are unsupported.');
      }
      const rawDate = fields.get('date');
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
      const payeeName = payee(fields.get('description'));
      recurring.push({
        id,
        name: name || payeeName,
        amount: Math.abs(amount),
        type: amount > 0 ? 'income' : 'expense',
        category: 'Other',
        accountId,
        destinationAccountId: null,
        date: start,
        notes: '',
        frequency: repeat?.frequency ?? 'once',
        reminderDays: 0,
      });
      scheduleSettings.push({ recurringId: id, isPaused: true, endDate: endDate ?? null });
    } catch (error) {
      const reason =
        error instanceof Error && !('issues' in error)
          ? error.message
          : 'Variable amounts, complex dates, transfer schedules or extra conditions require manual recreation.';
      exclusions.push({ id: text(row.id), name, reason });
    }
  }
  return { recurring, scheduleSettings, exclusions };
}
