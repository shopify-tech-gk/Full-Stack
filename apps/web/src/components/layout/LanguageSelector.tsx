'use client';

import { useEffect, useRef, useState } from 'react';
import { IndiaFlag } from '@/components/ui/IndiaFlag';
import { UkFlag } from '@/components/ui/UkFlag';
import { LANGUAGES, restoreLanguage, setLanguage, type LanguageCode } from '@/lib/translate';

function Flag({ language }: { language: LanguageCode }) {
  return language === 'en' ? (
    <UkFlag className="h-[18px] w-[24px]" />
  ) : (
    <IndiaFlag className="h-[18px] w-[24px] rounded-[1px]" />
  );
}

// Live's GTranslate languages: English + Hindi, Kannada, Malayalam, Tamil, Telugu.
export function LanguageSelector() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<LanguageCode>('en');
  const [failed, setFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((language) => language.code === code) ?? LANGUAGES[0];

  useEffect(() => {
    setCode(restoreLanguage());
  }, []);

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

  const choose = (next: LanguageCode) => {
    setOpen(false);
    if (next === code) return;
    setFailed(false);
    setCode(next);
    setLanguage(next).catch(() => {
      setFailed(true);
      setCode('en');
    });
  };

  return (
    // notranslate: the menu keeps every language's own name.
    <div ref={rootRef} className="notranslate relative" translate="no">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Language: ${current.label}`}
        onClick={() => setOpen((value) => !value)}
        className="flex h-[38px] items-center rounded-lang bg-white pl-[10px] pr-[15px] font-ui text-[15px] leading-[25.6px] text-brand"
      >
        <Flag language={current.code} />
        <span className="ml-[3px]">{current.code === 'en' ? 'English' : current.native}</span>
        <span aria-hidden="true" className="ml-[5px] text-[8px] font-bold text-ink-muted">
          ▼
        </span>
      </button>
      {failed ? (
        <p role="status" className="sr-only">
          Translation is unavailable right now
        </p>
      ) : null}
      {open ? (
        <ul
          role="listbox"
          aria-label="Choose language"
          className="absolute right-0 z-[1000] mt-1 min-w-[170px] rounded-lang bg-white py-1 shadow-menu"
        >
          {LANGUAGES.map((language) => (
            <li
              key={language.code}
              role="option"
              aria-selected={language.code === code}
              lang={language.code}
              tabIndex={0}
              onClick={() => choose(language.code)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  choose(language.code);
                }
              }}
              className={`flex cursor-pointer items-center gap-[8px] px-[10px] py-1.5 font-ui text-[15px] hover:bg-page focus:bg-page focus:outline-none ${
                language.code === code ? 'font-semibold text-brand' : 'text-heading'
              }`}
            >
              <Flag language={language.code} />
              <span>{language.native}</span>
              {language.code !== 'en' ? (
                <span className="ml-auto text-[12px] text-ink-muted">{language.label}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
