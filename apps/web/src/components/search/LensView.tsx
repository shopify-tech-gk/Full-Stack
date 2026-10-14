'use client';

import { useEffect, useRef, useState, type DragEvent } from 'react';
import Link from 'next/link';
import { Camera, ChevronRight, ImageUp, Loader2, Search, Sparkles } from 'lucide-react';
import {
  ApiError,
  DEMO_PRODUCT_IMAGE,
  type LensProduct,
  type LensResult,
  type ProductCardData,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { ProductCard } from '@/components/product/ProductCard';

export interface LensCategoryLink {
  name: string;
  /** Where it sits, e.g. "Electronics" for a sub; empty for a main. */
  trail: string;
  href: string;
}

/** Longest side sent to the server: plenty to recognise a product, and keeps each search cheap. */
const MAX_SIDE = 1024;

type Phase =
  | { kind: 'idle' }
  | { kind: 'searching'; preview: string }
  | { kind: 'result'; preview: string; result: LensResult; links: LensCategoryLink[] }
  | { kind: 'error'; preview: string | null; message: string };

const toCard = (p: LensProduct): ProductCardData => ({
  id: p.id,
  href: `/product/${p.slug}`,
  title: p.title,
  image: p.imageUrl ?? DEMO_PRODUCT_IMAGE,
  mrp: p.mrp,
  sellingPrice: p.price,
  rating: p.rating ?? 0,
  slug: p.slug,
  ...(p.skuId ? { skuId: p.skuId } : {}),
});

/** Downscale in the browser and re-encode as JPEG; returns [preview data URL, base64 body]. */
async function prepare(file: File): Promise<[string, string]> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
  return [dataUrl, dataUrl.slice(dataUrl.indexOf(',') + 1)];
}

const GRID = 'grid grid-cols-2 gap-x-[10px] md:grid-cols-3 md:gap-x-[20px] lg:grid-cols-5';

