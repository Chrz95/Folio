import { useWorkspace } from '../../app/WorkspaceContext';
import { categoryNames } from '../planning/catalog';
import type { BulkWorkflow } from './useBulkTransactions';
import type { BulkInput } from './bulkPlan';
import { BULK } from './bulk.constants';
interface Props {
  workflow: BulkWorkflow;
}
/** Make bounded bulk selection explicit before requesting a read-only review.
 * @param {Props} props - Workflow state. @param {BulkWorkflow} props.workflow - Selection and actions.
 * @returns {JSX.Element} Bulk controls. */
export function BulkToolbar({ workflow }: Props) {
  const { data } = useWorkspace();
  return (
    <section
      className="bulk-toolbar"
      aria-label="Bulk transaction actions"
    >
      <div className="bulk-selection-actions">
        <strong aria-live="polite">{workflow.ids.size} selected</strong>
        <button
          className="button secondary"
          disabled={workflow.isBusy || !workflow.eligibleCount}
          onClick={workflow.selectAll}
        >
          {workflow.eligibleCount > BULK.maximumRows ? 'Select first 100 editable' : 'Select all editable'}
        </button>
        <button
          className="text-button"
          disabled={workflow.isBusy || !workflow.ids.size}
          onClick={workflow.clear}
        >
          Clear selection
        </button>
      </div>
      <p>
        Select up to 100 editable transactions in this view. Changing filters clears the selection. Reconciled entries
        are protected.
      </p>
      {workflow.ids.size > 0 && (
        <form
          className="bulk-action-form"
          onSubmit={(event) => {
            event.preventDefault();
            void workflow.review();
          }}
        >
          <label>
            Bulk action
            <select
              value={workflow.action}
              disabled={workflow.isBusy}
              onChange={(event) => workflow.changeAction(event.target.value as BulkInput['action'])}
            >
              <option value="categorize">Change category</option>
              <option value="delete">Delete transactions</option>
            </select>
          </label>
          {workflow.action === 'categorize' && (
            <label>
              New category
              <select
                required
                value={workflow.category}
                disabled={workflow.isBusy}
                onChange={(event) => workflow.changeCategory(event.target.value)}
              >
                <option value="">Choose an active category</option>
                {categoryNames(data).map((category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            className="button secondary"
            disabled={workflow.isBusy || (workflow.action === 'categorize' && !workflow.category)}
          >
            Review selected transactions
          </button>
        </form>
      )}
    </section>
  );
}
