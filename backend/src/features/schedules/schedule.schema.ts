import { z } from 'zod';
export const scheduleSettingsSchema = z
  .object({
    recurringId: z.uuid(),
    isPaused: z.boolean(),
    endDate: z.iso.date().nullable(),
    autoConfirm: z.boolean().optional(),
    autoConfirmFrom: z.iso.date().nullable().optional(),
  })
  .strict();
export const portableScheduleSettingsSchema = scheduleSettingsSchema.refine(
  (value) => !value.autoConfirm || Boolean(value.autoConfirmFrom),
  'Automatic confirmation needs its activation date.',
);
export const scheduleSettingsInputSchema = scheduleSettingsSchema.omit({ autoConfirmFrom: true });
export const skipOccurrenceSchema = z
  .object({ recurringId: z.uuid(), date: z.iso.date(), isSkipped: z.boolean() })
  .strict();
