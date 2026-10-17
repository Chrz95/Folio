import { dateKey } from '../../utils/format';
import type { BudgetData, Transaction } from '../../types/budget';
import { VALUE } from '../../constants/app.constants';
/** Calculate balances using both legs of transfers.
 * @param {BudgetData} data - Complete workspace ledger.
 * @param {string} accountId - Optional account filter.
 * @returns {number} Balance in cents. */
export function accountBalance(data: BudgetData, accountId?: string) {
  const opening = data.accounts
    .filter((account) => !accountId || account.id === accountId)
    .reduce((sum, account) => sum + account.openingBalance, 0);
  return data.transactions
    .filter((entry) => entry.date <= dateKey())
    .reduce((balance, transaction) => {
      const source = !accountId || transaction.accountId === accountId;
      const destination = !accountId || transaction.destinationAccountId === accountId;
      if (transaction.type === 'transfer') {
        return balance + (destination ? transaction.amount : 0) - (source ? transaction.amount : 0);
      }
      return balance + (source ? transaction.amount * (transaction.type === 'income' ? 1 : -1) : 0);
    }, opening);
}
/** Select postings from the month; future planned items remain separate.
 * @param {BudgetData} data - Workspace ledger.
 * @param {string} month - ISO date in desired month.
 * @returns {Transaction[]} Month's actual transactions. */
export function monthTransactions(data: BudgetData, month: string) {
  return data.transactions.filter((transaction) =>
    transaction.date.startsWith(month.slice(0, VALUE.monthPrefixLength)),
  );
}
/** Summarize actual cash flow; internal transfers do not count as income or expense.
 * @param {Transaction[]} transactions - Filtered postings.
 * @returns {object} Income, expenses, savings and category totals. */
export function statistics(transactions: Transaction[]) {
  const income = transactions.filter((entry) => entry.type === 'income').reduce((sum, entry) => sum + entry.amount, 0);
  const expenses = transactions
    .filter((entry) => entry.type === 'expense')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const categories = new Map<string, number>();
  transactions
    .filter((entry) => entry.type === 'expense')
    .forEach((entry) => categories.set(entry.category, (categories.get(entry.category) ?? 0) + entry.amount));
  return {
    income,
    expenses,
    savings: income - expenses,
    savingsRate: income > 0 ? Math.round(((income - expenses) / income) * VALUE.percent) : 0,
    categories: [...categories].sort((first, second) => second[1] - first[1]),
  };
}
