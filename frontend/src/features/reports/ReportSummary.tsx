import { money } from '../../utils/format';
import { reportChange } from './report';
import type { ReportTotals } from './report';
interface Props {
  current: ReportTotals;
  previous: ReportTotals;
}
/** Present exact flows and neutral signed differences against the same scoped previous period.
 * @param {Props} props - Comparable totals. @param {ReportTotals} props.current - Selected actual flows.
 * @param {ReportTotals} props.previous - Previous period flows. @returns {JSX.Element} Summary cards. */
export function ReportSummary({ current, previous }: Props) {
  const cards = [
    { label: 'Income', current: current.income, previous: previous.income },
    { label: 'Expenses', current: current.expenses, previous: previous.expenses },
    { label: 'Net savings', current: current.savings, previous: previous.savings },
  ];
  return (
    <div className="report-summary">
      {cards.map((card) => {
        const change = reportChange(card.current, card.previous);
        return (
          <article
            className="summary-card"
            key={card.label}
            aria-label={`${card.label} report`}
          >
            <h2 className="summary-label">{card.label}</h2>
            <strong className="summary-value">{money(card.current)}</strong>
            <p>Previous: {money(card.previous)}</p>
            <p>
              {change.amount > 0 ? '+' : ''}
              {money(change.amount)} change
              {change.percent !== null && ` (${change.percent > 0 ? '+' : ''}${change.percent}%)`}
            </p>
            {card.previous === 0 && <p>No percentage: previous value is zero.</p>}
            {card.previous < 0 && <p>No percentage: previous value is negative.</p>}
          </article>
        );
      })}
    </div>
  );
}
