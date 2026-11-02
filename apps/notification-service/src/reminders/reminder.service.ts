import { z } from 'zod';
import { AppError } from '@youmart/errors';
import { enqueueNotification } from '@youmart/notifications-client';
import { prisma } from '../db';
import { logger } from '../logger';
import { authClient, catalogClient } from '../serviceClients';
import { addInboxMessage } from '../inbox/inbox.service';

// v1.18 "Remind me to buy": the customer picks a product and a date/time ("payday", "Saturday
// morning", "every month" for refills). When it is due the customer gets a WhatsApp, an email and
// an in-app Alert with the product and its price then - including how much it dropped since.

/** At most this many upcoming reminders per customer. */
const MAX_UPCOMING = 30;
const MIN_LEAD_MS = 60_000;
const MAX_AHEAD_MS = 366 * 86_400_000;

export const ReminderRepeat = z.enum(['NONE', 'WEEKLY', 'MONTHLY']);

const RemindAt = z
  .string()
  .datetime({ offset: true })
  .transform((v) => new Date(v));

export const CreateReminderBody = z.object({
  skuId: z.string().uuid(),
  imageUrl: z.string().url().max(500).optional(),
  remindAt: RemindAt,
  repeat: ReminderRepeat.default('NONE'),
  note: z.string().trim().max(80).optional(),
});
export type CreateReminderBody = z.infer<typeof CreateReminderBody>;

export const UpdateReminderBody = z.object({
  remindAt: RemindAt.optional(),
  repeat: ReminderRepeat.optional(),
  note: z.string().trim().max(80).nullable().optional(),
});
export type UpdateReminderBody = z.infer<typeof UpdateReminderBody>;

export const ListRemindersQuery = z.object({
  when: z.enum(['upcoming', 'past']).default('upcoming'),
});

export interface ReminderView {
  reminderId: string;
  productId: string;
  skuId: string | null;
  title: string;
  slug: string;
  imageUrl: string | null;
  priceAtSet: string | null;
  note: string | null;
  remindAt: string;
  repeat: z.infer<typeof ReminderRepeat>;
  status: 'SCHEDULED' | 'SENT' | 'CANCELLED';
  sentCount: number;
  lastSentAt: string | null;
  createdAt: string;
}

type Row = Awaited<ReturnType<typeof prisma.buyReminder.findFirstOrThrow>>;

const toView = (r: Row): ReminderView => ({
  reminderId: r.id,
  productId: r.productId,
  skuId: r.skuId,
  title: r.title,
  slug: r.slug,
  imageUrl: r.imageUrl,
  priceAtSet: r.priceAtSet?.toFixed(2) ?? null,
  note: r.note,
  remindAt: r.remindAt.toISOString(),
  repeat: r.repeat,
  status: r.status,
  sentCount: r.sentCount,
  lastSentAt: r.lastSentAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
});

function checkTime(at: Date): void {
  const lead = at.getTime() - Date.now();
  if (lead < MIN_LEAD_MS) {
    throw new AppError('VALIDATION_ERROR', 400, 'Pick a time at least a minute from now');
  }
  if (lead > MAX_AHEAD_MS) {
    throw new AppError('VALIDATION_ERROR', 400, 'Pick a time within the next year');
  }
}

/** Creates the reminder - or, when this variant already has an upcoming one, moves it. Each
 * variant (pack size / option) has its own reminder. */
