import { Router } from 'express';
import {
  ListProductsQuery,
  CreateProductBody,
  UpdateProductBody,
  AddSkuBody,
  UpdateSkuBody,
  AddImageBody,
} from '../catalog/catalog.schema';
import {
  createProductForSeller,
  updateProduct,
  addSku,
  updateSku,
  softDeleteProduct,
  addImage,
  softDeleteImage,
  listSellerProducts,
  assertProductOwnedBySeller,
  assertSkuOwnedBySeller,
  assertImageOwnedBySeller,
} from '../catalog/catalog.service';
import { requireAuth } from '../authMiddleware';
import { requireActiveSeller, requireSellerId } from '../sellerScope.middleware';

export const sellerCatalogRouter: Router = Router();

// SELLER-OWNED path (Ch5.2) - a seller manages ONLY their own products,
// enforced by resolving `req.sellerId` server-side (requireActiveSeller,
// via seller-service - NEVER client-supplied) and checking every
// product/SKU/image's `sellerId` against it before any read/write. This is
// a DISTINCT path from the ADMIN (ADMIN_USER_IDS) endpoints in
// catalog.routes.ts, which remain unchanged and manage ANY seller's
// catalog (in hard-off mode, that's the only way to manage the default
// seller's products, since it has no owning user). Express 5
// auto-forwards rejected promises to the central error handler.

sellerCatalogRouter.get('/products', requireAuth, requireActiveSeller, async (req, res) => {
  const sellerId = requireSellerId(req);
  const query = ListProductsQuery.parse(req.query);
  const result = await listSellerProducts(sellerId, query);
  res.status(200).json(result);
});

// seller_id is ALWAYS the resolved sellerId - the request body has no
// sellerId field at all (CreateProductBody), so there is nothing for a
// client to tamper with here.
sellerCatalogRouter.post('/products', requireAuth, requireActiveSeller, async (req, res) => {
  const sellerId = requireSellerId(req);
  const body = CreateProductBody.parse(req.body);
  const product = await createProductForSeller(sellerId, body);
  res.status(201).json(product);
});

sellerCatalogRouter.patch('/products/:id', requireAuth, requireActiveSeller, async (req, res) => {
  const sellerId = requireSellerId(req);
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  await assertProductOwnedBySeller(id, sellerId);
  const body = UpdateProductBody.parse(req.body);
  const product = await updateProduct(id, body);
  res.status(200).json(product);
});

sellerCatalogRouter.delete('/products/:id', requireAuth, requireActiveSeller, async (req, res) => {
  const sellerId = requireSellerId(req);
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  await assertProductOwnedBySeller(id, sellerId);
  await softDeleteProduct(id);
  res.status(204).send();
});

sellerCatalogRouter.post(
  '/products/:id/skus',
  requireAuth,
  requireActiveSeller,
  async (req, res) => {
    const sellerId = requireSellerId(req);
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    await assertProductOwnedBySeller(id, sellerId);
    const body = AddSkuBody.parse(req.body);
    const product = await addSku(id, body);
    res.status(201).json(product);
  },
);

sellerCatalogRouter.patch('/skus/:id', requireAuth, requireActiveSeller, async (req, res) => {
  const sellerId = requireSellerId(req);
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  await assertSkuOwnedBySeller(id, sellerId);
  const body = UpdateSkuBody.parse(req.body);
  const product = await updateSku(id, body);
  res.status(200).json(product);
});

sellerCatalogRouter.post(
  '/products/:id/images',
  requireAuth,
  requireActiveSeller,
  async (req, res) => {
    const sellerId = requireSellerId(req);
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    await assertProductOwnedBySeller(id, sellerId);
    const body = AddImageBody.parse(req.body);
    const product = await addImage(id, body);
    res.status(201).json(product);
  },
);

sellerCatalogRouter.delete('/images/:id', requireAuth, requireActiveSeller, async (req, res) => {
  const sellerId = requireSellerId(req);
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  await assertImageOwnedBySeller(id, sellerId);
  await softDeleteImage(id);
  res.status(204).send();
});
