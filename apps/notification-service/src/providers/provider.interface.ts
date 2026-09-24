export type NotificationChannelValue = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH';

/** One WhatsApp template's component values - mirrors MSG91's v5 bulk API
 * `to_and_components[].components` shape, generalized to an ORDERED list
 * of body params (`bodyParams[0]` -> `body_1`/`{{1}}`, `bodyParams[1]` ->
 * `body_2`/`{{2}}`, etc) so any UTILITY template's variable count/order is
 * expressed directly by the template registry rather than hardcoded
 * per-slot fields here. `authButtonCode` is specific to AUTHENTICATION
 * templates (OTP) - the "copy code" quick-reply button's payload, which
 * Meta requires to carry the SAME value as the code body param. */
export interface WhatsappComponents {
  headerDocumentUrl?: string;
  bodyParams: string[];
  authButtonCode?: string;
}

/** Pre-rendered, channel-specific content (from the template registry) -
 * providers never do their own template rendering, only transport.
 * `category` on the WHATSAPP variant distinguishes Meta/MSG91's two
 * template kinds (AUTHENTICATION vs UTILITY) - see
 * providers/msg91-whatsapp.provider.ts's doc comment for how each maps to
 * MSG91's send payload. */
export type RenderedMessage =
  | { channel: 'SMS'; text: string }
  | {
      channel: 'WHATSAPP';
      templateName: string;
      namespace: string;
      category: 'AUTHENTICATION' | 'UTILITY';
      components: WhatsappComponents;
    }
  | { channel: 'EMAIL'; subject: string; html: string };

export interface OutgoingMessage {
  channel: NotificationChannelValue;
  to: string;
  templateKey: string;
  rendered: RenderedMessage;
  /** Raw template variables as enqueued - most providers only need
   * `rendered`, but MSG91's dedicated OTP API needs the raw numeric code
   * directly (it injects it into its OWN pre-approved DLT template
   * server-side, not a free-text message we compose). */
  data: Record<string, unknown>;
}

export interface SendResult {
  status: 'SENT' | 'FAILED';
  providerMessageId?: string;
  /** A short, SECRET-FREE description of what went wrong - never the raw
   * authkey/token/refresh-token, and never the raw OTP code (see
   * redact.util.ts, applied by every adapter before returning this). */
  error?: string;
}

export interface NotificationProvider {
  send(message: OutgoingMessage): Promise<SendResult>;
}
