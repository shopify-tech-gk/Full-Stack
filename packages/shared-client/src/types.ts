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

/** v1.10 YouMart Lens: photo search. */
export type LensMediaType = 'image/jpeg' | 'image/png' | 'image/webp';
export interface LensProduct {
  id: Uuid;
  title: string;
  slug: string;
  price: Money;
  mrp: Money;
  skuId: Uuid | null;
  imageUrl: string | null;
  rating: number | null;
  ratingCount: number;
  category: { id: Uuid; name: string; slug: string };
}
export interface LensResult {
  identified: boolean;
  /** "Apple iPhone 13" - null when nothing recognisable was in the photo. */
  label: string | null;
  brand: string | null;
  productType: string | null;
  colour: string | null;
  confidence: 'high' | 'medium' | 'low';
  /** Text query for "See all results" in normal search. */
  query: string | null;
  /** Where it is sold in the storefront category tree (names as in the taxonomy). */
  categories: { main: string; sub: string | null }[];
  /** Catalogue categories the matched products are listed in - open with /category/<slug>. */
  catalogCategories: { id: Uuid; name: string; slug: string; count: number }[];
  matches: LensProduct[];
  related: LensProduct[];
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
  /** v1.13: this line's share of the coupon discount (paid = lineTotal - discount). */
  discount?: Money;
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
  /** v1.12: COD = Cash on Delivery (pay in cash at delivery). */
  paymentMethod?: 'ONLINE' | 'COD';
  /** v1.13: coupon discount already taken off grandTotal, and the code used. */
  discountTotal?: Money;
  couponCode?: string | null;
  shippingAddress: ShippingAddressSnapshot;
  /** v1.6 */
  createdAt: IsoDateTime;
  /** v1.6: order status history, oldest first. */
  timeline: OrderTimelineEntry[];
  /** W9: the latest cancellation request of a paid order (null = never requested). */
  cancelRequest?: { status: CancelRequestStatus; reason: string; createdAt: IsoDateTime } | null;
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
  /** v1.13: each line's progress (Processing / Packed / Shipped / Delivered on the list). */
  itemStatuses?: SellerItemStatus[];
  paymentMethod?: 'ONLINE' | 'COD';
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
/** v1.12: a review on the customer's My Reviews list. */
export interface MyReviewListItem extends Review {
  status: 'PENDING' | 'PUBLISHED' | 'REJECTED';
  /** null when the product is no longer sold. */
  product: { id: Uuid; title: string; slug: string; imageUrl: string | null } | null;
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
  /** W9 (customer views): what the return is for - null if the order line can't be read. */
  orderId?: Uuid | null;
  orderNumber?: string | null;
  title?: string | null;
  quantity?: number | null;
  /** W9: refunds are always credited to the YouMart Wallet. */
  refundTo?: 'WALLET';
}

// --- YouMart Wallet (W9) ---
export interface WalletSummary {
  /** Everything in the wallet. */
  balance: Money;
  /** Reserved for orders waiting for the rest of their payment. */
  held: Money;
  /** Spendable now (balance - held). */
  available: Money;
  topupLimits: { min: Money; max: Money; maxBalance: Money };
}
export type WalletTxnType = 'TOPUP' | 'REFUND' | 'ORDER_PAYMENT' | 'FORFEIT' | 'REFERRAL_REWARD';

/** v1.17 Refer & Earn: the customer's code and stats (GET /auth/me/referral). */
export interface MyReferral {
  code: string;
  friendsJoined: number;
  /** Who referred this customer (null = nobody). */
  referredBy: { name: string | null } | null;
  /** They can still enter a friend's code (new account, none entered yet). */
  canApplyCode: boolean;
  applyWindowDays: number;
}
/** v1.17 Refer & Earn: rewards earned from friends' delivered orders (amounts only). */
export interface MyReferralRewards {
  totalEarned: Money;
  rewards: Array<{
    rewardId: Uuid;
    amount: Money;
    status: 'CREDITED' | 'REVERSED';
    createdAt: IsoDateTime;
  }>;
}
export interface WalletTransaction {
  id: Uuid;
  type: WalletTxnType;
  direction: 'CREDIT' | 'DEBIT';
  amount: Money;
  balanceAfter: Money;
  description: string;
  orderId: Uuid | null;
  orderNumber: string | null;
  createdAt: IsoDateTime;
}
export interface WalletTransactionPage {
  items: WalletTransaction[];
  nextCursor: Uuid | null;
}
export type WalletTopupStatus = 'CREATED' | 'PAID' | 'FAILED';
export interface WalletTopup {
  topupId: Uuid;
  amount: Money;
  status: WalletTopupStatus;
  createdAt: IsoDateTime;
}
/** POST /api/wallet/topups: open Razorpay Checkout with `razorpayOrderId` / `amountPaise`. */
export interface CreateWalletTopupResult extends WalletTopup {
  razorpayOrderId: string;
  razorpayKeyId: string;
  amountPaise: number;
  currency: 'INR';
}
/** POST /api/payments/pay: PAID = the wallet covered everything; COD = confirmed as Cash on
 * Delivery (`codAmount` collected at the door); otherwise pay `razorpay`. */
export interface PayOrderResult {
  status: 'PAID' | 'PAYMENT_REQUIRED' | 'COD';
  codAmount?: Money;
  orderId: Uuid;
  walletAmount: Money;
  onlineAmount: Money;
  razorpay: RazorpayOrder | null;
}
/** GET /api/payments/orders/:orderId - how an order was paid and its refunds. */
export interface OrderPaymentSummary {
  orderId: Uuid;
  walletAmount: Money;
  onlineAmount: Money;
  /** v1.12: Cash on Delivery - the cash amount and whether it was collected (null = not COD). */
  cod?: { amount: Money; collected: boolean } | null;
  refundedTotal: Money;
  refunds: {
    refundId: Uuid;
    amount: Money;
    method: 'ORIGINAL_PAYMENT' | 'WALLET';
    status: 'PENDING' | 'PROCESSED' | 'FAILED';
    reason: string | null;
    createdAt: IsoDateTime;
  }[];
}

// --- Coupons (v1.13) ---
export interface CouponView {
  code: string;
  /** "10% off up to ₹500" */
  title: string;
  description: string | null;
  discountType: 'PERCENT' | 'FLAT';
  discountValue: Money;
  maxDiscount: Money | null;
  minOrderValue: Money | null;
  endsAt: IsoDateTime | null;
}
/** GET /api/orders/coupons[?subtotal=] - a public offer and whether it fits this cart. */
export interface AvailableCoupon extends CouponView {
  applicable: boolean;
  /** Why not, e.g. "Add ₹300 more to use this coupon (minimum order ₹999)". */
  reason: string | null;
  discount: Money;
}
/** POST /api/orders/coupons/quote */
export interface CouponQuote {
  coupon: CouponView;
  discount: Money;
  total: Money;
}

// --- Account settings (W9) ---
export interface NotificationSettings {
  /** Order placed / shipped / delivered, refunds and wallet credits. */
  orderUpdates: { whatsapp: boolean; email: boolean };
  /** Offers and promotions. */
  offers: { whatsapp: boolean; email: boolean };
}
export interface AccountDeletionCheck {
  canDelete: boolean;
  openOrders: number;
  walletBalance: Money;
  walletHeld: Money;
}

// --- Help Center (W9) ---
export type HelpTopic =
  | 'ORDER_STATUS'
  | 'CANCELLATION'
  | 'RETURN_REFUND'
  | 'PAYMENT_WALLET'
  | 'DAMAGED_WRONG_ITEM'
  | 'ACCOUNT'
  | 'OTHER';
/** v1.15: one message in the customer's inbox (the bell). */
export type InboxKind = 'ORDER' | 'REFUND' | 'RETURN' | 'SUPPORT' | 'OFFER' | 'ACCOUNT';
export interface InboxMessage {
  id: Uuid;
  kind: InboxKind;
  title: string;
  body: string;
  orderId: Uuid | null;
  orderNumber: string | null;
  ticketId: Uuid | null;
  imageUrl: string | null;
  /** v1.17 where tapping it goes - app path / website path (e.g. a "back in stock" product). */
  link: string | null;
  webLink: string | null;
  read: boolean;
  createdAt: IsoDateTime;
}
export interface InboxPage {
  items: InboxMessage[];
  nextCursor: string | null;
  unread: number;
}

/** v1.17 AI help. */
export interface AssistantTurn {
  role: 'user' | 'assistant';
  text: string;
}
export interface AssistantEscalation {
  topic: HelpTopic;
  /** Prefills the "Send to support" form. */
  summary: string;
  orderNumber: string | null;
}
/** v1.17 a store category YouMart AI suggests; `taxo` = the taxonomy path ("main~sub~leaf"). */
export interface AssistantCategory {
  taxo: string;
  name: string;
  /** "Main > Sub"; '' for a main category. */
  parents: string;
}
/** v1.17 a real product YouMart AI suggests (prices in rupees, e.g. "1299.00"). */
export interface AssistantProduct {
  id: string;
  slug: string;
  title: string;
  price: Money;
  mrp: Money;
  imageUrl: string | null;
  category: string;
}
export interface AssistantReply {
  reply: string;
  escalate: AssistantEscalation | null;
  remaining: number;
  /** v1.17 tappable cards under the reply. */
  categories: AssistantCategory[];
  products: AssistantProduct[];
  /** v1.17 "not in stock - request a restock?" for this item; null = none. */
  restock: { item: string } | null;
  /** v1.17 tap-to-answer options when the AI asks a question (e.g. "Beach", "Hill station"). */
  quickReplies: string[];
}

export interface HelpTicket {
  ticketId: Uuid;
  /** Short reference to quote to support, e.g. "HLP-1A2B3C4D". */
  reference: string;
  topic: HelpTopic;
  topicLabel: string;
  orderId: Uuid | null;
  orderNumber: string | null;
  message: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  /** v1.14: YouMart Support's reply (null until they answer). */
  adminReply: string | null;
  repliedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

// --- QR sign-in + Logged-in devices ---
export type QrLoginStatus = 'PENDING' | 'SCANNED' | 'APPROVED' | 'USED' | 'REJECTED' | 'EXPIRED';
/** POST /api/auth/qr (website): render `qrValue`; keep `browserKey` to poll and claim. */
export interface QrLoginStart {
  sessionId: Uuid;
  qrValue: string;
  browserKey: string;
  expiresAt: IsoDateTime;
}
export interface QrLoginPoll {
  status: QrLoginStatus;
  expiresAt: IsoDateTime;
  /** Masked phone/email of whoever scanned it. */
  scannedBy: string | null;
}
/** POST /api/auth/qr/scan (app): what the confirm sheet shows. */
export interface QrLoginRequest {
  requestId: Uuid;
  /** e.g. "Chrome · Windows". */
  device: string;
  requestedAt: IsoDateTime;
  expiresAt: IsoDateTime;
}
export interface LoggedInDevice {
  deviceId: Uuid;
  label: string;
  kind: 'APP' | 'BROWSER' | 'UNKNOWN';
  lastActiveAt: IsoDateTime;
  current: boolean;
}
