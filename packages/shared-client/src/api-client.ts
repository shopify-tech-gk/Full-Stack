import type {
  Address,
  InvoiceSummary,
  AddressInput,
  ApiCategory,
  ApiErrorBody,
  ApiErrorCode,
  AccountDeletionCheck,
  AuthUser,
  AvailableCoupon,
  CouponQuote,
  Money,
  LoggedInDevice,
  QrLoginPoll,
  QrLoginRequest,
  QrLoginStart,
  CancelOrderResult,
  CreateWalletTopupResult,
  HelpTicket,
  InboxKind,
  InboxPage,
  HelpTopic,
  NotificationSettings,
  OrderPaymentSummary,
  PayOrderResult,
  WalletSummary,
  WalletTopup,
  WalletTransactionPage,
  CartView,
  CategoryFilters,
  GuestTrackingView,
  MyReview,
  MyReviewListItem,
  NotifyPreference,
  OrderListItem,
  OrderView,
  OtpRequestBody,
  OtpRequestResponse,
  OtpVerifyBody,
  OtpVerifyResponse,
  Paginated,
  PaginationQuery,
  ProductDetail,
  ProductListPage,
  ProductListItem,
  ProductListQuery,
  RazorpayOrder,
  RecentlyViewedItem,
  RecentlyViewedMergeItem,
  RefreshResponse,
  ReturnView,
  ReviewPage,
  Review,
  SearchQuery,
  SearchResponse,
  LensMediaType,
  LensResult,
  ShipmentTracking,
  SkuSummary,
  SubmitReviewBody,
  SupportMessageBody,
  SupportMessageReceipt,
  Uuid,
  WishlistView,
} from './types';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface ApiClientOptions {
  /** Gateway base URL including `/api`, e.g. `http://localhost:4000/api`. */
  baseUrl: string;
  /** Returns the in-memory customer/admin access token, if any. */
  getAccessToken?: () => string | null | undefined;
  /**
   * Called once when an authenticated call gets 401: refresh the session and resolve `true`
   * to retry the call with the new token, `false` to surface the 401.
   */
  onUnauthorized?: () => Promise<boolean>;
  /** Override for environments without a global fetch. */
  fetchImpl?: typeof fetch;
}

/** Session endpoints never trigger the refresh-and-retry (it would recurse or mask a bad code). */
const NO_REFRESH_RETRY = /^\/auth\/(?:refresh|logout|otp\/)/;

type QueryValue = string | number | boolean | undefined;
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  query?: object;
  body?: unknown;
  headers?: Record<string, string>;
}

function buildQuery(query: object | undefined): string {
  if (!query) {
    return '';
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query as Record<string, QueryValue>)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as ApiErrorBody).error?.code === 'string'
  );
}

