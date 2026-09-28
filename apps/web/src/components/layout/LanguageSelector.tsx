'use client';

import { useEffect, useRef, useState } from 'react';
import { Caret } from '@/components/ui/Caret';
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
        className="flex items-center gap-1.5 rounded-[3px] bg-white px-2 py-1 text-[13px] text-brand lg:px-2.5 lg:py-1.5 lg:text-[14px]"
      >
        <UkFlag className="h-[13px] w-[22px]" />
        <span>English</span>
        <Caret className="h-[5px] w-[8px] text-ink-secondary" />
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label="Choose language"
          className="absolute right-0 z-40 mt-1 min-w-full rounded-[3px] bg-white py-1 shadow-menu"
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
              className="flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5 text-[13px] text-brand hover:bg-sky-tint"
            >
              <UkFlag className="h-[13px] w-[22px]" />
              {language.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
