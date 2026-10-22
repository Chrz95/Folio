import { confirmDemoOccurrences } from '../schedules/automaticConfirmation';
import { patchDemoControls } from '../schedules/automaticControls';
import { resolveScheduleEnding } from './scheduleEnding';
import type { EndingInput } from './scheduleEnding';
import { loadSchedules, mutateSchedule } from '../schedules/scheduleService';
import type { ScheduleResource } from '../schedules/scheduleService';
import { isScheduleDateEnabled } from '../schedules/schedulePolicy';
import { isOccurrence } from './recurrence';
import { loadPlanning, mutatePlanning } from '../planning/planningService';
import type { PlanningResource } from '../planning/planningService';
import { PLANNING_PATH } from '../planning/planning.constants';
import { categoryNames } from '../planning/catalog';
import { loadStatementState } from '../statements/statementsService';
import { environment } from '../../app/config/environment';
import { PATH } from '../../constants/app.constants';
import { request } from '../../lib/api/client';
import type { BudgetData, Account, CategoryBudget, Transaction, RecurringTransaction } from '../../types/budget';
import { readDemo, writeDemo } from '../../lib/storage/demoStore';
export type Resource = 'transactions' | 'recurring' | 'accounts' | 'budgets' | PlanningResource | ScheduleResource;
/** Load server collections; demo storage is a separate compile-time adapter, never an API fallback.
 * @param {AbortSignal} signal - Optional cancellation.
 * @returns {Promise<BudgetData>} Workspace snapshot. */
export async function loadBudget(signal?: AbortSignal): Promise<BudgetData> {
  if (environment.isDemo) {
    return confirmDemoOccurrences(Date.now());
  }
  const maximumRows = 500;
  const transactions: Transaction[] = [];
  let batch: Transaction[];
  do {
    batch = await request<Transaction[]>(`${PATH.transactions}?limit=${maximumRows}&offset=${transactions.length}`, {
      signal,
    });
    transactions.push(...batch);
  } while (batch.length === maximumRows);
  const [accounts, recurring, budgets] = await Promise.all([
    request<Account[]>(PATH.accounts, { signal }),
    request<RecurringTransaction[]>(PATH.recurring, { signal }),
    request<CategoryBudget[]>(PATH.budgets, { signal }),
  ]);
  return {
    transactions,
    accounts,
    recurring,
    budgets,
    ...(await loadStatementState(signal)),
    ...(await loadPlanning(signal)),
    ...(await loadSchedules(signal)),
  };
}
/** Save a CRUD change to the selected persistence adapter.
 * @param {Resource} resource - Domain collection.
 * @param {string} method - HTTP operation.
 * @param {object} value - Validated form value.
 * @param {string} id - Existing record ID.
 * @returns {Promise<void>} Completes only after durable write in selected adapter. */
