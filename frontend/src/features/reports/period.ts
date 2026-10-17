import { REPORT } from './report.constants';
export interface DateRange {
  start: string;
  end: string;
}
export interface ReportSelection {
  period: string;
  month: string;
  year: string;
  start: string;
  end: string;
  accountId: string;
  category: string;
}
/** Read report scope without changing navigation or silently repairing invalid dates.
 * @param {URLSearchParams} query - Bookmark parameters. @param {string} month - Workspace default.
 * @returns {ReportSelection} Report selections. */
export function readSelection(query: URLSearchParams, month: string): ReportSelection {
  return {
    period: query.get('period') ?? 'monthly',
    month: query.get('month') ?? month.slice(0, REPORT.monthDigits),
    year: query.get('year') ?? month.slice(0, REPORT.yearDigits),
    start: query.get('start') ?? month,
    end: query.get('end') ?? lastMonthDay(month.slice(0, REPORT.monthDigits)),
    accountId: query.get('account') ?? '',
    category: query.get('category') ?? '',
  };
}
/** Format a UTC civil date. @param {number} time - Epoch milliseconds.
 * @returns {string} ISO calendar date. */
export function civilDate(time: number) {
  return new Date(time).toISOString().slice(0, REPORT.dateDigits);
}
/** Find a calendar month's inclusive end. @param {string} month - YYYY-MM.
 * @returns {string} ISO month end, or empty for invalid input. */
function lastMonthDay(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return '';
  }
  const year = Number(month.slice(0, REPORT.yearDigits));
  const number = Number(month.slice(REPORT.yearDigits + 1));
  return civilDate(Date.UTC(year, number, 0));
}
/** Validate real supported calendar dates, including leap days. @param {string} date - Candidate.
 * @returns {boolean} Whether round-trip conversion is exact. */
function isDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }
  const year = Number(date.slice(0, REPORT.yearDigits));
  const time = Date.parse(`${date}T00:00:00Z`);
  return year >= REPORT.minimumYear && year <= REPORT.maximumYear && Number.isFinite(time) && civilDate(time) === date;
}
/** Resolve inclusive periods and their comparison without local timezone arithmetic.
 * @param {ReportSelection} selection - User selection.
 * @returns {object} Current and previous ranges or a visible validation error. */
export function resolvePeriod(selection: ReportSelection) {
  let { start, end } = selection;
  if (selection.period === 'monthly') {
    start = `${selection.month}-01`;
    end = lastMonthDay(selection.month);
  } else if (selection.period === 'yearly') {
    start = `${selection.year}-01-01`;
    end = `${selection.year}-12-31`;
  } else if (selection.period !== 'custom') {
    return { error: 'Choose a monthly, yearly or custom report.' };
  }
  if (!isDate(start) || !isDate(end)) {
    return { error: 'Enter valid report dates (1901–9998).' };
  }
  const duration = Date.parse(end) - Date.parse(start) + REPORT.dayMilliseconds;
  if (duration <= 0) {
    return { error: 'The end date must be on or after the start date.' };
  }
  if (duration > REPORT.maximumDays * REPORT.dayMilliseconds) {
    return { error: 'Choose a range of no more than 3,660 days.' };
  }
  let previous: DateRange;
  const date = new Date(start);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  if (selection.period === 'monthly') {
    previous = { start: civilDate(Date.UTC(year, month - 1, 1)), end: civilDate(Date.UTC(year, month, 0)) };
  } else if (selection.period === 'yearly') {
    previous = { start: `${year - 1}-01-01`, end: `${year - 1}-12-31` };
  } else {
    previous = {
      start: civilDate(Date.parse(start) - duration),
      end: civilDate(Date.parse(start) - REPORT.dayMilliseconds),
    };
  }
  return { current: { start, end }, previous, error: '' };
}
