import type { Transaction } from '../../types/budget';
import { statistics } from '../overview/statistics';
import type { DateRange, ReportSelection } from './period';
import { civilDate } from './period';
import { REPORT } from './report.constants';
/** Select recorded cash flow with exact scope and inclusive dates; transfers never count as spending.
 * @param {Transaction[]} entries - Complete actual ledger. @param {DateRange} range - Inclusive dates.
 * @param {ReportSelection} scope - Account/category filters. @returns {Transaction[]} Matching postings. */
export function reportEntries(entries: Transaction[], range: DateRange, scope: ReportSelection) {
  return entries
    .filter(
      (entry) =>
        entry.type !== 'transfer' &&
        entry.date >= range.start &&
        entry.date <= range.end &&
        (!scope.accountId || entry.accountId === scope.accountId) &&
        (!scope.category || entry.category === scope.category),
    )
    .sort((first, second) => first.date.localeCompare(second.date) || first.id.localeCompare(second.id));
}
export type ReportTotals = ReturnType<typeof statistics>;
/** Describe a signed change without a misleading zero or negative baseline percentage.
 * @param {number} current - Current cents. @param {number} previous - Comparison cents.
 * @returns {object} Signed cents and optional relative percentage. */
export function reportChange(current: number, previous: number) {
  return {
    amount: current - previous,
    percent: previous > 0 ? Math.round(((current - previous) / previous) * REPORT.percent) : null,
  };
}
/** Group short ranges by day and longer ranges by month, retaining zero-activity intervals.
 * @param {Transaction[]} entries - Scoped cash flow. @param {DateRange} range - Inclusive report dates.
 * @returns {object[]} Ordered income/expense buckets. */
export function reportBuckets(entries: Transaction[], range: DateRange) {
  const daily = Date.parse(range.end) - Date.parse(range.start) < REPORT.dailyLimit * REPORT.dayMilliseconds;
  const length = daily ? REPORT.dateDigits : REPORT.monthDigits;
  const buckets = new Map<string, { label: string; income: number; expenses: number }>();
  for (let time = Date.parse(range.start); time <= Date.parse(range.end); time += REPORT.dayMilliseconds) {
    const label = civilDate(time).slice(0, length);
    if (!buckets.has(label)) {
      buckets.set(label, { label, income: 0, expenses: 0 });
    }
  }
  entries.forEach((entry) => {
    const bucket = buckets.get(entry.date.slice(0, length));
    if (bucket && entry.type === 'income') {
      bucket.income += entry.amount;
    }
    if (bucket && entry.type === 'expense') {
      bucket.expenses += entry.amount;
    }
  });
  return [...buckets.values()];
}