export function LensView({
  resolveCategories,
}: {
  resolveCategories: (pairs: LensResult['categories']) => Promise<LensCategoryLink[]>;
}) {
  const session = useSession();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Paste a screenshot / copied image straight in (Ctrl+V).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (file) void search(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  async function search(file: File) {
    if (!file.type.startsWith('image/')) {
      setPhase({
        kind: 'error',
        preview: null,
        message: 'Please choose a photo (JPG, PNG or WebP).',
      });
      return;
    }
    let preview: string | null = null;
    try {
      const [url, image] = await prepare(file);
      preview = url;
      setPhase({ kind: 'searching', preview: url });
      const result = await api.search.lens(image, 'image/jpeg');
      const links = result.categories.length ? await resolveCategories(result.categories) : [];
      setPhase({ kind: 'result', preview: url, result, links });
    } catch (err) {
      setPhase({
        kind: 'error',
        preview,
        message:
          err instanceof ApiError
            ? err.message
            : 'Could not search with this photo. Check your connection and try again.',
      });
    }
  }

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void search(file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files);
  };

  const heading = (
    <div className="mb-[20px] flex items-center gap-[10px]">
      <span className="flex size-[40px] items-center justify-center rounded-full bg-brand-accent text-white">
        <Sparkles aria-hidden="true" className="size-[20px]" />
      </span>
      <div>
        <h1 className="font-ui text-[20px] font-semibold leading-[1.3] text-heading lg:text-[25px]">
          YouMart Lens
        </h1>
        <p className="font-sans text-[14px] text-ink-body">
          Search with a photo - find the same product, or similar ones.
        </p>
      </div>
    </div>
  );

  if (session.status === 'loading') {
    return heading;
  }

  if (session.status === 'anonymous') {
    return (
      <>
        {heading}
        <div className="rounded-[16px] border border-gray-200 bg-white p-[30px] text-center">
          <p className="font-ui text-[16px] text-heading">Sign in to search with a photo.</p>
          <Link
            href="/account?returnTo=/lens"
            className="mt-[16px] inline-block rounded-full bg-brand-accent px-[28px] py-[10px] font-ui text-[15px] font-semibold text-white"
          >
            Sign in
          </Link>
        </div>
      </>
    );
  }

  const preview = phase.kind === 'idle' ? null : phase.preview;
  const result = phase.kind === 'result' ? phase.result : null;

  return (
    <>
      {heading}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="flex flex-col gap-[20px] md:flex-row">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`relative flex min-h-[220px] flex-1 flex-col items-center justify-center gap-[12px] overflow-hidden rounded-[16px] border-2 border-dashed p-[20px] text-center transition-colors md:max-w-[420px] ${
            dragging ? 'border-brand-accent bg-blue-50' : 'border-gray-300 bg-white'
          }`}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local data: URL preview
            <img
              src={preview}
              alt="Your photo"
              className="max-h-[260px] w-auto rounded-[12px] object-contain"
            />
          ) : (
            <>
              <ImageUp aria-hidden="true" className="size-[42px] text-brand-accent" />
              <p className="font-ui text-[16px] font-semibold text-heading">
                Drag a product photo here
              </p>
              <p className="font-sans text-[13px] text-ink-body">
                or paste one (Ctrl+V), or choose a file
              </p>
            </>
          )}
          {phase.kind === 'searching' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-[8px] bg-black/45 text-white">
              <Loader2 aria-hidden="true" className="size-[34px] animate-spin" />
              <span className="font-ui text-[15px] font-semibold">Finding this product…</span>
            </div>
          ) : null}
          <div className="flex flex-wrap justify-center gap-[10px]">
            <button
              type="button"
              disabled={phase.kind === 'searching'}
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-[6px] rounded-full bg-brand-accent px-[18px] py-[9px] font-ui text-[14px] font-semibold text-white disabled:opacity-60"
            >
              <ImageUp aria-hidden="true" className="size-[17px]" />
              {preview ? 'Another photo' : 'Choose photo'}
            </button>
            <button
              type="button"
              disabled={phase.kind === 'searching'}
              onClick={() => cameraRef.current?.click()}
              className="flex items-center gap-[6px] rounded-full border-2 border-brand-accent px-[16px] py-[7px] font-ui text-[14px] font-semibold text-brand-accent disabled:opacity-60 md:hidden"
            >
              <Camera aria-hidden="true" className="size-[17px]" />
              Take photo
            </button>
          </div>
        </div>

        <div className="flex-1">
          {phase.kind === 'error' ? (
            <div className="rounded-[16px] bg-red-50 p-[20px] font-ui text-[15px] text-red-700">
              {phase.message}
            </div>
          ) : null}

          {result && !result.identified ? (
            <div className="rounded-[16px] border border-gray-200 bg-white p-[20px]">
              <p className="font-ui text-[18px] font-semibold text-heading">
                We couldn&apos;t spot a product
              </p>
              <p className="mt-[6px] font-sans text-[14px] text-ink-body">
                Use a photo where one product fills most of the picture, in good light.
              </p>
            </div>
          ) : null}

          {result?.identified && phase.kind === 'result' ? (
            <div className="rounded-[16px] border border-gray-200 bg-white p-[20px]">
              <p className="font-ui text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-placeholder">
                Looks like
              </p>
              <p className="font-ui text-[24px] font-semibold leading-[1.25] text-heading">
                {result.label}
              </p>
              <div className="mt-[8px] flex flex-wrap gap-[6px]">
                {[result.brand, result.productType, result.colour]
                  .filter((x): x is string => Boolean(x))
                  .map((x) => (
                    <span
                      key={x}
                      className="rounded-full bg-blue-50 px-[10px] py-[3px] font-ui text-[13px] text-brand-accent"
                    >
                      {x}
                    </span>
                  ))}
              </div>
              {result.catalogCategories.length > 0 ? (
                <div className="mt-[14px] flex flex-wrap items-center gap-[8px]">
                  <span className="font-sans text-[14px] text-ink-body">Listed in</span>
                  {result.catalogCategories.map((c) => (
                    <Link
                      key={c.id}
                      href={`/category/${c.slug}`}
                      className="flex items-center gap-[2px] rounded-full bg-brand-accent py-[4px] pl-[12px] pr-[8px] font-ui text-[13px] font-semibold text-white"
                    >
                      {c.name}
                      <ChevronRight aria-hidden="true" className="size-[14px]" />
                    </Link>
                  ))}
                </div>
              ) : null}
              {phase.links.length > 0 ? (
                <div className="mt-[12px] flex flex-wrap items-center gap-[8px]">
                  <span className="font-sans text-[14px] text-ink-body">Shop</span>
                  {phase.links.map((c) => (
                    <Link
                      key={c.href + c.name}
                      href={c.href}
                      className="rounded-full border border-brand-accent px-[12px] py-[3px] font-ui text-[13px] text-brand-accent hover:bg-blue-50"
                    >
                      {c.trail ? `${c.trail} › ${c.name}` : c.name}
                    </Link>
                  ))}
                </div>
              ) : null}
              {result.query ? (
                <Link
                  href={`/search?q=${encodeURIComponent(result.query)}`}
                  className="mt-[16px] inline-flex items-center gap-[6px] font-ui text-[14px] font-semibold text-brand-accent hover:underline"
                >
                  <Search aria-hidden="true" className="size-[15px]" />
                  See all results for &ldquo;{result.query}&rdquo;
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {result?.identified ? (
        <>
          <h2 className="mb-[14px] mt-[30px] font-ui text-[19px] font-semibold text-heading">
            {result.matches.length > 0
              ? 'Same product on YouMart'
              : 'We don’t have this exact product yet'}
          </h2>
          {result.matches.length > 0 ? (
            <ul className={GRID}>
              {result.matches.map((p) => (
                <li key={p.id} className="mb-[10px]">
                  <ProductCard product={toCard(p)} variant="listing" />
                </li>
              ))}
            </ul>
          ) : null}
          {result.related.length > 0 ? (
            <>
              <h2 className="mb-[14px] mt-[30px] font-ui text-[19px] font-semibold text-heading">
                Related products
              </h2>
              <ul className={GRID}>
                {result.related.map((p) => (
                  <li key={p.id} className="mb-[10px]">
                    <ProductCard product={toCard(p)} variant="listing" />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}
