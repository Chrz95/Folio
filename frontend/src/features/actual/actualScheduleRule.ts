import { z } from 'zod';
import type { SourceRow } from './source';
import { cents, text } from './source';
import { parseScheduleValue } from './actualScheduleErrors';
const conditionSchema = z
  .object({
    op: z.enum(['is', 'isapprox', 'isbetween']),
    field: z.enum(['acct', 'account', 'description', 'payee', 'date', 'amount']),
    value: z.unknown(),
    type: z.string().optional(),
    customName: z.string().optional(),
    options: z
      .object({
        inflow: z.boolean().optional(),
        outflow: z.boolean().optional(),
        month: z.boolean().optional(),
        year: z.boolean().optional(),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();
const actionSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('link-schedule'), value: z.string() }).strict(),
  z
    .object({
      op: z.literal('set'),
      field: z.enum(['acct', 'account', 'description', 'payee', 'amount', 'category', 'notes']),
      value: z.unknown(),
      type: z.string().optional(),
      options: z
        .object({
          template: z.string().nullable().optional(),
          formula: z.string().nullable().optional(),
          splitIndex: z.number().nullable().optional(),
        })
        .strict()
        .nullable()
        .optional(),
    })
    .strict(),
]);
const RANGE_DIVISOR = 2;
/** Normalize native account/payee aliases. @param {string} field - Source field. @returns {string} Native key. */
function nativeField(field: string): string {
  return field === 'account' ? 'acct' : field === 'payee' ? 'description' : field;
}
/** Read representable schedule rules without executing arbitrary source automation.
 * @param {SourceRow | undefined} rule - Native rule. @param {string} id - Schedule identity.
 * @returns {object} Canonical conditions, estimated amount and safe set actions. */
export function readScheduleRule(rule: SourceRow | undefined, id: string) {
  if (!rule || rule.conditions_op !== 'and') {
    throw new Error('Requires an AND rule with an account, amount and date.');
  }
  const conditions = parseScheduleValue(z.array(conditionSchema), JSON.parse(text(rule.conditions)), 'Conditions');
  const fields = new Map(conditions.map((item) => [nativeField(item.field), item]));
  if (fields.size !== conditions.length || !fields.has('acct') || !fields.has('amount') || !fields.has('date')) {
    throw new Error('Requires unique account, amount and date conditions.');
  }
  for (const [field, condition] of fields) {
    if (condition.options && Object.values(condition.options).some(Boolean)) {
      throw new Error(`Condition ${field}.options changes matching; only empty or disabled options are supported.`);
    }
    if (
      (field === 'date' && condition.op === 'isbetween') ||
      (field !== 'date' && field !== 'amount' && condition.op !== 'is')
    ) {
      throw new Error('Account and payee must be exact; date ranges require manual recreation.');
    }
  }
  const condition = fields.get('amount')!;
  const range =
    condition.op === 'isbetween'
      ? parseScheduleValue(z.object({ num1: z.number(), num2: z.number() }).strict(), condition.value, 'Amount range')
      : null;
  const first = cents(range ? range.num1 : condition.value);
  const last = range ? cents(range.num2) : first;
  if (!first || !last || Math.sign(first) !== Math.sign(last)) {
    throw new Error('Zero amounts and ranges spanning income and expense require manual recreation.');
  }
  const amount = Math.round((first + last) / RANGE_DIVISOR);
  const actions = parseScheduleValue(z.array(actionSchema), JSON.parse(text(rule.actions)), 'Actions');
  const links = actions.filter((action) => action.op === 'link-schedule');
  if (links.length !== 1 || links[0]!.value !== id) {
    throw new Error('The rule must link only to this schedule.');
  }
  const sets = new Map<string, unknown>();
  for (const action of actions) {
    if (action.op !== 'set') {
      continue;
    }
    if (action.options?.template || action.options?.formula || action.options?.splitIndex != null) {
      throw new Error(
        `Action ${action.field}.options: templates, formulas and split actions require manual recreation.`,
      );
    }
    const field = nativeField(action.field);
    if (sets.has(field)) {
      throw new Error('Repeated rule actions require manual recreation.');
    }
    if (
      field !== 'category' &&
      field !== 'notes' &&
      (field === 'amount' ? cents(action.value) !== amount : action.value !== fields.get(field)?.value)
    ) {
      throw new Error('A rule action changes the scheduled account, payee or amount. Recreate it manually.');
    }
    sets.set(field, action.value);
  }
  const estimate = range
    ? `Actual amount range: ${first} to ${last} cents; imported rounded midpoint: ${amount} cents.`
    : condition.op === 'isapprox'
      ? `Actual approximate amount: ${amount} cents; imported as a fixed estimate.`
      : '';
  return { fields, amount, sets, estimate };
}
