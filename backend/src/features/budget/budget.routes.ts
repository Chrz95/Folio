import { Router } from 'express';
import { API } from '../../constants/http.constants.js';
import { createBudgetController } from './budget.controller.js';
import type { BudgetService } from './budget.service.js';
/** Register transport paths without business logic.
 * @param {BudgetService} service - Budget use cases.
 * @returns {Router} Feature router. */
export function createBudgetRoutes(service: BudgetService) {
  const router = Router();
  const controller = createBudgetController(service);
  router.get(API.transactions, controller.listTransactions);
  router.post(API.transactions, controller.createTransaction);
  router.put(`${API.transactions}/:id`, controller.updateTransaction);
  router.delete(`${API.transactions}/:id`, controller.deleteTransaction);
  router.get(API.accounts, controller.listAccounts);
  router.post(API.accounts, controller.createAccount);
  router.get(API.recurring, controller.listRecurring);
  router.post(API.recurring, controller.createRecurring);
  router.put(`${API.recurring}/:id`, controller.updateRecurring);
  router.delete(`${API.recurring}/:id`, controller.deleteRecurring);
  router.post(`${API.recurring}/:id/pay`, controller.payOccurrence);
  router.get(API.budgets, controller.listBudgets);
  router.put(API.budgets, controller.saveBudget);
  return router;
}
