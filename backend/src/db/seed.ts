import { randomUUID } from 'node:crypto';
import { parseDatabaseEnvironment } from '../app/config/environment.js';
import { openDatabase, verifySchema } from './client.js';
import { accounts, transactions, budgets, recurring } from './schema/budget.js';
import { logger } from '../lib/logger/logger.js';
const SEED = {
  accountId: '11111111-1111-4111-8111-111111111111',
  savingId: '22222222-2222-4222-8222-222222222222',
  salaryId: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
  rentId: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001',
  opening: 810000,
  savings: 1370000,
  salary: 480000,
  rent: 95000,
  groceries: 40000,
  reminderDays: 2,
  date: '2026-10-01',
};
if (parseDatabaseEnvironment().mode === 'production') {
  throw new Error('Development seeds are forbidden in production.');
}
const client = openDatabase(parseDatabaseEnvironment());
try {
  verifySchema(client);
  client.database.transaction((database) => {
    database
      .insert(accounts)
      .values([
        { id: SEED.accountId, name: 'Everyday account', openingBalance: SEED.opening },
        { id: SEED.savingId, name: 'Savings account', openingBalance: SEED.savings },
      ])
      .onConflictDoNothing()
      .run();
    database
      .insert(recurring)
      .values({
        id: SEED.rentId,
        name: 'Apartment rent',
        amount: SEED.rent,
        type: 'expense',
        category: 'Housing',
        accountId: SEED.accountId,
        date: SEED.date,
        frequency: 'monthly',
        reminderDays: SEED.reminderDays,
      })
      .onConflictDoNothing()
      .run();
    database
      .insert(transactions)
      .values({
        id: SEED.salaryId,
        name: 'Monthly salary',
        amount: SEED.salary,
        type: 'income',
        category: 'Salary',
        accountId: SEED.accountId,
        date: SEED.date,
        createdAt: 0,
      })
      .onConflictDoNothing()
      .run();
    database.insert(budgets).values({ category: 'Groceries', amount: SEED.groceries }).onConflictDoNothing().run();
  });
  logger.info({ seed: randomUUID() }, 'Development samples initialized idempotently');
} finally {
  client.sqlite.close();
}
