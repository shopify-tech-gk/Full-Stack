/**
 * A short, human label for a client from its User-Agent - shown on the phone's QR confirm sheet
 * ("Chrome · Windows") and in Logged-in devices. Best-effort and display-only: never used for any
 * security decision.
 */
export function deviceLabel(userAgent: string | null | undefined): {
  label: string;
  kind: 'APP' | 'BROWSER' | 'UNKNOWN';
} {
  const ua = userAgent ?? '';
  if (!ua) return { label: 'Unknown device', kind: 'UNKNOWN' };

  // The YouMart / Expo app: React Native's fetch (okhttp on Android, CFNetwork on iOS).
  if (/okhttp/i.test(ua)) return { label: 'YouMart app · Android', kind: 'APP' };
  if (/CFNetwork|Darwin/i.test(ua) && !/Mozilla/i.test(ua)) {
    return { label: 'YouMart app · iPhone', kind: 'APP' };
  }
  if (/Expo|YouMart/i.test(ua) && !/Mozilla/i.test(ua))
    return { label: 'YouMart app', kind: 'APP' };

  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /SamsungBrowser/.test(ua)
        ? 'Samsung Internet'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Chrome\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : 'Browser';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /iPhone|iPad/.test(ua)
      ? 'iPhone'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'Mac'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';
  return { label: os ? `${browser} · ${os}` : browser, kind: 'BROWSER' };
}
