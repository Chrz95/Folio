import { AutomaticConfirmationField } from './AutomaticConfirmationField';
import { ScheduleEndingFields } from './ScheduleEndingFields';
import { VALUE } from '../../constants/app.constants';
import { Repeat2 } from 'lucide-react';
import type { Frequency } from '../../types/budget';
import type { TransactionFormState } from './useTransactionForm';
interface RecurrenceFieldsProps {
  form: TransactionFormState;
}
/** Offer explicit recurrence and reminder rules without changing existing item types.
 * @param {RecurrenceFieldsProps} props - Form state.
 * @param {TransactionFormState} props.form - Editor values and setters.
 * @returns {JSX.Element} Schedule controls. */
export function RecurrenceFields({ form }: RecurrenceFieldsProps) {
  const { original, isRecurring, setRecurring, frequency, setFrequency } = form;
  return (
    <div className="recurrence-fields">
      <label className="toggle-row">
        <span>
          <Repeat2 size={18} />
          <span>
            Make it recurring<small>A little less to keep in mind.</small>
          </span>
        </span>
        <input
          type="checkbox"
          checked={isRecurring}
          disabled={Boolean(original)}
          onChange={(event) => setRecurring(event.target.checked)}
        />
      </label>
      {isRecurring && (
        <div className="form-two-columns">
          <label>
            Repeats
            <select
              name="frequency"
              value={frequency}
              onChange={(event) => setFrequency(event.target.value as Frequency)}
            >
              <option value="once">One time only</option>
              <option value="weekly">Every week</option>
              <option value="monthly">Every month</option>
              <option value="yearly">Every year</option>
            </select>
          </label>
          <label>
            Remind me
            <select
              name="reminderDays"
              defaultValue={original && 'reminderDays' in original ? original.reminderDays : VALUE.defaultReminder}
            >
              <option value="0">On the due date</option>
              <option value="1">1 day before</option>
              <option value="2">2 days before</option>
              <option value="3">3 days before</option>
              <option value="7">7 days before</option>
            </select>
          </label>
        </div>
      )}
      <ScheduleEndingFields form={form} />
      <AutomaticConfirmationField form={form} />
      {isRecurring && (
        <p className="field-hint">
          Scheduled payments appear in your calendar. Confirm them manually or opt in to automatic confirmation.
        </p>
      )}
    </div>
  );
}
