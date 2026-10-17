import type { ImportPreview } from '../../types/operations';
import { money, formatDate } from '../../utils/format';
interface ImportReviewRowProps {
  row: ImportPreview;
  onChoice: (id: string, value: string) => void;
  isBusy: boolean;
}
/** Keep every potentially destructive match explicit and reversible before commit.
 * @param {ImportReviewRowProps} props - Row review.
 * @param {ImportPreview} props.row - Candidate and bank values.
 * @param {(id: string, value: string) => void} props.onChoice - Decision callback.
 * @param {boolean} props.isBusy - Prevents edits during commit. @returns {JSX.Element} Review row. */
export function ImportReviewRow({ row, onChoice, isBusy }: ImportReviewRowProps) {
  const value = row.action === 'match' ? `match:${row.matchId}` : row.action;
  return (
    <tr>
      <td>{formatDate(row.transaction.date)}</td>
      <td>
        <strong>{row.transaction.name}</strong>
        <small>{row.reason}</small>
      </td>
      <td className={row.transaction.type === 'income' ? 'positive amount-cell' : 'amount-cell'}>
        {row.transaction.type === 'income' ? '+' : '−'}
        {money(row.transaction.amount)}
      </td>
      <td>
        <select
          aria-label={`Import decision for ${row.transaction.name} ${row.reviewId}`}
          value={value}
          disabled={isBusy || row.isDuplicate}
          onChange={(event) => onChoice(row.reviewId, event.target.value)}
        >
          <option value="skip">Skip{row.isDuplicate ? ' duplicate' : ''}</option>
          {!row.isDuplicate && <option value="new">Import as new</option>}
          {row.candidates.map((candidate) => (
            <option
              key={candidate.id}
              value={`match:${candidate.id}`}
            >
              Match: {candidate.name} · {formatDate(candidate.date)}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}
