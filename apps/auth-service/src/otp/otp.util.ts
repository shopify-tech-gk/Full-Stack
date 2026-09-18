import { randomInt, createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config';

/**
 * Generates a zero-padded numeric OTP using node:crypto's CSPRNG
 * (`randomInt`) - never `Math.random`, which is not cryptographically
 * secure and predictable enough that an attacker who observes some outputs
 * could infer future ones.
 */
export function generateOtp(length: number = config.otpLength): string {
  const max = 10 ** length;
  const value = randomInt(0, max);
  return value.toString().padStart(length, '0');
}

/**
 * HMAC-SHA256 keyed with the server-side OTP_HASH_SECRET, rather than a
 * slow password hash like bcrypt: an OTP's brute-force resistance already
 * comes from OTP_MAX_ATTEMPTS + a short TTL, not from hash cost. A stolen
 * hash is useless without the server secret, and HMAC keeps verification
 * O(1) with a secret that's independently rotatable from stored data.
 */
export function hashOtp(code: string): string {
  return createHmac('sha256', config.otpHashSecret).update(code).digest('hex');
}

/**
 * Constant-time comparison (`crypto.timingSafeEqual`) so a guess can't be
 * distinguished from a near-miss by response timing.
 */
export function verifyOtp(code: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashOtp(code), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}
