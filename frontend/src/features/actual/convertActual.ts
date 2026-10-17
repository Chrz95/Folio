import { isActualOccurrence } from './actualOccurrence';
import { ACTUAL, ACTUAL_CATEGORIES } from './actual.constants';
import { actualFileSchema } from './actualSchema';
import type { ActualFile } from './actualSchema';
import type { ActualSource, SourceRow } from './source';
import { cents, date, identity, label, resolver, text } from './source';
import { convertSchedules } from './actualSchedules';
/** Preserve distinct source names, shortening only catalog labels with stable visible suffixes.
 * @param {string} original - Native name. @param {string} id - Stable UUID.
 * @param {Set<string>} used - Existing case-insensitive names. @param {number} maximum - Field bound.
 * @returns {string} Unique display name. */
function catalogName(original: string, id: string, used: Set<string>, maximum: number) {
  const suffix = ` · ${id.slice(0, ACTUAL.uuidSuffix)}`;
  let name = original;
  if (name.length > maximum || used.has(name.toLowerCase())) {
    name = name.slice(0, maximum - suffix.length) + suffix;
  }
  if (used.has(name.toLowerCase())) {
    throw new Error('Source names collide. Rename them in Actual before exporting.');
  }
  used.add(name.toLowerCase());
  return name;
}
/** Normalize a validated native SQLite snapshot without modifying the source or destination.
 * @param {ActualSource} source - Bounded live rows. @param {string} metadata - Native metadata JSON.
 * @returns {ActualFile} Additive data and compatibility report. */
