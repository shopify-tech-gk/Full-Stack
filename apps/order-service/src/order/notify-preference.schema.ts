import { z } from 'zod';

export const NotifyPreferenceBody = z.object({
  whatsapp: z.boolean(),
  sms: z.boolean(),
});
export type NotifyPreferenceBody = z.infer<typeof NotifyPreferenceBody>;
