import { createHmac } from 'node:crypto';
import { config } from '../config';

/**
 * HMAC-SHA256 keyed with the server-side BANK_ACCOUNT_HASH_SECRET - same
 * discipline as auth-service's OTP hashing (token.util.ts/otp.util.ts): a
 * stolen hash is useless without the server secret, and unlike a plain
 * sha256 hash, this resists offline enumeration of the (much smaller than
 * it looks) space of real bank account numbers. The raw account number is
 * NEVER stored or logged anywhere - only this hash is persisted
 * (`seller_kyc.bank_account_number_hash`).
 */
export function hashBankAccountNumber(rawAccountNumber: string): string {
  return createHmac('sha256', config.bankAccountHashSecret).update(rawAccountNumber).digest('hex');
}
