import { APP, VALUE, CATEGORY } from '../constants/app.constants';
const DATE_DIGITS = 2;
/** Format integer cents using the workspace's euro currency.
 * @param {number} cents - Integer money amount.
 * @returns {string} Localized euro amount. */
export function money(cents: number) {
  return new Intl.NumberFormat(APP.locale, { style: 'currency', currency: APP.currency }).format(cents / VALUE.cents);
}
/** Format a date without UTC shifting a calendar day.
 * @param {string} value - ISO calendar date.
 * @param {Intl.DateTimeFormatOptions} options - Display fields.
 * @returns {string} Human-readable date. */
export function formatDate(value: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(APP.locale, options);
}
/** Convert local calendar date to ISO representation.
 * @param {Date} date - Local date.
 * @returns {string} YYYY-MM-DD. */
export function dateKey(date: Date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(DATE_DIGITS, '0'),
    String(date.getDate()).padStart(DATE_DIGITS, '0'),
  ].join('-');
}
/** Find category presentation metadata.
 * @param {string} name - Catalog label.
 * @returns {object} Stable icon and color. */
export function categoryInfo(name: string) {
  return CATEGORY.find((category) => category.name === name) ?? CATEGORY.find((category) => category.name === 'Other')!;
}
/** Shift a month anchored to its first day.
 * @param {string} month - ISO calendar date.
 * @param {number} offset - Signed month count.
 * @returns {string} ISO first day of selected month. */
export function shiftMonth(month: string, offset: number) {
  const value = new Date(`${month}T12:00:00`);
  value.setDate(1);
  value.setMonth(value.getMonth() + offset);
  return dateKey(value);
}
