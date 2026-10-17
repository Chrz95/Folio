import { CashFlowGradient } from './CashFlowGradient';
import { CashFlowLegend } from './CashFlowLegend';
import { useCashFlowChart, CHART } from './useCashFlowChart';
import { money } from '../../utils/format';
/** Visualize daily cumulative inflows and outflows from the actual selected-month ledger.
 * @returns {JSX.Element} Responsive SVG chart with a text summary. */
export function CashFlowChart() {
  const { mode, setMode, totals, days, maximum, incomePoints, expensePoints, areaPoints } = useCashFlowChart();
  return (
    <section className="panel cashflow-panel">
      <div className="panel-heading">
        <div>
          <h2>Cash flow</h2>
          <p>A clearer picture of your money in motion.</p>
        </div>
        <select
          aria-label="Cash flow series"
          value={mode}
          onChange={(event) => setMode(event.target.value)}
        >
          <option value="both">Income & expenses</option>
          <option value="income">Income only</option>
          <option value="expenses">Expenses only</option>
        </select>
      </div>
      <CashFlowLegend
        income={totals.income}
        expenses={totals.expenses}
      />
      <div className="line-chart">
        <div className="chart-y-labels">
          {Array.from({ length: CHART.ticks }, (_, index) => (
            <span key={`tick-${index}`}>{money(maximum * (1 - index / CHART.intervals)).replace('.00', '')}</span>
          ))}
        </div>
        <svg
          viewBox={`0 0 ${CHART.width} ${CHART.height}`}
          aria-label={`Cumulative cash flow: income ${money(totals.income)}, expenses ${money(totals.expenses)}`}
          preserveAspectRatio="none"
        >
          <CashFlowGradient />
          {Array.from({ length: CHART.ticks }, (_, index) => (
            <line
              key={`grid-${index}`}
              x1="0"
              x2={CHART.width}
              y1={(index / CHART.intervals) * CHART.height}
              y2={(index / CHART.intervals) * CHART.height}
              stroke="var(--border)"
              strokeDasharray="3 5"
            />
          ))}
          {mode !== 'expenses' && (
            <polygon
              points={areaPoints}
              fill="url(#incomeFill)"
            />
          )}
          {mode !== 'expenses' && (
            <polyline
              points={incomePoints.join(' ')}
              fill="none"
              stroke="#52896d"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          )}
          {mode !== 'income' && (
            <polyline
              points={expensePoints.join(' ')}
              fill="none"
              stroke="#d4ae79"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </div>
      <div className="chart-x-labels">
        <span>01</span>
        <span>07</span>
        <span>14</span>
        <span>21</span>
        <span>{days}</span>
      </div>
    </section>
  );
}
