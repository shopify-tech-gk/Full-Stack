'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import {
  SUBCATEGORY_PLACEHOLDER_IMAGE,
  categoryHref,
  categoryImagePath,
  subcategoryHref,
  type StoreCategory,
} from '@youmart/shared-client';

interface CategoryMegaMenuProps {
  categories: readonly StoreCategory[];
}

export function CategoryMegaMenu({ categories }: CategoryMegaMenuProps) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  return (
    <section aria-labelledby="shop-by-category" className="px-3 py-3 lg:px-[10px] lg:py-2">
      <h2 id="shop-by-category" className="sr-only">
        Shop by category
      </h2>
      <ul className="grid grid-cols-4 gap-x-2 gap-y-6 lg:flex lg:flex-wrap lg:justify-center lg:gap-x-0 lg:gap-y-2 lg:bg-sky-tint lg:px-2 lg:py-2">
        {categories.map((category) => (
          <CategoryItem
            key={category.slug}
            category={category}
            open={activeSlug === category.slug}
            onOpen={() => setActiveSlug(category.slug)}
            onClose={() => setActiveSlug((current) => (current === category.slug ? null : current))}
          />
        ))}
      </ul>
    </section>
  );
}

interface CategoryItemProps {
  category: StoreCategory;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

function CategoryItem({ category, open, onOpen, onClose }: CategoryItemProps) {
  const panelId = `mega-${category.slug}`;
  const hasSubcategories = category.subcategories.length > 0;

  return (
    <li
      className="relative lg:px-[9px] lg:pt-1"
      onMouseEnter={hasSubcategories ? onOpen : undefined}
      onMouseLeave={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onClose();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onClose();
        }
      }}
    >
      <Link
        href={categoryHref(category.slug)}
        className="group flex flex-col items-center text-center"
      >
        <span className="relative block size-[70px] overflow-hidden rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)] lg:size-[54px]">
          <Image
            src={categoryImagePath(category.slug)}
            alt=""
            fill
            sizes="(min-width: 1024px) 54px, 70px"
            className="object-cover"
          />
        </span>
        <span
          className={`mt-2 text-[11px] font-medium leading-[1.2] lg:mt-4 lg:whitespace-nowrap lg:font-semibold ${open ? 'text-hover' : 'text-ink-strong group-hover:text-hover'}`}
        >
          {category.name}
        </span>
      </Link>

      {hasSubcategories ? (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`${open ? 'Hide' : 'Show'} ${category.name} subcategories`}
            onClick={open ? onClose : onOpen}
            className={`mx-auto mt-1 hidden size-5 items-center justify-center lg:flex ${open ? 'text-hover' : 'text-ink-secondary'}`}
          >
            <ChevronDown aria-hidden="true" className="size-4" strokeWidth={1.75} />
          </button>
          {open ? <SubcategoryPanel id={panelId} category={category} /> : null}
        </>
      ) : null}
    </li>
  );
}

function SubcategoryPanel({ id, category }: { id: string; category: StoreCategory }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [alignRight, setAlignRight] = useState(false);

  // Keep the panel inside the viewport for categories near the right edge.
  useLayoutEffect(() => {
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect && rect.right > window.innerWidth - 8) {
      setAlignRight(true);
    }
  }, []);

  return (
    <div
      ref={panelRef}
      id={id}
      className={`absolute top-full z-30 hidden pt-1 lg:block ${alignRight ? 'right-0' : 'left-0'}`}
    >
      <ul className="w-[195px] rounded-md bg-white py-2 shadow-menu">
        {category.subcategories.map((sub) => (
          <li key={sub.slug}>
            <Link
              href={subcategoryHref(category.slug, sub.slug)}
              className="flex items-center gap-4 px-3 py-2 text-[11px] text-ink-strong hover:bg-sky-tint/60 hover:text-hover focus:bg-sky-tint/60 focus:outline-none"
            >
              <Image
                src={SUBCATEGORY_PLACEHOLDER_IMAGE}
                alt=""
                width={24}
                height={24}
                className="size-6 shrink-0 rounded-sm object-cover"
              />
              {sub.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