export async function createReminder(
  userId: string,
  body: CreateReminderBody,
): Promise<ReminderView> {
  checkTime(body.remindAt);
  const sku = await catalogClient.getSku(body.skuId).catch(() => null);
  if (!sku) throw new AppError('NOT_FOUND', 404, 'Product not found');

  const existing = await prisma.buyReminder.findFirst({
    where: { userId, skuId: sku.skuId, status: 'SCHEDULED' },
  });
  const data = {
    skuId: sku.skuId,
    title: sku.title,
    slug: sku.productSlug,
    imageUrl: body.imageUrl ?? existing?.imageUrl ?? null,
    priceAtSet: sku.sellingPrice,
    note: body.note || null,
    remindAt: body.remindAt,
    repeat: body.repeat,
  };
  if (existing) {
    return toView(await prisma.buyReminder.update({ where: { id: existing.id }, data }));
  }
  const upcoming = await prisma.buyReminder.count({ where: { userId, status: 'SCHEDULED' } });
  if (upcoming >= MAX_UPCOMING) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      `You can have up to ${MAX_UPCOMING} reminders. Remove one to add another.`,
    );
  }
  return toView(
    await prisma.buyReminder.create({ data: { userId, productId: sku.productId, ...data } }),
  );
}

export async function listReminders(
  userId: string,
  when: 'upcoming' | 'past',
): Promise<{ items: ReminderView[] }> {
  const rows = await prisma.buyReminder.findMany({
    where: when === 'upcoming' ? { userId, status: 'SCHEDULED' } : { userId, status: 'SENT' },
    orderBy: when === 'upcoming' ? { remindAt: 'asc' } : { lastSentAt: 'desc' },
    take: 100,
  });
  return { items: rows.map(toView) };
}

/** A product's upcoming reminders, one per variant (the product page shows the one for the
 * option picked). */
export async function remindersForProduct(
  userId: string,
  productId: string,
): Promise<{ items: ReminderView[] }> {
  const rows = await prisma.buyReminder.findMany({
    where: { userId, productId, status: 'SCHEDULED' },
    orderBy: { remindAt: 'asc' },
  });
  return { items: rows.map(toView) };
}

async function own(userId: string, id: string): Promise<Row> {
  const row = await prisma.buyReminder.findFirst({ where: { id, userId } });
  if (!row) throw new AppError('NOT_FOUND', 404, 'Reminder not found');
  return row;
}

/** Change the time / repeat / note. A reminder that already went off is scheduled again
 * ("remind me again tomorrow"). */
export async function updateReminder(
  userId: string,
  id: string,
  body: UpdateReminderBody,
): Promise<ReminderView> {
  const row = await own(userId, id);
  if (body.remindAt) checkTime(body.remindAt);
  else if (row.status !== 'SCHEDULED' || row.remindAt.getTime() <= Date.now()) {
    throw new AppError('VALIDATION_ERROR', 400, 'Pick a new time for this reminder');
  }
  if (row.status !== 'SCHEDULED') {
    const other = await prisma.buyReminder.findFirst({
      where: {
        userId,
        ...(row.skuId ? { skuId: row.skuId } : { productId: row.productId }),
        status: 'SCHEDULED',
        NOT: { id },
      },
    });
    if (other) await prisma.buyReminder.delete({ where: { id: other.id } });
  }
  return toView(
    await prisma.buyReminder.update({
      where: { id },
      data: {
        ...(body.remindAt ? { remindAt: body.remindAt } : {}),
        ...(body.repeat ? { repeat: body.repeat } : {}),
        ...(body.note !== undefined ? { note: body.note || null } : {}),
        status: 'SCHEDULED',
      },
    }),
  );
}

export async function deleteReminder(userId: string, id: string): Promise<void> {
  await own(userId, id);
  await prisma.buyReminder.delete({ where: { id } });
}

// ---------------------------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------------------------

/** The next time a repeating reminder goes off - always in the future (missed ones are skipped). */
export function nextOccurrence(from: Date, repeat: 'WEEKLY' | 'MONTHLY', now = new Date()): Date {
  const day = from.getUTCDate();
  let next = new Date(from);
  let months = 0;
  while (next.getTime() <= now.getTime()) {
    if (repeat === 'WEEKLY') {
      next = new Date(next.getTime() + 7 * 86_400_000);
    } else {
      // Same day each month; the 31st becomes the month's last day (and back to the 31st later).
      months += 1;
      const candidate = new Date(from);
      candidate.setUTCDate(1);
      candidate.setUTCMonth(from.getUTCMonth() + months);
      const lastDay = new Date(
        Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth() + 1, 0),
      ).getUTCDate();
      candidate.setUTCDate(Math.min(day, lastDay));
      next = candidate;
    }
  }
  return next;
}

