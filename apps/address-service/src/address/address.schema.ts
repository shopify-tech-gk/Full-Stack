import { z } from 'zod';

const AddressTypeEnum = z.enum(['HOME', 'WORK', 'OTHER']);

// Same E.164-ish pattern auth-service's OTP flow uses for phone numbers
// (auth-service/src/otp/otp.schema.ts) - kept consistent across services.
// This is the DELIVERY contact number, which may differ from the account
// phone used to log in.
const Phone = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Invalid phone number');

// 6-digit Indian PIN code. Deliberately simple for launch (India-only) -
// relax/generalize once international shipping is a real requirement.
const Pincode = z.string().regex(/^\d{6}$/, 'Pincode must be exactly 6 digits');

// State is free text for launch (no fixed enum) - India's states/UTs list
// is stable but not worth hardcoding/validating against yet; a dropdown
// with a fixed list is a frontend/UX concern, not a backend validation one.
const State = z.string().min(1).max(100);

export const CreateAddressBody = z.object({
  fullName: z.string().min(1).max(200),
  phone: Phone,
  line1: z.string().min(1).max(300),
  line2: z.string().max(300).optional(),
  landmark: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: State,
  pincode: Pincode,
  country: z.string().min(1).max(100).default('India'),
  addressType: AddressTypeEnum.default('HOME'),
  isDefault: z.boolean().optional(),
});
export type CreateAddressBody = z.infer<typeof CreateAddressBody>;

export const UpdateAddressBody = z.object({
  fullName: z.string().min(1).max(200).optional(),
  phone: Phone.optional(),
  line1: z.string().min(1).max(300).optional(),
  line2: z.string().max(300).optional(),
  landmark: z.string().max(200).optional(),
  city: z.string().min(1).max(100).optional(),
  state: State.optional(),
  pincode: Pincode.optional(),
  country: z.string().min(1).max(100).optional(),
  addressType: AddressTypeEnum.optional(),
  isDefault: z.boolean().optional(),
});
export type UpdateAddressBody = z.infer<typeof UpdateAddressBody>;
