const DAYS_PER_WEEK = 7;
const MONTHS_PER_YEAR = 12;
const ISO_DATE_LENGTH = 10;
/** Return a clamped occurrence; Jan 31 becomes Feb's final day, then Mar 31.
 * @param {string} startDate - ISO date anchoring the series.
 * @param {string} frequency - weekly, monthly or yearly.
 * @param {number} index - Zero-based occurrence.
 * @returns {string} Local calendar date, without timezone drift. */
export function occurrenceDate(startDate: string, frequency: string, index: number) {
  if (frequency === 'once') {
    return startDate;
  }
  const start = new Date(`${startDate}T12:00:00Z`);
  const day = start.getUTCDate();
  if (frequency === 'weekly') {
    start.setUTCDate(day + index * DAYS_PER_WEEK);
  } else {
    const months = frequency === 'yearly' ? index * MONTHS_PER_YEAR : index;
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() + months);
    const last = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
    start.setUTCDate(Math.min(day, last));
  }
  return start.toISOString().slice(0, ISO_DATE_LENGTH);
}
/** Check an occurrence against the original schedule.
 * @param {string} start - Original date.
 * @param {string} frequency - Recurrence rule.
 * @param {string} candidate - Requested posting date.
 * @returns {number | null} Zero-based position, or null outside the series. */
export function occurrenceIndex(start: string, frequency: string, candidate: string) {
  if (frequency === 'once') {
    return candidate === start ? 0 : null;
  }
  if (candidate < start) {
    return null;
  }
  const origin = new Date(`${start}T12:00:00Z`);
  const target = new Date(`${candidate}T12:00:00Z`);
  let index = target.getUTCFullYear() - origin.getUTCFullYear();
  if (frequency === 'monthly') {
    index = index * MONTHS_PER_YEAR + target.getUTCMonth() - origin.getUTCMonth();
  }
  if (frequency === 'weekly') {
    const millisecondsPerWeek = 604800000;
    index = (target.getTime() - origin.getTime()) / millisecondsPerWeek;
  }
  return Number.isInteger(index) && occurrenceDate(start, frequency, index) === candidate ? index : null;
}

/** Check exact membership without losing month-end anchors.
 * @param {string} start - Original date. @param {string} frequency - Recurrence.
 * @param {string} candidate - Candidate date. @returns {boolean} Exact occurrence membership. */
export function isOccurrence(start: string, frequency: string, candidate: string) {
  return occurrenceIndex(start, frequency, candidate) !== null;
}
