import { Router } from 'express';
import { z } from 'zod';
import type { DatabaseClient } from '../../db/client.js';
import { HTTP } from '../../constants/http.constants.js';
import { identifierSchema } from '../budget/budget.schema.js';
import { receiptInputSchema } from './receiptValidation.js';
import { createReceiptRepository } from './receipt.repository.js';
import { createReceiptService } from './receipt.service.js';
import { workspaceSnapshot } from './workspaceSnapshot.js';
import { RECEIPT } from './receipt.constants.js';
/** Bind validated receipt and read-only export routes. @param {DatabaseClient} client - Database.
 * @returns {Router} Supporting document routes. */
export function createReceiptRoutes(client: DatabaseClient) {
  const router = Router();
  const service = createReceiptService(createReceiptRepository(client));
  const postingId = z.object({ transactionId: z.uuid() }).strict();
  router.get(`/transactions/:transactionId${RECEIPT.path}`, (request, response) => {
    response.json({ data: service.list(postingId.parse(request.params).transactionId) });
  });
  router.post(`/transactions/:transactionId${RECEIPT.path}`, (request, response) => {
    const entry = service.add(postingId.parse(request.params).transactionId, receiptInputSchema.parse(request.body));
    const { content: _content, ...metadata } = entry;
    response.status(HTTP.created).json({ data: metadata });
  });
  router.get(`${RECEIPT.path}/:id`, (request, response) =>
    response.json({ data: service.get(identifierSchema.parse(request.params).id) }),
  );
  router.delete(`${RECEIPT.path}/:id`, (request, response) => {
    service.remove(identifierSchema.parse(request.params).id);
    response.status(HTTP.noContent).end();
  });
  router.get('/workspace/export', (_request, response) => response.json({ data: workspaceSnapshot(client) }));
  return router;
}
