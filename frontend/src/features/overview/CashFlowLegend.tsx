import { money } from '../../utils/format';
interface LegendProps {
  income: number;
  expenses: number;
}
/** Show exact totals alongside the cumulative chart.
 * @param {LegendProps} props - Monthly totals.
 * @param {number} props.income - Incoming euro cents.
 * @param {number} props.expenses - Outgoing euro cents.
 * @returns {JSX.Element} Cash-flow legend. */
export function CashFlowLegend({ income, expenses }: LegendProps) {
  return (
    <div className="chart-legend">
      <span>
        <i className="small-dot green" />
        Income <strong>{money(income)}</strong>
      </span>
      <span>
        <i className="small-dot ochre" />
        Expenses <strong>{money(expenses)}</strong>
      </span>
    </div>
  );
}
