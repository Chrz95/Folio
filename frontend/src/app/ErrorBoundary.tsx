import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
interface ErrorBoundaryProps {
  children: ReactNode;
}
/** Keep unexpected render failures actionable without exposing private data. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { hasError: boolean }> {
  override state = { hasError: false };
  /** Convert a render failure into a safe fallback.
   * @returns {object} Recovery state. */
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  /** Keep errors out of third-party logging; user can reload safely.
   * @param {Error} _error - Internal render error.
   * @param {ErrorInfo} _info - Component diagnostic context. */
  override componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* No external telemetry for financial data. */
  }
  /** Render children or an explicit recovery screen.
   * @returns {ReactNode} Rendered application or recovery action. */
  override render() {
    if (this.state.hasError) {
      return (
        <main className="empty-state">
          <h1>Let's find our balance again.</h1>
          <p>Folio couldn't display this page. Your saved data is still on this device or your server.</p>
          <button
            className="button primary"
            onClick={() => window.location.reload()}
          >
            Reload Folio
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
