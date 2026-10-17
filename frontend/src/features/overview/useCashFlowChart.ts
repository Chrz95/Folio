import { useState } from 'react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { monthTransactions, statistics } from './statistics';
import { VALUE } from '../../constants/app.constants';
export const CHART = { width: 640, height: 180, padding: 16, ticks: 5, intervals: 4, lastDayLabel: 31 };
/** Derive daily cumulative chart series from the selected actual ledger.
 * @returns {object} Chart coordinates, totals and display mode. */
export function useCashFlowChart() {
  const { data, month } = useWorkspace();
  const [mode, setMode] = useState('both');
  const entries = monthTransactions(data, month);
  const totals = statistics(entries);
  const days = new Date(
    new Date(`${month}T12:00:00`).getFullYear(),
    new Date(`${month}T12:00:00`).getMonth() + 1,
    0,
  ).getDate();
  const maximum = Math.max(totals.income, totals.expenses, VALUE.cents);
  const incomePoints: string[] = [];
  const expensePoints: string[] = [];
  for (let day = 1; day <= days; day += 1) {
    const current = statistics(entries.filter((entry) => Number(entry.date.slice(VALUE.dateDayDigits)) <= day));
    const horizontal = CHART.padding + ((day - 1) / (days - 1)) * (CHART.width - CHART.padding * VALUE.diameterFactor);
    incomePoints.push(`${horizontal},${CHART.height - (current.income / maximum) * (CHART.height - CHART.padding)}`);
    expensePoints.push(`${horizontal},${CHART.height - (current.expenses / maximum) * (CHART.height - CHART.padding)}`);
  }
  const areaPoints =
    `${CHART.padding},${CHART.height} ${incomePoints.join(' ')} ` + `${CHART.width - CHART.padding},${CHART.height}`;
  return { mode, setMode, totals, days, maximum, incomePoints, expensePoints, areaPoints };
}
