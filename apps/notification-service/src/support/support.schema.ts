import { z } from 'zod';

// Same limits as the web contact form (packages/shared-client support.ts).
export const ContactMessageBody = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(20),
  email: z.string().trim().email().max(254).optional(),
  message: z.string().trim().min(10).max(2000),
});
export type ContactMessageBody = z.infer<typeof ContactMessageBody>;
