import { ArrowRight } from 'lucide-react';
import type { ImportWizardState } from './useImportWizard';
import { ImportColumnMappings } from './ImportColumnMappings';
import { ImportFormatOptions } from './ImportFormatOptions';
interface ImportMappingProps {
  wizard: ImportWizardState;
}
/** Require a valid complete mapping before sending normalized rows for review.
 * @param {ImportMappingProps} props - Workflow.
 * @param {ImportWizardState} props.wizard - Current file interpretation. @returns {JSX.Element} Mapping step. */
export function ImportMapping({ wizard }: ImportMappingProps) {
  return (
    <section className="panel import-mapping">
      <div className="panel-heading">
        <div>
          <h2>Make the columns feel at home</h2>
          <p>Review the suggested mapping. All imported amounts are EUR.</p>
        </div>
      </div>
      <fieldset disabled={wizard.isBusy}>
        <ImportColumnMappings wizard={wizard} />
        <ImportFormatOptions wizard={wizard} />
      </fieldset>
      <div className="import-mapping-footer">
        <p>
          Unknown categories use Other. Map a stable bank ID to distinguish identical same-day purchases. Match existing
          transfers instead of creating a second expense.
        </p>
        {wizard.mapped.errors.length > 0 && (
          <div
            className="error-message"
            role="alert"
          >
            <strong>Fix these rows or mappings before continuing:</strong>
            <ul>
              {wizard.mapped.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}
        <button
          className="button primary"
          disabled={wizard.isBusy || wizard.mapped.errors.length > 0 || !wizard.accountId}
          onClick={() => void wizard.prepareReview()}
        >
          {wizard.isBusy ? 'Checking statement…' : 'Review transactions'}
          <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}
