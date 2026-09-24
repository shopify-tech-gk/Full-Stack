import type { Prisma } from '@youmart/db';
import type { NotificationJob } from '@youmart/notifications-client';
import { prisma } from '../db';
import { logger } from '../logger';
import { config } from '../config';
import { renderTemplate } from '../templates/template.registry';
import { resolveProvider } from '../providers/registry';
import { redactJobDataForLog } from './log-redaction.util';

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/** The minimal BullMQ `Job` shape this module needs - kept as a small
 * structural interface (rather than importing `bullmq` directly) so
 * notification-service doesn't need it as an explicit dependency; the real
 * `Job` object passed by `@youmart/queue`'s `registerWorker` satisfies
 * this. */
export interface JobAttemptInfo {
  attemptsMade: number;
  opts: { attempts?: number };
}

/**
 * Processes ONE notification job (called by the BullMQ worker,
 * notification.queue.ts). Order:
 * 1. Log a QUEUED row FIRST, with the OTP code (or any other
 *    per-template sensitive field) already redacted - the raw value is
 *    never written to `notification_log`, even transiently, regardless of
 *    what happens next.
 * 2. `NOTIFICATIONS_ENABLED=false` -> simulate success (no real provider
 *    call), log row marked SENT with `simulated: true`.
 * 3. Render the template for this channel + resolve the provider - a
 *    failure here (unknown template, no provider for the channel) is a
 *    PERMANENT/config error, so it's logged as FAILED and NOT retried
 *    (retrying a template bug 3x accomplishes nothing).
 * 4. Send. A provider-reported FAILED (network/API issue) IS retried - the
 *    log row is updated FAILED and the function re-throws so BullMQ's
 *    built-in retry (3 attempts, exponential backoff -
 *    `@youmart/queue`'s DEFAULT_JOB_OPTIONS) kicks in. Each attempt
 *    creates its OWN log row, so every retry is independently
 *    visible/auditable in `notification_log`.
 * 5. LOGIN-SAFETY FALLBACK (Ch6.2b): if this was the OTP template's
 *    primary WHATSAPP leg, retries are now exhausted (this IS the final
 *    attempt), and the enqueuing service (auth-service) supplied a
 *    `data.fallbackEmail` for this user, a one-off EMAIL OTP send is
 *    attempted as a SIDE EFFECT (its own separate `notification_log` row)
 *    - a user must never be silently unable to log in just because
 *    WhatsApp delivery failed. If there's no fallback email on file, the
 *    failure is at least clearly diagnosable via this row's FAILED status
 *    + error - never a silent black hole.
 */
export async function processNotificationJob(
  payload: NotificationJob,
  job: JobAttemptInfo,
): Promise<void> {
  const redactedData = redactJobDataForLog(payload.templateKey, payload.data);

  const logRow = await prisma.notificationLog.create({
    data: {
      userId: payload.userId ?? null,
      channel: payload.channel,
      template: payload.templateKey,
      status: 'QUEUED',
      payload: toJsonInput({ to: payload.to, data: redactedData }),
    },
  });

  if (!config.notificationsEnabled) {
    await prisma.notificationLog.update({
      where: { id: logRow.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        payload: toJsonInput({ to: payload.to, data: redactedData, simulated: true }),
      },
    });
    logger.info(
      { id: logRow.id, channel: payload.channel, templateKey: payload.templateKey },
      'notification simulated (NOTIFICATIONS_ENABLED=false) - no real provider call made',
    );
    return;
  }

  let rendered;
  try {
    rendered = renderTemplate(payload.templateKey, payload.channel, payload.data);
  } catch (err) {
    await prisma.notificationLog.update({ where: { id: logRow.id }, data: { status: 'FAILED' } });
    logger.error(
      { id: logRow.id, err },
      'failed to render notification template - permanent error, not retrying',
    );
    return;
  }

  let provider;
  try {
    provider = resolveProvider(payload.channel);
  } catch (err) {
    await prisma.notificationLog.update({ where: { id: logRow.id }, data: { status: 'FAILED' } });
    logger.error(
      { id: logRow.id, err },
      'no provider registered for channel - permanent error, not retrying',
    );
    return;
  }

  const result = await provider.send({
    channel: payload.channel,
    to: payload.to,
    templateKey: payload.templateKey,
    rendered,
    data: payload.data,
  });

  await prisma.notificationLog.update({
    where: { id: logRow.id },
    data: {
      status: result.status,
      sentAt: result.status === 'SENT' ? new Date() : null,
      payload: toJsonInput({
        to: payload.to,
        data: redactedData,
        providerMessageId: result.providerMessageId ?? null,
        error: result.error ?? null,
      }),
    },
  });

  if (result.status === 'FAILED') {
    logger.warn(
      {
        id: logRow.id,
        channel: payload.channel,
        templateKey: payload.templateKey,
        error: result.error,
      },
      'notification send failed - will retry per queue policy',
    );

    const attemptNumber = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 1;
    const isFinalAttempt = attemptNumber >= maxAttempts;

    if (payload.templateKey === 'OTP' && payload.channel === 'WHATSAPP' && isFinalAttempt) {
      const fallbackEmail =
        typeof payload.data.fallbackEmail === 'string' ? payload.data.fallbackEmail : undefined;

      if (fallbackEmail) {
        logger.warn(
          { userId: payload.userId },
          'WhatsApp OTP delivery exhausted retries - falling back to email',
        );
        await sendOtpEmailFallback(payload, fallbackEmail);
      } else {
        logger.error(
          { userId: payload.userId },
          'WhatsApp OTP delivery exhausted retries and no fallback email is on file - ' +
            'this user cannot receive this OTP; diagnose via notification_log',
        );
      }
    }

    throw new Error(result.error ?? 'notification send failed');
  }

  logger.info(
    { id: logRow.id, channel: payload.channel, templateKey: payload.templateKey },
    'notification sent',
  );
}

/**
 * Login-safety fallback (Ch6.2b) - sends the SAME OTP via email as a
 * one-off, best-effort attempt (no retry of its own; the user can always
 * request a fresh OTP). Logged as its own `notification_log` row (channel
 * EMAIL, template OTP, `fallback: true`) so it's distinguishable from a
 * primary EMAIL OTP send were one ever added. Uses the SAME redaction as
 * the primary path - the raw code is never persisted here either.
 */
async function sendOtpEmailFallback(payload: NotificationJob, email: string): Promise<void> {
  const redactedData = redactJobDataForLog('OTP', payload.data);

  const logRow = await prisma.notificationLog.create({
    data: {
      userId: payload.userId ?? null,
      channel: 'EMAIL',
      template: 'OTP',
      status: 'QUEUED',
      payload: toJsonInput({ to: email, data: redactedData, fallback: true }),
    },
  });

  try {
    const rendered = renderTemplate('OTP', 'EMAIL', payload.data);
    const provider = resolveProvider('EMAIL');
    const result = await provider.send({
      channel: 'EMAIL',
      to: email,
      templateKey: 'OTP',
      rendered,
      data: payload.data,
    });

    await prisma.notificationLog.update({
      where: { id: logRow.id },
      data: {
        status: result.status,
        sentAt: result.status === 'SENT' ? new Date() : null,
        payload: toJsonInput({
          to: email,
          data: redactedData,
          fallback: true,
          providerMessageId: result.providerMessageId ?? null,
          error: result.error ?? null,
        }),
      },
    });
  } catch (err) {
    await prisma.notificationLog.update({ where: { id: logRow.id }, data: { status: 'FAILED' } });
    logger.error({ id: logRow.id, err }, 'OTP email fallback failed');
  }
}
