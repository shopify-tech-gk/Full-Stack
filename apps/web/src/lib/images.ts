/**
 * Catalog images are absolute CDN URLs (CDN_BASE_URL + stored key, or an absolute URL from the
 * import) and are served pre-sized by the CDN, so they skip Next's optimizer - no per-host config,
 * whatever host the catalog data points at. Local SVG placeholders skip it too.
 */
export function skipImageOptimizer(src: string): boolean {
  return src.endsWith('.svg') || /^https?:\/\//i.test(src);
}
