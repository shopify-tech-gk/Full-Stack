import { config } from '../config';
import type { NotificationProvider, OutgoingMessage, SendResult } from './provider.interface';
import { fetchWithTimeout } from './http.util';
import { describeError, summarizeResponse } from './redact.util';

interface ZohoTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface ZohoSendMessageResponse {
  status?: { code?: number; description?: string };
  data?: { messageId?: string };
}

const SECRETS = () => [config.zohoClientSecret, config.zohoRefreshToken];

/**
 * Zoho Mail API (transactional send), authenticated via the OAuth
 * refresh-token flow: exchange `ZOHO_REFRESH_TOKEN` for a short-lived
 * access token at `accounts.zoho.<region>/oauth/v2/token`, cache it
 * in-memory until ~30s before expiry, then POST to
 * `mail.zoho.<region>/api/accounts/{ZOHO_ACCOUNT_ID}/messages` with
 * `Authorization: Zoho-oauthtoken <token>`.
 */
export class ZohoEmailProvider implements NotificationProvider {
  private cachedToken: { accessToken: string; expiresAt: number } | undefined;

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt - 30_000 > now) {
      return this.cachedToken.accessToken;
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.zohoClientId,
      client_secret: config.zohoClientSecret,
      refresh_token: config.zohoRefreshToken,
    });

    const res = await fetchWithTimeout(
      `https://accounts.zoho.${config.zohoAccountRegion}/oauth/v2/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      },
    );
    const json = (await res.json().catch(() => undefined)) as ZohoTokenResponse | undefined;

    if (!res.ok || !json?.access_token) {
      throw new Error(summarizeResponse(res.status, json, SECRETS()));
    }

    const expiresInMs = (json.expires_in ?? 3600) * 1000;
    this.cachedToken = { accessToken: json.access_token, expiresAt: now + expiresInMs };
    return json.access_token;
  }

  async send(message: OutgoingMessage): Promise<SendResult> {
    if (message.rendered.channel !== 'EMAIL') {
      return {
        status: 'FAILED',
        error: `ZohoEmailProvider received a non-EMAIL rendered message (${message.rendered.channel})`,
      };
    }

    try {
      const accessToken = await this.getAccessToken();

      const res = await fetchWithTimeout(
        `https://mail.zoho.${config.zohoAccountRegion}/api/accounts/${config.zohoAccountId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fromAddress: config.zohoFromEmail,
            toAddress: message.to,
            subject: message.rendered.subject,
            content: message.rendered.html,
            mailFormat: 'html',
          }),
        },
      );
      const json = (await res.json().catch(() => undefined)) as ZohoSendMessageResponse | undefined;

      if (!res.ok || json?.status?.code !== 200) {
        return { status: 'FAILED', error: summarizeResponse(res.status, json, SECRETS()) };
      }
      return { status: 'SENT', providerMessageId: json.data?.messageId };
    } catch (err) {
      return { status: 'FAILED', error: describeError(err, SECRETS()) };
    }
  }
}
