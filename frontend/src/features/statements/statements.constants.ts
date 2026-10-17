/** Bank uploads stay in the browser; only approved normalized rows reach the API. */
export const STATEMENTS = {
  maximumBytes: 1048576,
  maximumRows: 500,
  maximumName: 100,
  maximumBankId: 200,
  maximumNotes: 1000,
  matchWindowDays: 3,
  dayMilliseconds: 86400000,
  cents: 100,
  previewRows: 500,
  apiImport: '/imports',
  apiReconciliation: '/reconciliation',
  minimumColumns: 2,
  dateParts: 3,
  dateDigits: 2,
  monthMaximum: 12,
} as const;
