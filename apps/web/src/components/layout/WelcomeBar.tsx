import { WELCOME_MESSAGE } from '@youmart/shared-client';
import { LanguageSelector } from './LanguageSelector';

export function WelcomeBar() {
  return (
    <div className="bg-brand">
      <div className="relative mx-auto flex min-h-[42px] max-w-[1180px] items-center justify-between gap-2 px-3 py-1.5 lg:min-h-[51px] lg:justify-center lg:px-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.01em] text-white sm:text-[13px] lg:text-[15px]">
          {WELCOME_MESSAGE}
        </p>
        <div className="shrink-0 lg:absolute lg:right-4">
          <LanguageSelector />
        </div>
      </div>
    </div>
  );
}
