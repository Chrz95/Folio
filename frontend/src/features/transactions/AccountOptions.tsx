import { Fragment } from 'react';
import type { Account } from '../../types/budget';
interface AccountOptionsProps {
  accounts: Account[];
}
/** Share account select options while keeping control labels distinct.
 * @param {AccountOptionsProps} props - Available accounts.
 * @param {Account[]} props.accounts - Workspace accounts.
 * @returns {JSX.Element} Native options with stable IDs. */
export function AccountOptions({ accounts }: AccountOptionsProps) {
  return (
    <Fragment>
      {accounts.map((account) => (
        <option
          key={account.id}
          value={account.id}
        >
          {account.name}
        </option>
      ))}
    </Fragment>
  );
}
