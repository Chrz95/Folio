import { describe, expect, it } from 'vitest';
import { parseCsv } from './csvParser';
import { mapStatement, suggestMapping } from './csvMapping';
import type { CsvOptions } from './csv.types';
/** Configure explicit formats for a bank export. @param {string} text - CSV. @returns {object} Parsed file/options. */
function parse(text: string) {
  const file = parseCsv(text);
  const options: CsvOptions = {
    mapping: suggestMapping(file.headers),
    dateFormat: 'iso',
    decimalSeparator: '.',
    expenseSign: 'negative',
  };
  return { file, options };
}
describe('bank CSV validation', () => {
  it('parses BOM, quoted delimiters, escaped quotes, multiline notes and CRLF', () => {
    const text = '\uFEFFDate,Description,Amount,Notes\r\n2026-10-16,"Cafe, ""Corner""",-12.50,"line 1\nline 2"\r\n';
    const { file, options } = parse(text);
    const result = mapStatement(file, options, 'account');
    expect(result.errors).toEqual([]);
    expect(result.rows[0]?.transaction.name).toBe('Cafe, "Corner"');
    expect(result.rows[0]?.transaction.amount).toBe(1250);
    expect(result.rows[0]?.transaction.notes).toBe('line 1\nline 2');
  });
  it('detects semicolons and supports explicit European decimals and day-first dates', () => {
    const { file, options } = parse('Date;Description;Amount;Currency\n16/10/2026;Groceries;-1.234,56;EUR');
    const result = mapStatement(file, { ...options, dateFormat: 'dmy', decimalSeparator: ',' }, 'account');
    expect(result.errors).toEqual([]);
    expect(result.rows[0]?.transaction.amount).toBe(123456);
    expect(result.rows[0]?.transaction.date).toBe('2026-10-16');
  });
  it('rejects invalid calendar dates, amounts, missing mappings and non-EUR rows', () => {
    const { file, options } = parse(
      'Date,Description,Amount,Currency\n2026-02-30,Shop,-10.00,EUR\n2026-10-16,Shop,-1,USD',
    );
    expect(mapStatement(file, options, 'account').errors).toHaveLength(2);
    expect(
      mapStatement(file, { ...options, mapping: { ...options.mapping, amount: -1 } }, 'account').errors,
    ).toHaveLength(1);
  });
  it('rejects unclosed quotes, inconsistent widths and more than 500 rows', () => {
    expect(() => parseCsv('Date,Name,Amount\n2026-10-16,"unfinished,-2')).toThrow();
    expect(() => parseCsv('Date,Name,Amount\n2026-10-16,Shop')).toThrow();
    expect(() =>
      parseCsv('Date,Name,Amount\n' + Array.from({ length: 501 }, () => '2026-10-16,Shop,-1').join('\n')),
    ).toThrow();
  });
  it('respects explicit type columns for positive expense amounts and handles refunds as signed income', () => {
    const { file, options } = parse(
      'Date,Description,Amount,Type\n2026-10-16,Shop,12.50,expense\n2026-10-16,Refund,3.00,income',
    );
    const result = mapStatement(file, options, 'account');
    expect(result.rows.map((row) => row.transaction.type)).toEqual(['expense', 'income']);
  });
  it('rejects malformed thousands grouping instead of silently changing the amount', () => {
    const { file, options } = parse('Date;Description;Amount\n2026-10-16;Shop;-12,34.56');
    expect(mapStatement(file, options, 'account').errors).toHaveLength(1);
  });
});
