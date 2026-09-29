// DEMO CONTENT ONLY - cart + checkout data for layout work. Replace with the cart API
// (/api/cart), order checkout (POST /api/orders/checkout) and Razorpay (/api/payments).
import { cartTotals, recalcCart } from './cart';
import { DEMO_PRODUCT_IMAGE, DEMO_PRODUCTS } from './demo';
import type { Address, CartLine, CartView, Money, OrderView } from './types';

/** Live shows "Free shipping" for every Tamil Nadu cart. */
export const DEMO_SHIPPING_TOTAL: Money = '0.00';

const line = (index: number, quantity: number): CartLine => {
  const product = DEMO_PRODUCTS[index];
  const n = index + 1;
  return {
    cartItemId: `demo-cart-item-${n}`,
    skuId: `demo-sku-${n}`,
    productId: `demo-product-${n}`,
    productSlug: `demo-product-${n}`,
    title: product?.title ?? 'Demo Product',
    quantity,
    priceSnapshot: product?.sellingPrice ?? '0.00',
    lineTotal: '0.00',
  };
};

export const DEMO_CART: CartView = recalcCart('demo-cart', [line(0, 1), line(1, 2), line(4, 1)]);

/** CartLine has no image; the real web joins the catalog by productSlug. */
export function demoCartLineImage(): string {
  return DEMO_PRODUCT_IMAGE;
}

/** Mirrors POST /api/orders/checkout: the server derives everything from cart + addressId. */
export function demoPlaceOrder(cart: CartView, address: Address, placedAt: Date): OrderView {
  const stamp = placedAt.getTime().toString(36).toUpperCase().slice(-6);
  return {
    orderId: `demo-order-${stamp}`,
    orderNumber: `YM-DEMO-${stamp}`,
    status: 'PENDING_PAYMENT',
    items: cart.items.map((item) => ({
      skuId: item.skuId,
      productId: item.productId,
      sellerId: 'demo-seller',
      title: item.title,
      unitPrice: item.priceSnapshot,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
      sellerStatus: 'PENDING',
    })),
    subtotal: cart.subtotal,
    shippingTotal: DEMO_SHIPPING_TOTAL,
    grandTotal: cartTotals(cart, DEMO_SHIPPING_TOTAL).total,
    shippingAddress: {
      addressId: address.id,
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2,
      landmark: address.landmark,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      country: address.country,
    },
  };
}
