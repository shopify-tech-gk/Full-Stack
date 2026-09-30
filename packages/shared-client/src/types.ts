// Types mirroring the FROZEN public API contract v1.2 (docs/contracts/API.md).
// Keep in lockstep with that document - it is the source of truth.

export type Uuid = string;
/** Decimal string with exactly 2 places, e.g. "1299.00". Never a JS number. */
export type Money = string;
export type IsoDateTime = string;

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; details?: unknown };
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

export interface PaginationQuery {
  cursor?: string;
  limit?: number;
}

// --- Auth (v1.2: one `identifier` = mobile number OR email) ---
export interface OtpRequestBody {
  identifier: string;
  purpose?: 'LOGIN' | 'PHONE_VERIFY';
}
export interface OtpRequestResponse {
  status: 'otp_sent';
  expiresInSeconds: number;
}
export interface OtpVerifyBody extends OtpRequestBody {
  code: string;
}
export interface AuthUser {
  id: Uuid;
  /** Null for an account created by email login. */
  phone: string | null;
  email: string | null;
  name: string | null;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
}
export interface OtpVerifyResponse {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
}
export interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
}

// --- Catalog ---
export interface CategoryRef {
  id: Uuid;
  name: string;
  slug: string;
}
export interface ApiCategory extends CategoryRef {
  parentId: Uuid | null;
}
export interface ProductListItem {
  id: Uuid;
  title: string;
  slug: string;
  price: Money | null;
  imageUrl: string | null;
  category: CategoryRef;
}
export interface ProductListQuery extends PaginationQuery {
  categoryId?: Uuid;
  minPrice?: number;
  maxPrice?: number;
  q?: string;
}
export interface ProductSku {
  id: Uuid;
  skuCode: string;
  mrp: Money;
  sellingPrice: Money;
  attributes: Record<string, unknown>;
}
export interface ProductImage {
  id: Uuid;
  url: string;
  position: number;
}
export interface ProductDetail {
  id: Uuid;
  title: string;
  slug: string;
  description: string | null;
  category: CategoryRef;
  skus: ProductSku[];
  images: ProductImage[];
}
export interface SkuSummary {
  skuId: Uuid;
  productId: Uuid;
  productSlug: string;
  title: string;
  sellerId: Uuid;
  sellingPrice: Money;
  mrp: Money;
  active: boolean;
}

// --- Search ---
export type SearchSort = 'relevance' | 'price_asc' | 'price_desc' | 'newest';
export interface SearchQuery {
  q?: string;
  category?: Uuid;
  minPrice?: number;
  maxPrice?: number;
  brand?: string;
  sort?: SearchSort;
  page?: number;
  perPage?: number;
}
export interface SearchResult {
  id: Uuid;
  title: string;
  slug: string;
  price: Money;
  primaryImageUrl: string | null;
  categoryName: string;
}
export interface FacetCount {
  value: string;
  count: number;
}
export interface SearchResponse {
  results: SearchResult[];
  facets: { category: FacetCount[]; brand: FacetCount[]; price: FacetCount[] };
  found: number;
  page: number;
  perPage: number;
}

// --- Cart ---
export interface CartLine {
  cartItemId: Uuid;
  skuId: Uuid;
  productId: Uuid;
  productSlug: string;
  title: string;
  quantity: number;
  priceSnapshot: Money;
  lineTotal: Money;
}
export interface CartView {
  cartId: Uuid | null;
  items: CartLine[];
  subtotal: Money;
  itemCount: number;
}

// --- Addresses ---
export interface Address {
  id: Uuid;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  addressType: string;
  isDefault: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
export interface AddressInput {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  addressType?: string;
  isDefault?: boolean;
}

// --- Orders ---
export type OrderStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED';
export type SellerItemStatus =
  'PENDING' | 'CONFIRMED' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';
export interface OrderItem {
  skuId: Uuid;
  productId: Uuid;
  sellerId: Uuid;
  title: string;
  unitPrice: Money;
  quantity: number;
  lineTotal: Money;
  sellerStatus: SellerItemStatus;
}
export interface ShippingAddressSnapshot {
  addressId: Uuid;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
}
export interface OrderView {
  orderId: Uuid;
  orderNumber: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: Money;
  shippingTotal: Money;
  grandTotal: Money;
  shippingAddress: ShippingAddressSnapshot;
}
export interface OrderListItem {
  orderId: Uuid;
  orderNumber: string;
  status: OrderStatus;
  grandTotal: Money;
  createdAt: IsoDateTime;
}

// --- Payments ---
export interface RazorpayOrder {
  razorpayOrderId: string;
  razorpayKeyId: string;
  /** Paise as a JSON number - the one documented exception to the Money-string rule. */
  amount: number;
  currency: 'INR';
  orderId: Uuid;
}

// --- Returns ---
export type ReturnStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'PICKED_UP' | 'REFUNDED';
export interface ReturnView {
  id: Uuid;
  orderItemId: Uuid;
  userId: Uuid;
  reason: string;
  status: ReturnStatus;
  refundAmount: Money | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
