'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { X } from 'lucide-react';
import {
  categoryHref,
  categoryImagePath,
  subcategoryHref,
  type StoreCategory,
} from '@youmart/shared-client';
import { SearchBar } from './SearchBar';
import { Caret } from '@/components/ui/Caret';

interface MobileCategoryDrawerProps {
  open: boolean;
  onClose: () => void;
  categories: readonly StoreCategory[];
}

export function MobileCategoryDrawer({ open, onClose, categories }: MobileCategoryDrawerProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div
      id="mobile-category-drawer"
      className={`fixed inset-0 z-50 lg:hidden ${open ? 'visible' : 'invisible'}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close category menu"
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Shop by category"
        className={`absolute inset-y-0 left-0 flex w-[82%] max-w-[320px] flex-col bg-white shadow-menu transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex justify-end px-4 pt-3">
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close category menu"
            onClick={onClose}
            className="flex size-6 items-center justify-center rounded-sm border-2 border-ink-strong text-ink-strong"
          >
            <X aria-hidden="true" className="size-4" strokeWidth={2.5} />
          </button>
        </div>
        <SearchBar id="search-drawer" className="mx-3 mt-2" />

        <nav aria-label="Categories" className="mt-3 flex-1 overflow-y-auto pb-6">
          <ul>
            {categories.map((category) => {
              const isOpen = expanded === category.slug;
              const panelId = `drawer-sub-${category.slug}`;
              return (
                <li key={category.slug}>
                  <div className="flex items-center gap-2 py-2.5 pl-10 pr-4">
                    <Link
                      href={categoryHref(category.slug)}
                      onClick={onClose}
                      className="flex items-center gap-3 text-[15px] leading-tight text-brand"
                    >
                      <span className="relative block size-[28px] shrink-0 overflow-hidden rounded-full bg-sky-tint">
                        <Image
                          src={categoryImagePath(category.slug)}
                          alt=""
                          fill
                          sizes="28px"
                          className="object-cover"
                        />
                      </span>
                      <span>{category.name}</span>
                    </Link>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      aria-label={`${isOpen ? 'Hide' : 'Show'} ${category.name} subcategories`}
                      onClick={() => setExpanded(isOpen ? null : category.slug)}
                      className="flex size-7 shrink-0 items-center justify-center text-brand"
                    >
                      <Caret
                        className={`h-[6px] w-[10px] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </div>
                  <ul id={panelId} hidden={!isOpen} className="pb-2 pl-[88px] pr-4">
                    {category.subcategories.map((sub) => (
                      <li key={sub.slug}>
                        <Link
                          href={subcategoryHref(category.slug, sub.slug)}
                          onClick={onClose}
                          className="block py-1.5 text-[14px] text-ink-secondary hover:text-hover"
                        >
                          {sub.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
