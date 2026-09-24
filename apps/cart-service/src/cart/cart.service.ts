import type { Money } from '@youmart/shared-types';
import type { Prisma } from '@youmart/db';
import { multiplyByQuantity, sum } from '@youmart/shared-utils';
import { AppError } from '@youmart/errors';
import { prisma } from '../db';
import { catalogClient, inventoryClient } from '../serviceClients';

function decimalToMoney(value: Prisma.Decimal): Money {
  return value.toFixed(2) as Money;
}

export interface CartLineItem {
  cartItemId: string;
  skuId: string;
  productId: string;
  productSlug: string;
  title: string;
  quantity: number;
  priceSnapshot: Money;
  lineTotal: Money;
}

export interface CartView {
  cartId: string | null;
  items: CartLineItem[];
  subtotal: Money;
  /** Total UNITS across all lines (sum of quantities), not distinct line count. */
  itemCount: number;
}

const EMPTY_CART: CartView = { cartId: null, items: [], subtotal: '0.00' as Money, itemCount: 0 };

async function findActiveCart(userId: string) {
  return prisma.cart.findFirst({ where: { userId, status: 'ACTIVE', deletedAt: null } });
}

async function getOrCreateActiveCart(userId: string) {
  const existing = await findActiveCart(userId);
  if (existing) {
    return existing;
  }
  return prisma.cart.create({ data: { userId, status: 'ACTIVE' } });
}

/**
 * Enriches each cart_item (skuId + quantity + price_snapshot, all cart_svc
 * owns locally) with title/productSlug/productId via catalogClient.getSku -
 * ONE call per line (N+1). Acceptable for now given small cart sizes; a
 * batch "get many SKUs" endpoint could replace this if carts grow large.
 */
async function buildCartView(cart: { id: string }): Promise<CartView> {
  const rows = await prisma.cartItem.findMany({
    where: { cartId: cart.id, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });

  const items: CartLineItem[] = await Promise.all(
    rows.map(async (row) => {
      const sku = await catalogClient.getSku(row.skuId);
      const priceSnapshot = decimalToMoney(row.priceSnapshot);
      return {
        cartItemId: row.id,
        skuId: row.skuId,
        productId: sku.productId,
        productSlug: sku.productSlug,
        title: sku.title,
        quantity: row.quantity,
        priceSnapshot,
        lineTotal: multiplyByQuantity(priceSnapshot, row.quantity),
      };
    }),
  );

  const subtotal = sum(items.map((item) => item.lineTotal));
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);

  return { cartId: cart.id, items, subtotal, itemCount };
}

export async function getCart(userId: string): Promise<CartView> {
  const cart = await findActiveCart(userId);
  if (!cart) {
    return EMPTY_CART;
  }
  return buildCartView(cart);
}

/**
 * Stock is checked here as a SOFT/UX check only (available at add-time) -
 * it does NOT reserve anything. The HARD anti-oversell guarantee happens
 * at checkout via inventoryClient.reserve, under inventory-service's Redis
 * lock (Ch4.3/4.5). Two users could both pass this check for the last unit;
 * only one of them will actually get it at checkout.
 */
export async function addItem(userId: string, skuId: string, quantity: number): Promise<CartView> {
  if (quantity < 1) {
    throw new AppError('VALIDATION_ERROR', 400, 'quantity must be at least 1');
  }

  const sku = await catalogClient.getSku(skuId);
  if (!sku.active) {
    // Product decision (documented in 4.4b report): adding an
    // inactive/unavailable SKU is a 409 CONFLICT, not a 400 - the request
    // itself is well-formed, it just conflicts with the product's current
    // sellable state (same rationale as "insufficient stock" below).
    throw new AppError('CONFLICT', 409, 'This product is not currently available');
  }

  const cart = await getOrCreateActiveCart(userId);

  const existingItem = await prisma.cartItem.findFirst({
    where: { cartId: cart.id, skuId, deletedAt: null },
  });
  const requestedTotalQuantity = (existingItem?.quantity ?? 0) + quantity;

  const stock = await inventoryClient.getStock(skuId);
  if (stock.available < requestedTotalQuantity) {
    throw new AppError('CONFLICT', 409, 'Insufficient stock', {
      skuId,
      requested: requestedTotalQuantity,
      available: stock.available,
    });
  }

  if (existingItem) {
    // Product decision (documented in 4.4b report): merging into an
    // existing line REFRESHES price_snapshot to the SKU's current selling
    // price, rather than keeping the original - so the cart always
    // reflects what the customer would actually pay if they checked out
    // right now.
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: requestedTotalQuantity, priceSnapshot: sku.sellingPrice },
    });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, skuId, quantity, priceSnapshot: sku.sellingPrice },
    });
  }

  return buildCartView(cart);
}

async function findOwnedCartItem(userId: string, cartItemId: string) {
  const cart = await findActiveCart(userId);
  if (!cart) {
    return null;
  }
  const item = await prisma.cartItem.findFirst({
    where: { id: cartItemId, cartId: cart.id, deletedAt: null },
  });
  return item ? { cart, item } : null;
}

export async function updateItem(
  userId: string,
  cartItemId: string,
  quantity: number,
): Promise<CartView> {
  if (quantity < 1) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      'quantity must be at least 1 - use DELETE /cart/items/:cartItemId to remove a line',
    );
  }

  const found = await findOwnedCartItem(userId, cartItemId);
  if (!found) {
    throw new AppError('NOT_FOUND', 404, 'Cart item not found');
  }
  const { cart, item } = found;

  const stock = await inventoryClient.getStock(item.skuId);
  if (stock.available < quantity) {
    throw new AppError('CONFLICT', 409, 'Insufficient stock', {
      skuId: item.skuId,
      requested: quantity,
      available: stock.available,
    });
  }

  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });

  return buildCartView(cart);
}

export async function removeItem(userId: string, cartItemId: string): Promise<CartView> {
  const found = await findOwnedCartItem(userId, cartItemId);
  if (!found) {
    throw new AppError('NOT_FOUND', 404, 'Cart item not found');
  }
  const { cart, item } = found;

  await prisma.cartItem.update({ where: { id: item.id }, data: { deletedAt: new Date() } });

  return buildCartView(cart);
}

export async function clearCart(userId: string): Promise<CartView> {
  const cart = await findActiveCart(userId);
  if (!cart) {
    return EMPTY_CART;
  }

  await prisma.cartItem.updateMany({
    where: { cartId: cart.id, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  return buildCartView(cart);
}

export interface ConvertCartResult {
  converted: boolean;
  cartId: string | null;
}

/**
 * Internal, service-to-service op called by order-service right after a
 * successful checkout. If the caller has no ACTIVE cart (already
 * converted, or never had one), that's a benign no-op - the order already
 * exists regardless, so this must never hard-fail a checkout that already
 * succeeded.
 */
export async function convertActiveCart(userId: string): Promise<ConvertCartResult> {
  const cart = await findActiveCart(userId);
  if (!cart) {
    return { converted: false, cartId: null };
  }

  await prisma.cart.update({ where: { id: cart.id }, data: { status: 'CONVERTED' } });

  return { converted: true, cartId: cart.id };
}
