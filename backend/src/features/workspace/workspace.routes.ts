import { Router } from 'express';
import type { DatabaseClient } from '../../db/client.js';
import { BACKUP } from './backup.constants.js';
import {
  workspaceImportInput,
  workspaceImportCommit,
  workspaceDeleteInput,
  workspaceDeleteCommit,
} from './workspace.schema.js';
import { createWorkspaceRepository } from './workspace.repository.js';
import { createWorkspaceDeletion } from './workspaceDelete.service.js';
import { createWorkspaceService } from './workspace.service.js';
/** Strictly validate the reviewed JSON import boundary; native database files are not accepted.
 * @param {DatabaseClient} client - Migrated connection. @returns {Router} Workspace import endpoints. */
export function createWorkspaceRoutes(client: DatabaseClient) {
  const router = Router();
  const service = createWorkspaceService(createWorkspaceRepository(client));
  router.post(`${BACKUP.importPath}/preview`, (request, response) => {
    response.json({ data: service.preview(workspaceImportInput.parse(request.body).data) });
  });
  router.post(`${BACKUP.importPath}/commit`, (request, response) => {
    const { data, revision } = workspaceImportCommit.parse(request.body);
    response.json({ data: service.commit(data, revision) });
  });
  const deletion = createWorkspaceDeletion(createWorkspaceRepository(client));
  router.post(`${BACKUP.deletePath}/preview`, (request, response) => {
    workspaceDeleteInput.parse(request.body);
    response.json({ data: deletion.preview() });
  });
  router.post(`${BACKUP.deletePath}/commit`, (request, response) => {
    const { revision } = workspaceDeleteCommit.parse(request.body);
    response.json({ data: deletion.commit(revision) });
  });
  return router;
}
