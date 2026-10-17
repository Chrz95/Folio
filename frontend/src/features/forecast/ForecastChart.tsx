import type { ForecastResult } from './forecast';
import { FORECAST } from './forecast.constants';
import { money, formatDate } from '../../utils/format';
interface ForecastChartProps {
  result: ForecastResult;
  threshold: number;
}
/** Render an exact daily projection with a threshold reference and readable totals.
 * @param {ForecastChartProps} props - Series.
 * @param {ForecastResult} props.result - Daily closing points.
 * @param {number} props.threshold - Alert floor in cents. @returns {JSX.Element} SVG chart. */
export function ForecastChart({ result, threshold }: ForecastChartProps) {
  const balances = result.points.map((point) => point.balance);
  const minimum = Math.min(...balances, threshold, result.opening);
  const maximum = Math.max(...balances, threshold, result.opening);
  const range = maximum - minimum || FORECAST.amountScale;
  const height = FORECAST.height - FORECAST.padding;
  const width = FORECAST.width - FORECAST.padding;
  const points = result.points
    .map((point, index) => {
      const horizontal = FORECAST.padding + (index / (result.points.length - 1)) * width;
      const vertical = height - ((point.balance - minimum) / range) * (height - FORECAST.padding);
      return `${horizontal},${vertical}`;
    })
    .join(' ');
  const thresholdY = height - ((threshold - minimum) / range) * (height - FORECAST.padding);
  return (
    <section className="panel forecast-chart">
      <div className="panel-heading">
        <div>
          <h2>Your balance, a little further ahead</h2>
          <p>Daily ending balances · known scheduled payments only</p>
        </div>
        <span className="positive">{money(result.closing)}</span>
      </div>
      <div className="forecast-axis-labels">
        <span>{money(maximum)}</span>
        <span>{money(minimum)}</span>
      </div>
      <svg
        viewBox={`0 0 ${FORECAST.width} ${FORECAST.height}`}
        aria-label={`Projected ending balance ${money(result.closing)}; lowest ${money(result.lowest.balance)}`}
      >
        <title>Projected daily account balance</title>
        <line
          x1={FORECAST.padding}
          x2={FORECAST.width}
          y1={thresholdY}
          y2={thresholdY}
          stroke="#ba8e66"
          strokeDasharray="5 5"
        />
        <polyline
          points={points}
          fill="none"
          stroke="#52896d"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="forecast-chart-labels">
        <span>{formatDate(result.points[0]?.date ?? result.lowest.date)}</span>
        <span>Dashed line: {money(threshold)} threshold</span>
        <span>{formatDate(result.points.at(-1)?.date ?? result.lowest.date)}</span>
      </div>
    </section>
  );
}
