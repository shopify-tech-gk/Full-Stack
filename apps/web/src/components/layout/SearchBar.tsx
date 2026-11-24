'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, Mic } from 'lucide-react';
import { SEARCH_PLACEHOLDER } from '@youmart/shared-client';
import { SearchSuggestPanel, rememberSearch, useSearchSuggest } from './SearchSuggest';

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
  const router = useRouter();
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const { data, recent, setRecent, items } = useSearchSuggest(value, open);

  const go = (term: string) => {
    const q = term.trim();
    if (!q) return;
    rememberSearch(q);
    setValue(q);
    setOpen(false);
    setActive(-1);
    inputRef.current?.blur();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (!open || items.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (event.key === 'Enter' && active >= 0 && items[active]) {
      event.preventDefault();
      go(items[active]!);
    }
  };

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
      if (transcript) go(transcript);
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
      onSubmit={(event) => {
        event.preventDefault();
        go(value);
      }}
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
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        placeholder={SEARCH_PLACEHOLDER}
        className={`h-[36px] w-full rounded-full border-2 border-brand-accent bg-white py-[7px] pl-[15px] font-sans text-[16px] text-ink-input transition-shadow placeholder:text-ink-placeholder focus:shadow-search-focus focus:outline-none [&::-webkit-search-cancel-button]:hidden ${mobile ? 'pr-[45px]' : 'pr-[75px]'}`}
      />
      {/* YouMart Lens: search with a photo. */}
      <Link
        href="/lens"
        aria-label="Search with a photo"
        title="Search with a photo"
        className={`absolute top-[4px] flex size-[28px] items-center justify-center rounded-full bg-white text-black hover:text-hover ${mobile ? 'right-[10px]' : 'right-[40px]'}`}
      >
        <Camera aria-hidden="true" className="size-[20px]" strokeWidth={2} />
      </Link>
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
      {open ? (
        <SearchSuggestPanel
          query={value}
          data={data}
          recent={recent}
          onRecentChange={setRecent}
          active={active}
          onPick={go}
          onNavigate={() => {
            rememberSearch(value);
            setOpen(false);
          }}
        />
      ) : null}
    </form>
  );
}
