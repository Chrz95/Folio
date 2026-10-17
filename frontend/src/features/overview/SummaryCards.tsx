import { Wallet, ArrowUpRight, ArrowDownLeft, PiggyBank, Ellipsis } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { accountBalance, monthTransactions, statistics } from './statistics';
import { money } from '../../utils/format';
/** Show actual account balances and selected-month cash flow.
 * @returns {JSX.Element} Financial summary cards. */
export function SummaryCards() {
  const { data, month } = useWorkspace();
  const totals = statistics(monthTransactions(data, month));
  return (
    <div className="summary-grid">
      <article className="summary-card balance-card">
        <div className="summary-label">
          <span>
            <Wallet size={16} />
            Total balance
          </span>
          <Ellipsis size={19} />
        </div>
        <strong className="summary-value">{money(accountBalance(data))}</strong>
        <div className="balance-footer">
          <span className="balance-pill">
            <ArrowUpRight size={12} />
            Across all accounts
          </span>
          <span>{data.accounts.length} accounts</span>
        </div>
        <div className="balance-decoration" />
      </article>
      <article className="summary-card">
        <div className="summary-label">
          <span>Income</span>
          <span className="metric-icon income">
            <ArrowDownLeft size={18} />
          </span>
        </div>
        <strong className="summary-value">{money(totals.income)}</strong>
        <p>
          <span className="small-dot green" />
          Money coming in this month
        </p>
      </article>
      <article className="summary-card">
        <div className="summary-label">
          <span>Expenses</span>
          <span className="metric-icon expense">
            <ArrowUpRight size={18} />
          </span>
        </div>
        <strong className="summary-value">{money(totals.expenses)}</strong>
        <p>
          <span className="small-dot ochre" />
          Money going out this month
        </p>
      </article>
      <article className="summary-card">
        <div className="summary-label">
          <span>Net savings</span>
          <span className="metric-icon savings">
            <PiggyBank size={18} />
          </span>
        </div>
        <strong className="summary-value">{money(totals.savings)}</strong>
        <p>
          <span className="rate-pill">{totals.savingsRate}%</span>of your monthly income
        </p>
      </article>
    </div>
  );
}
