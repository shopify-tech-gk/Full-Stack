import { config } from '../config';
import type { NotificationProvider, OutgoingMessage, SendResult } from './provider.interface';
import { fetchWithTimeout, toMsg91Mobile } from './http.util';
import { describeError, summarizeResponse } from './redact.util';

const OTP_API_URL = 'https://control.msg91.com/api/v5/otp';
// MSG91's legacy plain-text SMS endpoint - used for non-OTP transactional
// text (e.g. shipping updates), which MSG91's dedicated OTP API cannot
// send (that API only injects a numeric code into ITS OWN pre-approved
// DLT template, never arbitrary free text).
const SEND_SMS_URL = 'https://api.msg91.com/api/sendhttp.php';

const SECRETS = () => [config.msg91AuthKey];

interface Msg91OtpResponse {
  type?: string;
  message?: string;
}

/**
 * Two distinct MSG91 mechanisms behind one adapter (documented choice,
 * see Ch6.2 report): `templateKey === 'OTP'` uses MSG91's dedicated OTP
 * API (a numeric code injected into an already-DLT-approved OTP
 * template); everything else uses MSG91's legacy `sendhttp.php` free-text
 * API (still requires DLT registration account-side in India, but the
 * request itself carries the rendered text directly, no `MSG91_OTP_TEMPLATE_ID`
 * needed).
 */
export class Msg91SmsProvider implements NotificationProvider {
  async send(message: OutgoingMessage): Promise<SendResult> {
    const mobile = toMsg91Mobile(message.to);

    if (message.templateKey === 'OTP') {
      const code = typeof message.data.code === 'string' ? message.data.code : undefined;
      if (!code) {
        return { status: 'FAILED', error: 'OTP job payload missing "code"' };
      }
      return this.sendOtp(mobile, code);
    }

    if (message.rendered.channel !== 'SMS') {
      return {
        status: 'FAILED',
        error: `Msg91SmsProvider received a non-SMS rendered message (${message.rendered.channel})`,
      };
    }
    return this.sendPlainText(mobile, message.rendered.text);
  }

  private async sendOtp(mobile: string, code: string): Promise<SendResult> {
    const params = new URLSearchParams({
      authkey: config.msg91AuthKey,
      mobile,
      otp: code,
    });
    if (config.msg91OtpTemplateId) {
      params.set('template_id', config.msg91OtpTemplateId);
    }

    try {
      const res = await fetchWithTimeout(`${OTP_API_URL}?${params.toString()}`, { method: 'POST' });
      const json = (await res.json().catch(() => undefined)) as Msg91OtpResponse | undefined;

      if (res.ok && json?.type === 'success') {
        return { status: 'SENT', providerMessageId: json.message };
      }
      return { status: 'FAILED', error: summarizeResponse(res.status, json, SECRETS()) };
    } catch (err) {
      return { status: 'FAILED', error: describeError(err, SECRETS()) };
    }
  }

  private async sendPlainText(mobile: string, text: string): Promise<SendResult> {
    const params = new URLSearchParams({
      authkey: config.msg91AuthKey,
      mobiles: mobile,
      sender: config.msg91SenderId,
      route: '4', // transactional route
      country: '91',
      // MSG91's legacy endpoint expects the body under "message" - verified
      // live: an earlier "sms" param name drew back "Parameter are missing
      // : message".
      message: text,
    });

    try {
      const res = await fetchWithTimeout(`${SEND_SMS_URL}?${params.toString()}`, {
        method: 'POST',
      });
      const bodyText = await res.text();
      const trimmed = bodyText.trim();
      // A genuine success from this legacy endpoint is a BARE request id
      // (alphanumeric/dots/dashes only, no spaces or punctuation) - any
      // prose response (error text, "Parameter are missing", etc) is a
      // failure even when it doesn't literally contain the word "error".
      const looksLikeSuccessId = /^[A-Za-z0-9.-]+$/.test(trimmed);

      if (res.ok && looksLikeSuccessId) {
        return { status: 'SENT', providerMessageId: trimmed };
      }
      return { status: 'FAILED', error: summarizeResponse(res.status, bodyText, SECRETS()) };
    } catch (err) {
      return { status: 'FAILED', error: describeError(err, SECRETS()) };
    }
  }
}
