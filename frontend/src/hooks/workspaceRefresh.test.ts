// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useBudgetWorkspace } from '../app/useBudgetWorkspace';
import type { BudgetData } from '../types/budget';
const adapter = vi.hoisted(() => ({ loadBudget: vi.fn(), mutateBudget: vi.fn(), payOccurrence: vi.fn() }));
vi.mock('../features/transactions/budgetService', () => adapter);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe('foreground/automatic workspace refresh ordering', () => {
  it('does not let an earlier slow refresh replace a newer saved snapshot', async () => {
    const empty: BudgetData = { accounts: [], transactions: [], recurring: [], budgets: [] };
    adapter.loadBudget.mockResolvedValueOnce(empty);
    const { result } = renderHook(useBudgetWorkspace);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let resolveOld!: (data: BudgetData) => void;
    adapter.loadBudget.mockImplementationOnce(
      () =>
        new Promise<BudgetData>((resolve) => {
          resolveOld = resolve;
        }),
    );
    adapter.loadBudget.mockResolvedValueOnce({
      ...empty,
      accounts: [{ id: 'latest', name: 'Latest', openingBalance: 0 }],
    });
    let old!: Promise<void>;
    await act(async () => {
      old = result.current.reload();
      await result.current.reload();
    });
    expect(result.current.data.accounts[0]?.name).toBe('Latest');
    await act(async () => {
      resolveOld(empty);
      await old;
    });
    expect(result.current.data.accounts[0]?.name).toBe('Latest');
  });
});
