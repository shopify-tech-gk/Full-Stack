import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { AppError } from '@youmart/errors';
import { getConnection } from '@youmart/queue';
import { config } from '../config';
import { logger } from '../logger';
import { orderClient } from '../serviceClients';
import { TicketTopic } from '../support/ticket.schema';
import {
  MAIN_CATEGORY_NAMES,
  categoryByTaxo,
  findCategories,
  searchProducts,
  type AssistantCategory,
  type AssistantProduct,
} from './shopping-tools';

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
  /** v1.17 cards under the reply: categories and products to tap into. */
  categories: AssistantCategory[];
  products: AssistantProduct[];
  /** v1.17 "not in stock - request a restock?" offer for this item; null = none. */
  restock: { item: string } | null;
  /** v1.17 tap-to-answer options when the AI asks a question (e.g. "Beach", "Hill station"). */
  quickReplies: string[];
}

const MAX_TOOL_ROUNDS = 6;
const MAX_CARDS = 8;
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
- Wishlist is called Favourites (bookmark icon). "Buy" on a product checks out just that item.
- Main categories: ${MAIN_CATEGORY_NAMES.join(', ')}.
`.trim();

function systemPrompt(signedIn: boolean, today: string): string {
  return `You are YouMart Assistant, the friendly help chat inside the YouMart shopping app and website (India). Today is ${today}.

${STORE_RULES}

HOW TO ANSWER
- Short, warm, plain English (Indian context, rupees as Rs or ₹). 1-4 short sentences or a few bullet points; no long essays. Use the customer's words.
- Only help with YouMart shopping: finding things to buy, orders, delivery, payments, coupons, returns/refunds, the wallet, the account and using the app/website. Politely decline anything else (coding, homework, news, other companies, opinions) in one sentence.
- CLARIFY BEFORE ANSWERING: if the question can't be answered well from what they said - it is vague, could mean different things, or the right answer depends on a detail they didn't give - ask ONE short clarifying question first instead of guessing, and offer the likely answers as quick_replies (via show_to_customer). Examples: "I want a phone" -> budget or main use; "delivery charge?" -> which city; "cancel my order" when they have several open orders -> which one; "is it good?" with no product named -> which product. If the question is already clear, answer straight away - don't ask for the sake of it, and never ask the same thing twice.

SHOPPING HELP (the most important part)
- ASK FIRST when an occasion is vague: if they mention a trip, party, gift, event or project without the details that change what they need, do NOT show products yet. Ask ONE short, friendly question (two at most) and offer 3-6 tap-to-answer options with show_to_customer quick_replies. Examples:
  - "I'm going on a vacation trip" -> ask where / what kind; quick_replies like ["Beach", "Hill station / cold place", "Abroad", "Road trip", "Pilgrimage"].
  - "I'm having a party" -> ask what kind; quick_replies like ["Birthday", "House party", "Kids' party", "Anniversary", "Office party"].
  - "Gift ideas" -> ask for whom; quick_replies like ["For him", "For her", "For kids", "For parents"].
  If they already gave enough detail ("a beach trip to Goa", "my son's 5th birthday"), or say "just show me", skip the question. Ask at most once per occasion - after they answer, recommend straight away. A budget question can be a quick reply too (e.g. "Under ₹2,000").
- When you know enough, think about what they will need, then:
  1. call find_categories with several specific keywords (e.g. for a trip: luggage, travel bags, sunscreen, sunglasses, power bank, neck pillow, toiletry kit);
  2. call search_products for the 2-4 most useful items (short queries like "backpack", "power bank");
  3. call show_to_customer ONCE with the best 3-8 categories and up to 8 products that really fit.
- In the text, give a short, friendly checklist (3-6 bullet points, a few words each) of what to get; the cards appear under your reply, so do not paste product lists, prices or links in the text and do not say "click here".
- Only show products that search_products actually returned, and only categories find_categories returned. Never invent products, prices or stock.
- If the customer asks for a specific product or brand and search_products finds nothing that matches (or only unrelated items), tell them plainly it is not available in our store right now, and call show_to_customer with restock_item set to what they wanted (a short name, e.g. "Bose QuietComfort headphones") - the app then offers a "Request restock" button that tells our team. Do not promise that the customer will be notified or that it will come back. You can still show close alternatives if search found them.
- Prices are in rupees; if they give a budget, pass it as max_price.
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
    name: 'find_categories',
    description:
      'Search the YouMart store categories (main categories, sub-categories and sub-to-sub categories) by keywords. Returns matching categories with their path ("taxo") - pass those taxo values to show_to_customer. Use several specific keywords at once.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['keywords'],
      properties: {
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Short product-type keywords, e.g. ["luggage", "sunscreen", "sunglasses"].',
        },
      },
    },
  },
  {
    name: 'search_products',
    description:
      'Search the real YouMart catalog for products. Returns up to 8 products (slug, title, price, MRP, category). An empty list means the store does not have it.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['query'],
      properties: {
        query: {
          type: 'string',
          description: 'A short search, e.g. "power bank" or "Samsung phone".',
        },
        max_price: { type: 'number', description: 'Optional budget in rupees.' },
      },
    },
  },
  {
    name: 'show_to_customer',
    description:
      'Show tappable things under your reply: store categories (by taxo from find_categories), products (by slug from search_products), a "Request restock" offer for an item the store does not have, and/or quick-reply options when you ask the customer a question. Call at most once per reply.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'taxo values from find_categories, most useful first (max 8).',
        },
        products: {
          type: 'array',
          items: { type: 'string' },
          description: 'product slugs from search_products, most useful first (max 8).',
        },
        restock_item: {
          type: 'string',
          description: 'Only when the requested product is not available: what they wanted.',
        },
        quick_replies: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Short tap-to-answer options for a question you are asking (2-6, a few words each, e.g. "Beach", "Hill station").',
        },
      },
    },
  },
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

