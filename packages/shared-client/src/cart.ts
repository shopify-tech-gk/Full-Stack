// Cart + checkout logic shared by web and mobile. Shapes are the cart-service CartView and the
// order-service OrderView; nothing here talks to the network.
import { formatMoney, fromPaise, toPaise } from './money';
import { orderStatusLabel } from './account';
import type { Address, CartLine, CartView, Money, OrderView } from './types';

export const EMPTY_CART: CartView = { cartId: null, items: [], subtotal: '0.00', itemCount: 0 };

/** PATCH /api/cart/items/:id requires an integer >= 1; removal is a separate DELETE. */
export const MIN_LINE_QUANTITY = 1;

// Delivery charges (v1.16) live in ./delivery.ts (deliveryFee / freeDeliveryProgress).

export function productHref(slug: string): string {
  return `/product/${slug}`;
}

/** Re-derives lineTotal/subtotal/itemCount exactly like cart-service (paise, never floats). */
export function recalcCart(cartId: string | null, items: readonly CartLine[]): CartView {
  const lines = items.map((line) => ({
    ...line,
    lineTotal: fromPaise(toPaise(line.priceSnapshot) * line.quantity),
  }));
  return {
    cartId: lines.length > 0 ? cartId : null,
    items: lines,
    subtotal: fromPaise(lines.reduce((sum, line) => sum + toPaise(line.lineTotal), 0)),
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

/** Optimistic PATCH: the server response replaces this once the cart API is wired. */
export function setLineQuantity(cart: CartView, cartItemId: string, quantity: number): CartView {
  const next = Math.max(MIN_LINE_QUANTITY, Math.floor(quantity));
  return recalcCart(
    cart.cartId,
    cart.items.map((line) => (line.cartItemId === cartItemId ? { ...line, quantity: next } : line)),
  );
}

/** Optimistic DELETE. */
export function removeLine(cart: CartView, cartItemId: string): CartView {
  return recalcCart(
    cart.cartId,
    cart.items.filter((line) => line.cartItemId !== cartItemId),
  );
}

export interface CartTotals {
  subtotal: Money;
  shipping: Money;
  total: Money;
}

/** Shipping is decided by order-service at checkout; the cart only previews it. */
export function cartTotals(cart: CartView, shipping: Money): CartTotals {
  return {
    subtotal: cart.subtotal,
    shipping,
    total: fromPaise(toPaise(cart.subtotal) + toPaise(shipping)),
  };
}

export function shippingLabel(shipping: Money): string | null {
  return toPaise(shipping) === 0 ? 'Free shipping' : null;
}

// --- Checkout ---

/** Online (Razorpay) or Cash on Delivery (v1.12). */
export const PAYMENT_METHODS = [
  {
    id: 'razorpay',
    label: 'Credit Card / Debit Card / NetBanking / UPI / GPay / PhonePe',
    description:
      'Pay securely with Razorpay. You will complete the payment in the Razorpay window after placing the order.',
  },
  {
    id: 'cod',
    label: 'Cash on Delivery',
    description: 'Pay in cash (or UPI to the delivery partner) when your order arrives.',
  },
] as const;

/** Cash on Delivery is offered for orders up to this total (payment-service COD_MAX_AMOUNT). */
export const COD_MAX_AMOUNT = '50000.00' as Money;

/** Whether Cash on Delivery can be offered for an order total. */
export function codAvailable(total: Money): boolean {
  return toPaise(total) <= toPaise(COD_MAX_AMOUNT);
}

export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]['id'];

/** The address checkout pre-selects: the default one, else the first saved. */
export function defaultCheckoutAddress(addresses: readonly Address[]): Address | null {
  return addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
}

export type CheckoutBlocker = 'login' | 'address' | 'empty';

/** Why "Place order" can't run yet (checkout needs a session, an addressId and cart lines). */
export function checkoutBlocker(input: {
  loggedIn: boolean;
  addressId: string | null;
  cart: CartView;
}): CheckoutBlocker | null {
  if (!input.loggedIn) return 'login';
  if (input.cart.items.length === 0) return 'empty';
  if (!input.addressId) return 'address';
  return null;
}

export const CHECKOUT_BLOCKER_MESSAGE: Record<CheckoutBlocker, string> = {
  login: 'Please log in with your mobile number or email to place the order.',
  address: 'Please choose a delivery address.',
  empty: 'Your cart is empty.',
};

/** Order-received overview rows (WooCommerce "Thank you" page). */
export function orderOverview(
  order: OrderView,
  placedAt: string,
): { label: string; value: string }[] {
  return [
    { label: 'Order number', value: order.orderNumber },
    {
      label: 'Status',
      value:
        order.status === 'CONFIRMED'
          ? order.paymentMethod === 'COD'
            ? 'Confirmed \u00b7 Pay on delivery'
            : 'Paid \u00b7 Confirmed'
          : orderStatusLabel(order),
    },
    {
      label: 'Date',
      value: new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      }).format(new Date(placedAt)),
    },
    ...(order.discountTotal && toPaise(order.discountTotal) > 0
      ? [
          {
            label: 'Coupon',
            value: `${order.couponCode ?? 'Discount'} \u00b7 \u2212${formatMoney(order.discountTotal)}`,
          },
        ]
      : []),
    { label: 'Total', value: formatMoney(order.grandTotal) },
    {
      label: 'Payment method',
      value: order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online (Razorpay)',
    },
  ];
}
