import { Search } from 'lucide-react';
import { SEARCH_PLACEHOLDER } from '@youmart/shared-client';

interface SearchBarProps {
  id: string;
  className?: string;
}

export function SearchBar({ id, className = '' }: SearchBarProps) {
  return (
    <form role="search" action="/search" method="get" className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        Search products and brands
      </label>
      <input
        id={id}
        type="search"
        name="q"
        autoComplete="off"
        placeholder={SEARCH_PLACEHOLDER}
        className="h-[34px] w-full rounded-full border-[1.5px] border-brand bg-white pl-4 pr-11 text-[15px] text-ink-strong placeholder:text-ink-body focus:outline-none focus:ring-2 focus:ring-brand/30 lg:h-[32px] lg:text-[15px]"
      />
      <button
        type="submit"
        aria-label="Search"
        className="absolute inset-y-0 right-1 flex w-9 items-center justify-center rounded-full text-brand"
      >
        <Search aria-hidden="true" className="size-[18px]" strokeWidth={2.25} />
      </button>
    </form>
  );
}
