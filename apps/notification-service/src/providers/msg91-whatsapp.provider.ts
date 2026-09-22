import { config } from '../config';
import type { NotificationProvider, OutgoingMessage, SendResult } from './provider.interface';
import { fetchWithTimeout, toMsg91Mobile } from './http.util';
import { describeError, summarizeResponse } from './redact.util';

const WHATSAPP_BULK_URL = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';

const SECRETS = () => [config.msg91AuthKey];

interface Msg91WhatsappComponentPayload {
  type: string;
  value: string;
}

interface Msg91BulkResponse {
  message?: string;
  data?: { messageId?: string } | Array<{ messageId?: string }>;
}

/**
 * POSTs to MSG91's v5 WhatsApp bulk-message endpoint using the exact
 * `to_and_components` structure MSG91 requires: one recipient per call
 * (this repo sends one notification job at a time - no batching), each
 * component keyed `header_1`/`body_1`/`body_2` per MSG91's naming.
 */
export class Msg91WhatsappProvider implements NotificationProvider {
  async send(message: OutgoingMessage): Promise<SendResult> {
    if (message.rendered.channel !== 'WHATSAPP') {
      return {
        status: 'FAILED',
        error: `Msg91WhatsappProvider received a non-WHATSAPP rendered message (${message.rendered.channel})`,
      };
    }
    const { templateName, namespace, components } = message.rendered;

    const componentsPayload: Record<string, Msg91WhatsappComponentPayload> = {};
    if (components.header1) {
      componentsPayload.header_1 = {
        type: components.header1.type,
        value: components.header1.value,
      };
    }
    if (components.body1 !== undefined) {
      componentsPayload.body_1 = { type: 'text', value: components.body1 };
    }
    if (components.body2 !== undefined) {
      componentsPayload.body_2 = { type: 'text', value: components.body2 };
    }
    // AUTHENTICATION-category (OTP) templates only - the "copy code"
    // button's payload; best-effort mapping (verify against MSG91's actual
    // dashboard payload preview once the OTP template is approved - some
    // accounts may require additional button fields not modeled here).
    if (components.button1 !== undefined) {
      componentsPayload.button_1 = { type: 'text', value: components.button1 };
    }

    const body = {
      integrated_number: config.msg91IntegratedNumber,
      content_type: 'template',
      payload: {
        messaging_product: 'whatsapp',
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en', policy: 'deterministic' },
          namespace,
          to_and_components: [
            {
              to: [toMsg91Mobile(message.to)],
              components: componentsPayload,
            },
          ],
        },
      },
    };

    try {
      const res = await fetchWithTimeout(WHATSAPP_BULK_URL, {
        method: 'POST',
        headers: {
          authkey: config.msg91AuthKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => undefined)) as Msg91BulkResponse | undefined;

      if (!res.ok) {
        return { status: 'FAILED', error: summarizeResponse(res.status, json, SECRETS()) };
      }

      const dataEntry = Array.isArray(json?.data) ? json?.data[0] : json?.data;
      return { status: 'SENT', providerMessageId: dataEntry?.messageId };
    } catch (err) {
      return { status: 'FAILED', error: describeError(err, SECRETS()) };
    }
  }
}
