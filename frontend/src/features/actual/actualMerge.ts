import { isActualOccurrence } from './actualOccurrence';
import type { ActualFile, ActualData } from './actualSchema';
import { ACTUAL_CATEGORIES } from './actual.constants';
export interface ActualState {
  accounts: ActualData['accounts'];
  transactions: (Omit<ActualData['transactions'][number], 'createdAt'> & { createdAt: number })[];
  recurring: (Omit<ActualData['recurring'][number], 'reminderDays'> & { reminderDays: number })[];
  customCategories?: ActualData['customCategories'];
  monthlyBudgets?: (Omit<ActualData['monthlyBudgets'][number], 'rollover'> & { rollover: boolean })[];
  clearances?: (Omit<ActualData['clearances'][number], 'reconciliationId'> & { reconciliationId: string | null })[];
  scheduleSettings?: (Omit<ActualData['scheduleSettings'][number], 'isPaused'> & { isPaused: boolean })[];
}
/** Canonicalize object keys for database/browser equality without depending on SQL column order.
 * @param {unknown} value - Snapshot. @returns {string} Stable serialized value. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
/** Reject ambiguous identities before persistence. @param {string[]} keys - Record keys.
 * @returns {void} Unique guard. */
function unique(keys: string[]) {
  if (new Set(keys).size !== keys.length) {
    throw new Error('The import contains duplicate identities.');
  }
}
/** Compute an account's exact all-recorded balance, including future postings.
 * @param {ActualState} data - Ledger. @param {string} id - Account. @returns {number} Cents. */
function balance(data: ActualState, id: string) {
  return data.transactions.reduce(
    (sum, row) =>
      sum +
      (row.accountId === id ? (row.type === 'income' ? row.amount : -row.amount) : 0) +
      (row.destinationAccountId === id ? row.amount : 0),
    data.accounts.find((row) => row.id === id)?.openingBalance ?? 0,
  );
}
/** Select only absent rows, rejecting changed source identities rather than overwriting them.
 * @param {T[]} source - Approved source. @param {object[]} current - Existing records.
 * @param {(row: T) => string} key - Identity. @returns {T[]} New rows. */
function additions<T>(source: T[], current: object[], key: (row: T) => string): T[] {
  unique(source.map(key));
  const existing = new Map(current.map((row) => [key(row as T), row]));
  return source.filter((row) => {
    const previous = existing.get(key(row));
    if (previous && canonical(previous) !== canonical(row)) {
      throw new Error(
        'An imported identity was edited. Resolve the conflict before importing; nothing is overwritten.',
      );
    }
    return !previous;
  });
}
/** Validate the entire graph and construct a reversible additive review. Never mutates either input.
 * @param {ActualState} target - Fresh destination. @param {ActualFile} file - Normalized source.
 * @returns {object} New rows, counts and source/current/after balances. */
