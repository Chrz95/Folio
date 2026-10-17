/** Stable transport and infrastructure limits. */
export const HTTP = {
  ok: 200,
  created: 201,
  noContent: 204,
  badRequest: 400,
  notFound: 404,
  conflict: 409,
  tooLarge: 413,
  tooManyRequests: 429,
  internal: 500,
  unavailable: 503,
} as const;
export const API = {
  health: '/health',
  ready: '/ready',
  transactions: '/transactions',
  recurring: '/recurring',
  accounts: '/accounts',
  budgets: '/budgets',
  notifications: '/notifications',
} as const;
export const LIMIT = {
  body: '2mb',
  rows: 5000,
  busy: 5000,
  maxBusy: 30000,
  port: 3001,
  minPort: 1024,
  maxPort: 65535,
  shutdown: 10000,
  reminderInterval: 60000,
  directoryMode: 0o700,
  fileMode: 0o600,
} as const;
export const PRAGMA = {
  foreignKeys: 'foreign_keys = ON',
  journal: 'journal_mode = WAL',
  synchronous: 'synchronous = FULL',
  foreignKeyCheck: 'foreign_keys',
  journalCheck: 'journal_mode',
  synchronousCheck: 'synchronous',
} as const;
export const REMINDER = { horizonDays: 7, millisecondsPerDay: 86400000, deliveryHour: 9 } as const;
