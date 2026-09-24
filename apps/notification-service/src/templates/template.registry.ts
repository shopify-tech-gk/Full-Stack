import { config } from '../config';
import type { RenderedMessage } from '../providers/provider.interface';

export type TemplateKey =
  'OTP' | 'ORDER_PLACED' | 'ORDER_SHIPPED' | 'ORDER_DELIVERED' | 'REFUND_PROCESSED';
type RenderableChannel = 'SMS' | 'WHATSAPP' | 'EMAIL';

type ChannelRenderer = (data: Record<string, unknown>) => RenderedMessage;

/**
 * One entry per notification event; each entry maps the channels IT
 * supports to a pure render function. Adding a new notification later is
 * exactly this: a new `TemplateKey` + one renderer per channel it should
 * go out on - no other code changes needed (the queue worker, provider
 * registry, and logging path are all template-agnostic).
 *
 * Ch6.2c: aligned to the 5 FINAL MSG91 WhatsApp templates Vijesh created
 * (the old single "youmart_order_confirmation" template is DELETED - no
 * code below references it). Every WhatsApp template NAME comes from env
 * (a rename is an env change, never a code change) - see config.ts.
 *
 * Ch6.2b channel decision (still locked): WhatsApp + email only. SMS is
 * DROPPED as an active routing target for every template below -
 * Msg91SmsProvider itself stays registered (providers/registry.ts) for a
 * possible future fallback, but since no renderer here ever produces a
 * `channel: 'SMS'` RenderedMessage, `renderTemplate` can never resolve to
 * it - the safest way to guarantee "nothing routes to SMS".
 *
 * WHATSAPP PARAM ORDER (critical - must exactly match each MSG91 template's
 * {{1}},{{2}},... or the customer sees wrong data in the wrong slot):
 *   OTP ("youmart_login_otp", AUTHENTICATION): {{1}}=code
 *   ORDER_PLACED ("youmart_order_placed", UTILITY): {{1}}=customerName, {{2}}=orderNumber, {{3}}=amount
 *   ORDER_SHIPPED ("youmart_order_shipped", UTILITY): {{1}}=customerName, {{2}}=orderNumber, {{3}}=awb, {{4}}=carrier
 *   ORDER_DELIVERED ("youmart_order_delivered", UTILITY): {{1}}=customerName, {{2}}=orderNumber
 *   REFUND_PROCESSED ("youmart_refund_processed", UTILITY): {{1}}=customerName, {{2}}=amount, {{3}}=orderNumber
 *
 * `amount` is always passed as the bare numeric value (e.g. "999.00") -
 * every template's own approved text already contains the literal "Rs "
 * before {{n}}, so prefixing it here would double it ("Rs Rs 999.00").
 */
