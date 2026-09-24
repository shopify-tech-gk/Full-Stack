import { z } from 'zod';

const PercentString = z
  .string()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, 'Must be a decimal percent string')
  .refine((v) => Number(v) >= 0 && Number(v) <= 100, 'Percent must be between 0 and 100');

export const UpdateSettingsBody = z.object({
  marketplaceMode: z.enum(['ENABLED', 'DISABLED']).optional(),
  commissionEnabled: z.boolean().optional(),
  commissionDefaultPercent: PercentString.optional(),
  tcsEnabled: z.boolean().optional(),
  tcsPercent: PercentString.optional(),
  tdsEnabled: z.boolean().optional(),
  tdsPercent: PercentString.optional(),
});
export type UpdateSettingsBody = z.infer<typeof UpdateSettingsBody>;