export function createApiClient(options: ApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const doFetch = options.fetchImpl ?? fetch;

  async function send(method: Method, path: string, opts: RequestOptions = {}): Promise<Response> {
    const attempt = (token: string | null | undefined) => {
      const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };
      if (opts.body !== undefined) {
        headers['Content-Type'] = 'application/json';
      }
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      // `include` so the httpOnly `ym_rt` refresh cookie travels with auth calls.
      return doFetch(`${baseUrl}${path}${buildQuery(opts.query)}`, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        credentials: 'include',
      });
    };

    const token = options.getAccessToken?.();
    let response = await attempt(token);
    if (
      response.status === 401 &&
      token &&
      options.onUnauthorized &&
      !NO_REFRESH_RETRY.test(path) &&
      (await options.onUnauthorized())
    ) {
      response = await attempt(options.getAccessToken?.());
    }

    if (!response.ok) {
      const text = await response.text();
      let parsed: unknown;
      try {
        parsed = text ? JSON.parse(text) : undefined;
      } catch {
        parsed = undefined;
      }
      if (isApiErrorBody(parsed)) {
        throw new ApiError(
          parsed.error.code,
          response.status,
          parsed.error.message,
          parsed.error.details,
        );
      }
      throw new ApiError('INTERNAL_ERROR', response.status, 'Unexpected response from server');
    }
    return response;
  }

  async function json<T>(method: Method, path: string, opts?: RequestOptions): Promise<T> {
    const response = await send(method, path, opts);
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  return {
    auth: {
      requestOtp: (identifier: string) =>
        json<OtpRequestResponse>('POST', '/auth/otp/request', {
          body: { identifier } satisfies OtpRequestBody,
        }),
      verifyOtp: (identifier: string, code: string) =>
        json<OtpVerifyResponse>('POST', '/auth/otp/verify', {
          body: { identifier, code } satisfies OtpVerifyBody,
        }),
      refresh: () => json<RefreshResponse>('POST', '/auth/refresh'),
      logout: () => json<{ status: 'logged_out' }>('POST', '/auth/logout'),
      me: () => json<AuthUser>('GET', '/auth/me'),
      /** v1.6: display name only (phone/email are OTP-verified login identifiers). */
      updateProfile: (body: { name: string }) => json<AuthUser>('PATCH', '/auth/me', { body }),
      /** v1.12: change/add the mobile number or email - a code goes to the NEW value first. */
      requestContactChange: (identifier: string) =>
        json<{ status: 'otp_sent'; expiresInSeconds: number }>('POST', '/auth/me/contact/request', {
          body: { identifier },
        }),
      verifyContactChange: (identifier: string, code: string) =>
        json<AuthUser>('POST', '/auth/me/contact/verify', { body: { identifier, code } }),
      /** W8: the customer's saved home category order (empty array when never personalised). */
      getPreferences: () => json<{ categoryOrder: string[] }>('GET', '/auth/me/preferences'),
      setCategoryOrder: (categoryOrder: string[]) =>
        json<{ categoryOrder: string[] }>('PUT', '/auth/me/preferences', {
          body: { categoryOrder },
        }),
      /** W8: the account's profile photo (image data URL), null = initials avatar. */
      getAvatar: () => json<{ avatar: string | null }>('GET', '/auth/me/avatar'),
      setAvatar: (image: string) =>
        json<{ avatar: string | null }>('PUT', '/auth/me/avatar', { body: { image } }),
      removeAvatar: () => json<{ avatar: string | null }>('DELETE', '/auth/me/avatar'),
      /** W9: which channels order updates / offers go to. */
      getNotificationSettings: () =>
        json<NotificationSettings>('GET', '/auth/me/notification-settings'),
      setNotificationSettings: (body: NotificationSettings) =>
        json<NotificationSettings>('PUT', '/auth/me/notification-settings', { body }),
      /** W9: what stands in the way of deleting the account (open orders, wallet balance). */
      deletionCheck: () => json<AccountDeletionCheck>('GET', '/auth/me/deletion-check'),
      /** QR sign-in (website side): a fresh 2-minute QR for this browser. */
      qrStart: () => json<QrLoginStart>('POST', '/auth/qr'),
      qrPoll: (sessionId: Uuid, browserKey: string) =>
        json<QrLoginPoll>('GET', `/auth/qr/${sessionId}`, {
          headers: { 'x-qr-browser-key': browserKey },
        }),
      /** Once the phone confirmed: same response (+ refresh cookie) as OTP verify. */
      qrClaim: (sessionId: Uuid, browserKey: string) =>
        json<OtpVerifyResponse>('POST', `/auth/qr/${sessionId}/claim`, {
          headers: { 'x-qr-browser-key': browserKey },
        }),
      /** QR sign-in (app side, signed in): the scanned QR text. */
      qrScan: (qr: string) => json<QrLoginRequest>('POST', '/auth/qr/scan', { body: { qr } }),
      qrApprove: (qr: string) =>
        json<{ status: string }>('POST', '/auth/qr/approve', { body: { qr } }),
      qrReject: (qr: string) =>
        json<{ status: string }>('POST', '/auth/qr/reject', { body: { qr } }),
      /** Logged-in devices (this one first, `current: true`). */
      devices: () => json<{ items: LoggedInDevice[] }>('GET', '/auth/me/devices'),
      signOutDevice: async (deviceId: Uuid) => {
        await send('DELETE', `/auth/me/devices/${deviceId}`);
      },
      signOutOtherDevices: () =>
        json<{ signedOut: number }>('POST', '/auth/me/devices/sign-out-others'),
      /** W9: deletes the account; `forfeitWallet` must be true when the wallet has money. */
      deleteAccount: (forfeitWallet: boolean) =>
        json<{ deleted: true; walletForfeited: string }>('DELETE', '/auth/me', {
          body: { confirm: 'DELETE', forfeitWallet },
        }),
    },
    catalog: {
      /** Generic listing: attribute filters are passed as extra query keys. */
      listProducts: (query?: ProductListQuery) =>
        json<ProductListPage>('GET', '/catalog/products', { query }),
      getProduct: (slug: string) =>
        json<ProductDetail>('GET', `/catalog/products/${encodeURIComponent(slug)}`),
      listCategories: () => json<{ items: ApiCategory[] }>('GET', '/catalog/categories'),
      /** The category's filter definition + facet values/counts for the current selection. */
      getCategoryFilters: (slug: string, query?: ProductListQuery) =>
        json<CategoryFilters>('GET', `/catalog/categories/${encodeURIComponent(slug)}/filters`, {
          query,
        }),
      getSku: (skuId: Uuid) => json<SkuSummary>('GET', `/catalog/skus/${skuId}`),
      /** v1.6: published reviews, newest first. */
      listReviews: (slug: string, query?: { page?: number; limit?: number }) =>
        json<ReviewPage>('GET', `/catalog/products/${encodeURIComponent(slug)}/reviews`, {
          query,
        }),
      /** v1.12: My Reviews - every review the caller has written. */
      myReviews: () => json<{ items: MyReviewListItem[] }>('GET', '/catalog/reviews/mine'),
      myReview: (slug: string) =>
        json<MyReview>('GET', `/catalog/products/${encodeURIComponent(slug)}/reviews/mine`),
      submitReview: (slug: string, body: SubmitReviewBody) =>
        json<Review>('POST', `/catalog/products/${encodeURIComponent(slug)}/reviews`, { body }),
      /** v1.7: the signed-in customer's recently viewed products, newest first (max 50). */
      recentlyViewed: () =>
        json<{ items: RecentlyViewedItem[] }>('GET', '/catalog/recently-viewed'),
      /** v1.7: records a view; the server answers 202 before writing, so callers needn't wait. */
      recordView: (productId: Uuid) =>
        json<{ accepted: true }>('POST', '/catalog/recently-viewed', { body: { productId } }),
      /** v1.7: folds a guest's local history into the account; returns the merged list. */
      mergeRecentlyViewed: (items: readonly RecentlyViewedMergeItem[]) =>
        json<{ items: RecentlyViewedItem[] }>('POST', '/catalog/recently-viewed/merge', {
          body: { items },
        }),
      clearRecentlyViewed: () => json<void>('DELETE', '/catalog/recently-viewed'),
      /** v1.7: live products as listing cards, in the order given (a guest's local history). */
      productCards: (ids: readonly Uuid[]) =>
        json<{ items: ProductListItem[] }>('GET', '/catalog/product-cards', {
          query: { ids: ids.join(',') },
        }),
    },
    search: {
      products: (query: SearchQuery) => json<SearchResponse>('GET', '/search/products', { query }),
      /** v1.10 YouMart Lens (signed in): base64 photo -> what it is + matching/related products. */
      lens: (image: string, mediaType: LensMediaType = 'image/jpeg') =>
        json<LensResult>('POST', '/search/lens', { body: { image, mediaType } }),
    },
    cart: {
      get: () => json<CartView>('GET', '/cart'),
      addItem: (skuId: Uuid, quantity: number) =>
        json<CartView>('POST', '/cart/items', { body: { skuId, quantity } }),
      updateItem: (cartItemId: Uuid, quantity: number) =>
        json<CartView>('PATCH', `/cart/items/${cartItemId}`, { body: { quantity } }),
      removeItem: (cartItemId: Uuid) => json<CartView>('DELETE', `/cart/items/${cartItemId}`),
      clear: () => json<CartView>('POST', '/cart/clear'),
    },
    addresses: {
      list: () => json<{ items: Address[] }>('GET', '/addresses'),
      get: (id: Uuid) => json<Address>('GET', `/addresses/${id}`),
      create: (body: AddressInput) => json<Address>('POST', '/addresses', { body }),
      update: (id: Uuid, body: Partial<AddressInput>) =>
        json<Address>('PATCH', `/addresses/${id}`, { body }),
      remove: async (id: Uuid) => {
        await send('DELETE', `/addresses/${id}`);
      },
      setDefault: (id: Uuid) => json<Address>('POST', `/addresses/${id}/default`),
    },
    orders: {
      /** `cartItemIds` (v1.11, "Buy this now"): order only these cart lines; omit for the whole cart. */
      /** v1.13: `couponCode` is validated and reserved by the server (never a client discount). */
      checkout: (addressId: Uuid, cartItemIds?: readonly Uuid[], couponCode?: string) =>
        json<OrderView>('POST', '/orders/checkout', {
          body: {
            addressId,
            ...(cartItemIds?.length ? { cartItemIds } : {}),
            ...(couponCode ? { couponCode } : {}),
          },
        }),
      /** v1.13: public offers; with `subtotal`, each says whether it fits and what it saves. */
      coupons: (subtotal?: Money) =>
        json<{ items: AvailableCoupon[] }>('GET', '/orders/coupons', {
          query: subtotal ? { subtotal } : {},
        }),
      /** v1.13: validates a code against the caller's cart (or just `cartItemIds`). */
      quoteCoupon: (code: string, cartItemIds?: readonly Uuid[]) =>
        json<CouponQuote>('POST', '/orders/coupons/quote', {
          body: { code, ...(cartItemIds?.length ? { cartItemIds } : {}) },
        }),
      list: (query?: PaginationQuery) =>
        json<Paginated<OrderListItem>>('GET', '/orders', { query }),
      get: (orderId: Uuid) => json<OrderView>('GET', `/orders/${orderId}`),
      /** Public guest tracking: both must match (non-enumerable). */
      track: (orderNumber: string, phone: string) =>
        json<GuestTrackingView>('POST', '/orders/track', { body: { orderNumber, phone } }),
      cancel: (orderId: Uuid, body: { reason: string; comment?: string }) =>
        json<CancelOrderResult>('POST', `/orders/${orderId}/cancel`, { body }),
      getNotify: (orderId: Uuid) => json<NotifyPreference>('GET', `/orders/${orderId}/notify`),
      setNotify: (orderId: Uuid, body: { whatsapp: boolean; sms: boolean }) =>
        json<NotifyPreference>('PUT', `/orders/${orderId}/notify`, { body }),
    },
    wishlist: {
      get: () => json<WishlistView>('GET', '/wishlist'),
      add: (skuId: Uuid) => json<WishlistView>('POST', '/wishlist/items', { body: { skuId } }),
      remove: (wishlistItemId: Uuid) =>
        json<WishlistView>('DELETE', `/wishlist/items/${wishlistItemId}`),
    },
    /** v1.15: the signed-in customer's inbox (the bell). */
    notifications: {
      list: (query?: { cursor?: string; limit?: number; kind?: InboxKind }) =>
        json<InboxPage>('GET', '/notifications', { query }),
      unreadCount: () => json<{ unread: number }>('GET', '/notifications/unread-count'),
      markRead: async (id: Uuid): Promise<void> => {
        await send('POST', `/notifications/${id}/read`);
      },
      markAllRead: () => json<{ updated: number }>('POST', '/notifications/read-all'),
      remove: async (id: Uuid): Promise<void> => {
        await send('DELETE', `/notifications/${id}`);
      },
      removeAll: () => json<{ deleted: number }>('DELETE', '/notifications'),
    },
    support: {
      sendMessage: (body: SupportMessageBody) =>
        json<SupportMessageReceipt>('POST', '/support/messages', { body }),
      /** W9: a signed-in customer's help request, optionally about one of their orders. */
      createTicket: (body: { orderId?: Uuid; topic: HelpTopic; message: string }) =>
        json<HelpTicket>('POST', '/support/tickets', { body }),
      listTickets: (query?: PaginationQuery) =>
        json<Paginated<HelpTicket>>('GET', '/support/tickets', { query }),
    },
    payments: {
      createRazorpayOrder: (orderId: Uuid) =>
        json<RazorpayOrder>('POST', '/payments/razorpay-order', { body: { orderId } }),
      /** W9: pay an order - wallet first when `useWallet`, Razorpay for any rest. */
      /** v1.12: method COD = Cash on Delivery (confirms the order; nothing is paid now). */
      pay: (orderId: Uuid, useWallet: boolean, method: 'ONLINE' | 'COD' = 'ONLINE') =>
        json<PayOrderResult>('POST', '/payments/pay', { body: { orderId, useWallet, method } }),
      /** W9: confirm a Razorpay Checkout payment (order or top-up) right after it succeeds. */
      verify: (body: {
        razorpayOrderId: string;
        razorpayPaymentId: string;
        razorpaySignature: string;
      }) =>
        json<{ kind: 'ORDER' | 'TOPUP'; status: 'PAID' | 'PENDING' }>('POST', '/payments/verify', {
          body,
        }),
      /** W9: how an order was paid (wallet / online) and what was refunded. */
      orderSummary: (orderId: Uuid) =>
        json<OrderPaymentSummary>('GET', `/payments/orders/${orderId}`),
    },
    wallet: {
      get: () => json<WalletSummary>('GET', '/wallet'),
      transactions: (query?: { cursor?: string; limit?: number }) =>
        json<WalletTransactionPage>('GET', '/wallet/transactions', { query }),
      /** "Add money": open Razorpay Checkout with the result, then poll `getTopup`. */
      createTopup: (amount: string) =>
        json<CreateWalletTopupResult>('POST', '/wallet/topups', { body: { amount } }),
      getTopup: (topupId: Uuid) => json<WalletTopup>('GET', `/wallet/topups/${topupId}`),
    },
    invoices: {
      getForOrder: (orderId: Uuid) => json<InvoiceSummary>('GET', `/invoices/order/${orderId}`),
      downloadForOrder: async (orderId: Uuid): Promise<Blob> => {
        const response = await send('GET', `/invoices/order/${orderId}/download`);
        return response.blob();
      },
      /** W9: a 5-minute signed link (path relative to the API base) to open the PDF in a browser. */
      downloadLink: (orderId: Uuid) =>
        json<{ path: string; expiresAt: string }>(
          'POST',
          `/invoices/order/${orderId}/download-link`,
        ),
    },
    returns: {
      create: (orderItemId: Uuid, reason: string) =>
        json<ReturnView>('POST', '/returns', { body: { orderItemId, reason } }),
      list: (query?: PaginationQuery) => json<Paginated<ReturnView>>('GET', '/returns', { query }),
      get: (id: Uuid) => json<ReturnView>('GET', `/returns/${id}`),
    },
    logistics: {
      /** 404 until the line has shipped. */
      trackOrderItem: (orderItemId: Uuid) =>
        json<ShipmentTracking>('GET', `/logistics/track/order-item/${orderItemId}`),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
