import type { RecurringSort, SortDirection } from './recurringRows';
interface MobileSortProps {
  sort: RecurringSort;
  direction: SortDirection;
  onChange: (sort: RecurringSort, direction: SortDirection) => void;
}
/** Keep every table sort available when the desktop header collapses on small screens.
 * @param {MobileSortProps} props - Current sort. @param {RecurringSort} props.sort - Selected column.
 * @param {SortDirection} props.direction - Order. @param {Function} props.onChange - Update order.
 * @returns {JSX.Element} Phone-friendly sort selector. */
export function RecurringMobileSort({ sort, direction, onChange }: MobileSortProps) {
  return (
    <label className="mobile-recurring-sort">
      Sort recurring transactions
      <select
        value={`${sort}:${direction}`}
        onChange={(event) => {
          const [next, order] = event.target.value.split(':') as [RecurringSort, SortDirection];
          onChange(next, order);
        }}
      >
        <option value="proximity:ascending">Closest unconfirmed first</option>
        <option value="proximity:descending">Furthest unconfirmed first</option>
        <option value="name:ascending">Name: A to Z</option>
        <option value="name:descending">Name: Z to A</option>
        <option value="amount:ascending">Amount: low to high</option>
        <option value="amount:descending">Amount: high to low</option>
      </select>
    </label>
  );
}
