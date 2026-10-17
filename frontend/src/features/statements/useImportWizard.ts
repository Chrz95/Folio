import { categoryNames } from '../planning/catalog';
import { useState } from 'react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { parseCsv } from './csvParser';
import { suggestMapping, mapStatement } from './csvMapping';
import { previewStatement, commitStatement } from './statementsService';
import type { CsvFile, CsvOptions } from './csv.types';
import type { ImportPreview, ImportResult } from '../../types/operations';
import { dateKey } from '../../utils/format';
/** Own the upload-map-review-commit workflow; changing interpretation invalidates the preview.
 * @returns {object} Wizard state and durable actions. */
export function useImportWizard() {
  const { data, reload } = useWorkspace();
  const [accountId, setAccountId] = useState(data.accounts[0]?.id ?? '');
  const [file, setFile] = useState<CsvFile | null>(null);
  const [fileName, setFileName] = useState('');
  const [options, setOptions] = useState<CsvOptions | null>(null);
  const [preview, setPreview] = useState<ImportPreview[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [isBusy, setBusy] = useState(false);
  const mapped =
    file && options ? mapStatement(file, options, accountId, categoryNames(data)) : { rows: [], errors: [] };
  /** Parse a file without uploading raw contents. @param {string} text - CSV text.
   * @param {string} name - Safe display filename. @returns {void} Resets previous review. */
  function loadText(text: string, name: string) {
    try {
      const parsed = parseCsv(text);
      setFile(parsed);
      setFileName(name);
      setPreview([]);
      setResult(null);
      setError('');
      setOptions({
        mapping: suggestMapping(parsed.headers),
        dateFormat: 'iso',
        decimalSeparator: '.',
        expenseSign: 'negative',
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to read the CSV.');
    }
  }
  /** Load fictional bank rows for exploring the review flow. @returns {void} Uses explicit sample labels. */
  function loadSample() {
    const today = dateKey();
    const monthStart = `${today.slice(0, MONTH_PREFIX_LENGTH)}-01`;
    loadText(
      `Date,Description,Amount,Currency,Bank ID
${monthStart},Monthly salary,4800.00,EUR,example-salary
${today},Local bakery,-8.50,EUR,example-bakery`,
      'Sample bank statement.csv',
    );
  }
  /** Request authoritative suggestions without making any financial changes. @returns {Promise<void>} Review state. */
  async function prepareReview() {
    if (!file || !options || !accountId || mapped.errors.length) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      setPreview(await previewStatement(accountId, mapped.rows));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to preview the statement.');
    } finally {
      setBusy(false);
    }
  }
  /** Apply one explicit review choice. @param {string} reviewId - Stable row ID.
   * @param {string} choice - skip, new, or match:<UUID>. @returns {void} Updates only the selected choice. */
  function choose(reviewId: string, choice: string) {
    setPreview((rows) =>
      rows.map((row) =>
        row.reviewId !== reviewId
          ? row
          : {
              ...row,
              action: choice.startsWith('match:') ? 'match' : choice === 'new' ? 'new' : 'skip',
              matchId: choice.startsWith('match:') ? choice.slice(MATCH_PREFIX_LENGTH) : undefined,
            },
      ),
    );
  }
  /** Atomically persist all approved rows and display actual duplicate/match counts.
   * @returns {Promise<void>} Keeps the review open if server validation fails. */
  async function commit() {
    setBusy(true);
    setError('');
    try {
      const outcome = await commitStatement(
        accountId,
        preview.map(({ transaction, bankId, action, matchId }) => ({ transaction, bankId, action, matchId })),
      );
      setResult(outcome);
      await reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The statement could not be imported.');
    } finally {
      setBusy(false);
    }
  }
  /** Return to mapping after a successful import. @returns {void} Keeps the selected account. */
  function reset() {
    setResult(null);
  }
  return {
    data,
    accountId,
    setAccountId,
    file,
    fileName,
    options,
    setOptions,
    preview,
    setPreview,
    result,
    error,
    setError,
    isBusy,
    mapped,
    loadText,
    loadSample,
    prepareReview,
    choose,
    commit,
    reset,
  };
}
const MONTH_PREFIX_LENGTH = 7;
const MATCH_PREFIX_LENGTH = 6;
export type ImportWizardState = ReturnType<typeof useImportWizard>;
