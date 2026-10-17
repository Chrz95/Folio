interface CopyInput {
  fromMonth: string;
  toMonth: string;
  mode: 'missing' | 'replace';
}
interface Allocation {
  month: string;
  category: string;
  amount: number;
  rollover: boolean;
}
interface CopySnapshot {
  budgets: { category: string; amount: number }[];
  monthlyBudgets?: Allocation[];
  customCategories?: { name: string; isArchived: boolean }[];
}
/** Derive reviewed allocations without copying spending, rollover balances or unrelated target categories.
 * @param {CopySnapshot} data - Planning snapshot. @param {CopyInput} input - Source, destination and conflict policy.
 * @returns {object} Stable rows plus an exact optimistic-concurrency revision. */
export function budgetCopyPlan(data: CopySnapshot, input: CopyInput) {
  const source = (data.monthlyBudgets ?? []).filter((entry) => entry.month === input.fromMonth);
  const target = (data.monthlyBudgets ?? []).filter((entry) => entry.month === input.toMonth);
  const names = [
    ...new Set([...data.budgets.map((entry) => entry.category), ...source.map((entry) => entry.category)]),
  ].sort();
  const rows = names.map((category) => {
    const original = source.find((entry) => entry.category === category);
    const current = target.find((entry) => entry.category === category);
    const isArchived = data.customCategories?.some((entry) => entry.name === category && entry.isArchived) ?? false;
    return {
      category,
      amount: original?.amount ?? data.budgets.find((entry) => entry.category === category)?.amount ?? 0,
      rollover: original?.rollover ?? false,
      currentAmount: current?.amount ?? null,
      currentRollover: current?.rollover ?? null,
      action: isArchived
        ? ('archived' as const)
        : current && input.mode === 'missing'
          ? ('keep' as const)
          : ('copy' as const),
    };
  });
  return { ...input, rows, revision: JSON.stringify([input.fromMonth, input.toMonth, input.mode, rows]) };
}
export type BudgetCopyInput = CopyInput;
export type BudgetCopyPlan = ReturnType<typeof budgetCopyPlan>;
