/** True only for a loadable network image; web-relative paths (`/placeholders/...`, `/banners/...`)
 * from shared-client are treated as "no image" and rendered as a native placeholder. */
export function isRemoteImage(src?: string | null): src is string {
  return typeof src === 'string' && /^https?:\/\//i.test(src);
}
