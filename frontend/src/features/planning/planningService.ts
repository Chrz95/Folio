import { z } from 'zod';
import { environment } from '../../app/config/environment';
import { request } from '../../lib/api/client';
import { readDemo, writeDemo } from '../../lib/storage/demoStore';
import type { PlanningData } from '../../types/planning';
import { PLANNING_PATH, PLANNING } from './planning.constants';
import { VALUE, CATEGORY } from '../../constants/app.constants';
import { categoryNames } from './catalog';
export type PlanningResource = keyof typeof PLANNING_PATH;
const moneySchema = z.number().int().min(0).max(VALUE.maximumMoney);
const nameSchema = z.string().trim().min(1).max(PLANNING.maximumCategory);
const monthSchema = z
  .object({
    month: z.iso
      .date()
      .refine((value) => value.endsWith('-01') && value >= PLANNING.minimumMonth && value <= PLANNING.maximumMonth),
    category: nameSchema,
    amount: moneySchema,
    rollover: z.boolean(),
  })
  .strict();
const categorySchema = z.object({ name: nameSchema }).strict();
const goalSchema = z
  .object({
    name: z.string().trim().min(1).max(PLANNING.maximumName),
    targetAmount: moneySchema.refine((value) => value > 0),
    targetDate: z.iso.date().nullable(),
    isArchived: z.boolean().default(false),
  })
  .strict();
const contributionSchema = z
  .object({
    id: z.uuid(),
    amount: z
      .number()
      .int()
      .min(-VALUE.maximumMoney)
      .max(VALUE.maximumMoney)
      .refine((value) => value !== 0),
    date: z.iso.date(),
    notes: z.string().max(PLANNING.maximumNotes).default(''),
  })
  .strict();
/** Load planning metadata from the selected adapter. @param {AbortSignal} signal - Cancellation.
 * @returns {Promise<PlanningData>} Planning snapshot. */
export async function loadPlanning(signal?: AbortSignal): Promise<PlanningData> {
  return request<PlanningData>('/planning', { signal });
}
/** Save a planning change; preview validation mirrors API invariants and writes only after success.
 * @param {PlanningResource} resource - Planning collection. @param {string} method - HTTP method.
 * @param {object} value - Mutation payload. @param {string} id - Existing goal or category UUID.
 * @returns {Promise<void>} Durable completion. */
export async function mutatePlanning(resource: PlanningResource, method: string, value?: object, id?: string) {
  if (!environment.isDemo) {
    const suffix = id ? `/${id}${resource === 'contributions' ? '/contributions' : ''}` : '';
    await request(`${PLANNING_PATH[resource]}${suffix}`, { method, body: JSON.stringify(value) });
    return;
  }
  const data = readDemo();
  data.monthlyBudgets ??= [];
  data.customCategories ??= [];
  data.goals ??= [];
  data.contributions ??= [];
  if (resource === 'monthlyBudgets') {
    const input = monthSchema.parse(value);
    const previous = data.monthlyBudgets.find(
      (entry) => entry.month === input.month && entry.category === input.category,
    );
    if (!categoryNames(data, previous?.category).includes(input.category)) {
      throw new Error('Choose an active category.');
    }
    data.monthlyBudgets = [
      ...data.monthlyBudgets.filter((entry) => entry.month !== input.month || entry.category !== input.category),
      input,
    ];
  } else if (resource === 'categories') {
    if (id) {
      const input = z.object({ isArchived: z.boolean() }).strict().parse(value);
      const entry = data.customCategories.find((category) => category.id === id);
      if (!entry) {
        throw new Error('This category no longer exists.');
      }
      entry.isArchived = input.isArchived;
    } else {
      const { name } = categorySchema.parse(value);
      const names = [...CATEGORY.map((entry) => entry.name), ...data.customCategories.map((entry) => entry.name)];
      if (names.some((entry) => entry.toLowerCase() === name.toLowerCase())) {
        throw new Error('That category already exists. Restore it if archived.');
      }
      data.customCategories.push({ id: crypto.randomUUID(), name, isArchived: false });
    }
  } else if (resource === 'goals') {
    const input = goalSchema.parse(value);
    if (id && !data.goals.some((entry) => entry.id === id)) {
      throw new Error('This goal no longer exists.');
    }
    data.goals = [...data.goals.filter((entry) => entry.id !== id), { ...input, id: id ?? crypto.randomUUID() }];
  } else {
    const input = contributionSchema.parse(value);
    const prior = data.contributions.find((entry) => entry.id === input.id);
    if (prior) {
      if (
        prior.goalId !== id ||
        prior.amount !== input.amount ||
        prior.date !== input.date ||
        prior.notes !== input.notes
      ) {
        throw new Error('Use a new request ID for a different contribution.');
      }
      return;
    }
    const goal = data.goals.find((entry) => entry.id === id);
    const progress = data.contributions
      .filter((entry) => entry.goalId === id)
      .reduce((sum, entry) => sum + entry.amount, 0);
    if (!goal || goal.isArchived || progress + input.amount < 0 || progress + input.amount > VALUE.maximumMoney) {
      throw new Error('Restore this goal and keep progress within its range.');
    }
    data.contributions.push({ ...input, goalId: goal.id, createdAt: Date.now() });
  }
  writeDemo(data);
}
