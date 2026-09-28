'use client';

import { useEffect, useRef, useState } from 'react';
import { UkFlag } from '@/components/ui/UkFlag';

// Only English exists today; the menu structure is in place for more languages later.
const LANGUAGES = [{ code: 'en', label: 'English' }] as const;

export function LanguageSelector() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Language: English"
        onClick={() => setOpen((value) => !value)}
        className="flex h-[38px] items-center rounded-lang bg-white pl-[10px] pr-[15px] font-ui text-[15px] leading-[25.6px] text-brand"
      >
        <UkFlag className="h-[18px] w-[24px]" />
        <span className="ml-[3px]">English</span>
        <span aria-hidden="true" className="ml-[5px] text-[8px] font-bold text-ink-muted">
          ▼
        </span>
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label="Choose language"
          className="absolute right-0 z-[1000] mt-1 min-w-full rounded-lang bg-white py-1 shadow-menu"
        >
          {LANGUAGES.map((language) => (
            <li
              key={language.code}
              role="option"
              aria-selected="true"
              tabIndex={0}
              onClick={() => setOpen(false)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setOpen(false);
                }
              }}
              className="flex cursor-pointer items-center gap-[3px] px-[10px] py-1.5 font-ui text-[15px] text-brand hover:bg-page"
            >
              <UkFlag className="h-[18px] w-[24px]" />
              {language.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
