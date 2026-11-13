import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '@youmart/errors';
import { prisma } from '../db';

// v1.19 "Sell on YouMart" early access. Selling is not open yet (marketplace hard-off, see
// marketplace-gate.ts), so this does NOT create a Seller: it records who wants to sell, once per
// user, for the admin team to call back. The customer sees its reference code and status.

export const BUSINESS_TYPES = [
  'INDIVIDUAL',
  'SHOP',
  'BRAND',
  'MANUFACTURER',
  'WHOLESALER',
] as const;

export const APPLICATION_STATUSES = [
  'NEW',
  'CONTACTED',
  'SHORTLISTED',
  'ONBOARDED',
  'DECLINED',
] as const;
type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

const text = (max: number) => z.string().trim().min(1).max(max);

export const CreateApplicationBody = z.object({
  businessName: text(120),
  contactName: text(80),
  // Indian mobile: optional +91 / 0, then 10 digits starting 6-9.
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, ''))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number')),
  email: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.string().email('Enter a valid email').optional()),
  city: text(80),
  businessType: z.enum(BUSINESS_TYPES),
  category: text(80),
  hasGstin: z.boolean().default(false),
  note: z.string().trim().max(500).optional(),
});
export type CreateApplicationBody = z.infer<typeof CreateApplicationBody>;

export const AdminListApplicationsQuery = z.object({
  status: z.enum(APPLICATION_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const AdminUpdateApplicationBody = z
  .object({
    status: z.enum(APPLICATION_STATUSES).optional(),
    adminNote: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((b) => b.status !== undefined || b.adminNote !== undefined, 'Nothing to update');

type Row = Awaited<ReturnType<typeof prisma.sellerApplication.findFirstOrThrow>>;

/** What the customer sees (no admin note). */
function toMine(r: Row) {
  return {
    applicationId: r.id,
    referenceCode: r.referenceCode,
    businessName: r.businessName,
    contactName: r.contactName,
    phone: r.phone,
    email: r.email,
    city: r.city,
    businessType: r.businessType,
    category: r.category,
    hasGstin: r.hasGstin,
    note: r.note,
    status: r.status,
    contactedAt: r.contactedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function toAdmin(r: Row) {
  return { ...toMine(r), userId: r.userId, adminNote: r.adminNote };
}

async function newReferenceCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = `YMS-${randomInt(100000, 1000000)}`;
    const taken = await prisma.sellerApplication.findUnique({ where: { referenceCode: code } });
    if (!taken) return code;
  }
  throw new AppError('INTERNAL_ERROR', 500, 'Could not create a reference code');
}

export async function getMyApplication(userId: string) {
  const row = await prisma.sellerApplication.findUnique({ where: { userId } });
  return { application: row ? toMine(row) : null };
}

export async function createApplication(userId: string, body: CreateApplicationBody) {
  const existing = await prisma.sellerApplication.findUnique({ where: { userId } });
  if (existing) {
    throw new AppError('CONFLICT', 409, 'You have already applied for early access');
  }
  const row = await prisma.sellerApplication.create({
    data: {
      userId,
      referenceCode: await newReferenceCode(),
      businessName: body.businessName,
      contactName: body.contactName,
      phone: body.phone,
      email: body.email ?? null,
      city: body.city,
      businessType: body.businessType,
      category: body.category,
      hasGstin: body.hasGstin,
      note: body.note ? body.note : null,
    },
  });
  return { application: toMine(row) };
}

export async function listApplications(query: z.infer<typeof AdminListApplicationsQuery>) {
  const q = query.q;
  const search = q
    ? {
        OR: [
          { businessName: { contains: q, mode: 'insensitive' as const } },
          { contactName: { contains: q, mode: 'insensitive' as const } },
          { referenceCode: { contains: q, mode: 'insensitive' as const } },
          { city: { contains: q, mode: 'insensitive' as const } },
          { category: { contains: q, mode: 'insensitive' as const } },
          { phone: { contains: q } },
        ],
      }
    : {};
  const [rows, grouped] = await Promise.all([
    prisma.sellerApplication.findMany({
      where: { ...search, ...(query.status ? { status: query.status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
    }),
    prisma.sellerApplication.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  const counts = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0])) as Record<
    ApplicationStatus,
    number
  >;
  for (const g of grouped) counts[g.status] = g._count._all;
  return { items: rows.map(toAdmin), counts };
}

export async function updateApplication(
  id: string,
  body: z.infer<typeof AdminUpdateApplicationBody>,
) {
  const row = await prisma.sellerApplication.findUnique({ where: { id } });
  if (!row) throw new AppError('NOT_FOUND', 404, 'Application not found');
  const updated = await prisma.sellerApplication.update({
    where: { id },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.adminNote !== undefined ? { adminNote: body.adminNote || null } : {}),
      // First time it moves past NEW = when the team reached out.
      ...(body.status && body.status !== 'NEW' && !row.contactedAt
        ? { contactedAt: new Date() }
        : {}),
    },
  });
  return { application: toAdmin(updated) };
}
