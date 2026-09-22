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
 */
export async function processNotificationJob(payload: NotificationJob): Promise<void> {
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
    throw new Error(result.error ?? 'notification send failed');
  }

  logger.info(
    { id: logRow.id, channel: payload.channel, templateKey: payload.templateKey },
    'notification sent',
  );
}
