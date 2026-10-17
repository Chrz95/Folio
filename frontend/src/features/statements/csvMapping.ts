import { CATEGORY, VALUE } from '../../constants/app.constants';
import { STATEMENTS } from './statements.constants';
import type { CsvFile, CsvMapping, CsvOptions } from './csv.types';
import type { ImportRow } from '../../types/operations';
const COLUMN_NAMES = {
  date: ['date', 'bookingdate', 'transactiondate'],
  name: ['description', 'name', 'payee', 'merchant'],
  amount: ['amount', 'amounteur', 'value'],
  bankId: ['bankid', 'transactionid', 'reference', 'id'],
  category: ['category'],
  type: ['type', 'transactiontype'],
  currency: ['currency'],
  notes: ['notes', 'memo'],
};
/** Suggest mappings while retaining explicit user review for every column.
 * @param {string[]} headers - CSV headers. @returns {CsvMapping} Column indices; -1 means unmapped. */
export function suggestMapping(headers: string[]): CsvMapping {
  return Object.fromEntries(
    Object.entries(COLUMN_NAMES).map(([field, aliases]) => [
      field,
      headers.findIndex((header) => aliases.includes(header.toLowerCase().replace(/[^a-z]/g, ''))),
    ]),
  ) as unknown as CsvMapping;
}
/** Validate real calendar dates without locale guessing or UTC day shifts.
 * @param {string} text - Bank date. @param {CsvOptions['dateFormat']} format - Explicit interpretation.
 * @returns {string} ISO date. */
function parseBankDate(text: string, format: CsvOptions['dateFormat']) {
  const rawDate = text.trim().split(/[T ]/)[0] ?? '';
  const validPattern = format === 'iso' ? /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/ : /^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$/;
  if (!validPattern.test(rawDate)) {
    throw new Error('Choose the matching date format with a four-digit year.');
  }
  const parts = text.trim().split(/[T ]/)[0]?.split(/[-/.]/).map(Number) ?? [];
  if (parts.length !== STATEMENTS.dateParts) {
    throw new Error('Choose the matching date format.');
  }
  const [first = 0, second = 0, third = 0] = parts;
  const year = format === 'iso' ? first : third;
  const month = format === 'mdy' ? first : second;
  const day = format === 'iso' ? third : format === 'mdy' ? second : first;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    year < MINIMUM_YEAR ||
    year > MAXIMUM_YEAR
  ) {
    throw new Error('The date is invalid for the selected format.');
  }
  return date.toISOString().slice(0, VALUE.isoDateLength);
}
const MINIMUM_YEAR = 1900;
const MAXIMUM_YEAR = 9999;
/** Parse signed decimal money strictly, supporting common thousands separators and parentheses.
 * @param {string} text - Amount cell. @param {string} separator - Decimal character.
 * @returns {number} Nonzero signed integer cents. */
function parseBankMoney(text: string, separator: string) {
  let value = text.trim().replaceAll('€', '').replace(/\s/g, '');
  if (value.startsWith('(') && value.endsWith(')')) {
    value = `-${value.slice(1, -1)}`;
  }
  const thousands = separator === '.' ? ',' : '.';
  const unsigned = value.replace(/^[+-]/, '');
  const [integerPart = '', fraction = '', ...extraParts] = unsigned.split(separator);
  const groups = integerPart.split(thousands);
  if (
    extraParts.length ||
    fraction.includes(thousands) ||
    (groups.length > 1 &&
      (!groups[0] ||
        groups[0].length > THOUSANDS_GROUP_LENGTH ||
        groups.some((group, index) => !/^\d+$/.test(group) || (index > 0 && group.length !== THOUSANDS_GROUP_LENGTH))))
  ) {
    throw new Error('The amount has invalid thousands or decimal separators.');
  }
  value = value.replaceAll(thousands, '');
  if (separator === ',') {
    value = value.replace(',', '.');
  }
  if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new Error('Use a valid amount and the correct decimal separator.');
  }
  const cents = Math.round(Number(value) * VALUE.cents);
  if (!Number.isSafeInteger(cents) || cents === 0 || Math.abs(cents) > VALUE.maximumMoney) {
    throw new Error('Enter a nonzero amount within the supported range.');
  }
  return cents;
}
/** Convert all rows or show errors; invalid rows never disappear silently.
 * @param {CsvFile} file - Parsed bank export. @param {CsvOptions} options - User-reviewed mappings.
 * @param {string} accountId - Explicit target account.
 * @param {string[]} categories - Active catalog. @returns {object} Rows and validation errors. */
export function mapStatement(
  file: CsvFile,
  options: CsvOptions,
  accountId: string,
  categories: string[] = CATEGORY.map((entry) => entry.name),
) {
  const rows: ImportRow[] = [];
  const errors: string[] = [];
  const { mapping } = options;
  if ([mapping.date, mapping.name, mapping.amount].some((index) => index < 0)) {
    return { rows, errors: ['Map the date, description and amount columns.'] };
  }
  file.rows.forEach((record, index) => {
    try {
      /** Read a mapped cell. @param {keyof CsvMapping} field - Mapping name. @returns {string} Trimmed value. */
      const cell = (field: keyof CsvMapping) => (record[mapping[field]] ?? '').trim();
      const name = cell('name');
      const bankId = cell('bankId');
      const notes = cell('notes');
      if (
        !name ||
        name.length > STATEMENTS.maximumName ||
        bankId.length > STATEMENTS.maximumBankId ||
        notes.length > STATEMENTS.maximumNotes
      ) {
        throw new Error('Check description, bank ID and note lengths.');
      }
      if (cell('currency') && !['EUR', '€', 'EURO'].includes(cell('currency').toUpperCase())) {
        throw new Error('Only EUR statement rows can be imported.');
      }
      const signedAmount = parseBankMoney(cell('amount'), options.decimalSeparator);
      const explicitType = cell('type').toLowerCase();
      if (explicitType && !['expense', 'income'].includes(explicitType)) {
        throw new Error('Type must be expense or income. Match transfer movements from a bank statement.');
      }
      const isExpense = options.expenseSign === 'negative' ? signedAmount < 0 : signedAmount > 0;
      const type =
        explicitType === 'expense' || explicitType === 'income' ? explicitType : isExpense ? 'expense' : 'income';
      rows.push({
        bankId,
        transaction: {
          name,
          amount: Math.abs(signedAmount),
          type,
          accountId,
          destinationAccountId: null,
          date: parseBankDate(cell('date'), options.dateFormat),
          notes,
          category: categories.includes(cell('category')) ? cell('category') : 'Other',
        },
      });
    } catch (error) {
      errors.push(`Row ${index + CSV_HEADER_OFFSET}: ${error instanceof Error ? error.message : 'Invalid row.'}`);
    }
  });
  return { rows, errors };
}
const CSV_HEADER_OFFSET = 2;

const THOUSANDS_GROUP_LENGTH = 3;
