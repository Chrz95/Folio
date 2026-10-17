import type { ForecastState } from './useForecast';
import { transactionDelta } from './forecast';
import { money, formatDate } from '../../utils/format';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { FORECAST } from './forecast.constants';
interface ForecastScheduleProps {
  forecast: ForecastState;
}
/** Make forecast assumptions inspectable, including overdue entries moved to today.
 * @param {ForecastScheduleProps} props - Projection.
 * @param {ForecastState} props.forecast - Account and selected series. @returns {JSX.Element} Event ledger. */
export function ForecastSchedule({ forecast }: ForecastScheduleProps) {
  const { result, accountId } = forecast;
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Behind the projection</h2>
          <p>
            {result.events.length} planned or future-dated entries · showing the next {FORECAST.recentEvents}
          </p>
        </div>
      </div>
      <div className="forecast-event-list">
        {result.events.slice(0, FORECAST.recentEvents).map((entry) => {
          const delta = transactionDelta(entry, accountId);
          return (
            <div
              className="forecast-event"
              key={`${entry.id}:${entry.date}`}
            >
              <CategoryIcon category={entry.category} />
              <span>
                <strong>{entry.name}</strong>
                <small>
                  {formatDate(entry.effectiveDate)} · {entry.isPlanned ? 'Planned' : 'Recorded future entry'}
                  {entry.date !== entry.effectiveDate ? ` · overdue since ${formatDate(entry.date)}` : ''}
                </small>
              </span>
              <b className={delta > 0 ? 'positive' : ''}>
                {delta > 0 ? '+' : '−'}
                {money(Math.abs(delta))}
              </b>
            </div>
          );
        })}
        {!result.events.length && (
          <div className="empty-state">
            <p>No scheduled changes within this forecast.</p>
          </div>
        )}
      </div>
    </section>
  );
}
