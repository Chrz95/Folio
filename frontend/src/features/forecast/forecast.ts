import type { BudgetData, TransactionInput } from '../../types/budget';
import { getOccurrences } from '../transactions/recurrence';
import { dateKey } from '../../utils/format';
export interface ForecastOptions {
  startDate: string;
  days: number;
  accountId: string;
  threshold: number;
  includeOverdue: boolean;
}
/** Calculate one account's signed transaction leg; combined transfers cancel out.
 * @param {TransactionInput} transaction - Recorded or planned entry.
 * @param {string} accountId - Account, or empty for all.
 * @returns {number} Signed integer cents. */
export function transactionDelta(transaction: TransactionInput, accountId: string) {
  const source = !accountId || transaction.accountId === accountId;
  const destination = !accountId || transaction.destinationAccountId === accountId;
  if (transaction.type === 'transfer') {
    return (destination ? transaction.amount : 0) - (source ? transaction.amount : 0);
  }
  return source ? transaction.amount * (transaction.type === 'income' ? 1 : -1) : 0;
}
/** Advance calendar days at local noon to avoid daylight-saving duration assumptions.
 * @param {string} value - ISO calendar date.
 * @param {number} days - Calendar-day offset.
 * @returns {string} Shifted date. */
export function addCalendarDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}
/** Project daily ending balances without modifying postings or double-counting paid occurrences.
 * @param {BudgetData} data - Workspace snapshot.
 * @param {ForecastOptions} options - Explicit projection assumptions.
 * @returns {object} Opening, closing, minimum, warning and event series. */
export function buildForecast(data: BudgetData, options: ForecastOptions) {
  const { startDate, days, accountId, threshold, includeOverdue } = options;
  const end = addCalendarDays(startDate, days);
  const opening =
    data.accounts
      .filter((account) => !accountId || account.id === accountId)
      .reduce((total, account) => total + account.openingBalance, 0) +
    data.transactions
      .filter((entry) => entry.date <= startDate)
      .reduce((total, entry) => total + transactionDelta(entry, accountId), 0);
  const from = includeOverdue
    ? data.recurring.reduce((earliest, entry) => (entry.date < earliest ? entry.date : earliest), startDate)
    : startDate;
  const planned = getOccurrences(data, from, end)
    .filter((entry) => !entry.isPaid)
    .map((entry) => ({ ...entry, effectiveDate: entry.date < startDate ? startDate : entry.date, isPlanned: true }));
  const futureActual = data.transactions
    .filter((entry) => entry.date > startDate && entry.date <= end)
    .map((entry) => ({ ...entry, effectiveDate: entry.date, isPlanned: false }));
  const events = [...planned, ...futureActual]
    .filter((entry) => transactionDelta(entry, accountId) !== 0)
    .sort(
      (first, second) => first.effectiveDate.localeCompare(second.effectiveDate) || first.id.localeCompare(second.id),
    );
  let balance = opening;
  const points = Array.from({ length: days + 1 }, (_, index) => {
    const date = addCalendarDays(startDate, index);
    balance += events
      .filter((entry) => entry.effectiveDate === date)
      .reduce((total, entry) => total + transactionDelta(entry, accountId), 0);
    return { date, balance };
  });
  const lowest = points.reduce((minimum, point) => (point.balance < minimum.balance ? point : minimum), {
    date: startDate,
    balance: opening,
  });
  return {
    opening,
    closing: balance,
    lowest,
    points,
    events,
    firstWarning: points.find((point) => point.balance < threshold),
  };
}
export type ForecastResult = ReturnType<typeof buildForecast>;
