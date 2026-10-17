import { Router } from 'express';
import type { DatabaseClient } from '../../db/client.js';
import { requireCategory } from '../planning/categoryValidation.js';
import { createBulkRepository } from './bulk.repository.js';
import { createBulkService } from './bulk.service.js';
import { bulkInputSchema, bulkCommitSchema } from './bulk.schema.js';
import { BULK } from './bulk.constants.js';
/** Bind strictly validated bulk operations to the existing single-user ledger.
 * @param {DatabaseClient} client - Migrated database. @returns {Router} Bulk preview and commit paths. */
export function createBulkRoutes(client: DatabaseClient) {
  const router = Router();
  const service = createBulkService(createBulkRepository(client), (category) => requireCategory(client, category));
  router.post(`${BULK.path}/preview`, (request, response) => {
    response.json({ data: service.preview(bulkInputSchema.parse(request.body)) });
  });
  router.post(`${BULK.path}/commit`, (request, response) => {
    const { selection, revision } = bulkCommitSchema.parse(request.body);
    response.json({ data: service.commit(selection, revision) });
  });
  return router;
}
