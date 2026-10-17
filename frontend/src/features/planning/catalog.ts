import { CATEGORY } from '../../constants/app.constants';
import type { BudgetData } from '../../types/budget';
/** Include archived values only when retaining them on an existing record.
 * @param {BudgetData} data - Workspace. @param {string} retained - Original record value.
 * @returns {string[]} Active category names and any retained historical category. */
export function categoryNames(data: BudgetData, retained?: string): string[] {
  return [
    ...new Set([
      ...CATEGORY.map((entry) => entry.name),
      ...(data.customCategories ?? []).filter((entry) => !entry.isArchived).map((entry) => entry.name),
      ...(retained ? [retained] : []),
    ]),
  ];
}

/** Identify an archived custom name without changing its historical value.
 * @param {BudgetData} data - Category catalog. @param {string} name - Category name.
 * @returns {boolean} Whether the category is archived. */
export function isCategoryArchived(data: BudgetData, name: string): boolean {
  return data.customCategories?.some((entry) => entry.name === name && entry.isArchived) ?? false;
}
