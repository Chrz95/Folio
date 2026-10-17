import { useWorkspace } from '../../app/WorkspaceContext';
import { money } from '../../utils/format';
import type { BulkPlan } from './bulkPlan';
interface Props {
  rows: BulkPlan['rows'];
}
/** List the exact reviewed actual postings, including both transfer account names.
 * @param {Props} props - Review data. @param {BulkPlan['rows']} props.rows - Authoritative rows.
 * @returns {JSX.Element} Horizontally scrollable review table. */
export function BulkReviewRows({ rows }: Props) {
  const { data } = useWorkspace();
  return (
    <div className="review-table-scroll">
      <table className="statement-table">
        <caption>Selected recorded transactions</caption>
        <thead>
          <tr>
            <th scope="col">Transaction / date</th>
            <th scope="col">Account / type</th>
            <th scope="col">Category</th>
            <th scope="col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ transaction }) => (
            <tr key={transaction.id}>
              <td>
                {transaction.name}
                <small>{transaction.date}</small>
              </td>
              <td>
                {data.accounts.find((account) => account.id === transaction.accountId)?.name ?? 'Account'}
                <small>
                  {transaction.type}
                  {transaction.destinationAccountId &&
                    ` → ${
                      data.accounts.find((account) => account.id === transaction.destinationAccountId)?.name ??
                      'Account'
                    }`}
                </small>
              </td>
              <td>{transaction.category}</td>
              <td>{money(transaction.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