const FindCategoriesInput = z.object({ keywords: z.array(z.string().max(60)).min(1).max(12) });
const SearchProductsInput = z.object({
  query: z.string().trim().min(1).max(100),
  max_price: z.number().positive().optional(),
});
const ShowInput = z.object({
  categories: z.array(z.string().max(200)).max(20).optional(),
  products: z.array(z.string().max(200)).max(20).optional(),
  restock_item: z.string().trim().min(2).max(200).optional(),
  quick_replies: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
});

/** What the tools collected during one reply: products seen in searches, and the chosen cards. */
interface TurnState {
  seen: Map<string, AssistantProduct>;
  categories: AssistantCategory[];
  products: AssistantProduct[];
  restock: { item: string } | null;
  quickReplies: string[];
  escalate: AssistantEscalation | null;
}

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

  const turn: TurnState = {
    seen: new Map(),
    categories: [],
    products: [],
    restock: null,
    quickReplies: [],
    escalate: null,
  };
  let reply = '';

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await anthropic().messages.create({
        model: config.assistantModel,
        max_tokens: 900,
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

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      // Keep the latest text: the model may write its answer alongside show_to_customer and then
      // finish with an empty turn.
      if (text) reply = text;

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
          content: await runTool(use, who.userId, turn),
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
    reply = turn.escalate
      ? "I can't solve this one myself, but our support team can. Please send it to them with the form below."
      : turn.categories.length || turn.products.length
        ? 'Here are some picks from our store:'
        : "Sorry, I couldn't work that out. Could you rephrase, or send it to our support team?";
  }
  return {
    reply,
    escalate: turn.escalate,
    remaining,
    categories: turn.categories,
    products: turn.products,
    restock: turn.restock,
    quickReplies: turn.quickReplies,
  };
}

async function runTool(
  use: Anthropic.ToolUseBlock,
  userId: string | null,
  turn: TurnState,
): Promise<string> {
  if (use.name === 'find_categories') {
    const parsed = FindCategoriesInput.safeParse(use.input);
    if (!parsed.success) return 'Invalid input: keywords (array of strings) is required.';
    return JSON.stringify({ categories: findCategories(parsed.data.keywords) });
  }
  if (use.name === 'search_products') {
    const parsed = SearchProductsInput.safeParse(use.input);
    if (!parsed.success) return 'Invalid input: query is required.';
    try {
      const products = await searchProducts(parsed.data.query, {
        maxPrice: parsed.data.max_price,
      });
      for (const p of products) turn.seen.set(p.slug, p);
      return JSON.stringify({
        products: products.map(({ slug, title, price, mrp, category }) => ({
          slug,
          title,
          price,
          mrp,
          category,
        })),
      });
    } catch {
      return JSON.stringify({ error: 'Product search is not available right now.' });
    }
  }
  if (use.name === 'show_to_customer') {
    const parsed = ShowInput.safeParse(use.input);
    if (!parsed.success) return 'Invalid input.';
    const cats = (parsed.data.categories ?? [])
      .map((taxo) => categoryByTaxo(taxo))
      .filter((c): c is AssistantCategory => c !== null);
    const prods = (parsed.data.products ?? [])
      .map((slug) => turn.seen.get(slug))
      .filter((p): p is AssistantProduct => p !== undefined);
    turn.categories = [...new Map(cats.map((c) => [c.taxo, c])).values()].slice(0, MAX_CARDS);
    turn.products = [...new Map(prods.map((p) => [p.slug, p])).values()].slice(0, MAX_CARDS);
    turn.restock = parsed.data.restock_item ? { item: parsed.data.restock_item } : null;
    turn.quickReplies = [...new Set(parsed.data.quick_replies ?? [])].slice(0, 6);
    return `Shown: ${turn.categories.length} categories, ${turn.products.length} products${
      turn.restock ? ', and a restock request button' : ''
    }${turn.quickReplies.length ? `, ${turn.quickReplies.length} quick replies` : ''}. Now write your short reply.`;
  }
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
    turn.escalate = {
      topic: parsed.data.topic,
      summary: parsed.data.summary,
      orderNumber: parsed.data.orderNumber ?? null,
    };
    return 'Done: the customer now sees a prefilled "Send to support" form below your reply.';
  }
  return `Unknown tool ${use.name}`;
}
