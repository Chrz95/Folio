import type { ForecastState } from './useForecast';
import { FORECAST } from './forecast.constants';
interface ForecastControlsProps {
  forecast: ForecastState;
}
/** Expose assumptions instead of treating projected money as guaranteed income.
 * @param {ForecastControlsProps} props - Forecast state.
 * @param {ForecastState} props.forecast - Projection and controls. @returns {JSX.Element} Filter panel. */
export function ForecastControls({ forecast }: ForecastControlsProps) {
  return (
    <section className="panel forecast-controls">
      <label>
        Account
        <select
          value={forecast.accountId}
          onChange={(event) => forecast.setAccountId(event.target.value)}
        >
          <option value="">All accounts combined</option>
          {forecast.data.accounts.map((account) => (
            <option
              key={account.id}
              value={account.id}
            >
              {account.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Look ahead
        <select
          value={forecast.days}
          onChange={(event) => forecast.setDays(Number(event.target.value))}
        >
          {FORECAST.horizons.map((days) => (
            <option
              key={days}
              value={days}
            >
              Next {days} days
            </option>
          ))}
        </select>
      </label>
      <label>
        Low-balance threshold (€)
        <input
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={forecast.threshold}
          onChange={(event) => forecast.setThreshold(event.target.value)}
        />
      </label>
      <label className="inline-check">
        <input
          type="checkbox"
          checked={forecast.includeOverdue}
          onChange={(event) => forecast.setIncludeOverdue(event.target.checked)}
        />
        Include overdue payments today
      </label>
    </section>
  );
}
