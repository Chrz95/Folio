/** Valid categories are shared by the HTTP contract, seed and UI catalog. */
export const CATEGORIES = [
  'Housing',
  'Groceries',
  'Food & drink',
  'Transport',
  'Shopping',
  'Health',
  'Entertainment',
  'Subscriptions',
  'Utilities',
  'Salary',
  'Freelance',
  'Savings',
  'Other',
] as const;
export const BUDGET_LIMITS = {
  maximumMoney: 100000000000,
  maximumName: 100,
  maximumNotes: 1000,
  maximumReminder: 7,
  defaultPage: 200,
  maximumPage: 500,
  maximumOffset: 100000,
} as const;
