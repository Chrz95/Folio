export interface ScheduleSettings {
  recurringId: string;
  isPaused: boolean;
  endDate: string | null;
  autoConfirm?: boolean;
  autoConfirmFrom?: string | null;
}
export interface SkippedOccurrence {
  recurringId: string;
  date: string;
}
export interface ScheduleData {
  scheduleSettings: ScheduleSettings[];
  skippedOccurrences: SkippedOccurrence[];
}
/** Apply controls to unpaid dates without changing recurrence anchors or recorded postings.
 * @param {string} recurringId - Schedule UUID. @param {string} date - Due date.
 * @param {Partial<ScheduleData>} data - Optional saved controls.
 * @returns {boolean} Whether a planned date is enabled. */
export function isScheduleDateEnabled(recurringId: string, date: string, data: Partial<ScheduleData>): boolean {
  const settings = data.scheduleSettings?.find((entry) => entry.recurringId === recurringId);
  return (
    !settings?.isPaused &&
    (!settings?.endDate || date <= settings.endDate) &&
    !data.skippedOccurrences?.some((entry) => entry.recurringId === recurringId && entry.date === date)
  );
}
