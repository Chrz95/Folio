import pino from 'pino';
/** Build a structured logger without request bodies, query strings, or credentials.
 * @param {string} level - Minimum severity.
 * @returns {import('pino').Logger} Redacted logger. */
export function createLogger(level: string = 'info') {
  return pino({
    level,
    redact: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers.set-cookie',
      'password',
      'token',
      'endpoint',
      'keys',
      'privateKey',
    ],
  });
}
export const logger = createLogger();
