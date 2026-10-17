import { useState } from 'react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { VALUE } from '../../constants/app.constants';
import { dateKey } from '../../utils/format';
interface ContributionProps {
  goalId: string;
}
/** Retain a request UUID across failed retries to prevent double-counting progress.
 * @param {ContributionProps} props - Contribution destination. @param {string} props.goalId - Goal UUID.
 * @returns {JSX.Element} Progress adjustment form. */
export function ContributionForm({ goalId }: ContributionProps) {
  const { save, isSaving } = useWorkspace();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState('add');
  const [date, setDate] = useState(dateKey());
  const [notes, setNotes] = useState('');
  return (
    <form
      className="planning-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save(
          'contributions',
          'POST',
          { id: requestId, amount: Math.round(Number(amount) * VALUE.cents) * (kind === 'add' ? 1 : -1), date, notes },
          goalId,
        ).then((success) => {
          if (success) {
            setAmount('');
            setNotes('');
            setRequestId(crypto.randomUUID());
          }
        });
      }}
    >
      <div className="form-two-columns">
        <label>
          Progress action
          <select
            value={kind}
            onChange={(event) => {
              setKind(event.target.value);
              setRequestId(crypto.randomUUID());
            }}
          >
            <option value="add">Add saved amount</option>
            <option value="withdraw">Withdraw saved amount</option>
          </select>
        </label>
        <label>
          Amount (€)
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            max={VALUE.maximumMoney / VALUE.cents}
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setRequestId(crypto.randomUUID());
            }}
          />
        </label>
      </div>
      <label>
        Progress date
        <input
          required
          type="date"
          value={date}
          max={dateKey()}
          onChange={(event) => {
            setDate(event.target.value);
            setRequestId(crypto.randomUUID());
          }}
        />
      </label>
      <label>
        Note (optional)
        <input
          value={notes}
          maxLength={1000}
          onChange={(event) => {
            setNotes(event.target.value);
            setRequestId(crypto.randomUUID());
          }}
        />
      </label>
      <button
        className="button secondary"
        disabled={isSaving}
      >
        Record progress
      </button>
    </form>
  );
}
