'use client';

import { useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import { SEARCH_PLACEHOLDER } from '@youmart/shared-client';

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionCtor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

interface SearchBarProps {
  id: string;
  className?: string;
  /** Mobile/tablet mic target is 35px (31px glyph box); desktop is 28px (24px). */
  size?: 'desktop' | 'mobile';
}

export function SearchBar({ id, className = '', size = 'desktop' }: SearchBarProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [listening, setListening] = useState(false);

  const startVoiceSearch = () => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      inputRef.current?.focus();
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (inputRef.current && transcript) {
        inputRef.current.value = transcript;
        formRef.current?.requestSubmit();
      }
    };
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  };

  const mobile = size === 'mobile';

  return (
    <form
      ref={formRef}
      role="search"
      action="/search"
      method="get"
      className={`relative ${className}`}
    >
      <label htmlFor={id} className="sr-only">
        Search products and brands
      </label>
      <input
        ref={inputRef}
        id={id}
        type="search"
        name="q"
        autoComplete="off"
        placeholder={SEARCH_PLACEHOLDER}
        className={`h-[36px] w-full rounded-full border-2 border-brand-accent bg-white py-[7px] pl-[15px] font-sans text-[16px] text-ink-input transition-shadow placeholder:text-ink-placeholder focus:shadow-search-focus focus:outline-none [&::-webkit-search-cancel-button]:hidden ${mobile ? 'pr-[15px]' : 'pr-[45px]'}`}
      />
      {/* Live's mobile search has no voice button; keep it on desktop only (desktop stays unchanged). */}
      {!mobile && (
        <button
          type="button"
          onClick={startVoiceSearch}
          aria-label={listening ? 'Listening for voice search' : 'Search by voice'}
          aria-pressed={listening}
          className={`absolute right-[10px] top-[4px] flex size-[28px] items-center justify-center rounded-full bg-white text-black ${listening ? 'text-hover' : ''}`}
        >
          <Mic aria-hidden="true" className="size-[20px]" strokeWidth={2} />
        </button>
      )}
    </form>
  );
}
