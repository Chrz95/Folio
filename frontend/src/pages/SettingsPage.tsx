import { CategoriesSettings } from '../features/settings/CategoriesSettings';
import { useState } from 'react';
import { AccountsSettings } from '../features/settings/AccountsSettings';
import { DataSettings } from '../features/settings/DataSettings';
import { ReminderSettings } from '../features/reminders/ReminderSettings';
import { InstallPrompt } from '../pwa/components/InstallPrompt';
import { APP } from '../constants/app.constants';
/** Collect workspace, reminder, appearance and data controls.
 * @returns {JSX.Element} Settings route. */
export default function SettingsPage() {
  const [theme, setTheme] = useState(localStorage.getItem(APP.preferencesKey) ?? 'system');
  return (
    <div className="page-content settings-page">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">MAKE YOURSELF AT HOME</span>
          <h1>
            Your budget. Your way<span>.</span>
          </h1>
          <p>A few thoughtful settings for your everyday.</p>
        </div>
      </div>
      <div className="settings-grid">
        <AccountsSettings />
        <CategoriesSettings />
        <ReminderSettings />
        <section className="panel settings-panel">
          <h2>A comfortable view</h2>
          <p>Choose the appearance that feels right for you.</p>
          <label>
            Appearance
            <select
              value={theme}
              onChange={(event) => {
                const next = event.target.value;
                setTheme(next);
                document.documentElement.dataset.theme = next;
                localStorage.setItem(APP.preferencesKey, next);
              }}
            >
              <option value="system">Use device setting</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <InstallPrompt />
        </section>
        <DataSettings />
      </div>
    </div>
  );
}
