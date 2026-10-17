/** A safe transport error; internal causes stay in structured server logs. */
export class AppError extends Error {
  /** Initialize a stable API failure.
   * @param {number} status - HTTP status.
   * @param {string} code - Machine-readable identifier.
   * @param {string} message - Safe explanation. */
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