export function actualPlan(target: ActualState, file: ActualFile) {
  const accountIds = new Set(file.accounts.map((row) => row.id));
  const categoryNames = [...ACTUAL_CATEGORIES, ...file.customCategories.map((row) => row.name)];
  unique(file.accounts.map((row) => row.name.toLowerCase()));
  unique(file.customCategories.map((row) => row.id));
  unique(categoryNames.map((name) => name.toLowerCase()));
  const scheduleById = new Map(file.recurring.map((row) => [row.id, row]));
  for (const row of [...file.transactions, ...file.recurring]) {
    if (
      !accountIds.has(row.accountId) ||
      !categoryNames.includes(row.category) ||
      (row.type === 'transfer'
        ? !row.destinationAccountId ||
          !accountIds.has(row.destinationAccountId) ||
          row.destinationAccountId === row.accountId
        : row.destinationAccountId !== null)
    ) {
      throw new Error('The import has invalid account or category links.');
    }
  }
  unique(file.transactions.filter((row) => row.recurringId).map((row) => `${row.recurringId}:${row.date}`));
  if (
    file.transactions.some(
      (row) =>
        row.recurringId &&
        (!scheduleById.has(row.recurringId) ||
          !isActualOccurrence(
            scheduleById.get(row.recurringId)!.date,
            scheduleById.get(row.recurringId)!.frequency,
            row.date,
          )),
    )
  ) {
    throw new Error('An imported posting has an invalid schedule link.');
  }
  const transactionById = new Map(file.transactions.map((row) => [row.id, row]));
  for (const row of file.clearances) {
    const posting = transactionById.get(row.transactionId);
    if (!posting || (posting.accountId !== row.accountId && posting.destinationAccountId !== row.accountId)) {
      throw new Error('An imported clearance has an invalid account leg.');
    }
  }
  unique(file.scheduleSettings.map((row) => row.recurringId));
  if (
    file.scheduleSettings.length !== file.recurring.length ||
    file.scheduleSettings.some(
      (row) =>
        !scheduleById.has(row.recurringId) ||
        !row.isPaused ||
        (row.endDate && row.endDate < scheduleById.get(row.recurringId)!.date),
    )
  ) {
    throw new Error('Every imported schedule must have valid paused controls.');
  }
  if (file.monthlyBudgets.some((row) => !categoryNames.includes(row.category))) {
    throw new Error('An allocation has an unknown category.');
  }
  unique(file.balances.map((row) => row.accountId));
  if (
    file.balances.length !== file.accounts.length ||
    file.balances.some((row) => !accountIds.has(row.accountId) || row.amount !== balance(file, row.accountId))
  ) {
    throw new Error('Converted account balances do not match Actual. Nothing can be imported.');
  }
  const accounts = additions(file.accounts, target.accounts, (row) => row.id);
  if (
    accounts.some((row) => target.accounts.some((previous) => previous.name.toLowerCase() === row.name.toLowerCase()))
  ) {
    throw new Error('An account name already exists. Rename it in Folio before importing.');
  }
  const customCategories = file.customCategories.filter((row) => {
    const previous = target.customCategories?.find((entry) => entry.name.toLowerCase() === row.name.toLowerCase());
    if (previous && previous.name !== row.name) {
      throw new Error('Category names differ only by case. Rename first.');
    }
    if (target.customCategories?.some((entry) => entry.id === row.id && entry.name !== row.name)) {
      throw new Error('An imported category was renamed. Resolve the conflict first.');
    }
    return !previous;
  });
  // Older imports may have omitted a schedule. Adding it must not rewrite or conflict with its old postings.
  const existingPostings = new Map(target.transactions.map((row) => [row.id, row]));
  const preservedUnlinkedPayments = file.transactions.filter(
    (row) => row.recurringId && existingPostings.get(row.id)?.recurringId === null,
  ).length;
  const incomingPostings = file.transactions.map((row) =>
    existingPostings.get(row.id)?.recurringId === null && row.recurringId ? { ...row, recurringId: null } : row,
  );
  const transactions = additions(incomingPostings, target.transactions, (row) => row.id);
  const recurring = additions(file.recurring, target.recurring, (row) => row.id);
  const monthlyBudgets = additions(
    file.monthlyBudgets,
    target.monthlyBudgets ?? [],
    (row) => `${row.month}:${row.category}`,
  );
  unique(file.clearances.map((row) => `${row.transactionId}:${row.accountId}`));
  // Clearing and pause state belong to the user after the first import; repeat imports never reset them.
  const clearances = file.clearances.filter((row) => transactions.some((entry) => entry.id === row.transactionId));
  const scheduleSettings = file.scheduleSettings.filter((row) =>
    recurring.some((entry) => entry.id === row.recurringId),
  );
  const rows = { accounts, customCategories, transactions, recurring, monthlyBudgets, clearances, scheduleSettings };
  const merged = mergeActual(target, rows);
  unique(merged.transactions.filter((row) => row.recurringId).map((row) => `${row.recurringId}:${row.date}`));
  return {
    rows,
    added: {
      accounts: accounts.length,
      customCategories: customCategories.length,
      transactions: transactions.length,
      recurring: recurring.length,
      monthlyBudgets: monthlyBudgets.length,
      clearances: clearances.length,
      scheduleSettings: scheduleSettings.length,
    },
    reused: file.transactions.length - transactions.length,
    preservedUnlinkedPayments,
    accountRows: file.accounts.map((row) => ({
      id: row.id,
      name: row.name,
      source: file.balances.find((entry) => entry.accountId === row.id)!.amount,
      before: balance(target, row.id),
      after: balance(merged, row.id),
    })),
  };
}
export type ActualPlan = ReturnType<typeof actualPlan>;
export type ActualReview = ActualPlan & { revision: string };
/** Preserve every unrelated workspace collection while adding approved records.
 * @param {T} target - Existing snapshot. @param {ActualData} rows - New rows. @returns {T} Combined snapshot. */
export function mergeActual<T extends ActualState>(target: T, rows: ActualData): T {
  return {
    ...target,
    accounts: [...target.accounts, ...rows.accounts],
    transactions: [...target.transactions, ...rows.transactions],
    recurring: [...target.recurring, ...rows.recurring],
    customCategories: [...(target.customCategories ?? []), ...rows.customCategories],
    monthlyBudgets: [...(target.monthlyBudgets ?? []), ...rows.monthlyBudgets],
    clearances: [...(target.clearances ?? []), ...rows.clearances],
    scheduleSettings: [...(target.scheduleSettings ?? []), ...rows.scheduleSettings],
  };
}