export function convertActual(source: ActualSource, metadata: string): ActualFile {
  const meta: unknown = JSON.parse(metadata);
  if (!meta || typeof meta !== 'object' || !('id' in meta)) {
    throw new Error('Actual metadata is missing its ID.');
  }
  const budget =
    'cloudFileId' in meta && typeof meta.cloudFileId === 'string' && meta.cloudFileId
      ? meta.cloudFileId
      : label(meta.id, ACTUAL.name);
  const accountIds = new Map(source.accounts.map((row) => [text(row.id), identity(budget, 'account', row.id)]));
  const usedAccounts = new Set<string>();
  const accounts = source.accounts.map((row) => ({
    id: accountIds.get(text(row.id))!,
    name: catalogName(
      `Actual · ${label(row.name, ACTUAL.name)}`,
      accountIds.get(text(row.id))!,
      usedAccounts,
      ACTUAL.name,
    ),
    openingBalance: 0,
  }));
  const accountById = new Map(accounts.map((row) => [row.id, row]));
  const categoryMap = resolver(source.category_mapping, 'transferId');
  const payeeMap = resolver(source.payee_mapping, 'targetId');
  const usedCategories = new Set<string>();
  const categoryNames = new Map<string, string>();
  const categoryMappings: ActualFile['categoryMappings'] = [];
  const customCategories: ActualFile['customCategories'] = [];
  for (const row of source.categories) {
    const original = label(row.name, ACTUAL.notes);
    const builtin = ACTUAL_CATEGORIES.find((entry) => entry.toLowerCase() === original.toLowerCase());
    const id = identity(budget, 'category', row.id);
    const name = catalogName(builtin ?? original, id, usedCategories, ACTUAL.category);
    categoryNames.set(text(row.id), name);
    if (original !== name) {
      categoryMappings.push({ original, name });
    }
    if (!ACTUAL_CATEGORIES.includes(name)) {
      customCategories.push({ id, name, isArchived: row.hidden === 1 });
    }
  }
  /** Resolve historical merged names. @param {unknown} value - Category key. @returns {string} Folio category. */
  function category(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return 'Other';
    }
    const name = categoryNames.get(categoryMap(value));
    if (!name) {
      throw new Error('A transaction refers to an unavailable category.');
    }
    return name;
  }
  const payees = new Map(source.payees.map((row) => [text(row.id), row]));
  /** Resolve a payee without silently losing labels or treating transfers as expenses.
   * @param {unknown} value - Payee key. @returns {string} Display name. */
  function payee(value: unknown) {
    if (!value) {
      return 'Actual transaction';
    }
    const row = payees.get(payeeMap(value));
    if (!row) {
      throw new Error('A transaction refers to an unavailable payee.');
    }
    if (row.transfer_acct) {
      throw new Error('A transfer requires a reciprocal transfer pair.');
    }
    return label(row.name || 'Actual transaction', ACTUAL.name);
  }
  /** Resolve scheduled transfers through the same merged payees as historical transactions.
   * @param {unknown} value - Payee key. @returns {string | null} Destination account identity. */
  function transferAccount(value: unknown): string | null {
    if (!value) {
      return null;
    }
    const row = payees.get(payeeMap(value));
    if (!row) {
      throw new Error('A schedule refers to an unavailable payee.');
    }
    if (!row.transfer_acct) {
      return null;
    }
    const id = accountIds.get(text(row.transfer_acct));
    if (!id) {
      throw new Error('A schedule transfer account is unavailable.');
    }
    return id;
  }
  const schedules = convertSchedules(source, budget, accountIds, payee, category, transferAccount);
  const recurringById = new Map(schedules.recurring.map((row) => [row.id, row]));
  const linkedDates = new Set<string>();
  const transactions: ActualFile['transactions'] = [];
  const clearances: ActualFile['clearances'] = [];
  const all = new Map(source.transactions.map((row) => [text(row.id), row]));
  const children = new Map<string, SourceRow[]>();
  for (const row of source.transactions.filter((row) => row.isChild === 1)) {
    const parent = all.get(text(row.parent_id));
    if (!parent || parent.isParent !== 1 || parent.acct !== row.acct || parent.date !== row.date) {
      throw new Error('A split transaction has invalid parent links.');
    }
    const rows = children.get(text(row.parent_id)) ?? [];
    rows.push(row);
    children.set(text(row.parent_id), rows);
  }
  for (const row of source.transactions.filter((row) => row.isParent === 1)) {
    if ((children.get(text(row.id)) ?? []).reduce((sum, child) => sum + cents(child.amount), 0) !== cents(row.amount)) {
      throw new Error('Split children do not match the parent amount.');
    }
  }
  const balances = new Map(accounts.map((row) => [row.id, 0]));
  let zeroRows = 0;
  let unmatchedSchedulePayments = 0;
  const unmatchedPaymentExamples: string[] = [];
  for (const row of source.transactions) {
    if (row.isParent === 1) {
      continue;
    }
    const accountId = accountIds.get(text(row.acct));
    if (!accountId) {
      throw new Error('A transaction account is unavailable.');
    }
    const amount = cents(row.amount);
    balances.set(accountId, balances.get(accountId)! + amount);
    if (row.starting_balance_flag === 1) {
      if (row.isChild === 1 || row.transferred_id) {
        throw new Error('A starting balance has unsupported links.');
      }
      accountById.get(accountId)!.openingBalance += amount;
      continue;
    }
    if (!amount) {
      zeroRows += 1;
      continue;
    }
    let destinationAccountId: string | null = null;
    let paired: SourceRow | undefined;
    if (row.transferred_id) {
      paired = all.get(text(row.transferred_id));
      destinationAccountId = paired ? (accountIds.get(text(paired.acct)) ?? null) : null;
      if (
        !paired ||
        paired.transferred_id !== row.id ||
        cents(paired.amount) !== -amount ||
        paired.date !== row.date ||
        !destinationAccountId ||
        destinationAccountId === accountId ||
        paired.isParent === 1 ||
        paired.starting_balance_flag === 1
      ) {
        throw new Error('An internal transfer is incomplete or inconsistent.');
      }
      if (amount > 0) {
        continue;
      }
    }
    const parent = row.isChild === 1 ? all.get(text(row.parent_id)) : undefined;
    const notes = [parent?.notes, row.notes, paired?.notes]
      .filter((value) => value !== null && value !== undefined && value !== '')
      .map(text)
      .join('\n');
    if (notes.length > ACTUAL.notes) {
      throw new Error('Imported notes exceed 1,000 characters.');
    }
    const id = identity(budget, 'transaction', row.id);
    const scheduleId = row.schedule ? identity(budget, 'schedule', row.schedule) : null;
    transactions.push({
      id,
      name: paired ? 'Actual transfer' : payee(row.description || parent?.description),
      amount: Math.abs(amount),
      type: paired ? 'transfer' : amount > 0 ? 'income' : 'expense',
      category: paired ? 'Other' : category(row.category),
      accountId,
      destinationAccountId,
      date: date(row.date),
      notes,
      createdAt: 0,
      recurringId: null,
    });
    const posting = transactions[transactions.length - 1]!;
    const schedule = scheduleId ? recurringById.get(scheduleId) : undefined;
    const paidKey = `${scheduleId}:${posting.date}`;
    if (
      schedule &&
      schedule.amount === posting.amount &&
      schedule.type === posting.type &&
      schedule.accountId === posting.accountId &&
      schedule.destinationAccountId === posting.destinationAccountId &&
      !linkedDates.has(paidKey) &&
      isActualOccurrence(schedule.date, schedule.frequency, posting.date)
    ) {
      posting.recurringId = schedule.id;
      linkedDates.add(paidKey);
    }
    if ((row.schedule || parent?.schedule || paired?.schedule) && !posting.recurringId) {
      unmatchedSchedulePayments += 1;
      if (unmatchedPaymentExamples.length < ACTUAL.previewRows) {
        const expected = schedule ? `${schedule.name} (${schedule.frequency}, starts ${schedule.date})` : 'source rule';
        unmatchedPaymentExamples.push(
          `Unlinked payment: ${posting.name} recorded on ${posting.date}; scheduled by ${expected}.`,
        );
      }
    }
    if (row.cleared === 1 || row.reconciled === 1) {
      clearances.push({ transactionId: id, accountId, reconciliationId: null });
    }
    if (paired && destinationAccountId && (paired.cleared === 1 || paired.reconciled === 1)) {
      clearances.push({ transactionId: id, accountId: destinationAccountId, reconciliationId: null });
    }
  }
  const mode = source.preferences.find((row) => row.id === 'budgetType')?.value;
  const allocations = mode === '"tracking"' || mode === 'tracking' ? source.reflect_budgets : source.zero_budgets;
  const monthlyBudgets: ActualFile['monthlyBudgets'] = [];
  let excludedAllocations = 0;
  for (const row of allocations) {
    const original = source.categories.find((entry) => entry.id === row.category);
    if (!original || original.is_income === 1 || cents(row.amount) < 0) {
      excludedAllocations += 1;
      continue;
    }
    const raw = String(row.month);
    if (raw.length !== ACTUAL.monthDigits) {
      throw new Error('An allocation month is invalid.');
    }
    monthlyBudgets.push({
      month: date(`${raw}01`),
      category: category(row.category),
      amount: cents(row.amount),
      rollover: false,
    });
  }
  return actualFileSchema.parse({
    budgetName: 'budgetName' in meta ? label(meta.budgetName, ACTUAL.name) : 'Actual budget',
    accounts,
    categoryMappings,
    customCategories,
    transactions,
    ...schedules,
    monthlyBudgets,
    clearances,
    balances: [...balances].map(([accountId, amount]) => ({ accountId, amount })),
    warnings: [
      'EUR with two decimal places only. No currency conversion is performed.',
      'Split children become separate postings; split grouping is not retained. Starting balances become openings.',
      'Closed and off-budget accounts become ordinary manual accounts. Bank connections and groups are not imported.',
      'Reconciled entries become cleared entries; source reconciliation statements are not recreated.',
      'Actual next-date progress is retained as reversible skips, not new payments; anchors and endings stay intact.',
      'Supported schedules import paused; simple category/notes actions carry over, otherwise category is Other.',
      'Approximate amounts become fixed estimates; ranges use a rounded midpoint. Review notes before resuming.',
      'Date matching tolerance and source auto-posting are not enabled. Unsupported schedules are listed below.',
      'Existing historical postings keep their schedule links when importing newly supported schedules.',
      ...(unmatchedSchedulePayments
        ? [
            `Source-linked payments kept as ordinary transactions: ${unmatchedSchedulePayments}. ` +
              'Their original dates and amounts are preserved. They do not mark planned dates paid in Folio; ' +
              'review or skip those dates before resuming reminders.',
          ]
        : []),
      ...unmatchedPaymentExamples,
      ...(unmatchedSchedulePayments > unmatchedPaymentExamples.length
        ? ['Additional unlinked payments are present. Check source schedule links before resuming reminders.']
        : []),
      'Long or duplicate category names receive stable suffixes; original names are included in the review.',
      'Tags, rule automation, reports, attachments, goal formulas and carryover are not imported.',
      `${zeroRows} zero-value postings excluded; ` +
        `${excludedAllocations} negative, income or obsolete allocations excluded.`,
    ],
  });
}
