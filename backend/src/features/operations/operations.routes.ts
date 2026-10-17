import { Router } from 'express';
import type { DatabaseClient } from '../../db/client.js';
import { HTTP } from '../../constants/http.constants.js';
import { identifierSchema } from '../budget/budget.schema.js';
import { OPERATIONS } from './operations.constants.js';
import { importCommitSchema, importPreviewSchema, clearanceSchema, reconcileSchema } from './operations.schema.js';
import { createOperationsRepository } from './operations.repository.js';
import { createOperationsService } from './operations.service.js';
/** Bind validated HTTP inputs to import/reconciliation use cases.
 * @param {DatabaseClient} client - Existing SQLite connection. @returns {Router} Feature routes. */
export function createOperationsRoutes(client: DatabaseClient) {
  const router = Router();
  const service = createOperationsService(createOperationsRepository(client));
  router.post(`${OPERATIONS.imports}/preview`, (request, response) => {
    const input = importPreviewSchema.parse(request.body);
    response.json({ data: service.preview(input.accountId, input.rows) });
  });
  router.post(`${OPERATIONS.imports}/commit`, (request, response) => {
    const input = importCommitSchema.parse(request.body);
    response.json({ data: service.commit(input.accountId, input.rows) });
  });
  router.get(OPERATIONS.reconciliation, (_request, response) => response.json({ data: service.state() }));
  router.put(`${OPERATIONS.reconciliation}/clearance`, (request, response) => {
    service.setClearance(clearanceSchema.parse(request.body));
    response.status(HTTP.noContent).end();
  });
  router.post(OPERATIONS.reconciliation, (request, response) => {
    response.status(HTTP.created).json({ data: service.reconcile(reconcileSchema.parse(request.body)) });
  });
  router.delete(`${OPERATIONS.reconciliation}/:id`, (request, response) => {
    service.undo(identifierSchema.parse(request.params).id);
    response.status(HTTP.noContent).end();
  });
  return router;
}
