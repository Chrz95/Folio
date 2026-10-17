import type { TransactionFormState } from './useTransactionForm';
import type { EndingMode } from './useScheduleEnding';
import { SCHEDULE_ENDING } from './scheduleEnding';
/** Select an unlimited, explicit-date or counted schedule ending in the transaction editor.
 * @param {object} props - Editor values. @param {TransactionFormState} props.form - Draft schedule.
 * @returns {JSX.Element | null} Count and date controls. */
export function ScheduleEndingFields({ form }: { form: TransactionFormState }) {
  if (!form.isRecurring) {
    return null;
  }
  const { ending } = form;
  return (
    <div className="schedule-ending-fields">
      <div className="form-two-columns">
        <label>
          Ends
          <select
            value={ending.mode}
            onChange={(event) => ending.setMode(event.target.value as EndingMode)}
          >
            <option value="never">Never</option>
            <option value="date">On a date</option>
            <option value="count">After a number of repetitions</option>
          </select>
        </label>
        {ending.mode === 'count' && (
          <label>
            Number of repetitions
            <input
              type="number"
              min="1"
              max={form.frequency === 'once' ? 1 : SCHEDULE_ENDING.maximum}
              step="1"
              required
              value={ending.count}
              onChange={(event) => ending.setCount(event.target.value)}
            />
          </label>
        )}
        {ending.mode === 'date' && (
          <label>
            Final payment date
            <input
              type="date"
              required
              value={ending.endDate}
              onChange={(event) => ending.setEndDate(event.target.value)}
            />
          </label>
        )}
      </div>
      {ending.mode === 'count' && (
        <p className="field-hint">
          Total scheduled dates starting with the due date shown, including that date. Skipped or already recorded dates
          within this span still count.
        </p>
      )}
      {ending.error && <p className="field-hint negative">{ending.error}</p>}
    </div>
  );
}
