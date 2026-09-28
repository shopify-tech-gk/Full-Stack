'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { X } from 'lucide-react';
import {
  categoryHref,
  categoryImagePath,
  type StoreCategory,
  type StoreSubcategory,
} from '@youmart/shared-client';
import { SearchBar } from './SearchBar';
import { Caret } from '@/components/ui/Caret';

interface MobileCategoryDrawerProps {
  open: boolean;
  onClose: () => void;
  categories: readonly StoreCategory[];
}

export function MobileCategoryDrawer({ open, onClose, categories }: MobileCategoryDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const opener = document.activeElement as HTMLElement | null;
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
      opener?.focus();
    };
  }, [open, onClose]);

  return (
    <div
      id="mobile-category-drawer"
      className={`fixed inset-0 z-[1000] lg:hidden ${open ? 'visible' : 'invisible'}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close category menu"
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Shop by category"
        className={`absolute inset-y-0 left-0 flex w-[300px] max-w-[85vw] flex-col bg-white transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex justify-end px-[12px] pt-[12px]">
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close category menu"
            onClick={onClose}
            className="flex size-[20px] items-center justify-center rounded-[2px] border-2 border-ink-icon text-ink-icon"
          >
            <X aria-hidden="true" className="size-[14px]" strokeWidth={3} />
          </button>
        </div>
        <SearchBar id="search-drawer" size="mobile" className="mx-[15px] mt-[10px]" />

        <nav aria-label="Categories" className="mt-[8px] flex-1 overflow-y-auto pb-6">
          <ul className="px-[30px]">
            {categories.map((category) => (
              <DrawerRow
                key={category.slug}
                path={[category.slug]}
                name={category.name}
                image={categoryImagePath(category.slug)}
                items={category.subcategories}
                onNavigate={onClose}
              />
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}

interface DrawerRowProps {
  path: string[];
  name: string;
  image?: string;
  items: StoreSubcategory[];
  onNavigate: () => void;
}

function DrawerRow({ path, name, image, items, onNavigate }: DrawerRowProps) {
  const [expanded, setExpanded] = useState(false);
  const panelId = `drawer-${path.join('-')}`;
  const depth = path.length - 1;

  return (
    <li>
      <div
        className={`flex min-h-[60px] items-center ${depth === 0 ? 'p-[15px]' : 'py-[10px] pr-[15px]'}`}
      >
        <Link
          href={categoryHref(...path)}
          onClick={onNavigate}
          className="flex items-center gap-[10px] font-ui text-[14.6px] leading-[1.15] text-brand"
        >
          {image ? (
            <span className="relative block size-[30px] shrink-0 overflow-hidden rounded-full">
              <Image src={image} alt="" fill sizes="30px" className="object-cover" />
            </span>
          ) : null}
          <span>{name}</span>
        </Link>
        {items.length > 0 ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            aria-label={`${expanded ? 'Hide' : 'Show'} ${name} subcategories`}
            onClick={() => setExpanded((value) => !value)}
            className="ml-[4px] flex h-[35px] w-[30px] shrink-0 items-center justify-center text-brand"
          >
            <Caret
              className={`h-[6px] w-[10px] transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        ) : null}
      </div>
      {items.length > 0 ? (
        <ul id={panelId} hidden={!expanded} className="pl-[40px]">
          {items.map((item) => (
            <DrawerRow
              key={item.slug}
              path={[...path, item.slug]}
              name={item.name}
              items={item.children}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
