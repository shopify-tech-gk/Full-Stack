// Storefront URL map (W6 clean-URL scheme) - every internal link is built from here so web and
// mobile deep links agree. Old WordPress-style paths 301 to these (apps/web/next.config.mjs).
export const ROUTES = {
  home: '/',
  shop: '/shop',
  search: '/search',
  cart: '/cart',
  checkout: '/checkout',
  wishlist: '/wishlist',
  account: '/account',
  orders: '/account/orders',
  addresses: '/account/addresses',
  accountDetails: '/account/details',
  trackOrder: '/track-order',
  cancelOrder: '/cancel-order',
  orderNotifications: '/order-notifications',
  contact: '/contact',
  customerCare: '/customer-care',
} as const;

/** One of the signed-in customer's orders. */
export function orderHref(orderNumber: string): string {
  return `${ROUTES.orders}/${encodeURIComponent(orderNumber)}`;
}

/** The sign-in page, returning to `path` afterwards (checked against an allowlist on use). */
export function loginHref(returnTo?: string): string {
  return returnTo ? `${ROUTES.account}?returnTo=${encodeURIComponent(returnTo)}` : ROUTES.account;
}
