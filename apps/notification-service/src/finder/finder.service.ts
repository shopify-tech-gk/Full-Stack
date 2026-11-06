import { z } from 'zod';
import { AppError } from '@youmart/errors';
import { prisma } from '../db';
import { authClient, searchClient } from '../serviceClients';
import { logger } from '../logger';
import type { AssistantProduct } from '../assistant/shopping-tools';

// v1.18 Product Finder Live - a public "ask for a product" room, like a Telegram movie bot group:
// every shopper sees every question and the bot's reply to it, but shoppers can't talk to each
// other - a message can only be a product to look for (no links, numbers or chat), and the only
// voice that answers is the bot. Found: the matching products. Not found: "Request restock"
// (the existing product-request flow, so the asker hears when it's back).

/** Products shown under one reply (the rest are one tap away in search). */
const REPLY_PRODUCTS = 6;
const PER_MINUTE = 5;
const PER_DAY = 60;

export const FinderAskBody = z.object({
  text: z.string().trim().min(2, 'Type a product name').max(60, 'Keep it under 60 characters'),
});
export type FinderAskBody = z.infer<typeof FinderAskBody>;

export const FinderListQuery = z.object({
  /** Newer than this message (live updates). */
  after: z.string().uuid().optional(),
  /** Older than this message ("load earlier"). */
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(40),
});
export type FinderListQuery = z.infer<typeof FinderListQuery>;

export interface FinderMessageView {
  id: string;
  /** The asker's username ("vijay_07"); questions from before usernames show a masked name. */
  name: string;
  /** The viewer's own question. */
  mine: boolean;
  text: string;
  result: 'FOUND' | 'NOT_FOUND';
  found: number;
  products: AssistantProduct[];
  createdAt: string;
}

export interface FinderFeedView {
  items: FinderMessageView[];
  /** Questions asked today (the room's "live" counter). */
  todayCount: number;
}

// Shoppers can't reach each other: no links, phone numbers, e-mails, handles or chat words.
const CONTACT = [
  /https?:|www\.|\.(com|in|net|org|io|me|ly)\b/i,
  /\d[\d\s-]{8,}\d/,
  /\S+@\S+/,
  /(^|\s)@\w/,
  /\b(whatsapp|telegram|insta(gram)?|call me|dm me|message me|contact me|my number)\b/i,
];
const ABUSE =
  /\b(fuck|shit|bitch|bastard|asshole|dick|pussy|sex|porn|nude|madarchod|bhenchod|chutiya|gandu|randi|harami|lund)\w*/i;

function checkText(text: string): void {
  if (CONTACT.some((rx) => rx.test(text))) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      'Only product names here - links, numbers and contact details are not allowed.',
    );
  }
  if (ABUSE.test(text)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Please keep it to product names.');
  }
  if (!/[a-z]/i.test(text)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Type the product you are looking for.');
  }
}

/** v1.18 the room shows usernames - asking needs one ("vijay_07 asked for ..."). */
async function shownName(userId: string): Promise<string> {
  let username: string | null | undefined;
  try {
    username = (await authClient.getUserContact(userId)).username;
  } catch (err) {
    logger.warn({ err }, 'finder: could not read the shopper username');
    throw new AppError('INTERNAL_ERROR', 503, 'The room is busy. Please try again.');
  }
  if (!username) {
    throw new AppError(
      'FORBIDDEN',
      403,
      'Pick a username first - the room shows it with your question.',
    );
  }
  return username;
}

function toView(
  row: {
    id: string;
    userId: string;
    displayName: string;
    text: string;
    result: 'FOUND' | 'NOT_FOUND';
    found: number;
    products: unknown;
    createdAt: Date;
  },
  viewerId: string | null,
): FinderMessageView {
  return {
    id: row.id,
    name: row.displayName,
    mine: viewerId != null && row.userId === viewerId,
    text: row.text,
    result: row.result,
    found: row.found,
    products: Array.isArray(row.products) ? (row.products as AssistantProduct[]) : [],
    createdAt: row.createdAt.toISOString(),
  };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** The room: the latest questions (oldest first), newer ones (`after`) or earlier ones. */
export async function listFinder(
  viewerId: string | null,
  query: FinderListQuery,
): Promise<FinderFeedView> {
  const rows = query.after
    ? await prisma.finderQuery.findMany({
        where: { id: { gt: query.after } },
        orderBy: { id: 'asc' },
        take: query.limit,
      })
    : (
        await prisma.finderQuery.findMany({
          where: query.before ? { id: { lt: query.before } } : {},
          orderBy: { id: 'desc' },
          take: query.limit,
        })
      ).reverse();
  const todayCount = await prisma.finderQuery.count({
    where: { createdAt: { gte: startOfToday() } },
  });
  return { items: rows.map((r) => toView(r, viewerId)), todayCount };
}

/** A shopper asks; the bot searches the store and replies (both stored as one message). */
export async function askFinder(userId: string, body: FinderAskBody): Promise<FinderMessageView> {
  const text = body.text.replace(/\s+/g, ' ');
  checkText(text);
  const displayName = await shownName(userId);

  const [lastMinute, today] = await Promise.all([
    prisma.finderQuery.count({
      where: { userId, createdAt: { gte: new Date(Date.now() - 60_000) } },
    }),
    prisma.finderQuery.count({ where: { userId, createdAt: { gte: startOfToday() } } }),
  ]);
  if (lastMinute >= PER_MINUTE) {
    throw new AppError(
      'RATE_LIMITED',
      429,
      'You are asking quickly - wait a minute and try again.',
    );
  }
  if (today >= PER_DAY) {
    throw new AppError('RATE_LIMITED', 429, 'That is today’s limit - come back tomorrow.');
  }

  let found = 0;
  let products: AssistantProduct[] = [];
  try {
    // Like a movie bot: the product the shopper named, or "not found" - never look-alikes. A
    // misspelt long word ("prunning shears") gets one more try that forgives a typo.
    const strict = {
      q: text,
      strict: true,
      sort: 'relevance' as const,
      perPage: REPLY_PRODUCTS,
      page: 1,
    };
    let result = await searchClient.browse(strict);
    if (result.found === 0 && /[a-z]{7,}/i.test(text)) {
      result = await searchClient.browse({ ...strict, strictTypos: true });
    }
    found = result.found;
    products = result.items.map((item) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      price: item.price,
      mrp: item.mrp,
      imageUrl: item.imageUrl,
      category: item.category.name,
    }));
  } catch (err) {
    logger.error({ err }, 'finder: product search failed');
    throw new AppError(
      'INTERNAL_ERROR',
      503,
      'The bot could not search right now. Please try again.',
    );
  }

  const row = await prisma.finderQuery.create({
    data: {
      userId,
      displayName,
      text,
      result: products.length > 0 ? 'FOUND' : 'NOT_FOUND',
      found,
      products: products as unknown as object[],
    },
  });
  return toView(row, userId);
}
