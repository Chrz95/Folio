import { Fragment } from 'react';
import { Trash2 } from 'lucide-react';
import { useDeleteData } from './useDeleteData';
import { DeleteDataDialog } from './DeleteDataDialog';
/** Offer complete deletion in both deployment modes without executing it on the initial click.
 * @returns {JSX.Element} Danger button and optional confirmation. */
export function DeleteAllData() {
  const state = useDeleteData();
  return (
    <Fragment>
      <button
        className="button secondary negative"
        onClick={() => void state.prepare()}
        disabled={Boolean(state.busy)}
      >
        <Trash2 size={16} />
        Delete all app data
      </button>
      {state.isOpen && <DeleteDataDialog state={state} />}
    </Fragment>
  );
}
