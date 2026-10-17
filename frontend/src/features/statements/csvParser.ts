import { STATEMENTS } from './statements.constants';
import type { CsvFile } from './csv.types';
const DELIMITERS = [',', ';', '\t'];
const MAXIMUM_COLUMNS = 100;
/** Detect a bank export's delimiter without counting separators inside a quoted header.
 * @param {string} text - UTF-8 CSV text. @returns {string} Comma, semicolon or tab. */
function detectDelimiter(text: string) {
  const counts = new Map(DELIMITERS.map((value) => [value, 0]));
  let quoted = false;
  for (const character of text) {
    if (character === '"') {
      quoted = !quoted;
    }
    if (!quoted && (character === '\n' || character === '\r')) {
      break;
    }
    if (!quoted && counts.has(character)) {
      counts.set(character, (counts.get(character) ?? 0) + 1);
    }
  }
  return [...counts].sort((first, second) => second[1] - first[1])[0]?.[0] ?? ',';
}
/** Parse bounded RFC-style quoted CSV, including BOM, escaped quotes, CRLF and multiline fields.
 * @param {string} rawText - Bank CSV contents. @returns {CsvFile} Headers and data records.
 * @throws {Error} If malformed, oversized, or wider/longer than configured limits. */
export function parseCsv(rawText: string): CsvFile {
  if (new TextEncoder().encode(rawText).length > STATEMENTS.maximumBytes) {
    throw new Error('Choose a CSV under 1 MiB.');
  }
  const text = rawText.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(text);
  const records: string[][] = [];
  let fields: string[] = [];
  let field = '';
  let quoted = false;
  let closed = false;
  /** Finish one nonblank record and enforce memory bounds. */
  function finishRecord() {
    fields.push(field);
    if (fields.length > MAXIMUM_COLUMNS) {
      throw new Error('The CSV has too many columns.');
    }
    field = '';
    closed = false;
    if (fields.some((value) => value.trim())) {
      records.push(fields);
    }
    fields = [];
    if (records.length > STATEMENTS.maximumRows + 1) {
      throw new Error('Import at most 500 transactions per file.');
    }
  }
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? '';
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        closed = true;
      } else {
        field += character;
      }
      continue;
    }
    if (character === delimiter) {
      fields.push(field);
      field = '';
      closed = false;
      if (fields.length > MAXIMUM_COLUMNS) {
        throw new Error('The CSV has too many columns.');
      }
    } else if (character === '\n' || character === '\r') {
      finishRecord();
      if (character === '\r' && text[index + 1] === '\n') {
        index += 1;
      }
    } else if (character === '"' && !field && !closed) {
      quoted = true;
    } else if (closed && character.trim()) {
      throw new Error('Unexpected characters after a quoted CSV field.');
    } else if (character === '"') {
      throw new Error('A CSV field contains an unescaped quote.');
    } else if (!closed) {
      field += character;
    }
  }
  if (quoted) {
    throw new Error('The CSV contains an unfinished quoted field.');
  }
  finishRecord();
  const [headers, ...rows] = records;
  if (!headers || headers.length < STATEMENTS.minimumColumns || !rows.length) {
    throw new Error('Include a header row and at least one transaction.');
  }
  if (rows.some((row) => row.length !== headers.length)) {
    throw new Error('Each row must have the same columns as the header.');
  }
  return { headers, rows };
}
