export interface MonthlyBudget {
  month: string;
  category: string;
  amount: number;
  rollover: boolean;
}
export interface CustomCategory {
  id: string;
  name: string;
  isArchived: boolean;
}
export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string | null;
  isArchived: boolean;
}
export interface GoalContribution {
  id: string;
  goalId: string;
  amount: number;
  date: string;
  notes: string;
  createdAt: number;
}
export interface PlanningData {
  monthlyBudgets: MonthlyBudget[];
  customCategories: CustomCategory[];
  goals: SavingsGoal[];
  contributions: GoalContribution[];
}
export interface MonthPlan extends MonthlyBudget {
  carry: number;
  available: number;
  spent: number;
  remaining: number;
}
