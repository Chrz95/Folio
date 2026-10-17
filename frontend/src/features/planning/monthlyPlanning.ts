import type { BudgetData } from '../../types/budget';
import type { MonthPlan } from '../../types/planning';
import { VALUE } from '../../constants/app.constants';
import { shiftMonth } from '../../utils/format';
/** Calculate positive rollover along consecutive explicitly enabled months.
 * Missing overrides use the legacy baseline and stop carry after that month.
 * @param {BudgetData} data - Full actual ledger and planning records. @param {string} month - ISO month start.
 * @returns {MonthPlan[]} Exact allocations, carry, actual expense totals and remaining amounts. */
export function monthlyPlans(data: BudgetData, month: string): MonthPlan[] {
  const overrides = (data.monthlyBudgets ?? []).filter((entry) => entry.month <= month);
  const categories = [
    ...new Set([...data.budgets.map((entry) => entry.category), ...overrides.map((entry) => entry.category)]),
  ];
  const spending = new Map<string, number>();
  for (const entry of data.transactions) {
    if (entry.type === 'expense') {
      const key = `${entry.date.slice(0, VALUE.monthPrefixLength)}-01:${entry.category}`;
      spending.set(key, (spending.get(key) ?? 0) + entry.amount);
    }
  }
  return categories.map((category) => {
    const baseline = data.budgets.find((entry) => entry.category === category)?.amount ?? 0;
    const settings = new Map(
      overrides.filter((entry) => entry.category === category).map((entry) => [entry.month, entry]),
    );
    const chain = [];
    let previousMonth = shiftMonth(month, -1);
    while (settings.get(previousMonth)?.rollover) {
      const previous = settings.get(previousMonth);
      if (previous) {
        chain.unshift(previous);
      }
      previousMonth = shiftMonth(previousMonth, -1);
    }
    let carry = 0;
    for (const previous of chain) {
      carry = Math.max(0, previous.amount + carry - (spending.get(`${previous.month}:${category}`) ?? 0));
    }
    const allocation = settings.get(month);
    const amount = allocation?.amount ?? baseline;
    const spent = spending.get(`${month}:${category}`) ?? 0;
    return {
      month,
      category,
      amount,
      rollover: allocation?.rollover ?? false,
      carry,
      available: amount + carry,
      spent,
      remaining: amount + carry - spent,
    };
  });
}
