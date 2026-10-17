import { z } from 'zod';
const ISSUE_LIMIT = 3;
/** Retain the failing rule field instead of replacing every parser error with a generic exclusion.
 * @param {T} schema - Supported shape. @param {unknown} value - Native value.
 * @param {string} context - Rule section. @returns {z.infer<T>} Validated value. */
export function parseScheduleValue<T extends z.ZodType>(schema: T, value: unknown, context: string): z.infer<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, ISSUE_LIMIT).map((issue) => {
      const field = issue.path.length ? `.${issue.path.join('.')}` : '';
      return `${context}${field}: ${issue.message}`;
    });
    throw new Error(issues.join('; '));
  }
  return parsed.data;
}
