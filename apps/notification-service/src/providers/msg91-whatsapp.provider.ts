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
 * (this repo sends one notification job at a time - no batching).
 *
 * AUTHENTICATION vs UTILITY templates (Ch6.2c): both use the SAME v5 bulk
 * endpoint/envelope - the difference is just which component keys are
 * populated. UTILITY templates (order_placed/shipped/delivered/refund)
 * populate `body_1..body_N` from `components.bodyParams`, in order -
 * getting this order right is what maps our data onto the template's
 * `{{1}}`,`{{2}}`,... exactly. AUTHENTICATION templates (OTP) populate
 * ONLY `body_1` (the code - `bodyParams` has exactly one entry) PLUS
 * `button_1` (the same code, for the "copy code" button -
 * `authButtonCode`) - `category` is threaded through mainly for this
 * documentation/clarity; the payload shape itself doesn't currently branch
 * beyond "is there a button".
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
    if (components.headerDocumentUrl) {
      componentsPayload.header_1 = { type: 'document', value: components.headerDocumentUrl };
    }
    components.bodyParams.forEach((value, index) => {
      componentsPayload[`body_${index + 1}`] = { type: 'text', value };
    });
    if (components.authButtonCode !== undefined) {
      componentsPayload.button_1 = { type: 'text', value: components.authButtonCode };
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
