/** Fictional complete financial snapshot for workspace replacement integration tests.
 * @returns {object} JSON-compatible workspace. */
export function workspaceFixture() {
  const id = {
    account: '11111111-1111-4111-8111-111111111111',
    second: '22222222-2222-4222-8222-222222222222',
    posting: '33333333-3333-4333-8333-333333333333',
    transfer: '44444444-4444-4444-8444-444444444444',
    recurring: '55555555-5555-4555-8555-555555555555',
    category: '66666666-6666-4666-8666-666666666666',
    goal: '77777777-7777-4777-8777-777777777777',
    contribution: '88888888-8888-4888-8888-888888888888',
    statement: '99999999-9999-4999-8999-999999999999',
    secondStatement: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    receipt: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  };
  const posting = {
    name: 'Vet',
    amount: 1000,
    type: 'expense',
    category: 'Pets',
    accountId: id.account,
    destinationAccountId: null,
    date: '2026-10-01',
    notes: 'Fictional receipt',
    createdAt: 12,
    recurringId: id.recurring,
  };
  const { createdAt: _createdAt, recurringId: _recurringId, ...template } = posting;
  const content = '%PDF-1.4\nFictional fixture';
  return {
    accounts: [
      { id: id.account, name: 'Imported Bank', openingBalance: 10000 },
      { id: id.second, name: 'Imported Savings', openingBalance: 0 },
    ],
    transactions: [
      { ...posting, id: id.posting },
      {
        ...posting,
        id: id.transfer,
        name: 'Move savings',
        type: 'transfer',
        amount: 2000,
        destinationAccountId: id.second,
        date: '2026-10-02',
        recurringId: null,
      },
    ],
    recurring: [{ ...template, id: id.recurring, frequency: 'monthly', reminderDays: 2 }],
    scheduleSettings: [{ recurringId: id.recurring, isPaused: false, endDate: '2027-10-01' }],
    skippedOccurrences: [{ recurringId: id.recurring, date: '2026-11-01' }],
    budgets: [{ category: 'Pets', amount: 10000 }],
    monthlyBudgets: [{ month: '2026-10-01', category: 'Pets', amount: 5000, rollover: true }],
    customCategories: [{ id: id.category, name: 'Pets', isArchived: false }],
    goals: [{ id: id.goal, name: 'Emergency', targetAmount: 100000, targetDate: null, isArchived: false }],
    contributions: [{ id: id.contribution, goalId: id.goal, amount: 500, date: '2026-10-01', notes: '', createdAt: 5 }],
    reconciliations: [
      { id: id.statement, accountId: id.account, date: '2026-10-31', statementBalance: 7000, createdAt: 25 },
      { id: id.secondStatement, accountId: id.second, date: '2026-10-31', statementBalance: 2000, createdAt: 25 },
    ],
    clearances: [
      { transactionId: id.posting, accountId: id.account, reconciliationId: id.statement },
      { transactionId: id.transfer, accountId: id.account, reconciliationId: id.statement },
      { transactionId: id.transfer, accountId: id.second, reconciliationId: id.secondStatement },
    ],
    importLinks: [
      { fingerprint: JSON.stringify([id.account, 'bank-id', 'fictional-bank-id']), transactionId: id.posting },
    ],
    receipts: [
      {
        id: id.receipt,
        transactionId: id.posting,
        name: 'vet.pdf',
        mimeType: 'application/pdf',
        size: content.length,
        content: btoa(content),
        createdAt: 15,
      },
    ],
  };
}
