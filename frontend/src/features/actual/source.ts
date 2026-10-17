import { z } from 'zod';
import { v5 } from 'uuid';
import { ACTUAL, SOURCE_TABLES } from './actual.constants';
export type SourceRow = Record<string, string | number | Uint8Array | null>;
export type ActualSource = Record<(typeof SOURCE_TABLES)[number], SourceRow[]>;
/** Read an unambiguous source identifier or string. @param {unknown} value - Raw field.
 * @returns {string} Original text. */
export function text(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('An Actual text field is missing or invalid.');
  }
  return value;
}
/** Bound supported labels without silently truncating financial history.
 * @param {unknown} value - Label. @param {number} maximum - Field limit. @returns {string} Valid label. */
export function label(value: unknown, maximum: number): string {
  const result = text(value).trim();
  if (!result || result.length > maximum) {
    throw new Error(`An Actual label exceeds the ${maximum} character limit.`);
  }
  return result;
}
/** Accept only exact integer minor units. @param {unknown} value - Raw amount. @returns {number} Cents. */
export function cents(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || Math.abs(value) > ACTUAL.money) {
    throw new Error('An Actual amount is invalid or exceeds the supported range.');
  }
  return value;
}
/** Convert integer YYYYMMDD to a validated civil date. @param {unknown} value - Raw date.
 * @returns {string} ISO civil date. */
export function date(value: unknown): string {
  const raw = String(value);
  const iso =
    raw.length === ACTUAL.dateDigits
      ? `${raw.slice(0, ACTUAL.yearDigits)}-${raw.slice(ACTUAL.yearDigits, ACTUAL.monthDigits)}-` +
        raw.slice(ACTUAL.monthDigits)
      : raw;
  return z.iso.date().parse(iso);
}
/** Namespace every imported key by the original budget identity, including legacy split IDs.
 * @param {string} budget - Source identity. @param {string} kind - Record type.
 * @param {unknown} id - Original key. @returns {string} Stable UUID. */
export function identity(budget: string, kind: string, id: unknown): string {
  return v5(JSON.stringify([budget, kind, text(id)]), ACTUAL.namespace);
}
/** Follow Actual's merged category/payee identities with a cycle guard.
 * @param {SourceRow[]} rows - Mapping records. @param {string} field - Target column.
 * @returns {(id: unknown) => string} Resolver. */
export function resolver(rows: SourceRow[], field: string) {
  const targets = new Map(rows.map((row) => [text(row.id), text(row[field])]));
  return (id: unknown): string => {
    let current = text(id);
    const visited = new Set<string>();
    while (targets.has(current) && targets.get(current) !== current) {
      if (visited.has(current)) {
        throw new Error('An Actual merge mapping contains a cycle.');
      }
      visited.add(current);
      current = targets.get(current)!;
    }
    return current;
  };
}
