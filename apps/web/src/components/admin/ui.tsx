'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AdminApiError, type Tone } from '@/lib/admin';

// Admin dashboard building blocks: one quiet, classic look (navy / white / a touch of gold).

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-[22px] flex flex-wrap items-end justify-between gap-[12px]">
      <div>
        <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-[#0b1b3f]">{title}</h1>
        {subtitle && <p className="mt-[2px] text-[14px] text-[#5d6b85]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-[8px]">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className = '',
  title,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-[16px] border border-[#e4e9f2] bg-white shadow-[0_1px_2px_rgba(11,27,63,0.04),0_8px_24px_rgba(11,27,63,0.04)] ${className}`}
    >
      {title && (
        <header className="flex items-center justify-between gap-[8px] border-b border-[#eef1f6] px-[20px] py-[14px]">
          <h2 className="text-[15.5px] font-semibold text-[#0b1b3f]">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

const TONES: Record<Tone, string> = {
  green: 'bg-[#e8f7ee] text-[#137a3f] ring-[#bfe6cf]',
  amber: 'bg-[#fff6e0] text-[#9a6200] ring-[#f6dfa3]',
  blue: 'bg-[#e9f0ff] text-[#0142aa] ring-[#c6d6fb]',
  violet: 'bg-[#f2edff] text-[#5b35c4] ring-[#ddd1fb]',
  red: 'bg-[#fdecec] text-[#b42318] ring-[#f7c9c5]',
  grey: 'bg-[#f1f3f7] text-[#4a5670] ring-[#dfe3eb]',
};

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-[9px] py-[2px] text-[12px] font-semibold ring-1 ring-inset ${TONES[tone]}`}
    >
      <span aria-hidden="true" className="size-[6px] rounded-full bg-current opacity-80" />
      {children}
    </span>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'gold' | 'ghost';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-[#0142aa] text-white hover:bg-[#013a95] shadow-[0_4px_14px_rgba(1,66,170,0.22)]',
  secondary: 'bg-white text-[#0b1b3f] ring-1 ring-inset ring-[#d7deea] hover:bg-[#f6f8fc]',
  danger: 'bg-white text-[#b42318] ring-1 ring-inset ring-[#f2c4bf] hover:bg-[#fdf1f0]',
  gold: 'bg-[#ffc200] text-[#1d1500] hover:bg-[#f5b800] shadow-[0_4px_14px_rgba(255,194,0,0.3)]',
  ghost: 'text-[#0142aa] hover:bg-[#eef3ff]',
};

export function Button({
  variant = 'secondary',
  busy,
  icon: Icon,
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  busy?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || busy}
      className={`inline-flex h-[36px] items-center justify-center gap-[7px] rounded-[10px] px-[14px] text-[13.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 ${VARIANTS[variant]} ${className}`}
    >
      {busy ? (
        <Loader2 aria-hidden="true" className="size-[15px] animate-spin" />
      ) : Icon ? (
        <Icon aria-hidden="true" className="size-[15px]" />
      ) : null}
      {children}
    </button>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T;
  onChange: (value: T) => void;
  tabs: Array<{ value: T; label: string; count?: number }>;
}) {
  return (
    <div role="tablist" className="flex flex-wrap gap-[4px] rounded-[12px] bg-[#eef1f7] p-[4px]">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`flex h-[32px] items-center gap-[6px] rounded-[9px] px-[12px] text-[13px] font-semibold transition ${
              active
                ? 'bg-white text-[#0b1b3f] shadow-[0_1px_3px_rgba(11,27,63,0.12)]'
                : 'text-[#5d6b85] hover:text-[#0b1b3f]'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`rounded-full px-[7px] text-[11.5px] ${
                  active ? 'bg-[#0142aa] text-white' : 'bg-[#dfe4ee] text-[#4a5670]'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-[38px] w-full min-w-[220px] rounded-[10px] border border-[#d7deea] bg-white px-[12px] text-[14px] text-[#0b1b3f] placeholder:text-[#8a95ab] focus:border-[#0142aa] focus:outline-none focus:ring-2 focus:ring-[#0142aa]/15 md:w-[280px]"
    />
  );
}

export const inputClass =
  'h-[38px] w-full rounded-[10px] border border-[#d7deea] bg-white px-[12px] text-[14px] text-[#0b1b3f] placeholder:text-[#8a95ab] focus:border-[#0142aa] focus:outline-none focus:ring-2 focus:ring-[#0142aa]/15';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-[5px]">
      <span className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-[#5d6b85]">
        {label}
      </span>
      {children}
      {hint && <span className="text-[12px] text-[#8a95ab]">{hint}</span>}
    </label>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-[10px] py-[48px] text-[14px] text-[#5d6b85]">
      <Loader2 aria-hidden="true" className="size-[18px] animate-spin text-[#0142aa]" />
      {label}&hellip;
    </div>
  );
}

export function Empty({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text?: string;
}) {
  return (
    <div className="flex flex-col items-center px-[20px] py-[52px] text-center">
      <span className="mb-[12px] flex size-[54px] items-center justify-center rounded-full bg-[#eef3ff] text-[#0142aa]">
        <Icon aria-hidden="true" className="size-[24px]" />
      </span>
      <p className="text-[15.5px] font-semibold text-[#0b1b3f]">{title}</p>
      {text && <p className="mt-[3px] max-w-[360px] text-[13.5px] text-[#5d6b85]">{text}</p>}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-[10px] border border-[#f7c9c5] bg-[#fdf1f0] px-[14px] py-[10px] text-[13.5px] text-[#b42318]"
    >
      {message}
    </p>
  );
}

/** Table shell with the dashboard's header style. */
export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-[13.5px]">
        <thead>
          <tr className="border-b border-[#eef1f6] bg-[#f8fafd]">
            {head.map((h, i) => (
              <th
                key={`${h}-${i}`}
                className="whitespace-nowrap px-[16px] py-[11px] text-[11.5px] font-semibold uppercase tracking-[0.07em] text-[#6b7891]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eef1f6]">{children}</tbody>
      </table>
    </div>
  );
}

export const td = 'px-[16px] py-[13px] align-middle text-[#24324d]';

/** Right-hand panel for a record's detail / edit form. */
export function Drawer({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[2100] flex justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(11,27,63,0.38)] backdrop-blur-[1px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="ym-admin-drawer relative flex h-full w-full max-w-[520px] flex-col bg-white shadow-[-12px_0_40px_rgba(11,27,63,0.18)]"
      >
        <header className="flex items-center justify-between border-b border-[#eef1f6] px-[22px] py-[16px]">
          <h2 className="text-[17px] font-semibold text-[#0b1b3f]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-[34px] items-center justify-center rounded-full text-[#5d6b85] hover:bg-[#f1f4f9]"
          >
            <X aria-hidden="true" className="size-[18px]" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-[22px] py-[18px]">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-[8px] border-t border-[#eef1f6] px-[22px] py-[14px]">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

export const errorMessage = (error: unknown): string =>
  error instanceof AdminApiError || error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';

/** Loads `fn` (again whenever `deps` change); `reload` refetches in place. */
export function useAdminData<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(fn, deps);

  const reload = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const value = await load();
      if (id === seq.current) setData(value);
    } catch (failure) {
      if (id === seq.current) setError(errorMessage(failure));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, setData, error, loading, reload };
}

/** Debounced copy of `value` (search boxes). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** A small toast in the corner after an action. */
export function useToast() {
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  const node = toast ? (
    <div
      role="status"
      className={`fixed bottom-[24px] right-[24px] z-[2200] rounded-[12px] px-[16px] py-[11px] text-[14px] font-semibold text-white shadow-[0_10px_30px_rgba(11,27,63,0.25)] ${
        toast.tone === 'ok' ? 'bg-[#0b1b3f]' : 'bg-[#b42318]'
      }`}
    >
      {toast.text}
    </div>
  ) : null;
  return {
    node,
    ok: (text: string) => setToast({ text, tone: 'ok' }),
    fail: (error: unknown) => setToast({ text: errorMessage(error), tone: 'error' }),
  };
}
