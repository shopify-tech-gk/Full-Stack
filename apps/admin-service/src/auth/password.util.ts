import bcrypt from 'bcrypt';
import { config } from '../config';

/**
 * Slow, salted password hash (bcrypt) - deliberately NOT the OTP module's
 * fast HMAC (otp.util.ts): passwords are long-lived secrets an attacker
 * can attempt offline forever if a hash ever leaks, so the hash itself
 * must be expensive to brute-force. OTP codes are short-lived and rate-
 * limited server-side, so a fast HMAC is the right (and only practical)
 * choice there - the two are NOT interchangeable.
 */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, config.bcryptRounds);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
