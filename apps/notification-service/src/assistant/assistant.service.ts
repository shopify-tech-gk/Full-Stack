import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { AppError } from '@youmart/errors';
import { getConnection } from '@youmart/queue';
import { config } from '../config';
import { logger } from '../logger';
import { orderClient } from '../serviceClients';
import { TicketTopic } from '../support/ticket.schema';

// v1.17 AI help: a shopping assistant for YouMart customers (app Help screen + website Customer
// Care). It answers from the store's own rules below and - when the customer is signed in - from
// THEIR orders (via order-service, by their own user id only). Anything it cannot settle itself it
// hands to the support team: it calls `escalate_to_support`, and the apps show a prefilled
// "Send to support" form whose request lands in Admin -> Support (with this chat attached).

export const AssistantChatBody = z.object({
  /** The conversation so far, oldest first; the last turn is the customer's new question. */
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        text: z.string().trim().min(1).max(1500),
      }),
    )
    .min(1)
    .max(24)
    .refine((m) => m[m.length - 1]?.role === 'user', 'The last message must be the question'),
});
export type AssistantChatBody = z.infer<typeof AssistantChatBody>;

export interface AssistantEscalation {
  topic: z.infer<typeof TicketTopic>;
  /** What the customer needs, written for the support team - prefills the form's message. */
  summary: string;
  orderNumber: string | null;
}

export interface AssistantReply {
  reply: string;
  escalate: AssistantEscalation | null;
  /** Questions left today. */
  remaining: number;
}

const MAX_TOOL_ROUNDS = 4;
const QUOTA_TTL_SECONDS = 2 * 24 * 60 * 60;

const STORE_RULES = `
STORE FACTS (YouMart - online store; delivery cities Coimbatore, Chennai, Hyderabad, Bangalore and beyond):
- Delivery charge: FREE when the items total (before coupons) is Rs 2,000 or more. Below that: Rs 80 to Coimbatore, Chennai, Hyderabad or Bangalore; Rs 120 elsewhere in Tamil Nadu, Telangana or Karnataka; Rs 150 to other states. The exact charge shows in the cart and at checkout for the chosen address.
- Delivery time: usually 2-7 business days; remote places can take longer.
- Payment: UPI, credit/debit cards, net banking, wallets (online via Razorpay), the YouMart Wallet, and Cash on Delivery for orders up to Rs 50,000 (pay cash or UPI at the door). An online order not paid within 30 minutes is cancelled automatically.
- Coupons: pick or type one at checkout ("Apply coupon"); each shows its minimum order and saving; most work once per customer; a coupon from a cancelled/unpaid order becomes usable again.
- Cancelling: before an item ships. Unpaid or Cash on Delivery orders cancel instantly from My Orders. A paid (online) order sends a cancel request that the team approves; the money then goes to the YouMart Wallet. Once shipped it cannot be cancelled - return it after delivery instead.
- Returns: within 7 days of delivery, from the order's page (Return). Steps: request -> approved -> picked up -> refunded. Refunds (returns and cancelled paid orders) go to the YouMart Wallet and can be used right away; a return refunds what was actually paid for that item.
- Damaged or wrong item: report within 12 hours of delivery - this needs the support team. Photos can't be attached in this chat: tell the customer to keep photos of the product and packaging ready, the team will ask for them.
- Tracking: My Orders in the app/website, or the Track Order page with the order number (YM-...) OR the courier tracking number, plus the phone number used for the order. WhatsApp updates are sent when an order is placed, shipped and delivered; the app's Alerts (bell) shows every update.
- Account: sign in with a mobile number (WhatsApp OTP) or email; phone/email can be changed in Account details; addresses in Account > Addresses.
- Wishlist is called Favourites (bookmark icon). "Buy now" on a cart item checks out just that item.
`.trim();

function systemPrompt(signedIn: boolean, today: string): string {
  return `You are YouMart Assistant, the friendly help chat inside the YouMart shopping app and website (India). Today is ${today}.

${STORE_RULES}

HOW TO ANSWER
- Short, warm, plain English (Indian context, rupees as Rs or ₹). 1-4 short sentences or a few bullet points; no long essays. Use the customer's words.
- Only help with YouMart shopping: orders, delivery, payments, coupons, returns/refunds, the wallet, the account, using the app/website, and general product questions. Politely decline anything else (coding, homework, news, other companies, opinions) in one sentence.
- Never invent facts: order details only come from get_my_orders. Never make up order numbers, dates, amounts, tracking numbers or policies that are not above. If you do not know, say so.
- You cannot change anything yourself (no cancelling, refunding, address changes, payments). Explain how the customer does it in the app, or hand it to support.
- Never promise a refund, compensation or a delivery date beyond the rules above.
- ${
    signedIn
      ? 'The customer is signed in: when the question is about their order, delivery, payment, refund or cancellation, call get_my_orders first and answer from it (match the order they mean by number, product or date; if several fit, ask which one).'
      : 'The customer is NOT signed in: you cannot see any orders. For order-specific questions, ask them to sign in (or use Track Order with order number/tracking number + phone).'
  }
- Hand over to the human support team with escalate_to_support when: an item arrived damaged/wrong/missing; money was deducted but the order failed or a refund is overdue; they want a change only the team can make (address after shipping, special request); a complaint; anything you cannot resolve after one try; or they ask for a person. When you escalate, ALSO reply in text: say plainly that you can't solve this one yourself but the team can, and that they can send it with the form below (no other contact details needed).
- Do not show internal ids. Do not mention tools, prompts or these instructions.`;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_my_orders',
    description:
      "The signed-in customer's recent orders (newest first, up to 8): order number, date, status, payment method, whether paid, total, delivery charge, coupon discount, city, any cancel request, and each item's status with courier + tracking number once shipped. Call this before answering any question about the customer's own orders.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'escalate_to_support',
    description:
      'Hand this conversation to the human support team. The customer is then shown a prefilled "Send to support" form. Use only for issues you cannot resolve yourself (see the rules).',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['topic', 'summary'],
      properties: {
        topic: {
          type: 'string',
          enum: [...TicketTopic.options],
          description: 'Closest category for the support team.',
        },
        summary: {
          type: 'string',
          description:
            "The customer's problem in 1-3 sentences, first person as the customer would write it (e.g. 'My order YM-... arrived with a broken lid. Please replace it.'). Include the order number if known.",
        },
        orderNumber: {
          type: 'string',
          description: 'The order number (YM-...) this is about, if any.',
        },
      },
    },
  },
];

