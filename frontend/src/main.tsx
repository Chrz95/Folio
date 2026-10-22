import './styles/workspace-devices.css';
import './styles/actual.css';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import { APP } from './constants/app.constants';
import './styles/globals.css';
import './styles/responsive.css';
import './styles/release2.css';
import './styles/planning.css';
import './styles/reports.css';
import './styles/bulk.css';
import './styles/recurring-calendar.css';
import './styles/mobile.css';
const root = document.getElementById('root');
if (!root) {
  throw new Error('Application root is missing.');
}
document.documentElement.dataset.theme = localStorage.getItem(APP.preferencesKey) ?? 'system';
createRoot(root).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
