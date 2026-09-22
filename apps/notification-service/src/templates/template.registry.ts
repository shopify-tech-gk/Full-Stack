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
 *
 * Ch6.2b channel decision (Vijesh, locked): WhatsApp + email only. SMS is
 * DROPPED as an active routing target for every template below -
 * Msg91SmsProvider itself stays registered (providers/registry.ts) for a
 * possible future fallback, but since no renderer here ever produces a
 * `channel: 'SMS'` RenderedMessage, `renderTemplate` can never resolve to
 * it - the safest way to guarantee "nothing routes to SMS" (a job that
 * somehow specified channel SMS would hit the "no renderer" error path
 * below, not a real send).
 */
const templates: Record<TemplateKey, Partial<Record<RenderableChannel, ChannelRenderer>>> = {
  // WhatsApp OTP REQUIRES a separate, pre-approved AUTHENTICATION-category
  // template (MSG91_WHATSAPP_OTP_TEMPLATE) - order/marketing templates
  // (like the order-confirmation one) cannot carry an OTP; Meta rejects
  // it. `body1` + `button1` both carry the SAME code value: the body text
  // variable and the "copy code" quick-reply button's payload
  // respectively - the standard Meta/MSG91 auth-template shape. Until
  // Vijesh creates + gets this template approved, sends here fail
  // honestly (template not found) - see providers/msg91-whatsapp.provider.ts.
  // EMAIL is the login-safety fallback leg (see notification.service.ts) -
  // never used as this template's PRIMARY channel, only invoked directly
  // by the fallback path once the WhatsApp leg exhausts its retries.
  OTP: {
    WHATSAPP: (data) => ({
      channel: 'WHATSAPP',
      templateName: config.msg91WhatsappOtpTemplate,
      namespace: config.msg91WhatsappOtpNamespace,
      components: {
        body1: String(data.code),
        button1: String(data.code),
      },
    }),
    EMAIL: (data) => ({
      channel: 'EMAIL',
      subject: 'Your YouMart login code',
      html: `<p>Your YouMart OTP is <strong>${String(data.code)}</strong>. Valid for ${String(
        data.minutes,
      )} minutes.</p><p>If you didn't request this, you can ignore this email.</p>`,
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
    // No shipping-specific WhatsApp template is approved yet
    // (MSG91_WHATSAPP_SHIPPING_TEMPLATE unset) - reusing the
    // order-confirmation template's fixed wording for a shipped-item
    // message would be misleading, so this deliberately throws a clear,
    // permanent (non-retried, see notification.service.ts) error instead
    // of sending a wrong-content WhatsApp message. EMAIL is the reliable
    // leg until Vijesh approves a dedicated shipping template.
    WHATSAPP: (data) => {
      if (!config.msg91WhatsappShippingTemplate) {
        throw new Error(
          'No approved WhatsApp template configured for shipping updates yet ' +
            '(MSG91_WHATSAPP_SHIPPING_TEMPLATE) - set it once Vijesh approves one; EMAIL is the reliable leg meanwhile.',
        );
      }
      return {
        channel: 'WHATSAPP',
        templateName: config.msg91WhatsappShippingTemplate,
        namespace: config.msg91WhatsappNamespace,
        components: {
          body1: String(data.orderNumber),
          body2: `${String(data.carrier)} - ${String(data.awb)}`,
        },
      };
    },
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
