import type { BudgetData } from '../../types/budget';
import { escapeCsv, downloadFile } from '../transactions/export';
import type { DateRange, ReportSelection } from './period';
import type { ReportTotals } from './report';
import { REPORT } from './report.constants';
export interface ReportExport {
  selection: ReportSelection;
  current: DateRange;
  previous: DateRange;
  totals: ReportTotals;
  prior: ReportTotals;
  data: BudgetData;
}
/** Build a spreadsheet-safe report with exact scope, periods and comparable metrics/category amounts.
 * @param {ReportExport} report - Selected report snapshot. @returns {string} CSV with integer-cent-derived euros. */
export function buildReportCsv(report: ReportExport) {
  const { selection, current, previous, totals, prior, data } = report;
  const account = selection.accountId
    ? (data.accounts.find((entry) => entry.id === selection.accountId)?.name ??
      `Unavailable account (${selection.accountId})`)
    : 'All accounts';
  const rows: (string | number)[][] = [
    ['Section', 'Label', 'Current (EUR)', 'Previous (EUR)', 'Change (EUR)', 'Details'],
    ['Scope', 'Current period', '', '', '', `${current.start} to ${current.end}`],
    ['Scope', 'Comparison period', '', '', '', `${previous.start} to ${previous.end}`],
    ['Scope', 'Account', '', '', '', account],
    ['Scope', 'Account ID', '', '', '', selection.accountId],
    ['Scope', 'Category', '', '', '', selection.category || 'All categories'],
    ['Scope', 'Basis', '', '', '', 'Recorded income/expenses only; transfers and unpaid schedules excluded'],
  ];
  const metrics = [
    ['Income', totals.income, prior.income],
    ['Expenses', totals.expenses, prior.expenses],
    ['Net savings', totals.savings, prior.savings],
  ] as const;
  metrics.forEach(([label, value, old]) =>
    rows.push(['Summary', label, value / REPORT.cents, old / REPORT.cents, (value - old) / REPORT.cents, '']),
  );
  const currentCategories = new Map(totals.categories);
  const previousCategories = new Map(prior.categories);
  [...new Set([...currentCategories.keys(), ...previousCategories.keys()])].sort().forEach((category) => {
    const value = currentCategories.get(category) ?? 0;
    const old = previousCategories.get(category) ?? 0;
    rows.push(['Category', category, value / REPORT.cents, old / REPORT.cents, (value - old) / REPORT.cents, '']);
  });
  return rows
    .map((row) => row.map((cell) => (typeof cell === 'number' ? String(cell) : escapeCsv(cell))).join(','))
    .join('\r\n');
}
/** Download the current report scope. @param {ReportExport} report - Snapshot displayed on screen.
 * @returns {void} Report CSV download. */
export function exportReport(report: ReportExport) {
  downloadFile(
    `folio-report-${report.current.start}-${report.current.end}.csv`,
    buildReportCsv(report),
    'text/csv;charset=utf-8',
  );
}
