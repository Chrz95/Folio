import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from 'pino';
import { ZodError } from 'zod';
import { AppError } from '../../lib/errors/AppError.js';
import { HTTP } from '../../constants/http.constants.js';
/** Centralize safe error envelopes and keep internal causes in server logs.
 * @param {Logger} logger - Redacted logger.
 * @returns {ErrorRequestHandler} Final error middleware. */
export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, request, response, _next) => {
    const requestId = response.getHeader('X-Request-Id');
    if (error instanceof ZodError) {
      response.status(HTTP.badRequest).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please check your input.',
          details: error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
          requestId,
        },
      });
      return;
    }
    if (error instanceof AppError) {
      response.status(error.status).json({ error: { code: error.code, message: error.message, requestId } });
      return;
    }
    const code = error instanceof Error && 'code' in error ? String(error.code) : '';
    if (code.startsWith('SQLITE_CONSTRAINT') || code === 'SQLITE_BUSY') {
      response.status(HTTP.conflict).json({
        error: {
          code: 'STORAGE_CONFLICT',
          requestId,
          message: 'This change conflicts with existing data, or storage is busy. Please review and retry.',
        },
      });
      return;
    }
    if (
      error instanceof SyntaxError ||
      (error instanceof Error && 'status' in error && error.status === HTTP.badRequest)
    ) {
      response
        .status(HTTP.badRequest)
        .json({ error: { code: 'INVALID_JSON', message: 'Invalid request body.', requestId } });
      return;
    }
    logger.error({ err: error, requestId, method: request.method }, 'Request failed');
    response
      .status(HTTP.internal)
      .json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.', requestId } });
  };
}
/** Return a predictable response for unknown routes. */
export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(HTTP.notFound).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } });
};
