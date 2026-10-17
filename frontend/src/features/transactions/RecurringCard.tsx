import { OccurrenceActions } from '../schedules/OccurrenceActions';
import { ScheduleControls } from '../schedules/ScheduleControls';
import { Pencil, Bell } from 'lucide-react';
import type { RecurringRow } from '../recurring/recurringRows';
import { useWorkspace } from '../../app/WorkspaceContext';
import { money, formatDate } from '../../utils/format';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { FREQUENCY_LABEL } from '../../constants/app.constants';
interface RecurringCardProps {
  row: RecurringRow;
}
/** Display the next unpaid occurrence and allow explicit payment posting.
 * @param {RecurringCardProps} props - Schedule configuration.
 * @param {RecurringRow} props.row - Schedule and nearest unconfirmed date.
 * @returns {JSX.Element} Recurring payment card. */
export function RecurringCard({ row }: RecurringCardProps) {
  const { data, setEditor } = useWorkspace();
  const { template, closest: next, isPaused, endDate } = row;
  return (
    <article className="panel recurring-card">
      <div className="recurring-card-top">
        <CategoryIcon category={template.category} />
        <span className={`type-pill ${template.type}`}>{template.type}</span>
        <button
          className="icon-button"
          aria-label={`Edit ${template.name}`}
          title={`Edit ${template.name}`}
          onClick={() => setEditor({ transaction: template, isRecurring: true })}
        >
          <Pencil size={16} />
        </button>
      </div>
      <h2>{template.name}</h2>
      <p>
        {template.category} · {data.accounts.find((account) => account.id === template.accountId)?.name}
      </p>
      <div className="recurring-amount">
        {money(template.amount)}
        <small>
          /{' '}
          {template.frequency === 'once'
            ? 'one time'
            : FREQUENCY_LABEL[template.frequency].toLowerCase().replace('ly', '')}
        </small>
      </div>
      <p className="schedule-status">
        {isPaused ? 'Paused' : endDate ? `Ends ${formatDate(endDate)}` : 'Active schedule'}
      </p>
      <div className="recurring-date">
        <span>Closest unconfirmed</span>
        <strong>
          {next ? formatDate(next.date, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No unconfirmed dates'}
        </strong>
      </div>
      <div className="recurring-card-bottom">
        <span>
          <Bell size={13} />
          {template.reminderDays === 0 ? 'On the due date' : `${template.reminderDays} days before`}
        </span>
        <OccurrenceActions
          occurrence={next}
          isPaused={isPaused}
        />
      </div>
      <ScheduleControls template={template} />
    </article>
  );
}
