'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  SUBCATEGORY_PLACEHOLDER_IMAGE,
  categoryHref,
  categoryImagePath,
  type StoreCategory,
  type StoreSubcategory,
} from '@youmart/shared-client';

interface CategoryMegaMenuProps {
  categories: readonly StoreCategory[];
}

/**
 * Desktop (>= 1025px): wrapping strip of 60px circles with hover mega-dropdowns (+ flyouts for the
 * third level). Below 1025px: plain grid - 4 columns of 75px circles on mobile, 5 of 158px on
 * tablet - exactly as the live site switches layouts.
 */
export function CategoryMegaMenu({ categories }: CategoryMegaMenuProps) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  return (
    <section aria-labelledby="shop-by-category">
      <h2 id="shop-by-category" className="sr-only">
        Shop by category
      </h2>

      <ul className="grid grid-cols-4 gap-y-[20px] md:grid-cols-5 lg:hidden">
        {categories.map((category) => (
          <li key={category.slug}>
            <Link
              href={categoryHref(category.slug)}
              className="mx-auto flex w-[75px] flex-col items-center text-center md:w-[158px]"
            >
              <span className="relative block size-[75px] overflow-hidden rounded-full md:size-[158px]">
                <Image
                  src={categoryImagePath(category.slug)}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 158px, 75px"
                  className="object-cover"
                />
              </span>
              <span className="mt-[6px] font-sans text-[10px] font-bold leading-[13px] text-ink-body md:mt-[7px] md:text-[15px] md:leading-[23px]">
                {category.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="relative -mt-px hidden bg-strip-frame px-[10px] pb-[14px] pt-[8px] lg:block">
        <ul className="flex flex-wrap justify-center bg-page">
          {categories.map((category) => (
            <DesktopCategory
              key={category.slug}
              category={category}
              open={activeSlug === category.slug}
              onOpen={() => setActiveSlug(category.slug)}
              onClose={() =>
                setActiveSlug((current) => (current === category.slug ? null : current))
              }
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

interface DesktopCategoryProps {
  category: StoreCategory;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

function DesktopCategory({ category, open, onOpen, onClose }: DesktopCategoryProps) {
  const panelId = `mega-${category.slug}`;
  const color = open ? 'text-hover' : 'text-ink-strong';

  return (
    <li
      className="relative"
      onMouseEnter={onOpen}
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
      <Link href={categoryHref(category.slug)} className="block px-[10px] pt-[7px] text-center">
        <span className="relative mx-auto mb-[10px] block size-[60px] overflow-hidden rounded-full">
          <Image
            src={categoryImagePath(category.slug)}
            alt=""
            fill
            sizes="60px"
            className="object-cover"
          />
        </span>
        <span
          className={`block whitespace-nowrap font-ui text-[11px] font-semibold leading-[25.6px] ${color}`}
        >
          {category.name}
        </span>
      </Link>
      <div className="flex h-[25.6px] items-center justify-end px-[20px]">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`${open ? 'Hide' : 'Show'} ${category.name} subcategories`}
          onClick={open ? onClose : onOpen}
          className={`flex h-full items-center ${open ? 'text-hover' : 'text-ink-chevron'}`}
        >
          <ChevronDown aria-hidden="true" className="size-[11px]" strokeWidth={3} />
        </button>
      </div>
      {open ? (
        <MenuPanel
          id={panelId}
          parentPath={[category.slug]}
          items={category.subcategories}
          placement="below"
        />
      ) : null}
    </li>
  );
}

interface MenuPanelProps {
  id: string;
  parentPath: string[];
  items: StoreSubcategory[];
  placement: 'below' | 'side';
}

function MenuPanel({ id, parentPath, items, placement }: MenuPanelProps) {
  const ref = useRef<HTMLUListElement>(null);
  const [shift, setShift] = useState(0);
  const [flip, setFlip] = useState(false);

  // Dropdowns clamp to the viewport's right edge (as live); flyouts flip left, since live's
  // third-level flyouts open off-screen at the right edge.
  useLayoutEffect(() => {
    const rect = ref.current?.getBoundingClientRect();
    const overflow = rect ? rect.right - document.documentElement.clientWidth : 0;
    if (overflow > 0) {
      if (placement === 'below') {
        setShift(overflow);
      } else {
        setFlip(true);
      }
    }
  }, [placement]);

  const position =
    placement === 'below' ? 'top-full left-0' : `top-0 ${flip ? 'right-full' : 'left-full'}`;

  return (
    <ul
      ref={ref}
      id={id}
      style={shift ? { transform: `translateX(-${shift}px)` } : undefined}
      className={`absolute z-[999] w-[220px] rounded-menu border border-line-menu bg-white py-[5px] shadow-menu ${position}`}
    >
      {items.map((item) => (
        <MenuRow key={item.slug} parentPath={parentPath} item={item} />
      ))}
    </ul>
  );
}

function MenuRow({ parentPath, item }: { parentPath: string[]; item: StoreSubcategory }) {
  const [open, setOpen] = useState(false);
  const hasChildren = item.children.length > 0;
  const path = [...parentPath, item.slug];

  return (
    <li
      className="relative"
      onMouseEnter={hasChildren ? () => setOpen(true) : undefined}
      onMouseLeave={hasChildren ? () => setOpen(false) : undefined}
      onFocus={hasChildren ? () => setOpen(true) : undefined}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <Link
        href={categoryHref(...path)}
        aria-haspopup={hasChildren || undefined}
        aria-expanded={hasChildren ? open : undefined}
        className={`group block h-[45px] pl-[10px] pt-[5px] focus:outline-none ${open ? 'text-hover' : 'text-ink-strong'}`}
      >
        <span className="flex h-[40px] items-center gap-[4px]">
          <Image
            src={SUBCATEGORY_PLACEHOLDER_IMAGE}
            alt=""
            width={40}
            height={40}
            className="size-[40px] shrink-0 object-cover"
          />
          <span className="font-ui text-[12px] leading-[25.6px] group-hover:text-hover group-focus-visible:text-hover group-focus-visible:underline">
            {item.name}
          </span>
          {hasChildren ? (
            <ChevronRight
              aria-hidden="true"
              className="ml-[6px] size-[11px] group-hover:text-hover"
              strokeWidth={3}
            />
          ) : null}
        </span>
      </Link>
      {hasChildren && open ? (
        <MenuPanel
          id={`mega-${path.join('-')}`}
          parentPath={path}
          items={item.children}
          placement="side"
        />
      ) : null}
    </li>
  );
}
