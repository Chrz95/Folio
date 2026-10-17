import { TriangleAlert, TrendingUp, Wallet, ArrowDownRight } from 'lucide-react';
import type { ForecastState } from './useForecast';
import { money, formatDate } from '../../utils/format';
interface ForecastSummaryProps {
  forecast: ForecastState;
}
/** Distinguish today's actual money from projected and minimum balances.
 * @param {ForecastSummaryProps} props - Projection.
 * @param {ForecastState} props.forecast - Derived series. @returns {JSX.Element} Financial summary. */
export function ForecastSummary({ forecast }: ForecastSummaryProps) {
  const { result, accountWarnings, accountId } = forecast;
  return (
    <div>
      <div className="forecast-summary">
        <article className="panel">
          <span>
            <Wallet size={17} />
            Actual balance today
          </span>
          <strong>{money(result.opening)}</strong>
          <small>Recorded entries through today</small>
        </article>
        <article className="panel">
          <span>
            <TrendingUp size={17} />
            Projected ending balance
          </span>
          <strong>{money(result.closing)}</strong>
          <small>After the next {forecast.days} days</small>
        </article>
        <article className="panel">
          <span>
            <ArrowDownRight size={17} />
            Lowest projected balance
          </span>
          <strong className={result.lowest.balance < forecast.options.threshold ? 'negative' : ''}>
            {money(result.lowest.balance)}
          </strong>
          <small>{formatDate(result.lowest.date, { month: 'long', day: 'numeric' })}</small>
        </article>
      </div>
      {result.firstWarning && (
        <div
          className="forecast-warning"
          role="alert"
        >
          <TriangleAlert size={20} />
          <span>
            This projection falls below your threshold on <strong>{formatDate(result.firstWarning.date)}</strong>.
            Lowest balance: <strong>{money(result.lowest.balance)}</strong>.
          </span>
        </div>
      )}
      {!accountId && accountWarnings.length > 0 && (
        <div className="forecast-warning">
          <TriangleAlert size={20} />
          <span>
            Combined balances can hide account shortfalls.{' '}
            {accountWarnings
              .map((entry) => `${entry.name}: ${entry.warning ? formatDate(entry.warning.date) : ''}`)
              .join(' · ')}
            . Select an account to inspect it.
          </span>
        </div>
      )}
    </div>
  );
}
