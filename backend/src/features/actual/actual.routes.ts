import { Router } from 'express';
import type { DatabaseClient } from '../../db/client.js';
import { ACTUAL } from './actual.constants.js';
import { actualInputSchema, actualCommitSchema } from './actualSchema.js';
import { createActualRepository } from './actual.repository.js';
import { createActualService } from './actual.service.js';
/** Bind validated normalized data; native archive bytes stay on the user's device.
 * @param {DatabaseClient} client - Migrated connection. @returns {Router} Actual import endpoints. */
export function createActualRoutes(client: DatabaseClient) {
  const router = Router();
  const service = createActualService(createActualRepository(client));
  router.post(`${ACTUAL.path}/preview`, (request, response) => {
    const { file } = actualInputSchema.parse(request.body);
    response.json({ data: service.preview(file) });
  });
  router.post(`${ACTUAL.path}/commit`, (request, response) => {
    const { file, revision } = actualCommitSchema.parse(request.body);
    response.json({ data: service.commit(file, revision) });
  });
  return router;
}
