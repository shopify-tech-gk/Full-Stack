export type NotificationChannelValue = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH';

/** One WhatsApp template component slot - mirrors MSG91's v5 bulk API
 * `to_and_components[].components` shape (header_1/body_1/body_2/...). */
export interface WhatsappComponents {
  header1?: { type: 'document' | 'text' | 'image'; value: string };
  body1?: string;
  body2?: string;
}

/** Pre-rendered, channel-specific content (from the template registry) -
 * providers never do their own template rendering, only transport. */
export type RenderedMessage =
  | { channel: 'SMS'; text: string }
  | {
      channel: 'WHATSAPP';
      templateName: string;
      namespace: string;
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
