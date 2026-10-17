import type { ActualReview } from './actualMerge';
import { money } from '../../utils/format';
/** Reconcile every imported account against the source, including future recorded entries.
 * @param {ActualReview} review - Exact plan. @returns {JSX.Element} Balance comparison. */
export function ActualBalances({ review }: { review: ActualReview }) {
  return (
    <div className="table-scroll">
      <table className="actual-balances">
        <caption>All recorded balances · includes future transactions</caption>
        <thead>
          <tr>
            <th>Account</th>
            <th>Actual source</th>
            <th>Folio before</th>
            <th>Folio after</th>
          </tr>
        </thead>
        <tbody>
          {review.accountRows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.name}</th>
              <td>{money(row.source)}</td>
              <td>{money(row.before)}</td>
              <td>{money(row.after)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