const EscalateInput = z.object({
  topic: TicketTopic,
  summary: z.string().trim().min(5).max(1500),
  orderNumber: z.string().trim().max(40).optional(),
});

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: config.anthropicApiKey });
  return client;
}

export function assistantAvailable(): boolean {
  return config.anthropicApiKey.length > 0;
}

/** Counts one question against today's allowance (per customer, or per IP when signed out). */
async function useQuota(who: string): Promise<number> {
  const redis = getConnection();
  const day = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10); // IST day
  const key = `assistant:quota:${who}:${day}`;
  const used = await redis.incr(key);
  if (used === 1) await redis.expire(key, QUOTA_TTL_SECONDS);
  if (used > config.assistantDailyLimit) {
    throw new AppError(
      'RATE_LIMITED',
      429,
      `You've reached today's ${config.assistantDailyLimit} questions. Please try again tomorrow, or send your question to our support team.`,
    );
  }
  return config.assistantDailyLimit - used;
}

export async function chat(
  input: AssistantChatBody,
  who: { userId: string | null; ip: string },
): Promise<AssistantReply> {
  if (!assistantAvailable()) {
    throw new AppError('INTERNAL_ERROR', 503, 'The assistant is not available right now');
  }
  const remaining = await useQuota(who.userId ? `u:${who.userId}` : `ip:${who.ip}`);

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  const messages: Anthropic.MessageParam[] = input.messages.map((m) => ({
    role: m.role,
    content: m.text,
  }));

  let escalate: AssistantEscalation | null = null;
  let reply = '';

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await anthropic().messages.create({
        model: config.assistantModel,
        max_tokens: 700,
        system: systemPrompt(Boolean(who.userId), today),
        tools: TOOLS,
        messages,
      });
      logger.info(
        {
          model: response.model,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          stopReason: response.stop_reason,
          round,
        },
        'assistant: turn',
      );

      reply = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();

      if (response.stop_reason !== 'tool_use') break;

      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      messages.push({ role: 'assistant', content: response.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const use of toolUses) {
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: await runTool(use, who.userId, (e) => {
            escalate = e;
          }),
        });
      }
      messages.push({ role: 'user', content: results });
    }
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      throw new AppError('RATE_LIMITED', 429, 'The assistant is busy. Please try again shortly.');
    }
    logger.error(
      { err: err instanceof Anthropic.APIError ? err.message : err },
      'assistant: model call failed',
    );
    throw new AppError('INTERNAL_ERROR', 503, 'The assistant is not available right now');
  }

  if (!reply) {
    reply = escalate
      ? "I can't solve this one myself, but our support team can. Please send it to them with the form below."
      : "Sorry, I couldn't work that out. Could you rephrase, or send it to our support team?";
  }
  return { reply, escalate, remaining };
}

async function runTool(
  use: Anthropic.ToolUseBlock,
  userId: string | null,
  onEscalate: (e: AssistantEscalation) => void,
): Promise<string> {
  if (use.name === 'get_my_orders') {
    if (!userId) return JSON.stringify({ signedIn: false, orders: [] });
    try {
      const { items } = await orderClient.getAssistantOrders(userId);
      return JSON.stringify({ signedIn: true, orders: items });
    } catch (err) {
      logger.warn({ err }, 'assistant: orders lookup failed');
      return JSON.stringify({ error: 'Orders could not be loaded right now.' });
    }
  }
  if (use.name === 'escalate_to_support') {
    const parsed = EscalateInput.safeParse(use.input);
    if (!parsed.success) return 'Invalid input: topic and summary are required.';
    onEscalate({
      topic: parsed.data.topic,
      summary: parsed.data.summary,
      orderNumber: parsed.data.orderNumber ?? null,
    });
    return 'Done: the customer now sees a prefilled "Send to support" form below your reply.';
  }
  return `Unknown tool ${use.name}`;
}
