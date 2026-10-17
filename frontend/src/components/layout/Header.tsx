import { useState } from 'react';
import { Bell, Plus, PanelLeftClose, ShieldCheck, Settings2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useWorkspace } from '../../app/WorkspaceContext';
import { NAVIGATION } from '../../constants/app.constants';
import { ReminderPanel } from '../../features/reminders/ReminderPanel';
import { environment } from '../../app/config/environment';
/** Show page context and persistent quick actions.
 * @returns {JSX.Element} Header and notification popover. */
export function Header() {
  const { setEditor } = useWorkspace();
  const { pathname } = useLocation();
  const [isReminderOpen, setReminderOpen] = useState(false);
  const title =
    NAVIGATION.find((item) => pathname.endsWith(item.id))?.label ??
    {
      '/settings': 'Settings',
      '/forecast': 'Forecast',
      '/import': 'Import statement',
      '/reconcile': 'Reconcile account',
      '/reminders': 'Reminders',
    }[pathname] ??
    'Overview';
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <PanelLeftClose size={18} />
        <span className="breadcrumb-divider" />
        My workspace<span className="slash">/</span>
        <strong>{title}</strong>
      </div>
      <div className="topbar-actions">
        <Link
          className="icon-button mobile-settings"
          to="/settings"
          aria-label="Workspace settings"
        >
          <Settings2 size={18} />
        </Link>
        <span className="privacy-badge">
          <ShieldCheck size={14} />
          {environment.isDemo ? 'Device-only preview' : 'Private workspace'}
        </span>
        <button
          className="notification-button icon-button"
          aria-label="Upcoming reminders"
          aria-expanded={isReminderOpen}
          onClick={() => setReminderOpen(!isReminderOpen)}
        >
          <Bell size={20} />
          <i />
        </button>
        <button
          className="button primary"
          onClick={() => setEditor({ isRecurring: false })}
        >
          <Plus size={17} />
          <span>Add transaction</span>
        </button>
      </div>
      {isReminderOpen && <ReminderPanel onClose={() => setReminderOpen(false)} />}
    </header>
  );
}
