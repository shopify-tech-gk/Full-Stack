import { config } from '../config';
import type { RenderedMessage } from '../providers/provider.interface';

export type TemplateKey = 'OTP' | 'ORDER_CONFIRMATION' | 'SHIPPING_UPDATE';
type RenderableChannel = 'SMS' | 'WHATSAPP' | 'EMAIL';

type ChannelRenderer = (data: Record<string, unknown>) => RenderedMessage;

/**
 * One entry per notification event; each entry maps the channels IT
 * supports to a pure render function. Adding a new notification later is
 * exactly this: a new `TemplateKey` + one renderer per channel it should
 * go out on - no other code changes needed (the queue worker, provider
 * registry, and logging path are all template-agnostic).
 */
const templates: Record<TemplateKey, Partial<Record<RenderableChannel, ChannelRenderer>>> = {
  OTP: {
    SMS: (data) => ({
      channel: 'SMS',
      text: `Your YouMart OTP is ${String(data.code)}. Valid for ${String(data.minutes)} minutes.`,
    }),
  },

  // WhatsApp side maps our data onto Vijesh's approved "youmart_order_confirmation"
  // template's components: body_1 = order number, body_2 = amount. No
  // header (no document/invoice URL available yet - optional, omitted).
  ORDER_CONFIRMATION: {
    WHATSAPP: (data) => ({
      channel: 'WHATSAPP',
      templateName: config.msg91WhatsappTemplate,
      namespace: config.msg91WhatsappNamespace,
      components: {
        body1: String(data.orderNumber),
        body2: `₹${String(data.amount)}`,
      },
    }),
    EMAIL: (data) => ({
      channel: 'EMAIL',
      subject: `Your YouMart order ${String(data.orderNumber)} is confirmed`,
      html: `<p>Hi,</p><p>Your order <strong>${String(data.orderNumber)}</strong> for <strong>₹${String(
        data.amount,
      )}</strong> is confirmed. We'll notify you again once it ships.</p><p>Thanks for shopping with YouMart.</p>`,
    }),
  },

  SHIPPING_UPDATE: {
    SMS: (data) => ({
      channel: 'SMS',
      text: `Your YouMart order ${String(data.orderNumber)} has shipped. Track: ${String(
        data.awb,
      )} via ${String(data.carrier)}.`,
    }),
    EMAIL: (data) => ({
      channel: 'EMAIL',
      subject: `Your YouMart order ${String(data.orderNumber)} has shipped`,
      html: `<p>Hi,</p><p>Your order <strong>${String(data.orderNumber)}</strong> has shipped via <strong>${String(
        data.carrier,
      )}</strong>. Tracking number: <strong>${String(data.awb)}</strong>.</p>`,
    }),
  },
};

export function renderTemplate(
  templateKey: string,
  channel: string,
  data: Record<string, unknown>,
): RenderedMessage {
  const def = templates[templateKey as TemplateKey];
  if (!def) {
    throw new Error(`Unknown notification template "${templateKey}"`);
  }
  const renderer = def[channel as RenderableChannel];
  if (!renderer) {
    throw new Error(`Template "${templateKey}" has no renderer for channel "${channel}"`);
  }
  return renderer(data);
}
