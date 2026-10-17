import { APP } from '../../constants/app.constants';
/** Public build-time settings; no backend settings are sent to the browser. */
export const environment = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || APP.api,
  isDemo: import.meta.env.VITE_DEMO_MODE === 'true',
};
