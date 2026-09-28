import { WELCOME_MESSAGE } from '@youmart/shared-client';
import { LanguageSelector } from './LanguageSelector';

// Live: desktop only (hidden below 1025px), 58px #0142aa band, a 900px scrolling marquee and the
// language pill as one 1200px centred group. Marquee speed measured at 72px/s: (900 + 414) / 72.
export function WelcomeBar() {
  return (
    <div className="hidden h-[58px] bg-brand px-[10px] lg:block">
      <div className="mx-auto flex h-full max-w-[1200px] items-start justify-between gap-4 pt-[10px]">
        <div className="group relative h-[26px] min-w-0 max-w-[900px] flex-1 overflow-hidden">
          <div className="absolute inset-0 animate-[marquee-track_18.25s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none">
            <p className="inline-block animate-[marquee-text_18.25s_linear_infinite] whitespace-nowrap font-sans text-[16px] font-bold uppercase leading-[25.6px] text-white group-hover:[animation-play-state:paused] motion-reduce:animate-none">
              {WELCOME_MESSAGE}
            </p>
          </div>
        </div>
        <LanguageSelector />
      </div>
    </div>
  );
}
