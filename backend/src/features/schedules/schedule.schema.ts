import { z } from 'zod';
export const scheduleSettingsSchema = z
  .object({ recurringId: z.uuid(), isPaused: z.boolean(), endDate: z.iso.date().nullable() })
  .strict();
export const skipOccurrenceSchema = z
  .object({ recurringId: z.uuid(), date: z.iso.date(), isSkipped: z.boolean() })
  .strict();
