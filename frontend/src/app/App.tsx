import { WorkspaceRoutes } from './WorkspaceRoutes';
import { useState, useMemo, Suspense } from 'react';
import { BrowserRouter, Link } from 'react-router-dom';
import { Check, X, CircleAlert } from 'lucide-react';
import { WorkspaceContext } from './WorkspaceContext';
import { useBudgetWorkspace } from './useBudgetWorkspace';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { TransactionEditor } from '../features/transactions/TransactionEditor';
import type { EditorState } from '../types/budget';
import { dateKey } from '../utils/format';
import { PwaNotices } from '../pwa/components/PwaNotices';
import { useLocalReminders } from '../features/reminders/useLocalReminders';
import { VALUE } from '../constants/app.constants';
import { environment } from './config/environment';
/** Compose a responsive workspace with lazy routes and isolated editor state.
 * @returns {JSX.Element} Budget application. */
export default function App() {
  const workspace = useBudgetWorkspace();
  const [month, setMonth] = useState(`${dateKey().slice(0, VALUE.monthPrefixLength)}-01`);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const context = useMemo(() => ({ ...workspace, month, setMonth, editor, setEditor }), [workspace, month, editor]);
  useLocalReminders(workspace.data);
  return (
    <BrowserRouter>
      <WorkspaceContext.Provider value={context}>
        <a
          className="skip-link"
          href="#main-content"
        >
          Skip to content
        </a>
        <div className="app-layout">
          <Sidebar />
          <div className="main-shell">
            <Header />
            {environment.isDemo && (
              <div className="demo-banner">
                <span className="small-dot green" />
                <span>You're exploring a sample budget. Changes are saved on this device.</span>
                <Link to="/settings">
                  Make it yours <span aria-hidden="true">↗</span>
                </Link>
              </div>
            )}
            <PwaNotices />
            <main id="main-content">
              {workspace.isLoading ? (
                <output className="loading-state">Getting your budget ready…</output>
              ) : (
                <Suspense fallback={<output className="loading-state">A moment of clarity…</output>}>
                  <WorkspaceRoutes />
                </Suspense>
              )}
            </main>
            {workspace.error && (
              <div
                className="feedback-toast error-toast"
                role="alert"
              >
                <CircleAlert size={18} />
                <span>{workspace.error}</span>
                <button
                  className="icon-button"
                  aria-label="Dismiss error"
                  onClick={() => workspace.setError('')}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {workspace.notice && (
              <output className="feedback-toast">
                <Check size={18} />
                <span>{workspace.notice}</span>
                <button
                  className="icon-button"
                  aria-label="Dismiss confirmation"
                  onClick={() => workspace.setNotice('')}
                >
                  <X size={16} />
                </button>
              </output>
            )}
          </div>
        </div>
        {editor && (
          <TransactionEditor
            key={`${editor.transaction?.id ?? 'new'}:${editor.isRecurring}:${editor.isDuplicate ?? false}`}
            editor={editor}
          />
        )}
      </WorkspaceContext.Provider>
    </BrowserRouter>
  );
}
