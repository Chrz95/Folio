import { useState } from 'react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { PLANNING } from '../planning/planning.constants';
/** Archive custom names without rewriting transactions, budgets or reconciled history.
 * @returns {JSX.Element} Category settings panel. */
export function CategoriesSettings() {
  const { data, save, isSaving } = useWorkspace();
  const [name, setName] = useState('');
  return (
    <section className="panel settings-panel">
      <h2>Categories that fit your life</h2>
      <p>Add custom names for transactions and budgets. Archived names stay in your history.</p>
      <form
        className="planning-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save('categories', 'POST', { name }).then((success) => {
            if (success) {
              setName('');
            }
          });
        }}
      >
        <label>
          New category
          <input
            required
            maxLength={PLANNING.maximumCategory}
            value={name}
            placeholder="e.g. Pets"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button
          className="button secondary"
          disabled={isSaving}
        >
          Add category
        </button>
      </form>
      <div className="custom-category-list">
        {(data.customCategories ?? []).map((entry) => (
          <div key={entry.id}>
            <span>
              {entry.name}
              {entry.isArchived && <small>Archived</small>}
            </span>
            <button
              className="text-button"
              disabled={isSaving}
              onClick={() => void save('categories', 'PUT', { isArchived: !entry.isArchived }, entry.id)}
            >
              {entry.isArchived ? 'Restore' : 'Archive'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
