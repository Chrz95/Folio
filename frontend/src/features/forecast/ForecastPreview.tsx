import { Link } from 'react-router-dom';
import { ArrowUpRight, TrendingUp } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { buildForecast } from './forecast';
import { FORECAST } from './forecast.constants';
import { dateKey, money } from '../../utils/format';
/** Offer a discoverable projection separate from historical cash-flow reporting.
 * @returns {JSX.Element} Forecast entry point. */
export function ForecastPreview() {
  const { data } = useWorkspace();
  const result = buildForecast(data, {
    startDate: dateKey(),
    days: FORECAST.defaultDays,
    accountId: '',
    threshold: FORECAST.defaultThreshold,
    includeOverdue: false,
  });
  return (
    <Link
      className="forecast-preview panel"
      to="/forecast"
    >
      <span className="forecast-preview-icon">
        <TrendingUp size={24} />
      </span>
      <span>
        <strong>A little further ahead</strong>
        <small>Projected balance in 30 days · known payments only</small>
      </span>
      <b>{money(result.closing)}</b>
      <ArrowUpRight size={18} />
    </Link>
  );
}
