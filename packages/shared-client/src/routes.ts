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
  /** v1.12 */
  recentlyViewed: '/account/recently-viewed',
  myReviews: '/account/reviews',
  /** v1.13 */
  coupons: '/account/coupons',
  /** v1.15: the inbox (bell). */
  notifications: '/account/notifications',
  /** W9 on the website: wallet, returns, help requests, devices, privacy & account deletion. */
  wallet: '/account/wallet',
  returns: '/account/returns',
  help: '/account/help',
  devices: '/account/devices',
  privacy: '/account/privacy',
  /** v1.17 Refer & Earn; v1.18 Remind me to buy. */
  refer: '/account/refer',
  reminders: '/account/reminders',
  /** v1.19 Advertise on YouMart; Sell on YouMart (early access). */
  ads: '/account/ads',
  adsNew: '/account/ads/new',
  sell: '/sell',
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
