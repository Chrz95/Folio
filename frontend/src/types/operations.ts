import type { TransactionInput } from './budget';
/** Per-account clearing supports both legs of an internal transfer. */
export interface Clearance {
  transactionId: string;
  accountId: string;
  reconciliationId: string | null;
}
export interface Reconciliation {
  id: string;
  accountId: string;
  date: string;
  statementBalance: number;
  createdAt: number;
}
export interface ImportLink {
  fingerprint: string;
  transactionId: string;
}
export interface ReconciliationData {
  clearances: Clearance[];
  reconciliations: Reconciliation[];
  importLinks: ImportLink[];
}
export interface ImportRow {
  transaction: TransactionInput;
  bankId: string;
}
export interface ImportChoice extends ImportRow {
  action: 'new' | 'match' | 'skip';
  matchId?: string;
}
export interface ImportPreview extends ImportChoice {
  reviewId: string;
  fingerprint: string;
  reason: string;
  isDuplicate: boolean;
  candidates: { id: string; name: string; date: string }[];
}
export interface ImportResult {
  imported: number;
  matched: number;
  skipped: number;
}
export interface ReminderPreferences {
  timeZone: string;
  deliveryTime: string;
  mode: 'individual' | 'digest';
  overdueDays: number;
}
export interface ReminderSnooze {
  recurringId: string;
  date: string;
  until: number;
}
export interface ReminderAttempt {
  id: string;
  title: string;
  date: string;
  status: 'sent' | 'failed' | 'expired';
  attemptedAt: number;
  retryAfter: number;
  count: number;
}
export interface ReminderState {
  deliveryLedger?: ReminderAttempt[];
  preferences: ReminderPreferences;
  snoozes: ReminderSnooze[];
  attempts: ReminderAttempt[];
}
