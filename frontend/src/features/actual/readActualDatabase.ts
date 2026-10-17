import type { Database } from 'sql.js';
import { ACTUAL, SOURCE_TABLES } from './actual.constants';
import { convertActual } from './convertActual';
import type { ActualSource, SourceRow } from './source';
const REQUIRED = ['accounts', 'transactions', 'categories', 'payees'];
const FLAGS = [
  'tombstone',
  'isParent',
  'isChild',
  'starting_balance_flag',
  'cleared',
  'reconciled',
  'hidden',
  'is_income',
  'closed',
  'offbudget',
];
/** Read allowlisted physical tables only; exported SQL, views and trigger writes are never executed.
 * @param {Database} database - Transient native snapshot. @param {string} metadata - Export metadata.
 * @returns {import('./actualSchema').ActualFile} Validated conversion. */
export function readActualDatabase(database: Database, metadata: string) {
  database.run('PRAGMA trusted_schema = OFF; PRAGMA query_only = ON;');
  const tables = new Set(
    database.exec("SELECT name FROM sqlite_master WHERE type='table'")[0]?.values.map((row) => String(row[0])) ?? [],
  );
  if (REQUIRED.some((table) => !tables.has(table))) {
    throw new Error('This SQLite file is not an Actual budget.');
  }
  const source: ActualSource = {
    accounts: [],
    transactions: [],
    categories: [],
    payees: [],
    rules: [],
    schedules: [],
    category_mapping: [],
    payee_mapping: [],
    preferences: [],
    zero_budgets: [],
    reflect_budgets: [],
  };
  for (const table of SOURCE_TABLES) {
    if (!tables.has(table)) {
      source[table] = [];
      continue;
    }
    const columns = database.exec(`PRAGMA table_info("${table}")`)[0]?.values.map((row) => String(row[1])) ?? [];
    const condition = columns.includes('tombstone') ? ' WHERE tombstone = 0' : '';
    const statement = database.prepare(`SELECT * FROM "${table}"${condition} LIMIT ${ACTUAL.rows + 1}`);
    const rows: SourceRow[] = [];
    try {
      while (statement.step()) {
        rows.push(statement.getAsObject());
      }
    } finally {
      statement.free();
    }
    if (rows.length > ACTUAL.rows || (table === 'accounts' && rows.length > ACTUAL.accounts)) {
      throw new Error('This budget exceeds the supported row limit.');
    }
    if (
      rows.some((row) => FLAGS.some((flag) => flag in row && row[flag] !== null && row[flag] !== 0 && row[flag] !== 1))
    ) {
      throw new Error('The source contains invalid boolean flags.');
    }
    source[table] = rows;
  }
  return convertActual(source, metadata);
}
