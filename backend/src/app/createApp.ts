import { createWorkspaceRoutes } from '../features/workspace/workspace.routes.js';
import { BACKUP } from '../features/workspace/backup.constants.js';
import { createActualRoutes } from '../features/actual/actual.routes.js';
import { createBulkRoutes } from '../features/bulk/bulk.routes.js';
import { createScheduleRoutes } from '../features/schedules/schedule.routes.js';
import { createReceiptRoutes } from '../features/receipts/receipt.routes.js';
import { createPlanningRoutes } from '../features/planning/planning.routes.js';
import { createOperationsRoutes } from '../features/operations/operations.routes.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { DatabaseClient } from '../db/client.js';
import { verifySchema } from '../db/client.js';
import { HTTP, API, LIMIT } from '../constants/http.constants.js';
import { createBudgetRepository } from '../features/budget/budget.repository.js';
import { createBudgetService } from '../features/budget/budget.service.js';
import { createBudgetRoutes } from '../features/budget/budget.routes.js';
import { createErrorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createNotificationRoutes } from '../features/reminders/reminders.routes.js';
import type { loadEnvironment } from './config/environment.js';
/** Compose an injectable Express application without starting a listener.
 * @param {DatabaseClient} client - Existing migrated database.
 * @param {ReturnType<typeof loadEnvironment>} configuration - Typed settings.
 * @param {Logger} logger - Redacted structured logger.
 * @returns {express.Express} Fully configured application. */
export function createApp(client: DatabaseClient, configuration: ReturnType<typeof loadEnvironment>, logger: Logger) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use((_request, response, next) => {
    response.setHeader('X-Request-Id', randomUUID());
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(
    pinoHttp({
      logger,
      /** Reuse the server-generated correlation identifier for structured logging.
       * @param {import('express').Request} _request - Typed boundary input.
       * @param {import('express').Response} response - Typed boundary input.
       * @returns {object} Operation result. */
      genReqId: (_request, response) => String(response.getHeader('X-Request-Id')),
      serializers: {
        /** Log only the request method, excluding headers and personal payloads.
         * @param {import('express').Request} request - Typed boundary input.
         * @returns {object} Operation result. */
        req: (request) => ({ method: request.method }),
        /** Log only the response status, excluding headers and personal payloads.
         * @param {import('express').Response} response - Typed boundary input.
         * @returns {object} Operation result. */
        res: (response) => ({ statusCode: response.statusCode }),
      },
    }),
  );
  app.use(`${configuration.apiPrefix}/imports/actual`, express.json({ limit: '8mb' }));
  app.use(`${configuration.apiPrefix}${BACKUP.importPath}`, express.json({ limit: BACKUP.maximumServerBytes }));
  app.use(express.json({ limit: LIMIT.body }));
  app.use(cors({ origin: configuration.origins }));
  app.get(`${configuration.apiPrefix}${API.health}`, (_request, response) =>
    response.json({ data: { status: 'alive' } }),
  );
  app.get(`${configuration.apiPrefix}${API.ready}`, (_request, response) => {
    try {
      verifySchema(client);
      response.json({ data: { status: 'ready' } });
    } catch {
      response.status(HTTP.unavailable).json({ error: { code: 'NOT_READY', message: 'Storage unavailable.' } });
    }
  });
  const repository = createBudgetRepository(client);
  app.use(configuration.apiPrefix, createBudgetRoutes(createBudgetService(repository)));
  app.use(`${configuration.apiPrefix}${API.notifications}`, createNotificationRoutes(client, configuration.push));
  app.use(configuration.apiPrefix, createOperationsRoutes(client));
  app.use(configuration.apiPrefix, createPlanningRoutes(client));
  app.use(configuration.apiPrefix, createReceiptRoutes(client));
  app.use(configuration.apiPrefix, createScheduleRoutes(client));
  app.use(configuration.apiPrefix, createBulkRoutes(client));
  app.use(configuration.apiPrefix, createActualRoutes(client));
  app.use(configuration.apiPrefix, createWorkspaceRoutes(client));
  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));
  return app;
}
