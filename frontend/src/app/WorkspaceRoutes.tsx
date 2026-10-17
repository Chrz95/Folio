import { lazy } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
const Forecast = lazy(() => import('../pages/ForecastPage'));
const ActualImport = lazy(() => import('../pages/ActualImportPage'));
const Import = lazy(() => import('../pages/ImportPage'));
const Reconcile = lazy(() => import('../pages/ReconcilePage'));
const Reminders = lazy(() => import('../pages/RemindersPage'));
const Overview = lazy(() => import('../pages/OverviewPage'));
const Transactions = lazy(() => import('../pages/TransactionsPage'));
const Calendar = lazy(() => import('../pages/CalendarPage'));
const Recurring = lazy(() => import('../pages/RecurringPage'));
const Reports = lazy(() => import('../pages/ReportsPage'));
const Budgets = lazy(() => import('../pages/BudgetsPage'));
const Settings = lazy(() => import('../pages/SettingsPage'));
/** Map application URLs to lazy feature pages.
 * @returns {JSX.Element} Route switch. */
export function WorkspaceRoutes() {
  return (
    <Routes>
      <Route
        path="/import/actual"
        element={<ActualImport />}
      />
      <Route
        path="/forecast"
        element={<Forecast />}
      />
      <Route
        path="/import"
        element={<Import />}
      />
      <Route
        path="/reconcile"
        element={<Reconcile />}
      />
      <Route
        path="/reminders"
        element={<Reminders />}
      />
      <Route
        path="/"
        element={<Overview />}
      />
      <Route
        path="/transactions"
        element={<Transactions />}
      />
      <Route
        path="/calendar"
        element={<Calendar />}
      />
      <Route
        path="/recurring"
        element={<Recurring />}
      />
      <Route
        path="/reports"
        element={<Reports />}
      />
      <Route
        path="/budgets"
        element={<Budgets />}
      />
      <Route
        path="/settings"
        element={<Settings />}
      />
      <Route
        path="*"
        element={
          <div className="page-content empty-state">
            <h1>A little off track</h1>
            <p>This page doesn't exist.</p>
            <Link to="/">Back to your overview</Link>
          </div>
        }
      />
    </Routes>
  );
}
