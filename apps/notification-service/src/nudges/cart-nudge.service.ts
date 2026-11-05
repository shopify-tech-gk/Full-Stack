import { z } from 'zod';
import { enqueueNotification } from '@youmart/notifications-client';
import { prisma } from '../db';
import { config } from '../config';
import { logger } from '../logger';
import { authClient, cartClient, catalogClient } from '../serviceClients';
import { addInboxMessage } from '../inbox/inbox.service';

// v1.18 "Still in your cart" (Shapermen-style): the customer opened checkout and left without
// ordering. An hour later - if no order was placed since - one WhatsApp with the product photo,
// their name, the item and its price (+ an Alert and an email). At most one per customer per
// CART_NUDGE_COOLDOWN_HOURS. Two kinds:
//   - CART: they checked out their cart -> about what is still in it; "Shop now" opens the cart.
//   - BUY_NOW: they used Buy Now on a product (it leaves the cart again when they back out) ->
//     about that product; "Shop now" opens its page.

export const CheckoutStartedBody = z.object({
  source: z.enum(['CART', 'BUY_NOW']).default('CART'),
  skuIds: z.array(z.string().uuid()).max(50).default([]),
});
export type CheckoutStartedBody = z.infer<typeof CheckoutStartedBody>;

/** Checkouts older than this are let go (no nudge days later, e.g. after the service was down). */
const GIVE_UP_MS = 2 * 86_400_000;

/** The app tells us when a signed-in customer opens checkout. */
export async function checkoutStarted(
  userId: string,
  body: CheckoutStartedBody = { source: 'CART', skuIds: [] },
): Promise<void> {
  const now = new Date();
  const what = { source: body.source, skuIds: body.skuIds };
  await prisma.checkoutNudge.upsert({
    where: { userId },
    create: { userId, startedAt: now, ...what },
    update: { startedAt: now, orderedAt: null, ...what },
  });
}

/** An order was placed: nothing to nudge about. Best-effort. */
export async function orderPlaced(userId: string): Promise<void> {
  await prisma.checkoutNudge.updateMany({ where: { userId }, data: { orderedAt: new Date() } });
}

/**
 * WhatsApp image headers take only JPEG / PNG, and our product photos are WebP: those go through
 * wsrv.nl (a free public image CDN) as an 800px JPEG. The photos are public already.
 */
