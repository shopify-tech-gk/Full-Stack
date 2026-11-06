import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '@youmart/errors';
import { prisma } from '../db';
import { Phone } from '../otp/otp.schema';
import { requestOtp, verifyOtpCode, type RequestOtpResult } from '../otp/otp.service';

// v1.18 Username + password sign-in, next to the mobile/email OTP login. An account still belongs
// to its mobile number: registering with a username needs that number's OTP, and a number can have
// only one account - registering on a number that already has an OTP account adds the username and
// password to it (the OTP proved it's theirs); a number that already has a username can't register
// again. After that the shopper logs in either way: username + password, or OTP to the number.

const RESERVED = new Set([
  'admin',
  'administrator',
  'youmart',
  'youmartbot',
  'support',
  'help',
  'bot',
  'system',
  'root',
  'moderator',
  'official',
  'staff',
  'team',
  'shopper',
  'null',
  'undefined',
]);

export const Username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9_.]{2,19}$/, 'Use 3-20 letters, numbers, _ or . and start with a letter')
  .refine((u) => !/[_.]{2}/.test(u) && !/[_.]$/.test(u), 'No double or ending _ or .')
  .refine((u) => !RESERVED.has(u) && !u.startsWith('youmart'), 'That username is not allowed');

export const Password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Use at most 72 characters')
  .refine((p) => /[a-z]/i.test(p) && /\d/.test(p), 'Use letters and numbers');

export const RegisterStartBody = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(60),
  username: Username,
  password: Password,
  phone: Phone,
});
export type RegisterStartBody = z.infer<typeof RegisterStartBody>;

export const RegisterVerifyBody = RegisterStartBody.extend({
  code: z.string().regex(/^\d+$/, 'Code must be numeric'),
});
export type RegisterVerifyBody = z.infer<typeof RegisterVerifyBody>;

export const PasswordLoginBody = z.object({
  username: z.string().trim().toLowerCase().min(1).max(40),
  password: z.string().min(1).max(200),
});
export type PasswordLoginBody = z.infer<typeof PasswordLoginBody>;

// --- password hashing (scrypt, no extra dependency) ---

const KEY_LEN = 64;

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, KEY_LEN, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, keyB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// A wrong username costs the same time as a wrong password (no "this username exists" hint).
const DUMMY_HASH = hashPassword('not-a-real-password-1');

// --- username availability ---

export async function usernameAvailability(
  raw: string,
): Promise<{ username: string; available: boolean; reason: string | null }> {
  const parsed = Username.safeParse(raw);
  if (!parsed.success) {
    return {
      username: raw.trim().toLowerCase(),
      available: false,
      reason: parsed.error.issues[0]?.message ?? 'Not a valid username',
    };
  }
  const taken = await prisma.user.findFirst({
    where: { username: parsed.data },
    select: { id: true },
  });
  return {
    username: parsed.data,
    available: !taken,
    reason: taken ? 'That username is taken' : null,
  };
}

// --- registration ---

/** The number's own account (if any) may take the username; nobody else may. */
async function assertCanRegister(username: string, phone: string): Promise<void> {
  const [owner, phoneAccount] = await Promise.all([
    prisma.user.findFirst({ where: { username }, select: { id: true, phone: true } }),
    prisma.user.findFirst({
      where: { phone, deletedAt: null },
      select: { id: true, username: true },
    }),
  ]);
  if (phoneAccount?.username) {
    throw new AppError(
      'CONFLICT',
      409,
      'This mobile number already has a YouMart account with a username. Log in instead.',
    );
  }
  if (owner && owner.id !== phoneAccount?.id) {
    throw new AppError('CONFLICT', 409, 'That username is taken - try another one');
  }
}

/** Step 1: check the username and number, then send the OTP to the number. */
export async function startRegistration(body: RegisterStartBody): Promise<RequestOtpResult> {
  await assertCanRegister(body.username, body.phone);
  return requestOtp({ target: { type: 'PHONE', phone: body.phone }, purpose: 'PHONE_VERIFY' });
}

/** Step 2: the OTP proves the number; the account (new or the number's own) gets the login. */
export async function completeRegistration(body: RegisterVerifyBody): Promise<{ userId: string }> {
  await assertCanRegister(body.username, body.phone);
  const { userId } = await verifyOtpCode({
    target: { type: 'PHONE', phone: body.phone },
    purpose: 'PHONE_VERIFY',
    code: body.code,
  });
  const passwordHash = await hashPassword(body.password);
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await prisma.user.update({
      where: { id: userId },
      data: { username: body.username, passwordHash, name: user.name ?? body.name },
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      throw new AppError('CONFLICT', 409, 'That username was just taken - try another one');
    }
    throw err;
  }
  return { userId };
}

// --- an existing (OTP) account adds its username / password from Account ---

export const SetLoginBody = z
  .object({ username: Username.optional(), password: Password.optional() })
  .refine((b) => b.username !== undefined || b.password !== undefined, 'Nothing to save');
export type SetLoginBody = z.infer<typeof SetLoginBody>;

/** v1.18 a signed-in shopper picks a username (once - it can't be changed) and/or a password
 * (when the account has none yet). */
export async function setLogin(userId: string, body: SetLoginBody): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { username: true, passwordHash: true },
  });
  if (!user) throw new AppError('NOT_FOUND', 404, 'Account not found');
  if (body.username !== undefined && user.username) {
    throw new AppError('CONFLICT', 409, 'Your username is already set');
  }
  if (body.password !== undefined && user.passwordHash) {
    throw new AppError('CONFLICT', 409, 'Your password is already set');
  }
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.username !== undefined ? { username: body.username } : {}),
        ...(body.password !== undefined ? { passwordHash: await hashPassword(body.password) } : {}),
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      throw new AppError('CONFLICT', 409, 'That username is taken - try another one');
    }
    throw err;
  }
}

// --- password login (with a short lock after repeated wrong tries) ---

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60_000;
const fails = new Map<string, { count: number; until: number }>();

export async function passwordLogin(body: PasswordLoginBody): Promise<{ userId: string }> {
  const key = body.username;
  const now = Date.now();
  const entry = fails.get(key);
  if (entry && entry.until > now && entry.count >= MAX_FAILS) {
    throw new AppError(
      'RATE_LIMITED',
      429,
      'Too many wrong tries. Wait 15 minutes, or log in with OTP.',
    );
  }

  const user = await prisma.user.findFirst({
    where: { username: key, deletedAt: null },
    select: { id: true, passwordHash: true },
  });
  const ok = user?.passwordHash
    ? await verifyPassword(body.password, user.passwordHash)
    : (await verifyPassword(body.password, await DUMMY_HASH), false);

  if (!user || !ok) {
    const next = entry && entry.until > now ? entry.count + 1 : 1;
    fails.set(key, { count: next, until: now + LOCK_MS });
    throw new AppError('UNAUTHORIZED', 401, 'Wrong username or password');
  }
  fails.delete(key);
  return { userId: user.id };
}
