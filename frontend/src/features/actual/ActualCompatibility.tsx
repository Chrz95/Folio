import type { ActualFile } from './actualSchema';
import { downloadScheduleDiagnostics } from './actualScheduleDiagnostics';
import { ACTUAL } from './actual.constants';
/** Make unsupported semantics explicit before committing. @param {ActualFile} file - Decoded compatibility report.
 * @returns {JSX.Element} Warnings and bounded exclusion detail. */
export function ActualCompatibility({ file }: { file: ActualFile }) {
  return (
    <section className="panel actual-compatibility">
      <h2>What carries over</h2>
      <ul>
        {file.warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
      {file.categoryMappings.length > 0 && (
        <details>
          <summary>{file.categoryMappings.length} category names adapted</summary>
          <ul>
            {file.categoryMappings.slice(0, ACTUAL.previewRows).map((row) => (
              <li key={row.name}>
                {row.original} → {row.name}
              </li>
            ))}
          </ul>
          <p>All mappings are included in the review download.</p>
        </details>
      )}
      {file.exclusions.length > 0 && (
        <details>
          <summary>{file.exclusions.length} schedules need manual recreation</summary>
          <ul>
            {file.exclusions.slice(0, ACTUAL.previewRows).map((row) => (
              <li key={row.id}>
                <strong>{row.name}</strong>: {row.reason}
              </li>
            ))}
          </ul>
          <p>The complete list is included in the review download.</p>
          <button
            className="button secondary"
            onClick={() => downloadScheduleDiagnostics(file)}
          >
            Download schedule diagnostics
          </button>
          <p>Contains failed schedule names, amounts, dates and rule fields. No transaction history is included.</p>
        </details>
      )}
    </section>
  );
}
