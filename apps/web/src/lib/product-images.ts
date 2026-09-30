'use client';

// Cart lines carry no image (CartView has none), so each line's picture comes from the catalog:
// GET /api/catalog/products/:slug -> images[0].url, cached per slug for the page's lifetime.
// Add-to-cart seeds the cache with the image the shopper just saw.
import { useEffect, useSyncExternalStore } from 'react';
import { DEMO_PRODUCT_IMAGE } from '@youmart/shared-client';
import { api } from './api';

const images = new Map<string, string>();
const pending = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

function changed(): void {
  version += 1;
  listeners.forEach((listener) => listener());
}

export function rememberProductImage(slug: string, url: string): void {
  if (images.get(slug) === url) return;
  images.set(slug, url);
  changed();
}

function load(slug: string): void {
  if (images.has(slug) || pending.has(slug)) return;
  pending.add(slug);
  api.catalog
    .getProduct(slug)
    .then((product) => rememberProductImage(slug, product.images[0]?.url ?? DEMO_PRODUCT_IMAGE))
    // Product gone or network down: the placeholder, without retrying on every render.
    .catch(() => rememberProductImage(slug, DEMO_PRODUCT_IMAGE))
    .finally(() => pending.delete(slug));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Image URL for each product slug (the placeholder until the lookup resolves). */
export function useProductImages(slugs: readonly string[]): (slug: string) => string {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  const key = slugs.join('|');
  useEffect(() => {
    key.split('|').filter(Boolean).forEach(load);
  }, [key]);
  return (slug) => images.get(slug) ?? DEMO_PRODUCT_IMAGE;
}
