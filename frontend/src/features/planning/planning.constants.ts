export const PLANNING_PATH = {
  monthlyBudgets: '/planning/monthly-budgets',
  categories: '/planning/categories',
  goals: '/planning/goals',
  contributions: '/planning/goals',
} as const;
export const PLANNING = {
  maximumCategory: 40,
  maximumCopyCategories: 500,
  minimumMonth: '1900-01-01',
  maximumMonth: '9999-12-01',
  suggestionCount: 30,
  monthsPerYear: 12,
  maximumName: 100,
  maximumNotes: 1000,
} as const;