export function jpegPhoto(url: string): string {
  if (!/\.webp(\?|$)/i.test(url)) return url;
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=jpg&w=800&q=85`;
}

/** "499.00" -> "499", "499.50" -> "499.50". */
const price = (money: string) => (money.endsWith('.00') ? money.slice(0, -3) : money);

type Row = { userId: string; startedAt: Date; orderedAt: Date | null; lastSentAt: Date | null };
type Pick = { title: string; price: string; slug: string; moreItems: number };

/** Buy Now: the product they were buying (null when it's gone from the catalog). */
async function buyNowPick(skuIds: string[]): Promise<Pick | null> {
  const skuId = skuIds[0];
  if (!skuId) return null;
  const sku = await catalogClient.getSku(skuId).catch(() => null);
  if (!sku?.active) return null;
  return { title: sku.title, price: sku.sellingPrice, slug: sku.productSlug, moreItems: 0 };
}

/** Cart: the first thing still in it (null when it's empty). */
async function cartPick(userId: string): Promise<Pick | null> {
  const cart = await cartClient.getMyCart(userId);
  const first = cart.items[0];
  if (!first) return null;
  return {
    title: first.title,
    price: first.priceSnapshot,
    slug: first.productSlug,
    moreItems: cart.items.length - 1,
  };
}

/** Due: left checkout long enough ago, didn't order since, and not nudged recently. */
export function isDue(row: Row, now: Date): boolean {
  const since = now.getTime() - row.startedAt.getTime();
  if (since < config.cartNudgeDelayMinutes * 60_000 || since > GIVE_UP_MS) return false;
  if (row.orderedAt && row.orderedAt >= row.startedAt) return false;
  if (!row.lastSentAt) return true;
  return (
    row.lastSentAt < row.startedAt &&
    now.getTime() - row.lastSentAt.getTime() >= config.cartNudgeCooldownHours * 3_600_000
  );
}

async function sendOne(row: {
  userId: string;
  source: string;
  skuIds: string[];
}): Promise<boolean> {
  const { userId } = row;
  const buyNow = row.source === 'BUY_NOW';
  const pick = buyNow ? await buyNowPick(row.skuIds) : await cartPick(userId);
  if (!pick) return false;
  const [product, contact] = await Promise.all([
    catalogClient.getProductBySlug(pick.slug).catch(() => null),
    authClient.getUserContact(userId).catch(() => null),
  ]);
  const image = product?.images.slice().sort((a, b) => a.position - b.position)[0]?.url;
  const productPath = `/product/${pick.slug}`;
  const data = {
    customerName: contact?.name?.trim().split(/\s+/)[0] || 'there',
    title: pick.title,
    price: price(pick.price),
    moreItems: pick.moreItems,
    buyNow,
    imageUrl: image ?? null,
    // For WhatsApp + email (JPEG); the in-app Alert uses imageUrl.
    photoUrl: image ? jpegPhoto(image) : null,
    link: buyNow ? productPath : '/my-cart',
    webLink: buyNow ? productPath : '/cart',
    // The WhatsApp "Shop now" button: https://youmart.in/{{1}}
    urlPath: buyNow ? productPath.slice(1) : 'cart',
  };
  await addInboxMessage(userId, 'CART_NUDGE', data);
  if (contact?.phone) {
    await enqueueNotification({
      channel: 'WHATSAPP',
      to: contact.phone,
      userId,
      templateKey: 'CART_NUDGE',
      data,
    });
  }
  if (contact?.email) {
    await enqueueNotification({
      channel: 'EMAIL',
      to: contact.email,
      userId,
      templateKey: 'CART_NUDGE',
      data,
    });
  }
  return true;
}

/** Sends every nudge that is due; each is claimed first so it never goes twice. */
export async function sendDueNudges(now = new Date()): Promise<number> {
  const candidates = await prisma.checkoutNudge.findMany({
    where: {
      startedAt: {
        lte: new Date(now.getTime() - config.cartNudgeDelayMinutes * 60_000),
        gte: new Date(now.getTime() - GIVE_UP_MS),
      },
    },
    take: 200,
  });
  let sent = 0;
  for (const row of candidates) {
    if (!isDue(row, now)) continue;
    const claim = await prisma.checkoutNudge.updateMany({
      where: { userId: row.userId, lastSentAt: row.lastSentAt, startedAt: row.startedAt },
      data: { lastSentAt: now },
    });
    if (claim.count === 0) continue;
    try {
      if (await sendOne(row)) sent += 1;
      else {
        // Cart already empty / product gone: nothing was nudged - don't use up the day's nudge.
        await prisma.checkoutNudge.updateMany({
          where: { userId: row.userId, lastSentAt: now },
          data: { lastSentAt: row.lastSentAt, orderedAt: now },
        });
      }
    } catch (err) {
      logger.warn({ err, userId: row.userId }, 'cart nudge: could not send');
    }
  }
  return sent;
}

let timer: NodeJS.Timeout | undefined;
let running = false;

/** Checks for due nudges every minute. */
export function startCartNudgeScheduler(): void {
  const tick = () => {
    if (running) return;
    running = true;
    sendDueNudges()
      .then((n) => {
        if (n > 0) logger.info({ sent: n }, 'cart nudges sent');
      })
      .catch((err: unknown) => logger.error({ err }, 'cart nudge tick failed'))
      .finally(() => {
        running = false;
      });
  };
  tick();
  timer = setInterval(tick, 60_000);
}

export function stopCartNudgeScheduler(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
