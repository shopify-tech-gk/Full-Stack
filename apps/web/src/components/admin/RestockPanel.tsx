'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, FolderTree, Link2Off, Package, Send, X } from 'lucide-react';
import { buildCategoryTaxonomy, formatMoney, type ProductListItem } from '@youmart/shared-client';
import { CATEGORY_TAXONOMY_SOURCE } from '@youmart/shared-client/src/category-taxonomy.data';
import { api } from '@/lib/api';
import { Button, useDebounced } from './ui';

// v1.17 Admin -> Product requests -> "Restocked": pick what the shopper is sent to (a product or a
// category, or nothing) before they get the "Back in stock" message. The app opens the app path
// (/product/<slug>, /category/<slug>?taxo=...), the website the web path.

export interface RestockLink {
  label: string;
  appPath: string;
  webPath: string;
  imageUrl?: string;
}

interface CategoryOption {
  key: string;
  name: string;
  trail: string;
  appPath: string;
  webPath: string;
}

/** Every taxonomy node (main, sub, sub-to-sub) with the app and website paths it opens. */
function categoryOptions(): CategoryOption[] {
  const out: CategoryOption[] = [];
  const catalogSlug = (href: string) =>
    href.startsWith('/search') ? '' : (href.split('?')[0]?.split('/').filter(Boolean).pop() ?? '');
  const add = (path: string[], name: string, href: string, trail: string) =>
    out.push({
      key: path.join('~'),
      name,
      trail,
      appPath: `/category/${catalogSlug(href) || path[path.length - 1]}?taxo=${path.join('~')}`,
      webPath: href,
    });
  for (const main of buildCategoryTaxonomy(CATEGORY_TAXONOMY_SOURCE)) {
    add([main.slug], main.name, main.href, '');
    for (const sub of main.subcategories) {
      add([main.slug, sub.slug], sub.name, sub.href, main.name);
      for (const leaf of sub.children) {
        add([main.slug, sub.slug, leaf.slug], leaf.name, leaf.href, `${main.name} › ${sub.name}`);
      }
    }
  }
  return out;
}

type Mode = 'product' | 'category' | 'none';

