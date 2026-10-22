import { useState } from 'react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { PLANNING } from '../planning/planning.constants';
interface CategoryProps {
  onCreated: (name: string) => void;
}
/** Add a reusable spending category without leaving or submitting the enclosing transaction form.
 * @param {CategoryProps} props - Selection callback. @param {(name: string) => void} props.onCreated - Select saved name.
 * @returns {JSX.Element} Inline category creation. */
export function InlineCategory({ onCreated }: CategoryProps) {
  const { save, isSaving } = useWorkspace();
  const [isOpen, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  /** Keep the draft open after validation/storage failures and select only a durably saved name.
   * @returns {Promise<void>} Category creation outcome. */
  async function createCategory() {
    const value = name.trim();
    if (!value || value.length > PLANNING.maximumCategory) {
      setError('Enter a category name of up to 40 characters.');
      return;
    }
    setError('');
    if (await save('categories', 'POST', { name: value })) {
      onCreated(value);
      setName('');
      setOpen(false);
    }
  }
  if (!isOpen) {
    return (
      <button
        type="button"
        className="text-button"
        disabled={isSaving}
        onClick={() => setOpen(true)}
      >
        + Add category
      </button>
    );
  }
  return (
    <div className="inline-category">
      <label>
        New spending category
        <input
          value={name}
          maxLength={PLANNING.maximumCategory}
          disabled={isSaving}
          placeholder="e.g. Pets"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void createCategory();
            }
          }}
        />
      </label>
      <div className="inline-category-actions">
        <button
          type="button"
          className="button secondary"
          disabled={isSaving || !name.trim()}
          onClick={() => void createCategory()}
        >
          Create category
        </button>
        <button
          type="button"
          className="text-button"
          disabled={isSaving}
          onClick={() => {
            setOpen(false);
            setError('');
          }}
        >
          Cancel category
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="error-message"
        >
          {error}
        </p>
      )}
    </div>
  );
}