const inr = (n: number) =>
  n.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });

/** "It is now ₹449 - ₹50 less than when you set this reminder." (and a WhatsApp "Rs" version). */
export function priceLines(
  then: number | null,
  now: number | null,
  available: boolean,
): { priceLine: string; priceLineWa: string } {
  if (!available || now === null) {
    const line = 'It is not available right now - have a look at similar products.';
    return { priceLine: line, priceLineWa: line };
  }
  const say = (cur: string) => {
    if (then !== null && now < then) {
      return `It is now ${cur}${inr(now)}, ${cur}${inr(then - now)} less than when you set this reminder.`;
    }
    return `It is ${cur}${inr(now)} today.`;
  };
  return { priceLine: say('₹'), priceLineWa: say('Rs ') };
}

async function sendOne(row: Row): Promise<void> {
  const sku = row.skuId ? await catalogClient.getSku(row.skuId).catch(() => null) : null;
  const now = sku ? Number(sku.sellingPrice) : null;
  const then = row.priceAtSet ? Number(row.priceAtSet) : null;
  const path = `/product/${sku?.productSlug ?? row.slug}`;
  const data = {
    reminderId: row.id,
    productId: row.productId,
    title: sku?.title ?? row.title,
    note: row.note,
    imageUrl: row.imageUrl,
    link: path,
    webLink: path,
    ...priceLines(then, now, sku?.active ?? false),
  };
  await addInboxMessage(row.userId, 'BUY_REMINDER', data);
  const contact = await authClient.getUserContact(row.userId).catch(() => null);
  if (contact?.phone) {
    await enqueueNotification({
      channel: 'WHATSAPP',
      to: contact.phone,
      userId: row.userId,
      templateKey: 'BUY_REMINDER',
      data,
    });
  }
  if (contact?.email) {
    await enqueueNotification({
      channel: 'EMAIL',
      to: contact.email,
      userId: row.userId,
      templateKey: 'BUY_REMINDER',
      data,
    });
  }
}

/**
 * Sends every reminder that is due. Each one is claimed first (a conditional update on its own
 * time), so two service instances - or an overlapping tick - never send the same reminder twice.
 */
export async function sendDueReminders(now = new Date()): Promise<number> {
  const due = await prisma.buyReminder.findMany({
    where: { status: 'SCHEDULED', remindAt: { lte: now } },
    orderBy: { remindAt: 'asc' },
    take: 100,
  });
  let sent = 0;
  for (const row of due) {
    const next = row.repeat === 'NONE' ? null : nextOccurrence(row.remindAt, row.repeat, now);
    const claim = await prisma.buyReminder.updateMany({
      where: { id: row.id, status: 'SCHEDULED', remindAt: row.remindAt },
      data: {
        ...(next ? { remindAt: next } : { status: 'SENT' }),
        sentCount: { increment: 1 },
        lastSentAt: now,
      },
    });
    if (claim.count === 0) continue;
    try {
      await sendOne(row);
      sent += 1;
    } catch (err) {
      logger.warn({ err, reminderId: row.id }, 'buy reminder: could not send');
    }
  }
  return sent;
}

let timer: NodeJS.Timeout | undefined;
let running = false;

/** Checks for due reminders every 30 seconds (and once at start-up, for any missed while down). */
export function startReminderScheduler(): void {
  const tick = () => {
    if (running) return;
    running = true;
    sendDueReminders()
      .then((n) => {
        if (n > 0) logger.info({ sent: n }, 'buy reminders sent');
      })
      .catch((err: unknown) => logger.error({ err }, 'buy reminder tick failed'))
      .finally(() => {
        running = false;
      });
  };
  tick();
  timer = setInterval(tick, 30_000);
}

export function stopReminderScheduler(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
