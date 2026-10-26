import { RECURRING_COLUMNS } from './recurringSort.constants';
import { RecurringMobileSort } from './RecurringMobileSort';
import { useState } from 'react';
import type { RecurringRow, RecurringSort, SortDirection } from './recurringRows';
import { sortRecurringRows } from './recurringRows';
import { RecurringTableRow } from './RecurringTableRow';
/** Offer accessible sortable columns with proximity as the default ordering.
 * @param {object} props - Display data. @param {RecurringRow[]} props.rows - Computed schedule rows.
 * @param {string} props.today - Current local date. @returns {JSX.Element} Default recurring table. */
export function RecurringTable({ rows, today }: { rows: RecurringRow[]; today: string }) {
  const [sort, setSort] = useState<RecurringSort>('proximity');
  const [direction, setDirection] = useState<SortDirection>('ascending');
  /** Toggle a selected column or start a new ascending sort. @param {RecurringSort} next - Column.
   * @returns {void} Presentation-only state change. */
  function changeSort(next: RecurringSort): void {
    setDirection(next === sort && direction === 'ascending' ? 'descending' : 'ascending');
    setSort(next);
  }
  return (
    <div className="panel recurring-table-scroll">
      <RecurringMobileSort
        sort={sort}
        direction={direction}
        onChange={(next, order) => {
          setSort(next);
          setDirection(order);
        }}
      />
      <table
        className="recurring-table"
        aria-label="Recurring transactions"
      >
        <caption>
          Remaining counts include overdue dates and exclude confirmed or skipped dates. ∞ means no end date or
          repetition limit.
        </caption>
        <thead>
          <tr>
            {RECURRING_COLUMNS.map((column) => (
              <th
                key={column.key}
                scope="col"
                aria-sort={sort === column.key ? direction : 'none'}
              >
                <button onClick={() => changeSort(column.key)}>
                  {column.label} {sort === column.key ? (direction === 'ascending' ? '↑' : '↓') : ''}
                </button>
              </th>
            ))}
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortRecurringRows(rows, today, sort, direction).map((row) => (
            <RecurringTableRow
              key={row.template.id}
              row={row}
              today={today}
            />
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="empty-state">No recurring transactions yet.</p>}
    </div>
  );
}
