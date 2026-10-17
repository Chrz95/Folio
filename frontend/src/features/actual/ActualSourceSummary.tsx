import type { ActualWizard } from './useActualImport';
/** Distinguish source compatibility from the user's selected scope before requesting an import review.
 * @param {object} props - Current source and selection. @returns {JSX.Element | null} Local compatibility counts. */
export function ActualSourceSummary({ wizard }: { wizard: ActualWizard }) {
  const { file, sourceSummary } = wizard;
  if (!file || !sourceSummary) {
    return null;
  }
  return (
    <output className="actual-source-summary">
      <span>
        <strong>{file.budgetName}</strong> · {file.transactions.length} transactions found
      </span>
      <span className="actual-source-result">
        {sourceSummary.supported} of {sourceSummary.total} schedules supported
      </span>
      <span>{file.recurring.length} schedules selected. Imported schedules start paused.</span>
      <span>{sourceSummary.ending} supported schedules have a final payment date.</span>
      <span>{sourceSummary.linked} historical payments match an exact schedule date and amount.</span>
      {!wizard.includeSchedules && (
        <span>Schedules excluded by your choice; your recorded history will still import.</span>
      )}
      {sourceSummary.total === sourceSummary.supported && sourceSummary.total > 0 && (
        <span>No schedules require manual recreation.</span>
      )}
    </output>
  );
}
