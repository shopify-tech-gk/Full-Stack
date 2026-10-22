'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUp, CheckCircle2, Headset, Loader2, Sparkles } from 'lucide-react';
import {
  ASSISTANT_SUGGESTIONS,
  ApiError,
  HELP_TOPIC_LABELS,
  ROUTES,
  assistantTranscript,
  type AssistantEscalation,
  type AssistantTurn,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

// v1.17 AI help on the website's Customer Care page - same assistant as the app: answers from the
// store's rules and (signed in) the customer's own orders; hands over to support with a prefilled
// "Send to support" card that becomes a help request with this chat attached.

interface Bubble extends AssistantTurn {
  id: number;
  escalate?: AssistantEscalation | null;
  error?: boolean;
}

const WELCOME =
  "Hi! I'm YouMart Assistant. Ask me about your orders, delivery, payments, returns, refunds or anything about shopping on YouMart.";

/** **bold** and "- " bullets, as the assistant formats replies. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-[6px]" />;
        const bullet = /^\s*[-*•]\s+/.test(line);
        const body = line.replace(/^\s*[-*•]\s+/, '');
        const parts = body
          .split(/(\*\*[^*]+\*\*)/g)
          .map((p, j) =>
            /^\*\*[^*]+\*\*$/.test(p) ? <strong key={j}>{p.slice(2, -2)}</strong> : p,
          );
        return bullet ? (
          <p key={i} className="flex gap-[6px]">
            <span aria-hidden="true">•</span>
            <span>{parts}</span>
          </p>
        ) : (
          <p key={i}>{parts}</p>
        );
      })}
    </>
  );
}

export function AssistantChat() {
  const session = useSession();
  const signedIn = session.status === 'authenticated';
  const [available, setAvailable] = useState<boolean | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    api.support
      .assistantStatus()
      .then((r) => setAvailable(r.available))
      .catch(() => setAvailable(false));
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [bubbles, busy]);

  if (available === false) return null;

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setText('');
    const turns: AssistantTurn[] = [
      ...bubbles
        .filter((b) => !b.error)
        .map(({ role, text: t }) => ({ role, text: t.slice(0, 1500) })),
      { role: 'user' as const, text: q.slice(0, 1500) },
    ].slice(-24);
    setBubbles((b) => [...b, { id: nextId.current++, role: 'user', text: q }]);
    setBusy(true);
    try {
      const res = await api.support.askAssistant(turns);
      setRemaining(res.remaining);
      setBubbles((b) => [
        ...b,
        { id: nextId.current++, role: 'assistant', text: res.reply, escalate: res.escalate },
      ]);
    } catch (err) {
      setBubbles((b) => [
        ...b,
        {
          id: nextId.current++,
          role: 'assistant',
          error: true,
          text:
            err instanceof ApiError && (err.status === 429 || err.status === 503)
              ? err.message
              : "Sorry, I couldn't reply just now. Please try again.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const transcript = () =>
    assistantTranscript(
      bubbles.filter((b) => !b.error).map(({ role, text: t }) => ({ role, text: t })),
    );

  return (
    <section
      aria-label="YouMart Assistant"
      className="mx-auto mt-[30px] flex max-w-[760px] flex-col overflow-hidden rounded-[18px] border border-catalog-rule bg-white font-ui shadow-[0_10px_30px_rgba(1,66,170,0.08)]"
    >
      <header className="flex items-center gap-[12px] bg-brand px-[18px] py-[14px] text-white">
        <span className="flex size-[38px] items-center justify-center rounded-full bg-white text-brand">
          <Sparkles aria-hidden="true" className="size-[19px]" />
        </span>
        <div>
          <h2 className="text-[17px] font-semibold">YouMart Assistant</h2>
          <p className="text-[12.5px] opacity-85">
            Instant answers 24×7 - if I can&rsquo;t solve it, I&rsquo;ll pass it to our team.
          </p>
        </div>
      </header>

      <div
        ref={listRef}
        className="flex max-h-[460px] min-h-[260px] flex-col gap-[10px] overflow-y-auto bg-[#f5f8fd] p-[16px]"
      >
        <BotBubble text={WELCOME} />
        {bubbles.length === 0 && (
          <div className="flex flex-wrap gap-[8px] pl-[36px]">
            {ASSISTANT_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void ask(s)}
                className="rounded-full border border-brand bg-white px-[12px] py-[6px] text-[13px] font-semibold text-brand hover:bg-[#eef3ff]"
              >
                {s}
              </button>
            ))}
            {!signedIn && (
              <p className="w-full text-[12.5px] text-ink-muted">
                <Link href={ROUTES.account} className="font-semibold text-brand hover:underline">
                  Sign in
                </Link>{' '}
                so I can look up your orders.
              </p>
            )}
          </div>
        )}
        {bubbles.map((b) =>
          b.role === 'user' ? (
            <div key={b.id} className="flex justify-end">
              <p className="max-w-[80%] rounded-[16px] rounded-br-[4px] bg-brand px-[13px] py-[9px] text-[14.5px] leading-[1.45] text-white">
                {b.text}
              </p>
            </div>
          ) : (
            <div key={b.id}>
              <BotBubble text={b.text} error={b.error} />
              {b.escalate && (
                <Handover escalation={b.escalate} signedIn={signedIn} transcript={transcript} />
              )}
            </div>
          ),
        )}
        {busy && (
          <div className="flex items-end gap-[8px]">
            <span className="flex size-[28px] items-center justify-center rounded-full bg-brand text-white">
              <Sparkles aria-hidden="true" className="size-[13px]" />
            </span>
            <span className="flex gap-[5px] rounded-[16px] rounded-bl-[4px] border border-catalog-rule bg-white px-[14px] py-[13px]">
              {[0, 150, 300].map((d) => (
                <span
                  key={d}
                  className="size-[7px] animate-pulse rounded-full bg-brand"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </span>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(text);
        }}
        className="flex items-end gap-[8px] border-t border-catalog-rule bg-white p-[10px]"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void ask(text);
            }
          }}
          rows={1}
          maxLength={1500}
          disabled={busy}
          placeholder="Type your question…"
          aria-label="Your question"
          className="max-h-[110px] min-h-[42px] flex-1 resize-none rounded-[21px] border border-catalog-rule bg-[#f5f8fd] px-[14px] py-[10px] text-[14.5px] text-heading focus:border-brand focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          aria-label="Send"
          className="flex size-[42px] items-center justify-center rounded-full bg-brand text-white disabled:opacity-45"
        >
          {busy ? (
            <Loader2 aria-hidden="true" className="size-[18px] animate-spin" />
          ) : (
            <ArrowUp aria-hidden="true" className="size-[19px]" />
          )}
        </button>
      </form>
      {remaining !== null && remaining <= 5 && (
        <p className="pb-[8px] text-center text-[11.5px] text-ink-muted">
          {remaining} questions left today
        </p>
      )}
    </section>
  );
}

function BotBubble({ text, error }: { text: string; error?: boolean }) {
  return (
    <div className="flex items-end gap-[8px]">
      <span
        className={`flex size-[28px] shrink-0 items-center justify-center rounded-full text-white ${
          error ? 'bg-woo-error' : 'bg-brand'
        }`}
      >
        <Sparkles aria-hidden="true" className="size-[13px]" />
      </span>
      <div
        className={`max-w-[80%] rounded-[16px] rounded-bl-[4px] border px-[13px] py-[9px] text-[14.5px] leading-[1.5] text-heading ${
          error ? 'border-[#f3c4c4] bg-[#fff6f6]' : 'border-catalog-rule bg-white'
        }`}
      >
        <Rich text={text} />
      </div>
    </div>
  );
}

function Handover({
  escalation,
  signedIn,
  transcript,
}: {
  escalation: AssistantEscalation;
  signedIn: boolean;
  transcript: () => string;
}) {
  const [message, setMessage] = useState(escalation.summary);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (message.trim().length < 10) {
      setError('Please describe the problem in a few more words.');
      return;
    }
    setState('sending');
    setError(null);
    try {
      const orderId = escalation.orderNumber
        ? await api.orders
            .get(escalation.orderNumber)
            .then((o) => o.orderId)
            .catch(() => undefined)
        : undefined;
      const ticket = await api.support.createTicket({
        topic: escalation.topic,
        message: message.trim(),
        ...(orderId ? { orderId } : {}),
        transcript: transcript(),
      });
      setReference(ticket.reference);
      setState('sent');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send. Please try again.');
      setState('idle');
    }
  };

  if (state === 'sent') {
    return (
      <div className="ml-[36px] mt-[8px] flex gap-[10px] rounded-[14px] border border-[#86efac] bg-white p-[12px] text-[13.5px]">
        <CheckCircle2 aria-hidden="true" className="size-[20px] shrink-0 text-[#16a34a]" />
        <p>
          <strong className="text-heading">Sent to our support team.</strong> Reference {reference}.
          We&rsquo;ll reply soon - see Notifications and your help requests.
        </p>
      </div>
    );
  }

  return (
    <div className="ml-[36px] mt-[8px] rounded-[14px] border-[1.5px] border-brand bg-white p-[12px]">
      <p className="flex items-center gap-[8px] text-[14px] font-semibold text-heading">
        <Headset aria-hidden="true" className="size-[17px] text-brand" />
        Send to our support team
      </p>
      <p className="mt-[3px] text-[12.5px] font-semibold text-brand">
        {HELP_TOPIC_LABELS[escalation.topic]}
        {escalation.orderNumber ? ` · Order ${escalation.orderNumber}` : ''}
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        maxLength={2000}
        disabled={!signedIn || state !== 'idle'}
        aria-label="Message to support"
        className="mt-[8px] w-full rounded-[10px] border border-catalog-rule p-[10px] text-[13.5px] focus:border-brand focus:outline-none"
      />
      {error && <p className="mt-[4px] text-[12.5px] text-woo-error">{error}</p>}
      {signedIn ? (
        <button
          type="button"
          onClick={() => void send()}
          disabled={state === 'sending'}
          className="mt-[8px] flex h-[38px] w-full items-center justify-center gap-[6px] rounded-[10px] bg-brand text-[14px] font-semibold text-white disabled:opacity-60"
        >
          {state === 'sending' && (
            <Loader2 aria-hidden="true" className="size-[16px] animate-spin" />
          )}
          Send to support
        </button>
      ) : (
        <Link
          href={ROUTES.account}
          className="mt-[8px] flex h-[38px] items-center justify-center rounded-[10px] bg-brand text-[14px] font-semibold text-white"
        >
          Sign in to send
        </Link>
      )}
      <p className="mt-[6px] text-[11.5px] text-ink-muted">
        This chat is attached so our team sees what you asked.
      </p>
    </div>
  );
}
