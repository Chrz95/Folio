import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useForecast } from '../features/forecast/useForecast';
import { ForecastControls } from '../features/forecast/ForecastControls';
import { ForecastSummary } from '../features/forecast/ForecastSummary';
import { ForecastChart } from '../features/forecast/ForecastChart';
import { ForecastSchedule } from '../features/forecast/ForecastSchedule';
import { downloadFile } from '../features/transactions/export';
import { VALUE } from '../constants/app.constants';
/** Explore account cash flow without changing actual financial records. @returns {JSX.Element} Forecast route. */
export default function ForecastPage() {
  const forecast = useForecast();
  return (
    <div className="page-content">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">A LITTLE FURTHER AHEAD</span>
          <h1>
            Make room for what's next<span>.</span>
          </h1>
          <p>See how known payments and paydays could shape your balance.</p>
        </div>
        <div className="page-toolbar">
          <Link
            className="button secondary"
            to="/reports"
          >
            Spending reports
          </Link>
          <button
            className="button secondary"
            onClick={() =>
              downloadFile(
                'folio-forecast.csv',
                [
                  'Date,Projected balance (EUR)',
                  ...forecast.result.points.map((point) => `${point.date},${point.balance / VALUE.cents}`),
                ].join('\r\n'),
                'text/csv;charset=utf-8',
              )
            }
          >
            <Download size={16} />
            Export projection
          </button>
        </div>
      </div>
      <ForecastControls forecast={forecast} />
      <ForecastSummary forecast={forecast} />
      <ForecastChart
        result={forecast.result}
        threshold={forecast.options.threshold}
      />
      <p className="projection-assumptions">
        This projection assumes every included schedule happens at its current amount. It excludes unscheduled spending,
        fees and unentered income. Balances are daily endings, so intraday shortfalls can differ. Overdue payments are
        excluded unless you include them above.
      </p>
      <ForecastSchedule forecast={forecast} />
    </div>
  );
}
