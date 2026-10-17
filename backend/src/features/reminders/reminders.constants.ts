/** Calendar delivery uses the selected IANA zone; retry and scan costs stay bounded. */
export const REMINDERS = {
  maximumOverdue: 30,
  singletonId: 1,
  historyLimit: 20,
  dayMilliseconds: 86400000,
  minuteMilliseconds: 60000,
  maximumOccurrences: 5000,
  snoozeMinutes: [60, 1440],
  retryMilliseconds: 900000,
  maximumAttempts: 3,
  pushTtl: 3600,
  pushTimeout: 10000,
  dateLength: 10,
  digits: 2,
  notFound: 404,
  gone: 410,
  mode: ['individual', 'digest'],
} as const;
export const DEFAULT_REMINDER_PREFERENCES = {
  timeZone: 'Europe/Athens',
  deliveryTime: '09:00',
  mode: 'individual' as const,
  overdueDays: 3,
};
