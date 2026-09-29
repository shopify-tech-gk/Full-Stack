import { CheckCircle2, Info, XCircle } from 'lucide-react';

interface NoticeProps {
  tone: 'info' | 'success' | 'error';
  children: React.ReactNode;
}

const TONES = {
  info: {
    border: 'border-t-brand',
    icon: <Info aria-hidden="true" className="size-[16px] text-brand" />,
  },
  success: {
    border: 'border-t-woo-success',
    icon: <CheckCircle2 aria-hidden="true" className="size-[16px] text-woo-success" />,
  },
  error: {
    border: 'border-t-woo-error',
    icon: <XCircle aria-hidden="true" className="size-[16px] text-woo-error" />,
  },
} as const;

/** WooCommerce notice (live CSS): #f7f6f7, 3px coloured top border, icon at 1em/1.5em. */
export function Notice({ tone, children }: NoticeProps) {
  const { border, icon } = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`relative mb-[2em] border-t-[3px] bg-woo-noticeBg py-[1em] pl-[3.5em] pr-[2em] font-ui text-[16px] leading-[25.6px] text-woo-noticeText ${border}`}
    >
      <span className="absolute left-[1.5em] top-[1.25em]">{icon}</span>
      {children}
    </div>
  );
}
