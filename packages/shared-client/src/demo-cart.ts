// DEMO CONTENT ONLY - placing an order. The cart is real (W4); replace this with order checkout
// (POST /api/orders/checkout) and Razorpay (/api/payments).
import { CART_SHIPPING_TOTAL, cartTotals } from './cart';
import type { Address, CartView, OrderView } from './types';

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
    shippingTotal: CART_SHIPPING_TOTAL,
    grandTotal: cartTotals(cart, CART_SHIPPING_TOTAL).total,
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
