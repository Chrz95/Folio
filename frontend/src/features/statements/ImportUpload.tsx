import { Upload, FileSpreadsheet } from 'lucide-react';
import type { ImportWizardState } from './useImportWizard';
import { STATEMENTS } from './statements.constants';
interface ImportUploadProps {
  wizard: ImportWizardState;
}
/** Keep the source file local while the user chooses its target account.
 * @param {ImportUploadProps} props - Workflow.
 * @param {ImportWizardState} props.wizard - Current upload state. @returns {JSX.Element} Upload step. */
export function ImportUpload({ wizard }: ImportUploadProps) {
  return (
    <section className="panel import-upload">
      <div>
        <span className="import-upload-icon">
          <Upload size={27} />
        </span>
        <h2>A fresh view of your statement</h2>
        <p>Choose a CSV or TSV export from your bank. Maximum 500 rows and 1 MiB. Raw files stay in your browser.</p>
      </div>
      <label>
        Import into
        <select
          value={wizard.accountId}
          onChange={(event) => wizard.setAccountId(event.target.value)}
          disabled={wizard.isBusy || wizard.preview.length > 0}
        >
          {wizard.data.accounts.map((account) => (
            <option
              key={account.id}
              value={account.id}
            >
              {account.name}
            </option>
          ))}
        </select>
      </label>
      <label className="file-input-label">
        Statement file
        <input
          type="file"
          accept=".csv,.tsv,text/csv,text/tab-separated-values"
          disabled={wizard.isBusy || wizard.preview.length > 0 || !wizard.accountId}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }
            if (file.size > STATEMENTS.maximumBytes) {
              wizard.setError('Choose a CSV under 1 MiB.');
              return;
            }
            void file
              .text()
              .then((text) => wizard.loadText(text, file.name))
              .catch(() => wizard.setError('Unable to read this file.'));
          }}
        />
      </label>
      <button
        className="button secondary"
        disabled={wizard.isBusy || wizard.preview.length > 0 || !wizard.accountId}
        onClick={wizard.loadSample}
      >
        <FileSpreadsheet size={16} />
        Try a sample statement
      </button>
      {wizard.fileName && (
        <p className="selected-file">
          {wizard.fileName} · {wizard.file?.rows.length} rows
        </p>
      )}
    </section>
  );
}
