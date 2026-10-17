import { useState, useRef } from 'react';
import type { BudgetData, TransactionInput, TransactionType } from '../../types/budget';
import { categoryNames, isCategoryArchived } from '../planning/catalog';
import { PLANNING } from '../planning/planning.constants';
/** Reuse merchant defaults only until the user explicitly chooses their own values.
 * @param {BudgetData} data - Recent ledger and active categories.
 * @param {TransactionInput} source - Edit/copy defaults.
 * @param {TransactionType} type - Selected transaction kind. @returns {object} Entry values and suggestions. */
export function useEntrySuggestions(data: BudgetData, source: TransactionInput | undefined, type: TransactionType) {
  const [name, setName] = useState(source?.name ?? '');
  const [category, setCategory] = useState(source?.category ?? (type === 'income' ? 'Salary' : 'Groceries'));
  const [accountId, setAccountId] = useState(source?.accountId ?? data.accounts[0]?.id ?? '');
  const categoryTouched = useRef(false);
  const accountTouched = useRef(false);
  const active = categoryNames(data, source?.category);
  const recent = [...(data.transactions ?? [])].sort((left, right) => right.createdAt - left.createdAt);
  const suggestions = [...new Set(recent.filter((entry) => entry.type === type).map((entry) => entry.name))].slice(
    0,
    PLANNING.suggestionCount,
  );
  /** Suggest defaults on an exact merchant match, without copying the amount or date.
   * @param {string} value - Entered merchant. @returns {void} Updates untouched selectors. */
  function changeName(value: string) {
    setName(value);
    if (source) {
      return;
    }
    const match = recent.find(
      (entry) =>
        entry.type === type &&
        entry.name.trim().toLowerCase() === value.trim().toLowerCase() &&
        active.includes(entry.category),
    );
    if (match && !categoryTouched.current) {
      setCategory(match.category);
    }
    if (match && !accountTouched.current && data.accounts.some((entry) => entry.id === match.accountId)) {
      setAccountId(match.accountId);
    }
  }
  /** Retain an explicit category selection. @param {string} value - Name. @returns {void} Selector state. */
  function changeCategory(value: string) {
    categoryTouched.current = true;
    setCategory(value);
  }
  /** Retain an explicit account selection. @param {string} value - UUID. @returns {void} Selector state. */
  function changeAccount(value: string) {
    accountTouched.current = true;
    setAccountId(value);
  }
  /** Keep sensible defaults when switching a blank entry's kind.
   * @param {TransactionType} next - Transaction kind. @returns {void} Updates only untouched new entries. */
  function changeType(next: TransactionType) {
    if (!source && !categoryTouched.current) {
      setCategory(next === 'income' ? 'Salary' : 'Groceries');
    }
  }
  return {
    name,
    category,
    accountId,
    categories: active,
    suggestions,
    /** Label retained archived values clearly. @param {string} name - Category. @returns {boolean} Archive flag. */
    isArchived: (name: string) => isCategoryArchived(data, name),
    changeName,
    changeCategory,
    changeAccount,
    changeType,
  };
}
