// Types mirroring the FROZEN public API contract v1.3 (docs/contracts/API.md).
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
/** v1.3: listing items come from the search index (price/mrp/rating always present). */
export interface ProductListItem {
  id: Uuid;
  title: string;
  slug: string;
  price: Money;
  mrp: Money;
  /** v1.4: the cheapest SKU (the one `price` is for) - what a card's "Add" puts in the cart. */
  skuId: Uuid | null;
  imageUrl: string | null;
  rating: number | null;
  ratingCount: number;
  category: CategoryRef;
}
export type CatalogSort =
  'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'rating' | 'discount';
/** `category` + universal filters; attribute filters are extra keys (`brand=A,B`, `size_min=2`). */
export interface ProductListQuery {
  category?: string;
  q?: string;
  min_price?: number;
  max_price?: number;
  rating?: number;
  sort?: CatalogSort;
  page?: number;
  limit?: number;
  [attributeFilter: string]: string | number | undefined;
}
export interface ProductListPage {
  items: ProductListItem[];
  nextCursor: string | null;
  total: number;
  page: number;
  perPage: number;
}
/** v1.7 view tracking: a listing card + when the customer last viewed it. */
export interface RecentlyViewedItem extends ProductListItem {
  viewedAt: string;
}
/** v1.7: one guest view, merged into the account on login. */
export interface RecentlyViewedMergeItem {
  productId: Uuid;
  viewedAt: string;
}
export type FilterType = 'multi_select' | 'single_select' | 'range' | 'boolean';
/** One filter a category offers (its `filter_definition` entry) + live facet data. */
export interface CategoryFilter {
  key: string;
  label: string;
  type: FilterType;
  unit?: string;
  order?: number;
  values?: FacetCount[];
  min?: number | null;
  max?: number | null;
}
export interface CategoryFilters {
  category: CategoryRef & { parentId: Uuid | null };
  path: CategoryRef[];
  definitionFrom: string | null;
  total: number;
  /** Rupees; null when the category has no products. */
  price: { min: number; max: number } | null;
  filters: CategoryFilter[];
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
  /** v1.3 */
  attributes: Record<string, unknown>;
  specifications: { key: string; label: string; value: string; unit: string | null }[];
  rating: number | null;
  ratingCount: number;
  categoryPath: CategoryRef[];
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
  /** v1.3 */
  mrp: Money;
  /** v1.4 */
  skuId: Uuid | null;
  rating: number | null;
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
  /** v1.6 */
  orderItemId: Uuid;
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
  /** v1.6 */
  createdAt: IsoDateTime;
  /** v1.6: order status history, oldest first. */
  timeline: OrderTimelineEntry[];
}
export interface OrderTimelineEntry {
  status: OrderStatus;
  at: IsoDateTime;
}
export interface OrderListItem {
  orderId: Uuid;
  orderNumber: string;
  status: OrderStatus;
  grandTotal: Money;
  createdAt: IsoDateTime;
}

/** POST /api/orders/track (public): deliberately no ids, prices or full address. */
export interface GuestTrackingView {
  orderNumber: string;
  status: OrderStatus;
  placedAt: IsoDateTime;
  shipTo: { city: string; state: string } | null;
  items: {
    title: string;
    quantity: number;
    sellerStatus: SellerItemStatus;
    shipment: ShipmentTracking | null;
  }[];
  timeline: OrderTimelineEntry[];
}
export interface ShipmentTracking {
  status: string;
  carrier: string | null;
  awbNumber: string | null;
  events: { status: string; location: string | null; occurredAt: IsoDateTime }[];
}

export type CancelRequestStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED';
export interface CancelRequestView {
  cancelRequestId: Uuid;
  orderId: Uuid;
  status: CancelRequestStatus;
  reason: string;
  comment: string | null;
  resolutionNote: string | null;
  createdAt: IsoDateTime;
  resolvedAt: IsoDateTime | null;
}
/** POST /api/orders/:id/cancel - unpaid orders cancel at once; paid ones become a request. */
export interface CancelOrderResult {
  outcome: 'CANCELLED' | 'CANCEL_REQUESTED';
  order: OrderView;
  cancelRequest: CancelRequestView | null;
}
export interface NotifyPreference {
  orderId: Uuid;
  whatsapp: boolean;
  sms: boolean;
  updatedAt: IsoDateTime | null;
}

// --- Wishlist ---
export interface WishlistItem {
  wishlistItemId: Uuid;
  skuId: Uuid;
  productId: Uuid;
  /** null (with title/prices) once the product is no longer sold. */
  productSlug: string | null;
  title: string | null;
  sellingPrice: Money | null;
  mrp: Money | null;
  available: boolean;
  addedAt: IsoDateTime;
}
export interface WishlistView {
  items: WishlistItem[];
  itemCount: number;
}

// --- Support ---
export interface SupportMessageBody {
  name: string;
  phone: string;
  email?: string;
  message: string;
}
export interface SupportMessageReceipt {
  messageId: Uuid;
  reference: string;
  receivedAt: IsoDateTime;
}

// --- Reviews (v1.6) ---
export interface Review {
  id: Uuid;
  rating: number;
  title: string | null;
  body: string;
  author: string;
  verifiedPurchase: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
export interface ReviewPage {
  items: Review[];
  total: number;
  page: number;
  perPage: number;
  breakdown: Record<'1' | '2' | '3' | '4' | '5', number>;
}
export interface MyReview {
  canReview: boolean;
  review: Review | null;
}
export interface SubmitReviewBody {
  rating: number;
  title?: string;
  body: string;
  authorName?: string;
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

// --- Invoices ---
/** The fields of GET /api/invoices/order/:orderId the storefront uses (the response has more). */
export interface InvoiceSummary {
  id: Uuid;
  orderId: Uuid;
  invoiceNumber: string;
  invoiceDate: IsoDateTime;
  grandTotal: Money;
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
