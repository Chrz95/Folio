import { useState } from 'react';
import type { BudgetData, Frequency } from '../../types/budget';
import { occurrenceIndex } from './recurrence';
import { resolveScheduleEnding, SCHEDULE_ENDING } from './scheduleEnding';
export type EndingMode = 'never' | 'date' | 'count';
/** Edit a finite schedule span from the visible due date while preserving its original month-end anchor.
 * @param {BudgetData} data - Workspace controls. @param {string | undefined} id - Existing schedule.
 * @param {string} anchor - Draft anchor. @param {string} due - Visible first pending date.
 * @param {Frequency} frequency - Draft recurrence. @returns {object} Ending fields and exact inclusive date. */
export function useScheduleEnding(
  data: BudgetData,
  id: string | undefined,
  anchor: string,
  due: string,
  frequency: Frequency,
) {
  const [initial] = useState(() => {
    const end = data.scheduleSettings?.find((row) => row.recurringId === id)?.endDate ?? '';
    const first = occurrenceIndex(anchor, frequency, due);
    const last = end ? occurrenceIndex(anchor, frequency, end) : null;
    const remaining = first !== null && last !== null ? last - first + 1 : 0;
    return {
      end,
      count: remaining > 0 ? String(remaining) : SCHEDULE_ENDING.defaultCount,
      mode: end ? ((remaining > 0 ? 'count' : 'date') as EndingMode) : ('never' as EndingMode),
    };
  });
  const [mode, setMode] = useState<EndingMode>(initial.mode);
  const [count, setCount] = useState(initial.count);
  const [endDate, setEndDate] = useState(initial.end);
  const request =
    mode === 'count' ? { repetitions: Number(count), countFrom: due } : { endDate: mode === 'date' ? endDate : null };
  let resolved: string | null = null;
  let error = '';
  try {
    resolved = resolveScheduleEnding({ date: anchor, frequency, ...request }) ?? null;
  } catch (failure) {
    error = failure instanceof Error ? failure.message : 'Choose a valid schedule ending.';
  }
  return { mode, setMode, count, setCount, endDate, setEndDate, request, resolved, error };
}
