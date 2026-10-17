import { environment } from '../../app/config/environment';
import { VALUE } from '../../constants/app.constants';
/** A normalized network error safe for user-facing feedback. */
export class ApiError extends Error {
  /** Create an actionable API failure.
   * @param {string} message - Safe explanation.
   * @param {string} code - Stable reason. */
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}
/** Central HTTP boundary: cancellation, no caching, consistent errors, no payload logging.
 * @param {string} path - Contract endpoint.
 * @param {RequestInit} options - Request configuration.
 * @returns {Promise<T>} Parsed response data. */
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${environment.apiBaseUrl}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      cache: 'no-store',
      signal: options.signal ?? AbortSignal.timeout(VALUE.requestTimeout),
    });
  } catch {
    throw new ApiError(
      navigator.onLine
        ? 'Unable to reach the budget server. Please try again.'
        : 'You are offline. Reconnect to access your budget.',
      'OFFLINE',
    );
  }
  const noContentStatus = 204;
  if (response.status === noContentStatus) {
    return undefined as T;
  }
  const payload = (await response.json()) as { data?: T; error?: { message: string; code: string } };
  if (!response.ok) {
    throw new ApiError(
      payload.error?.message ?? 'This change could not be saved.',
      payload.error?.code ?? 'REQUEST_FAILED',
    );
  }
  if (!('data' in payload)) {
    throw new ApiError('The server returned an unexpected response.', 'INVALID_RESPONSE');
  }
  return payload.data as T;
}
