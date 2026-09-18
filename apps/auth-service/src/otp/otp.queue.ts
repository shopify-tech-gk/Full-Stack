import { createQueue, registerWorker } from '@youmart/queue';
import { logger } from '../logger';
import { OtpSendJob } from './otp.schema';

export const otpSendQueue = createQueue('otp-send', OtpSendJob);

let worker: ReturnType<typeof registerWorker<OtpSendJob>> | undefined;

/**
 * DEV STUB: no SMS provider exists yet (a later chapter) - this worker just
 * logs the code, clearly marked so it's never mistaken for production
 * behavior. The raw code appears ONLY here; it is never stored in the DB
 * and never returned in an HTTP response.
 */
export function startOtpSendWorker(): ReturnType<typeof registerWorker<OtpSendJob>> {
  worker = registerWorker('otp-send', OtpSendJob, (payload) => {
    logger.info(
      { phone: payload.phone, purpose: payload.purpose, code: payload.code },
      'DEV ONLY - OTP would be sent via SMS',
    );
  });
  return worker;
}

export async function closeOtpSendWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = undefined;
  }
}
