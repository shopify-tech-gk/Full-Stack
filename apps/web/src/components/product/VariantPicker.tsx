'use client';

import { Shirt } from 'lucide-react';
import { formatMoney, sizeRank, type Money, type ProductDetailData, type ProductVariant } from '@youmart/shared-client';

// v1.17 option picker on the website (same rules as the app): one group per option kind the
// variants differ by (Style, then Weight...). A later group only lists what exists for the earlier
// picks; combinations without a price show greyed out. Colours / styles with photos are picture
// cards; weights and sizes are tiles with their price.

const money = (m: Money) => formatMoney(m).replace(/\.00$/, '');
const norm = (s: string | undefined) => (s ?? '').toLowerCase().replace(/\s+/g, '');
const same = (a: string | undefined, b: string | undefined) => norm(a) === norm(b);

/** "900 g" -> 0.9, "5 kg" -> 5, "2 L" -> 2: weight tiles in size order. */
function amount(v: string): number {
  const m = /(\d+(?:\.\d+)?)\s*(kg|kilo|g|gm|gram|l|lit|ml)?/i.exec(v);
  if (!m) return Number.MAX_VALUE;
  const n = Number(m[1]);
  return /^(g|gm|gram|ml)/i.test(m[2] ?? '') ? n / 1000 : n;
}

interface Choice {
  value: string;
  variants: ProductVariant[];
  on: boolean;
}

function priceText(c: Choice) {
  const first = c.variants[0];
  if (!first) return 'Unavailable';
  const several = c.variants.some((v) => v.sellingPrice !== first.sellingPrice);
  return `${several ? 'from ' : ''}${money(first.sellingPrice)}`;
}

export function VariantPicker({
  prod,
  selectedSkuId,
  onSelect,
}: {
  prod: Pick<ProductDetailData, 'variants' | 'variantDims' | 'unavailableVariants'>;
  selectedSkuId: string | null;
  onSelect: (skuId: string) => void;
}) {
  const sel = prod.variants.find((v) => v.skuId === selectedSkuId) ?? prod.variants[0];
  if (!sel) return null;
  const dims = prod.variantDims.length ? prod.variantDims : [{ key: '', name: 'Option' }];
  const valueOf = (options: Readonly<Record<string, string>>, label: string, key: string) => (key ? options[key] : label);

  const pick = (choice: Choice, d: number) => {
    if (choice.variants.length === 0) return;
    // Keep the shopper's later picks when that combination exists (Style changes, Weight stays).
    const later = dims.slice(d + 1);
    const keep = choice.variants.find((v) => later.every((l) => same(v.options[l.key], sel.options[l.key])));
    onSelect((keep ?? choice.variants[0]!).skuId);
  };

  return (
    <div className="mb-[18px] space-y-[16px] font-ui">
      {dims.map((dim, d) => {
        const earlier = dims.slice(0, d);
        const fits = (options: Readonly<Record<string, string>>) => earlier.every((e) => same(options[e.key], sel.options[e.key]));
        const choices: Choice[] = [];
        const add = (value: string | undefined, variant: ProductVariant | null) => {
          if (!value) return;
          let c = choices.find((x) => same(x.value, value));
          if (!c) {
            c = { value, variants: [], on: same(value, valueOf(sel.options, sel.label, dim.key)) };
            choices.push(c);
          }
          if (variant) c.variants.push(variant);
        };
        for (const v of prod.variants) if (fits(v.options)) add(valueOf(v.options, v.label, dim.key), v);
        for (const u of prod.unavailableVariants) if (fits(u.options)) add(valueOf(u.options, u.label, dim.key), null);
        if (dim.key === 'weight') choices.sort((a, b) => amount(a.value) - amount(b.value));
        if (dim.key === 'size') choices.sort((a, b) => sizeRank(a.value) - sizeRank(b.value));
        const current = choices.find((c) => c.on)?.value ?? '';
        const visual = dim.key !== 'weight' && dim.key !== 'size' && choices.some((c) => c.variants[0]?.image);
        const name = dim.key === 'color' || dim.key === 'colour' ? 'Colour' : dim.name;

        return (
          <fieldset key={dim.key || 'option'}>
            <legend className="mb-[8px] text-[14px] text-ink-muted">
              {name}: <strong className="font-semibold text-heading">{current}</strong>
            </legend>
            <div className="flex flex-wrap gap-[8px]">
              {choices.map((c) => {
                const na = c.variants.length === 0;
                const image = c.variants.find((v) => v.image)?.image;
                const base = `relative rounded-[10px] border text-left transition-[border-color,box-shadow] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  c.on ? 'border-brand shadow-[0_0_0_1px] shadow-brand' : 'border-catalog-rule hover:border-[#9db5e0]'
                } ${na ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`;
                return visual ? (
                  <button
                    key={c.value}
                    type="button"
                    aria-pressed={c.on}
                    disabled={na}
                    onClick={() => pick(c, d)}
                    title={c.value}
                    className={`${base} w-[92px] overflow-hidden bg-white`}
                  >
                    <span className="flex h-[76px] items-center justify-center bg-white">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt="" className="size-full object-contain p-[4px]" />
                      ) : (
                        <Shirt aria-hidden="true" className="size-[22px] text-[#cbd5e1]" />
                      )}
                    </span>
                    <span className="block border-t border-catalog-rule px-[6px] py-[4px]">
                      <span className="block truncate text-[12px] font-medium text-heading">{c.value}</span>
                      <span className={`block text-[12px] ${na ? 'text-ink-muted' : 'font-semibold text-heading'}`}>{priceText(c)}</span>
                    </span>
                  </button>
                ) : (
                  <button
                    key={c.value}
                    type="button"
                    aria-pressed={c.on}
                    disabled={na}
                    onClick={() => pick(c, d)}
                    className={`${base} min-w-[84px] bg-white px-[12px] py-[7px] ${c.on ? 'bg-[#f3f7fe]' : ''}`}
                  >
                    <span className={`block text-[14px] ${c.on ? 'font-semibold text-brand' : 'font-medium text-heading'} ${na ? 'line-through' : ''}`}>{c.value}</span>
                    <span className="block text-[12.5px] text-ink-muted">{priceText(c)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
