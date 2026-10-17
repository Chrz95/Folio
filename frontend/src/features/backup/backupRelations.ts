import { isOccurrence } from '../transactions/recurrence';
import type { RestorableWorkspace } from './backupSchema';
import { CATEGORY, VALUE } from '../../constants/app.constants';
import { RECEIPT } from '../receipts/receipt.constants';
import { accountDelta } from '../statements/importMatching';
/** Reject duplicate identities that would make later CRUD ambiguous.
 * @param {string[]} values - Collection keys. @returns {void} Uniqueness validation. */
function unique(values: string[]) {
  if (new Set(values).size !== values.length) {
    throw new Error('The backup contains duplicate identities or names.');
  }
}
/** Verify graph links, category history, statement locks and file quotas before restoring.
 * @param {RestorableWorkspace} data - Structurally valid workspace. @returns {void} Domain validation. */
export function validateBackupRelations(data: RestorableWorkspace) {
  [
    data.accounts,
    data.transactions,
    data.recurring,
    data.customCategories,
    data.goals,
    data.contributions,
    data.reconciliations,
    data.receipts,
  ].forEach((rows) => unique(rows.map((entry) => entry.id)));
  unique(data.accounts.map((entry) => entry.name));
  unique(data.budgets.map((entry) => entry.category));
  unique(data.monthlyBudgets.map((entry) => `${entry.month}:${entry.category}`));
  unique(data.clearances.map((entry) => `${entry.transactionId}:${entry.accountId}`));
  unique(data.importLinks.map((entry) => entry.fingerprint));
  unique(data.reconciliations.map((entry) => `${entry.accountId}:${entry.date}`));
  unique(data.transactions.filter((entry) => entry.recurringId).map((entry) => `${entry.recurringId}:${entry.date}`));
  const accountIds = new Set(data.accounts.map((entry) => entry.id));
  const transactionById = new Map(data.transactions.map((entry) => [entry.id, entry]));
  const accountById = new Map(data.accounts.map((entry) => [entry.id, entry]));
  const statementById = new Map(data.reconciliations.map((entry) => [entry.id, entry]));
  unique(data.scheduleSettings.map((entry) => entry.recurringId));
  unique(data.skippedOccurrences.map((entry) => `${entry.recurringId}:${entry.date}`));
  for (const settings of data.scheduleSettings) {
    const template = data.recurring.find((entry) => entry.id === settings.recurringId);
    if (!template || (settings.endDate && settings.endDate < template.date)) {
      throw new Error('A schedule has invalid controls.');
    }
  }
  for (const skipped of data.skippedOccurrences) {
    const template = data.recurring.find((entry) => entry.id === skipped.recurringId);
    if (
      !template ||
      !isOccurrence(template.date, template.frequency, skipped.date) ||
      data.transactions.some((entry) => entry.recurringId === skipped.recurringId && entry.date === skipped.date)
    ) {
      throw new Error('A skipped occurrence has invalid schedule or payment links.');
    }
  }
  const recurringIds = new Set(data.recurring.map((entry) => entry.id));
  const goalIds = new Set(data.goals.map((entry) => entry.id));
  const categories = [...CATEGORY.map((entry) => entry.name), ...data.customCategories.map((entry) => entry.name)];
  unique(categories.map((entry) => entry.toLowerCase()));
  const invalidCategory = data.customCategories.some(
    (entry) => entry.normalizedName !== undefined && entry.normalizedName !== entry.name.toLowerCase(),
  );
  const invalidPosting = [...data.transactions, ...data.recurring].some(
    (entry) =>
      !accountIds.has(entry.accountId) ||
      !categories.includes(entry.category) ||
      (entry.type === 'transfer'
        ? !entry.destinationAccountId ||
          !accountIds.has(entry.destinationAccountId) ||
          entry.destinationAccountId === entry.accountId
        : entry.destinationAccountId !== null),
  );
  if (
    invalidCategory ||
    invalidPosting ||
    data.transactions.some((entry) => entry.recurringId && !recurringIds.has(entry.recurringId)) ||
    [...data.budgets, ...data.monthlyBudgets].some((entry) => !categories.includes(entry.category)) ||
    data.contributions.some((entry) => !goalIds.has(entry.goalId))
  ) {
    throw new Error('The backup contains missing or invalid account, category or schedule links.');
  }
  const goalProgress = new Map<string, number>();
  data.contributions.forEach((entry) =>
    goalProgress.set(entry.goalId, (goalProgress.get(entry.goalId) ?? 0) + entry.amount),
  );
  if ([...goalProgress.values()].some((progress) => progress < 0 || progress > VALUE.maximumMoney)) {
    throw new Error('A savings goal has invalid progress.');
  }
  const statementMovements = new Map<string, number>();
  for (const flag of data.clearances) {
    const entry = transactionById.get(flag.transactionId);
    const statement = statementById.get(flag.reconciliationId ?? '');
    if (
      !entry ||
      !accountIds.has(flag.accountId) ||
      accountDelta(entry, flag.accountId) === 0 ||
      (flag.reconciliationId && (!statement || statement.accountId !== flag.accountId || entry.date > statement.date))
    ) {
      throw new Error('The backup contains invalid reconciliation links.');
    }
  }
  for (const flag of data.clearances) {
    const entry = transactionById.get(flag.transactionId);
    if (entry && flag.reconciliationId) {
      statementMovements.set(
        flag.reconciliationId,
        (statementMovements.get(flag.reconciliationId) ?? 0) + accountDelta(entry, flag.accountId),
      );
    }
  }
  const balances = new Map(data.accounts.map((entry) => [entry.id, entry.openingBalance]));
  for (const statement of [...data.reconciliations].sort((left, right) => left.date.localeCompare(right.date))) {
    const balance = (balances.get(statement.accountId) ?? 0) + (statementMovements.get(statement.id) ?? 0);
    if (!accountById.has(statement.accountId) || balance !== statement.statementBalance) {
      throw new Error('A reconciled statement does not match its locked ledger.');
    }
    balances.set(statement.accountId, balance);
  }
  for (const link of data.importLinks) {
    const entry = transactionById.get(link.transactionId);
    let fingerprint: unknown;
    try {
      fingerprint = JSON.parse(link.fingerprint);
    } catch {
      throw new Error('A bank import identity is damaged.');
    }
    if (
      !entry ||
      !Array.isArray(fingerprint) ||
      !accountIds.has(String(fingerprint[0])) ||
      accountDelta(entry, String(fingerprint[0])) === 0 ||
      ![BANK_ID_PARTS, MOVEMENT_PARTS].includes(fingerprint.length) ||
      (fingerprint.length === BANK_ID_PARTS && (fingerprint[1] !== 'bank-id' || typeof fingerprint[2] !== 'string')) ||
      (fingerprint.length === MOVEMENT_PARTS &&
        (typeof fingerprint[1] !== 'string' ||
          !['expense', 'income'].includes(String(fingerprint[2])) ||
          !Number.isSafeInteger(fingerprint[3]) ||
          typeof fingerprint[4] !== 'string'))
    ) {
      throw new Error('A bank import identity has invalid account links.');
    }
  }
  if (
    data.receipts.some((entry) => !transactionById.has(entry.transactionId)) ||
    data.receipts.reduce((sum, entry) => sum + entry.size, 0) > RECEIPT.previewBytes ||
    data.transactions.some(
      (entry) => data.receipts.filter((row) => row.transactionId === entry.id).length > RECEIPT.perTransaction,
    )
  ) {
    throw new Error('Attachments exceed preview limits or refer to a missing transaction.');
  }
}
const BANK_ID_PARTS = 3;
const MOVEMENT_PARTS = 5;
