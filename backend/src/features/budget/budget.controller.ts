import type { RequestHandler } from 'express';
import type { z } from 'zod';
import type { BudgetService } from './budget.service.js';
import {
  accountSchema,
  budgetSchema,
  identifierSchema,
  pageSchema,
  paySchema,
  recurringSchema,
  transactionSchema,
} from './budget.schema.js';
import { HTTP } from '../../constants/http.constants.js';
/** Adapt a validated body to a JSON resource response.
 * @param {z.ZodType<T>} schema - Boundary schema.
 * @param {(value: T, id: string) => unknown} action - Service operation.
 * @param {number} status - Success status.
 * @returns {RequestHandler} Typed Express controller. */
function bodyHandler<T>(
  schema: z.ZodType<T>,
  action: (value: T, id: string) => unknown,
  status: number = HTTP.ok,
): RequestHandler {
  return (request, response) => {
    const id = Object.keys(request.params).length ? identifierSchema.parse(request.params).id : '';
    response.status(status).json({ data: action(schema.parse(request.body), id) });
  };
}
/** Bind HTTP parsing without database queries in controllers.
 * @param {BudgetService} service - Business operations.
 * @returns {object} Request handlers. */
export function createBudgetController(service: BudgetService) {
  return {
    listTransactions: ((request, response) => {
      const { limit, offset } = pageSchema.parse(request.query);
      response.json({
        data: service.listTransactions(limit, offset),
        meta: { limit, offset, total: service.countTransactions() },
      });
    }) satisfies RequestHandler,
    createTransaction: bodyHandler(transactionSchema, service.createTransaction, HTTP.created),
    updateTransaction: bodyHandler(transactionSchema, (value, id) => service.updateTransaction(id, value)),
    deleteTransaction: ((request, response) => {
      service.deleteTransaction(identifierSchema.parse(request.params).id);
      response.status(HTTP.noContent).end();
    }) satisfies RequestHandler,
    listAccounts: ((_request, response) => response.json({ data: service.listAccounts() })) satisfies RequestHandler,
    createAccount: bodyHandler(accountSchema, service.createAccount, HTTP.created),
    listRecurring: ((_request, response) => response.json({ data: service.listRecurring() })) satisfies RequestHandler,
    createRecurring: bodyHandler(recurringSchema, service.createRecurring, HTTP.created),
    updateRecurring: bodyHandler(recurringSchema, (value, id) => service.updateRecurring(id, value)),
    deleteRecurring: ((request, response) => {
      service.deleteRecurring(identifierSchema.parse(request.params).id);
      response.status(HTTP.noContent).end();
    }) satisfies RequestHandler,
    payOccurrence: bodyHandler(paySchema, (value, id) => service.payOccurrence(id, value.date)),
    listBudgets: ((_request, response) => response.json({ data: service.listBudgets() })) satisfies RequestHandler,
    saveBudget: bodyHandler(budgetSchema, service.saveBudget),
  };
}
