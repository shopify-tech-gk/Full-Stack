import { mintServiceToken } from '@youmart/auth-middleware';

/**
 * Every client factory in this package takes this shape (injected by the
 * consuming service's own config - this package never reads
 * `process.env`/holds a secret itself). `callerServiceName` becomes the
 * minted token's `sub` claim (purely for logging/audit on the receiving
 * end).
 */
export interface ServiceAuthOptions {
  callerServiceName: string;
  serviceSecret: string;
  ttlSeconds: number;
}

/** Minted FRESH per outbound call (not cached) - simplest correct approach
 * given tokens are short-lived (default 300s) and HS256 signing is cheap. */
export function mintCallerServiceToken(options: ServiceAuthOptions): string {
  return mintServiceToken(options.callerServiceName, {
    serviceSecret: options.serviceSecret,
    ttlSeconds: options.ttlSeconds,
  });
}