const templates: Record<TemplateKey, Partial<Record<RenderableChannel, ChannelRenderer>>> = {
  // AUTHENTICATION category - MSG91/Meta requires a SEPARATE approved
  // template from any UTILITY template; the code is the ONLY body param
  // AND the "copy code" button's payload (Meta requires both to carry the
  // identical value). EMAIL is the login-safety fallback leg only (see
  // notification.service.ts) - never this template's primary channel.
  OTP: {
    WHATSAPP: (data) => ({
      channel: 'WHATSAPP',
      templateName: config.msg91WhatsappOtpTemplate,
      namespace: config.msg91WhatsappOtpNamespace,
      category: 'AUTHENTICATION',
      components: {
        bodyParams: [String(data.code)],
        authButtonCode: String(data.code),
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

  // "youmart_order_placed": "Hi {{1}}, thank you for your order! Your
  // order {{2}} is confirmed. Total: Rs {{3}}. We'll let you know when it
  // ships." - {{1}}=customerName, {{2}}=orderNumber, {{3}}=amount.
  ORDER_PLACED: {
    WHATSAPP: (data) => ({
      channel: 'WHATSAPP',
      templateName: config.msg91WhatsappOrderPlacedTemplate,
      namespace: config.msg91WhatsappNamespace,
      category: 'UTILITY',
      components: {
        bodyParams: [String(data.customerName), String(data.orderNumber), String(data.amount)],
      },
    }),
    EMAIL: (data) => ({
      channel: 'EMAIL',
      subject: `Your YouMart order ${String(data.orderNumber)} is confirmed`,
      html: `<p>Hi ${String(data.customerName)},</p><p>Thank you for your order! Your order <strong>${String(
        data.orderNumber,
      )}</strong> is confirmed. Total: Rs ${String(
        data.amount,
      )}.</p><p>We'll let you know when it ships.</p>`,
    }),
  },

  // "youmart_order_shipped": "Hi {{1}}, your YouMart order {{2}} has
  // shipped! Track it with AWB {{3}} via {{4}}." - {{1}}=customerName,
  // {{2}}=orderNumber, {{3}}=awb, {{4}}=carrier.
  ORDER_SHIPPED: {
    WHATSAPP: (data) => ({
      channel: 'WHATSAPP',
      templateName: config.msg91WhatsappOrderShippedTemplate,
      namespace: config.msg91WhatsappNamespace,
      category: 'UTILITY',
      components: {
        bodyParams: [
          String(data.customerName),
          String(data.orderNumber),
          String(data.awb),
          String(data.carrier),
        ],
      },
    }),
    EMAIL: (data) => ({
      channel: 'EMAIL',
      subject: `Your YouMart order ${String(data.orderNumber)} has shipped`,
      html: `<p>Hi ${String(data.customerName)},</p><p>Your YouMart order <strong>${String(
        data.orderNumber,
      )}</strong> has shipped! Track it with AWB <strong>${String(data.awb)}</strong> via <strong>${String(
        data.carrier,
      )}</strong>.</p>`,
    }),
  },

  // "youmart_order_delivered": "Hi {{1}}, your YouMart order {{2}} has
  // been delivered. Thank you for shopping with us!" - {{1}}=customerName,
  // {{2}}=orderNumber.
  ORDER_DELIVERED: {
    WHATSAPP: (data) => ({
      channel: 'WHATSAPP',
      templateName: config.msg91WhatsappOrderDeliveredTemplate,
      namespace: config.msg91WhatsappNamespace,
      category: 'UTILITY',
      components: {
        bodyParams: [String(data.customerName), String(data.orderNumber)],
      },
    }),
    EMAIL: (data) => ({
      channel: 'EMAIL',
      subject: `Your YouMart order ${String(data.orderNumber)} has been delivered`,
      html: `<p>Hi ${String(data.customerName)},</p><p>Your YouMart order <strong>${String(
        data.orderNumber,
      )}</strong> has been delivered. Thank you for shopping with us!</p>`,
    }),
  },

  // "youmart_refund_processed": "Hi {{1}}, your refund of Rs {{2}} for
  // order {{3}} has been processed. It will reflect in 5-7 business
  // days." - {{1}}=customerName, {{2}}=amount, {{3}}=orderNumber.
  REFUND_PROCESSED: {
    WHATSAPP: (data) => ({
      channel: 'WHATSAPP',
      templateName: config.msg91WhatsappRefundTemplate,
      namespace: config.msg91WhatsappNamespace,
      category: 'UTILITY',
      components: {
        bodyParams: [String(data.customerName), String(data.amount), String(data.orderNumber)],
      },
    }),
    EMAIL: (data) => ({
      channel: 'EMAIL',
      subject: `Your refund for order ${String(data.orderNumber)} has been processed`,
      html: `<p>Hi ${String(data.customerName)},</p><p>Your refund of Rs ${String(
        data.amount,
      )} for order <strong>${String(
        data.orderNumber,
      )}</strong> has been processed. It will reflect in 5-7 business days.</p>`,
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
