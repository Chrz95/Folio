/** Visible table columns and matching phone sort choices. */
export const RECURRING_COLUMNS = [
  { key: 'name', label: 'Name', ascending: 'Name: A to Z', descending: 'Name: Z to A' },
  { key: 'amount', label: 'Amount', ascending: 'Amount: low to high', descending: 'Amount: high to low' },
  {
    key: 'frequency',
    label: 'Frequency',
    ascending: 'Frequency: shortest first',
    descending: 'Frequency: longest first',
  },
  {
    key: 'proximity',
    label: 'Closest unconfirmed',
    ascending: 'Closest unconfirmed first',
    descending: 'Furthest unconfirmed first',
  },
  {
    key: 'remaining',
    label: 'Remaining unconfirmed',
    ascending: 'Remaining: low to high (∞ last)',
    descending: 'Remaining: high to low (∞ last)',
  },
  {
    key: 'status',
    label: 'Status',
    ascending: 'Status: A to Z (pause takes priority)',
    descending: 'Status: Z to A (pause takes priority)',
  },
] as const;
export type RecurringSort = (typeof RECURRING_COLUMNS)[number]['key'];
/** Natural schedule cadence, rather than alphabetical frequency labels. */
export const FREQUENCY_ORDER = { once: 0, weekly: 1, monthly: 2, yearly: 3 } as const;
export const SORT_DIRECTIONS = ['ascending', 'descending'] as const;
