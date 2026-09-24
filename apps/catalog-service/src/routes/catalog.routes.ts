import { Router } from 'express';
import { PaginationQuery } from '@youmart/shared-types';
import {
  ListProductsQuery,
  CreateProductBody,
  UpdateProductBody,
  AddSkuBody,
  UpdateSkuBody,
  AddImageBody,
  CreateCategoryBody,
  UpdateCategoryBody,
} from '../catalog/catalog.schema';
import {
  listProducts,
  getProductBySlug,
  getSkuById,
  listCategories,
  createProduct,
  updateProduct,
  addSku,
  updateSku,
  softDeleteProduct,
  addImage,
  softDeleteImage,
  createCategory,
  updateCategory,
  getProductForIndex,
  listProductsForIndex,
} from '../catalog/catalog.service';
import { optionalAuth, requireServiceAuth, requireAdmin } from '../authMiddleware';

export const catalogRouter: Router = Router();

// Express 5 auto-forwards rejected promises from async handlers to the
// central error handler (app.ts) - no explicit try/catch + next(err) needed
// here, unlike Express 4.

// --- internal indexing endpoints (search-service, Ch6.3) ---
// SERVICE-ONLY (Ch6.5) - search-service's queue worker (event-driven
// reindex) and nightly full-reindex job now mint + attach a short-lived
// service token (they have no end-user bearer token to forward at all;
// this is what actually closes that documented gap, replacing the
// previously-unauthenticated stop-gap).
catalogRouter.get('/internal/products/:id', requireServiceAuth, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const product = await getProductForIndex(id);
  res.status(200).json({ product });
});

catalogRouter.get('/internal/products-for-index', requireServiceAuth, async (req, res) => {
  const query = PaginationQuery.parse(req.query);
  const result = await listProductsForIndex(query);
  res.status(200).json(result);
});

// --- public read endpoints (unchanged from Ch4.1) ---

catalogRouter.get('/products', optionalAuth, async (req, res) => {
  const query = ListProductsQuery.parse(req.query);
  const result = await listProducts(query);
  res.status(200).json(result);
});

catalogRouter.get('/products/:slug', optionalAuth, async (req, res) => {
  const slug = typeof req.params.slug === 'string' ? req.params.slug : '';
  const product = await getProductBySlug(slug);
  res.status(200).json(product);
});

catalogRouter.get('/categories', optionalAuth, async (_req, res) => {
  const items = await listCategories();
  res.status(200).json({ items });
});

// Internal-ish lookup for other services (cart/checkout) via
// @youmart/service-client. optionalAuth for now (read-only price/SKU info,
// forwarded user tokens are fine) - may move to a dedicated
// service-to-service auth gate later.
catalogRouter.get('/skus/:skuId', optionalAuth, async (req, res) => {
  const skuId = typeof req.params.skuId === 'string' ? req.params.skuId : '';
  const sku = await getSkuById(skuId);
  res.status(200).json(sku);
});

// --- write endpoints (Ch4.2) ---
// Ch6.7a: real RBAC - requireAdmin('catalog.manage') replaces the retired
// ADMIN_USER_IDS gate (requireCatalogManager).

catalogRouter.post('/products', requireAdmin('catalog.manage'), async (req, res) => {
  const body = CreateProductBody.parse(req.body);
  const product = await createProduct(body);
  res.status(201).json(product);
});

catalogRouter.patch('/products/:id', requireAdmin('catalog.manage'), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const body = UpdateProductBody.parse(req.body);
  const product = await updateProduct(id, body);
  res.status(200).json(product);
});

catalogRouter.delete('/products/:id', requireAdmin('catalog.manage'), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  await softDeleteProduct(id);
  res.status(204).send();
});

catalogRouter.post('/products/:id/skus', requireAdmin('catalog.manage'), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const body = AddSkuBody.parse(req.body);
  const product = await addSku(id, body);
  res.status(201).json(product);
});

catalogRouter.patch('/skus/:id', requireAdmin('catalog.manage'), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const body = UpdateSkuBody.parse(req.body);
  const product = await updateSku(id, body);
  res.status(200).json(product);
});

catalogRouter.post('/products/:id/images', requireAdmin('catalog.manage'), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const body = AddImageBody.parse(req.body);
  const product = await addImage(id, body);
  res.status(201).json(product);
});

catalogRouter.delete('/images/:id', requireAdmin('catalog.manage'), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  await softDeleteImage(id);
  res.status(204).send();
});

catalogRouter.post('/categories', requireAdmin('catalog.manage'), async (req, res) => {
  const body = CreateCategoryBody.parse(req.body);
  const category = await createCategory(body);
  res.status(201).json(category);
});

catalogRouter.patch('/categories/:id', requireAdmin('catalog.manage'), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const body = UpdateCategoryBody.parse(req.body);
  const category = await updateCategory(id, body);
  res.status(200).json(category);
});
