import { ACTUAL } from './actual.constants';
import { ActualSourceSummary } from './ActualSourceSummary';
import type { ActualWizard } from './useActualImport';
/** Choose an explicit native file and import scope. @param {ActualWizard} wizard - Import state.
 * @returns {JSX.Element} Accessible file and consent controls. */
export function ActualUpload({ wizard }: { wizard: ActualWizard }) {
  return (
    <section className="panel actual-upload">
      <span className="eyebrow">1 · CHOOSE YOUR EXPORT</span>
      <h2>Bring your Actual budget along</h2>
      <p className="field-hint">Actual importer {ACTUAL.importerVersion}</p>
      <p>In Actual, open Settings → Export data and download the budget ZIP. It is read on this device.</p>
      <label className="field">
        Actual Budget export · ZIP, up to 25 MiB
        <input
          type="file"
          accept=".zip,application/zip"
          disabled={wizard.busy}
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) {
              void wizard.select(selected);
            }
            event.target.value = '';
          }}
        />
      </label>
      {wizard.isReading && (
        <button
          className="button secondary"
          onClick={wizard.cancel}
        >
          Cancel reading
        </button>
      )}
      {wizard.file && (
        <div className="actual-options">
          <ActualSourceSummary wizard={wizard} />
          <label>
            Import behavior
            <select
              value={wizard.mode}
              disabled={wizard.busy}
              onChange={(event) => wizard.setMode(event.target.value as 'add' | 'replace')}
            >
              <option value="add">Add to current data</option>
              <option value="replace">Overwrite current financial workspace</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={wizard.includeBudgets}
              disabled={wizard.busy}
              onChange={(event) => wizard.setIncludeBudgets(event.target.checked)}
            />{' '}
            Include monthly allocations
          </label>
          <label>
            <input
              type="checkbox"
              checked={wizard.includeSchedules}
              disabled={wizard.busy}
              onChange={(event) => wizard.setIncludeSchedules(event.target.checked)}
            />{' '}
            Include supported schedules (paused)
          </label>
          <label>
            <input
              type="checkbox"
              checked={wizard.currency}
              disabled={wizard.busy}
              onChange={(event) => wizard.setCurrency(event.target.checked)}
            />
            I confirm this budget uses EUR and two decimal places. No currency conversion is performed.
          </label>
          {wizard.mode === 'add' && (
            <button
              className="button primary"
              disabled={!wizard.currency || wizard.busy}
              onClick={() => void wizard.preview()}
            >
              {wizard.busy ? 'Working…' : 'Review import'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
