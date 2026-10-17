/** Mapping uses header positions, so duplicate bank column names remain selectable. */
export interface CsvMapping {
  date: number;
  name: number;
  amount: number;
  bankId: number;
  category: number;
  type: number;
  currency: number;
  notes: number;
}
export interface CsvOptions {
  mapping: CsvMapping;
  dateFormat: 'iso' | 'dmy' | 'mdy';
  decimalSeparator: '.' | ',';
  expenseSign: 'negative' | 'positive';
}
export interface CsvFile {
  headers: string[];
  rows: string[][];
}