export function RestockPanel({
  item,
  others,
  busy,
  onCancel,
  onConfirm,
}: {
  item: string;
  /** Other open requests for the same item. */
  others: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (link: RestockLink | undefined, notifyAll: boolean) => void;
}) {
  const [mode, setMode] = useState<Mode>('product');
  const [q, setQ] = useState(item);
  const query = useDebounced(q.trim());
  const [products, setProducts] = useState<ProductListItem[] | null>(null);
  const [picked, setPicked] = useState<RestockLink | null>(null);
  const [notifyAll, setNotifyAll] = useState(true);
  const categories = useMemo(() => (mode === 'category' ? categoryOptions() : []), [mode]);

  useEffect(() => {
    if (mode !== 'product' || query.length < 2) {
      setProducts(null);
      return;
    }
    let active = true;
    api.catalog
      .listProducts({ q: query, limit: 8 })
      .then((page) => active && setProducts(page.items))
      .catch(() => active && setProducts([]));
    return () => {
      active = false;
    };
  }, [mode, query]);

  const matches = useMemo(() => {
    if (mode !== 'category' || query.length < 2) return [];
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return categories
      .filter((c) => words.every((w) => `${c.name} ${c.trail}`.toLowerCase().includes(w)))
      .slice(0, 8);
  }, [mode, query, categories]);

  const tab = (value: Mode, label: string, Icon: typeof Package) => (
    <button
      type="button"
      onClick={() => {
        setMode(value);
        setPicked(null);
      }}
      className={`inline-flex items-center gap-[6px] rounded-[9px] px-[12px] py-[7px] text-[13px] font-semibold transition ${
        mode === value
          ? 'bg-[#0142aa] text-white'
          : 'bg-white text-[#0b1b3f] ring-1 ring-inset ring-[#d7deea] hover:bg-[#f6f8fc]'
      }`}
    >
      <Icon aria-hidden="true" className="size-[14px]" />
      {label}
    </button>
  );

  const option = (
    key: string,
    title: string,
    sub: string,
    link: RestockLink,
    image?: string | null,
  ) => {
    const on = picked?.appPath === link.appPath;
    return (
      <li key={key}>
        <button
          type="button"
          onClick={() => setPicked(link)}
          className={`flex w-full items-center gap-[10px] rounded-[10px] px-[10px] py-[8px] text-left transition ${
            on ? 'bg-[#eef3ff] ring-2 ring-[#0142aa]' : 'hover:bg-[#f6f8fc]'
          }`}
        >
          {image !== undefined && (
            <span className="size-[38px] shrink-0 overflow-hidden rounded-[8px] bg-[#f1f4f9]">
              {/* eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail */}
              {image ? <img src={image} alt="" className="size-full object-cover" /> : null}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold text-[#0b1b3f]">
              {title}
            </span>
            {sub && <span className="block truncate text-[12px] text-[#5d6b85]">{sub}</span>}
          </span>
          {on && <Check aria-hidden="true" className="size-[16px] text-[#0142aa]" />}
        </button>
      </li>
    );
  };

  const ready = mode === 'none' || picked !== null;

  return (
    <div className="mt-[12px] rounded-[14px] border border-[#cfdcf4] bg-[#f8fafd] p-[14px]">
      <p className="text-[13.5px] font-semibold text-[#0b1b3f]">
        Where should “Back in stock” take them?
      </p>
      <div className="mt-[10px] flex flex-wrap gap-[8px]">
        {tab('product', 'A product', Package)}
        {tab('category', 'A category', FolderTree)}
        {tab('none', 'No link', Link2Off)}
      </div>

      {mode !== 'none' && (
        <>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPicked(null);
            }}
            placeholder={mode === 'product' ? 'Search products…' : 'Search categories…'}
            className="mt-[10px] h-[38px] w-full rounded-[10px] border border-[#d7deea] bg-white px-[12px] text-[14px] text-[#0b1b3f] focus:border-[#0142aa] focus:outline-none focus:ring-2 focus:ring-[#0142aa]/15"
          />
          <ul className="mt-[8px] flex max-h-[260px] flex-col gap-[2px] overflow-y-auto">
            {mode === 'product' &&
              (products === null ? (
                <li className="px-[10px] py-[8px] text-[12.5px] text-[#8a95ab]">
                  Type at least 2 letters.
                </li>
              ) : products.length === 0 ? (
                <li className="px-[10px] py-[8px] text-[12.5px] text-[#8a95ab]">
                  No products match - add it to the catalog first, or link a category.
                </li>
              ) : (
                products.map((p) =>
                  option(
                    p.id,
                    p.title,
                    `${formatMoney(p.price)} · ${p.category.name}`,
                    {
                      label: p.title,
                      appPath: `/product/${p.slug}`,
                      webPath: `/product/${p.slug}`,
                      ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}),
                    },
                    p.imageUrl,
                  ),
                )
              ))}
            {mode === 'category' &&
              (matches.length === 0 ? (
                <li className="px-[10px] py-[8px] text-[12.5px] text-[#8a95ab]">
                  {query.length < 2 ? 'Type at least 2 letters.' : 'No categories match.'}
                </li>
              ) : (
                matches.map((c) =>
                  option(c.key, c.name, c.trail, {
                    label: c.name,
                    appPath: c.appPath,
                    webPath: c.webPath,
                  }),
                )
              ))}
          </ul>
        </>
      )}

      {others > 0 && (
        <label className="mt-[12px] flex cursor-pointer items-center gap-[8px] text-[13px] text-[#24324d]">
          <input
            type="checkbox"
            checked={notifyAll}
            onChange={(e) => setNotifyAll(e.target.checked)}
            className="size-[16px] accent-[#0142aa]"
          />
          Also tell the {others} other {others === 1 ? 'person' : 'people'} who asked for this
        </label>
      )}

      <div className="mt-[12px] flex flex-wrap justify-end gap-[8px]">
        <Button icon={X} onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="primary"
          icon={Send}
          busy={busy}
          disabled={!ready}
          onClick={() => onConfirm(mode === 'none' ? undefined : (picked ?? undefined), notifyAll)}
        >
          Mark restocked &amp; notify
        </Button>
      </div>
    </div>
  );
}
