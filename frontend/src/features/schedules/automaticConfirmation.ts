import type { BudgetData } from '../../types/budget';
import { readDemo, writeDemo } from '../../lib/storage/demoStore';
import { automaticOccurrences } from './automaticPlanning';
import { localAutomaticDate } from './automaticControls';
/** Apply opt-in browser-preview confirmations while open, with a single atomic localStorage write.
 * @param {number} now - Epoch milliseconds. @returns {BudgetData} Durable current snapshot. */
export function confirmDemoOccurrences(now: number): BudgetData {
  const data = readDemo();
  if (!data.scheduleSettings?.some((row) => row.autoConfirm && !row.isPaused)) {
    return data;
  }
  const due = automaticOccurrences(data, localAutomaticDate(now));
  for (const row of due) {
    const template = data.recurring.find((entry) => entry.id === row.recurringId)!;
    const { frequency: _frequency, reminderDays: _reminderDays, ...posting } = template;
    data.transactions.push({
      ...posting,
      id: crypto.randomUUID(),
      recurringId: template.id,
      date: row.date,
      createdAt: now,
    });
  }
  if (due.length) {
    writeDemo(data);
  }
  return data;
}
