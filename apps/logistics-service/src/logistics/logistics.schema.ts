import { z } from 'zod';

const ShipmentStatusEnum = z.enum([
  'CREATED',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'RTO',
  'CANCELLED',
]);

export const CreateShipmentBody = z.object({
  orderItemId: z.string().uuid(),
  carrier: z.string().min(1).max(100).optional(),
  awbNumber: z.string().min(1).max(100).optional(),
  fulfillmentMode: z.enum(['PLATFORM', 'SELLER']).optional(),
});
export type CreateShipmentBody = z.infer<typeof CreateShipmentBody>;

export const UpdateShipmentStatusBody = z.object({
  status: ShipmentStatusEnum,
});
export type UpdateShipmentStatusBody = z.infer<typeof UpdateShipmentStatusBody>;

// `status` here is free text (matches tracking_event.status's schema -
// a raw courier/manual status string, not our ShipmentStatus enum) -
// logistics.service.ts maps it onto ShipmentStatus via mapTrackingStatus.
export const AddTrackingEventBody = z.object({
  status: z.string().min(1).max(100),
  location: z.string().min(1).max(200).optional(),
  occurredAt: z.string().datetime().optional(),
});
export type AddTrackingEventBody = z.infer<typeof AddTrackingEventBody>;
