import { Router } from 'express';
import type { DatabaseClient } from '../../db/client.js';
import { HTTP } from '../../constants/http.constants.js';
import { identifierSchema } from '../budget/budget.schema.js';
import { createPlanningRepository } from './planning.repository.js';
import { createPlanningService } from './planning.service.js';
import { requireCategory } from './categoryValidation.js';
import { PLANNING } from './planning.constants.js';
import {
  monthlyBudgetSchema,
  budgetCopySchema,
  budgetCopyCommitSchema,
  categorySchema,
  archiveSchema,
  goalSchema,
  contributionSchema,
} from './planning.schema.js';
/** Bind planning routes to validated domain operations.
 * @param {DatabaseClient} client - Migrated connection. @returns {Router} Planning routes. */
export function createPlanningRoutes(client: DatabaseClient) {
  const router = Router();
  const service = createPlanningService(createPlanningRepository(client), (name, previous) =>
    requireCategory(client, name, previous),
  );
  router.post(`${PLANNING.path}/budget-copy/preview`, (request, response) => {
    response.json({ data: service.previewCopy(budgetCopySchema.parse(request.body)) });
  });
  router.post(`${PLANNING.path}/budget-copy/commit`, (request, response) => {
    response.json({ data: service.commitCopy(budgetCopyCommitSchema.parse(request.body)) });
  });
  router.get(PLANNING.path, (_request, response) => response.json({ data: service.state() }));
  router.put(`${PLANNING.path}/monthly-budgets`, (request, response) => {
    response.json({ data: service.saveBudget(monthlyBudgetSchema.parse(request.body)) });
  });
  router.post(`${PLANNING.path}/categories`, (request, response) => {
    response.status(HTTP.created).json({ data: service.addCategory(categorySchema.parse(request.body).name) });
  });
  router.put(`${PLANNING.path}/categories/:id`, (request, response) => {
    response.json({
      data: service.archiveCategory(
        identifierSchema.parse(request.params).id,
        archiveSchema.parse(request.body).isArchived,
      ),
    });
  });
  router.post(`${PLANNING.path}/goals`, (request, response) => {
    response.status(HTTP.created).json({ data: service.addGoal(goalSchema.parse(request.body)) });
  });
  router.put(`${PLANNING.path}/goals/:id`, (request, response) => {
    response.json({
      data: service.updateGoal(identifierSchema.parse(request.params).id, goalSchema.parse(request.body)),
    });
  });
  router.post(`${PLANNING.path}/goals/:id/contributions`, (request, response) => {
    response.json({
      data: service.contribute(identifierSchema.parse(request.params).id, contributionSchema.parse(request.body)),
    });
  });
  return router;
}
