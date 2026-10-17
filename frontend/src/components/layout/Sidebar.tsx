import { Brand } from './Brand';
import { NavLink } from 'react-router-dom';
import { Plus, Settings2, ArrowUpRight, Sprout, ChevronDown, Landmark, Wallet } from 'lucide-react';
import { NAVIGATION } from '../../constants/app.constants';
import { money } from '../../utils/format';
import { accountBalance } from '../../features/overview/statistics';
import { useWorkspace } from '../../app/WorkspaceContext';
/** Render one responsive navigation tree for desktop and mobile.
 * @returns {JSX.Element} Workspace sidebar. */
export function Sidebar() {
  const { data } = useWorkspace();
  return (
    <aside className="sidebar">
      <Brand />
      <div className="workspace-switch">
        <span className="workspace-avatar">P</span>
        <div>
          Personal workspace<small>Make room for what matters</small>
        </div>
        <ChevronDown size={14} />
      </div>
      <p className="sidebar-label">WORKSPACE</p>
      <nav
        className="main-nav"
        aria-label="Main navigation"
      >
        {NAVIGATION.map(({ id, label, icon: Icon }) => (
          <NavLink
            key={id}
            to={id === 'overview' ? '/' : `/${id}`}
            end={id === 'overview'}
          >
            <Icon size={19} />
            <span>{label}</span>
            {id === 'recurring' && <small>{data.recurring.length}</small>}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-accounts">
        <div className="sidebar-label account-label">
          MY ACCOUNTS
          <NavLink
            to="/settings"
            aria-label="Add an account"
          >
            <Plus size={16} />
          </NavLink>
        </div>
        {data.accounts.map((account, index) => (
          <NavLink
            key={account.id}
            to={`/transactions?account=${account.id}`}
            className="sidebar-account"
          >
            {index === 0 ? <Landmark size={17} /> : <Wallet size={17} />}
            <span>
              {account.name}
              <strong>{money(accountBalance(data, account.id))}</strong>
            </span>
            <span className="account-status" />
          </NavLink>
        ))}
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-tip">
          <Sprout size={24} />
          <strong>
            A little planning.
            <br />A little more possibility.
          </strong>
          <p>Your future self will thank you.</p>
          <NavLink to="/budgets">
            Build your budget <ArrowUpRight size={15} />
          </NavLink>
        </div>
        <NavLink
          to="/settings"
          className="settings-link"
        >
          <Settings2 size={18} />
          Settings
        </NavLink>
        <div className="profile">
          <span className="profile-avatar">YO</span>
          <div>
            Your workspace<small>Personal budget</small>
          </div>
          <ChevronDown size={14} />
        </div>
      </div>
    </aside>
  );
}
