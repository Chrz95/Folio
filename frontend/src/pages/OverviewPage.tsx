import { ForecastPreview } from '../features/forecast/ForecastPreview';
import { Link } from 'react-router-dom';
import { ArrowRight, Download, Sparkles } from 'lucide-react';
import { useWorkspace } from '../app/WorkspaceContext';
import { SummaryCards } from '../features/overview/SummaryCards';
import { CashFlowChart } from '../features/overview/CashFlowChart';
import { SpendingChart } from '../features/overview/SpendingChart';
import { UpcomingPayments } from '../features/reminders/UpcomingPayments';
import { BudgetPreview } from '../features/overview/BudgetPreview';
import { TransactionTable } from '../features/transactions/TransactionTable';
import { MonthPicker } from '../components/ui/MonthPicker';
import { monthTransactions } from '../features/overview/statistics';
import { VALUE } from '../constants/app.constants';
import { exportTransactions } from '../features/transactions/export';
/** Compose the main financial overview from focused feature cards.
 * @returns {JSX.Element} Overview route. */
export default function OverviewPage() {
  const { data, month } = useWorkspace();
  const transactions = monthTransactions(data, month).sort((first, second) => second.date.localeCompare(first.date));
  return (
    <div className="page-content">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">
            <span className="small-dot green" />
            YOUR FINANCIAL PICTURE
          </span>
          <h1>
            Your money, at a glance<span>.</span>
          </h1>
          <p>A little clarity for today. A little confidence for tomorrow.</p>
        </div>
        <div className="page-toolbar">
          <button
            className="button secondary export-button"
            onClick={() => exportTransactions(transactions)}
          >
            <Download size={15} />
            Export
          </button>
          <MonthPicker />
        </div>
      </div>
      <SummaryCards />
      <div className="overview-columns">
        <div className="overview-main">
          <CashFlowChart />
          <ForecastPreview />
          <section className="panel recent-panel">
            <div className="panel-heading">
              <div>
                <h2>Recent transactions</h2>
                <p>The everyday moments behind your balance.</p>
              </div>
              <Link
                className="text-button"
                to="/transactions"
              >
                View all <ArrowRight size={14} />
              </Link>
            </div>
            <TransactionTable transactions={transactions.slice(0, VALUE.previewRows)} />
          </section>
          <BudgetPreview />
        </div>
        <div className="overview-aside">
          <SpendingChart />
          <UpcomingPayments />
          <div className="insight-card">
            <span>
              <Sparkles size={18} />A MOMENT OF CLARITY
            </span>
            <h3>
              Progress is a habit,
              <br />
              not a number.
            </h3>
            <p>Checking in on your money is a small step that makes a big difference.</p>
            <Link to="/reports">
              See your bigger picture <span aria-hidden="true">↗</span>
            </Link>
            <span className="insight-art">✳</span>
          </div>
        </div>
      </div>
      <footer className="page-footer">
        <span>
          <span className="brand-mark tiny">
            <span />
            <span />
            <span />
          </span>
          A little more in balance.
        </span>
        <span>Made for your everyday.</span>
      </footer>
    </div>
  );
}
