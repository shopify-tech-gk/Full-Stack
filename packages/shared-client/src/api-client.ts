import type {
  Address,
  AddressInput,
  ApiCategory,
  ApiErrorBody,
  ApiErrorCode,
  AuthUser,
  CartView,
  CategoryFilters,
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
  ProductListQuery,
  RazorpayOrder,
  RefreshResponse,
  ReturnView,
  SearchQuery,
  SearchResponse,
  SkuSummary,
  Uuid,
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
type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface RequestOptions {
  query?: object;
  body?: unknown;
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
      const headers: Record<string, string> = { Accept: 'application/json' };
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
    },
    search: {
      products: (query: SearchQuery) => json<SearchResponse>('GET', '/search/products', { query }),
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
      checkout: (addressId: Uuid) =>
        json<OrderView>('POST', '/orders/checkout', { body: { addressId } }),
      list: (query?: PaginationQuery) =>
        json<Paginated<OrderListItem>>('GET', '/orders', { query }),
      get: (orderId: Uuid) => json<OrderView>('GET', `/orders/${orderId}`),
    },
    payments: {
      createRazorpayOrder: (orderId: Uuid) =>
        json<RazorpayOrder>('POST', '/payments/razorpay-order', { body: { orderId } }),
    },
    invoices: {
      getForOrder: (orderId: Uuid) =>
        json<Record<string, unknown>>('GET', `/invoices/order/${orderId}`),
      downloadForOrder: async (orderId: Uuid): Promise<Blob> => {
        const response = await send('GET', `/invoices/order/${orderId}/download`);
        return response.blob();
      },
    },
    returns: {
      create: (orderItemId: Uuid, reason: string) =>
        json<ReturnView>('POST', '/returns', { body: { orderItemId, reason } }),
      list: (query?: PaginationQuery) => json<Paginated<ReturnView>>('GET', '/returns', { query }),
      get: (id: Uuid) => json<ReturnView>('GET', `/returns/${id}`),
    },
    logistics: {
      trackOrderItem: (orderItemId: Uuid) =>
        json<Record<string, unknown>>('GET', `/logistics/track/order-item/${orderItemId}`),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
