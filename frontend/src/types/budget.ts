import type { ScheduleData } from '../features/schedules/schedulePolicy';
import type { Receipt } from './receipts';
import type { PlanningData } from './planning';
import type { ReconciliationData } from './operations';
/** Money is represented as integer euro cents throughout the contract. */
export type TransactionType = 'expense' | 'income' | 'transfer';
export type Frequency = 'once' | 'weekly' | 'monthly' | 'yearly';
export interface Account {
  id: string;
  name: string;
  openingBalance: number;
}
export interface TransactionInput {
  name: string;
  amount: number;
  type: TransactionType;
  category: string;
  accountId: string;
  destinationAccountId: string | null;
  date: string;
  notes: string;
}
export interface Transaction extends TransactionInput {
  id: string;
  createdAt: number;
  recurringId: string | null;
}
export interface RecurringInput extends TransactionInput {
  frequency: Frequency;
  reminderDays: number;
}
export interface RecurringTransaction extends RecurringInput {
  id: string;
}
export interface CategoryBudget {
  category: string;
  amount: number;
}
export interface BudgetData extends Partial<ReconciliationData>, Partial<PlanningData>, Partial<ScheduleData> {
  receipts?: Receipt[];
  transactions: Transaction[];
  accounts: Account[];
  recurring: RecurringTransaction[];
  budgets: CategoryBudget[];
}
export interface Occurrence extends RecurringTransaction {
  occurrenceId: string;
  isPaid: boolean;
}
export type PageName = 'overview' | 'transactions' | 'calendar' | 'recurring' | 'reports' | 'budgets' | 'settings';
export interface EditorState {
  transaction?: Transaction | RecurringTransaction;
  isRecurring: boolean;
  isDuplicate?: boolean;
  date?: string;
}
