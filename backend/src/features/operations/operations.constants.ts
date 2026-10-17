/** Import limits cap validation, memory and synchronous transaction duration. */
export const OPERATIONS = {
  imports: '/imports',
  reconciliation: '/reconciliation',
  maximumRows: 500,
  bankIdLength: 200,
  matchWindowDays: 3,
  dayMilliseconds: 86400000,
} as const;