export async function mutateBudget(resource: Resource, method: string, value?: object, id?: string): Promise<void> {
  if (resource === 'scheduleSettings' || resource === 'skippedOccurrences') {
    return mutateSchedule(resource, value);
  }
  if (resource in PLANNING_PATH) {
    return mutatePlanning(resource as PlanningResource, method, value, id);
  }
  const path = PATH[resource as keyof typeof PATH];
  if (!environment.isDemo) {
    await request(`${path}${id ? `/${id}` : ''}`, {
      method,
      body: value ? JSON.stringify(value) : undefined,
    });
    return;
  }
  const data = readDemo();
  let storedValue = value;
  let requestedEnd: string | null | undefined;
  let requestedAutomatic: boolean | undefined;
  let restartAutomatic = false;
  if (resource === 'recurring' && value && method !== 'DELETE') {
    const input = value as EndingInput & { autoConfirm?: boolean };
    requestedEnd = resolveScheduleEnding(input);
    const { endDate: _end, repetitions: _count, countFrom: _from, autoConfirm, ...fields } = input;
    if ((autoConfirm !== undefined && typeof autoConfirm !== 'boolean') || 'autoConfirmFrom' in input) {
      throw new Error('Choose an explicit automatic confirmation checkbox value.');
    }
    requestedAutomatic = autoConfirm;
    storedValue = fields;
  }
  if ((resource === 'transactions' || resource === 'recurring') && value && method !== 'DELETE') {
    const input = value as Transaction;
    const previous = data[resource].find((entry) => entry.id === id);
    if (!categoryNames(data, previous?.category).includes(input.category)) {
      throw new Error('Choose an active category.');
    }
  }
  if (
    resource === 'transactions' &&
    id &&
    data.clearances?.some((entry) => entry.transactionId === id && entry.reconciliationId)
  ) {
    throw new Error('Undo the latest statement reconciliation before editing this entry.');
  }
  if (resource === 'recurring' && method === 'PUT' && id && value) {
    const previous = data.recurring.find((entry) => entry.id === id);
    const input = value as RecurringTransaction;
    const endDate =
      requestedEnd === undefined
        ? data.scheduleSettings?.find((entry) => entry.recurringId === id)?.endDate
        : requestedEnd;
    if (endDate && input.date > endDate) {
      throw new Error('Adjust the end date before moving the schedule start.');
    }
    if (previous && (previous.date !== input.date || previous.frequency !== input.frequency)) {
      restartAutomatic = true;
      data.skippedOccurrences = data.skippedOccurrences?.filter((entry) => entry.recurringId !== id);
    }
  }
  if (resource === 'transactions' && method === 'DELETE') {
    data.receipts = data.receipts?.filter((entry) => entry.transactionId !== id);
    data.clearances = data.clearances?.filter((entry) => entry.transactionId !== id);
    data.importLinks = data.importLinks?.filter((entry) => entry.transactionId !== id);
  }
  if (method === 'DELETE') {
    if (resource === 'transactions') {
      data.transactions = data.transactions.filter((entry) => entry.id !== id);
    }
    if (resource === 'recurring') {
      data.scheduleSettings = data.scheduleSettings?.filter((entry) => entry.recurringId !== id);
      data.skippedOccurrences = data.skippedOccurrences?.filter((entry) => entry.recurringId !== id);
      data.recurring = data.recurring.filter((entry) => entry.id !== id);
      data.transactions = data.transactions.map((entry) =>
        entry.recurringId === id ? { ...entry, recurringId: null } : entry,
      );
    }
  } else if (resource === 'budgets') {
    const budget = value as CategoryBudget;
    data.budgets = [...data.budgets.filter((entry) => entry.category !== budget.category), budget];
  } else {
    const entries = data[resource as keyof BudgetData] as unknown as Record<string, unknown>[];
    const previous = entries.find((entry) => entry.id === id);
    const audit =
      resource === 'transactions'
        ? { createdAt: previous?.createdAt ?? Date.now(), recurringId: previous?.recurringId ?? null }
        : {};
    const record = { ...audit, ...storedValue, id: id ?? crypto.randomUUID() };
    if (
      resource === 'recurring' &&
      (requestedEnd !== undefined ||
        requestedAutomatic !== undefined ||
        (restartAutomatic && data.scheduleSettings?.some((row) => row.recurringId === record.id && row.autoConfirm)))
    ) {
      patchDemoControls(
        data,
        record.id,
        {
          ...(requestedEnd !== undefined ? { endDate: requestedEnd } : {}),
          ...(requestedAutomatic !== undefined ? { autoConfirm: requestedAutomatic } : {}),
        },
        restartAutomatic,
      );
    }
    const next = [...entries.filter((entry) => entry.id !== id), record];
    Object.assign(data, { [resource]: next });
  }
  writeDemo(data);
}
/** Idempotently mark one planned occurrence paid.
 * @param {RecurringTransaction} template - Schedule including selected date.
 * @returns {Promise<void>} Posted occurrence. */
export async function payOccurrence(template: RecurringTransaction): Promise<void> {
  if (!environment.isDemo) {
    await request(`${PATH.recurring}/${template.id}/pay`, {
      method: 'POST',
      body: JSON.stringify({ date: template.date }),
    });
    return;
  }
  const data = readDemo();
  if (data.transactions.some((entry) => entry.recurringId === template.id && entry.date === template.date)) {
    return;
  }
  const current = data.recurring.find((entry) => entry.id === template.id);
  if (
    !current ||
    !isOccurrence(current.date, current.frequency, template.date) ||
    !isScheduleDateEnabled(template.id, template.date, data)
  ) {
    throw new Error('Resume or restore this occurrence before recording it.');
  }
  const { frequency: _frequency, reminderDays: _reminderDays, ...transaction } = current;
  data.transactions.push({
    ...transaction,
    date: template.date,
    id: crypto.randomUUID(),
    recurringId: template.id,
    createdAt: Date.now(),
  });
  writeDemo(data);
}
