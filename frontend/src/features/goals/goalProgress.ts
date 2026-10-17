import type { SavingsGoal, GoalContribution } from '../../types/planning';
import { dateKey } from '../../utils/format';
import { VALUE } from '../../constants/app.constants';
import { PLANNING } from '../planning/planning.constants';
/** Calculate a calendar-month pace from manually recorded progress.
 * @param {SavingsGoal} goal - Savings target. @param {GoalContribution[]} contributions - Progress journal.
 * @param {string} today - Local date, injectable in tests. @returns {object} Progress, remaining and monthly pace. */
export function goalProgress(goal: SavingsGoal, contributions: GoalContribution[], today: string = dateKey()) {
  const saved = contributions.filter((entry) => entry.goalId === goal.id).reduce((sum, entry) => sum + entry.amount, 0);
  const remaining = Math.max(0, goal.targetAmount - saved);
  const target = goal.targetDate;
  const [year = 0, month = 0] = today.split('-').map(Number);
  const [targetYear = 0, targetMonth = 0] = (target ?? today).split('-').map(Number);
  const months = Math.max(1, (targetYear - year) * PLANNING.monthsPerYear + targetMonth - month + 1);
  return {
    saved,
    remaining,
    percentage: Math.min(VALUE.percent, (saved / goal.targetAmount) * VALUE.percent),
    monthly: target && target >= today && remaining > 0 ? Math.ceil(remaining / months) : null,
    isOverdue: Boolean(target && target < today && remaining > 0),
  };
}
