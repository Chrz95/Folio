import type { BudgetData } from '../../types/budget';
/** Sample data is used only by the explicitly compiled browser preview. */
export const ACCOUNT_IDS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
] as const;
export const SEED_ACCOUNTS = [
  { id: ACCOUNT_IDS[0], name: 'Everyday account', openingBalance: 810000 },
  { id: ACCOUNT_IDS[1], name: 'Savings account', openingBalance: 1370000 },
  { id: ACCOUNT_IDS[2], name: 'Cash wallet', openingBalance: 12000 },
];
export const SEED_ENTRIES = [
  ['Monthly salary', 480000, 'income', 'Salary', 1],
  ['Apartment rent', 95000, 'expense', 'Housing', 1],
  ['Weekly groceries', 8420, 'expense', 'Groceries', 3],
  ['Metro pass', 3000, 'expense', 'Transport', 3],
  ['Electricity bill', 6800, 'expense', 'Utilities', 5],
  ['Sunday brunch', 3250, 'expense', 'Food & drink', 6],
  ['New running shoes', 8900, 'expense', 'Shopping', 7],
  ['Weekly groceries', 7630, 'expense', 'Groceries', 8],
  ['Dinner with friends', 4850, 'expense', 'Food & drink', 10],
  ['Pharmacy', 2480, 'expense', 'Health', 11],
  ['Cinema night', 2400, 'expense', 'Entertainment', 12],
  ['Spotify Premium', 1099, 'expense', 'Subscriptions', 12],
  ['Weekly groceries', 9240, 'expense', 'Groceries', 14],
  ['Freelance project', 60000, 'income', 'Freelance', 15],
  ['Morning coffee', 450, 'expense', 'Food & drink', 16],
  ['Monthly savings', 50000, 'transfer', 'Savings', 15],
] as const;
export const SEED_RECURRING = [
  ['Apartment rent', 95000, 'expense', 'Housing', 1, 'monthly'],
  ['Monthly salary', 480000, 'income', 'Salary', 1, 'monthly'],
  ['Spotify Premium', 1099, 'expense', 'Subscriptions', 12, 'monthly'],
  ['Netflix', 1399, 'expense', 'Subscriptions', 18, 'monthly'],
  ['Internet', 3490, 'expense', 'Utilities', 20, 'monthly'],
  ['Gym membership', 4500, 'expense', 'Health', 23, 'monthly'],
  ['Phone plan', 1990, 'expense', 'Utilities', 25, 'monthly'],
] as const;
export const SEED_BUDGETS = [
  { category: 'Housing', amount: 110000 },
  { category: 'Groceries', amount: 40000 },
  { category: 'Food & drink', amount: 25000 },
  { category: 'Transport', amount: 15000 },
  { category: 'Shopping', amount: 20000 },
  { category: 'Entertainment', amount: 10000 },
];
/** Create a deterministic sample ledger for the current month.
 * @returns {BudgetData} Clearly labelled demonstration workspace. */
export function createDemoSeed(): BudgetData {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const today = now.getDate();
  const recurring = SEED_RECURRING.map(([name, amount, type, category, day, frequency], index) => ({
    id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(index + 1).padStart(12, '0')}`,
    name,
    amount,
    type,
    category,
    accountId: ACCOUNT_IDS[0],
    destinationAccountId: null,
    notes: '',
    frequency,
    reminderDays: 2,
    date: `${month}-${String(day).padStart(2, '0')}`,
  }));
  return {
    accounts: SEED_ACCOUNTS.map((account) => ({ ...account })),
    recurring,
    budgets: SEED_BUDGETS.map((budget) => ({ ...budget })),
    transactions: SEED_ENTRIES.filter((entry) => entry[4] <= today).map(
      ([name, amount, type, category, day], index) => ({
        id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index + 1).padStart(12, '0')}`,
        name,
        amount,
        type,
        category,
        accountId: ACCOUNT_IDS[0],
        destinationAccountId: type === 'transfer' ? ACCOUNT_IDS[1] : null,
        date: `${month}-${String(day).padStart(2, '0')}`,
        notes: '',
        createdAt: 0,
        recurringId: recurring.find((template) => template.name === name)?.id ?? null,
      }),
    ),
  };
}
