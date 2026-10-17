import { ACTUAL } from './actual.constants.js';
/** Check only imported simple date rules; month-end/leap-day rules are excluded during conversion.
 * @param {string} start - Anchor. @param {string} frequency - Supported frequency.
 * @param {string} candidate - Historical payment. @returns {boolean} Exact occurrence membership. */
export function isActualOccurrence(start: string, frequency: string, candidate: string) {
  if (candidate < start) {
    return false;
  }
  if (frequency === 'once') {
    return candidate === start;
  }
  if (frequency === 'weekly') {
    const difference = Date.parse(`${candidate}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`);
    return difference % ACTUAL.weekMilliseconds === 0;
  }
  return frequency === 'monthly'
    ? candidate.slice(ACTUAL.monthDigits + 1) === start.slice(ACTUAL.monthDigits + 1)
    : candidate.slice(ACTUAL.yearDigits + 1) === start.slice(ACTUAL.yearDigits + 1);
}
