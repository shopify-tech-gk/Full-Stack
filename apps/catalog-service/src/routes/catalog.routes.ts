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
import { optionalAuth, requireAuth } from '../authMiddleware';
import { requireCatalogManager } from '../catalogManager.middleware';

export const catalogRouter: Router = Router();

// Express 5 auto-forwards rejected promises from async handlers to the
// central error handler (app.ts) - no explicit try/catch + next(err) needed
// here, unlike Express 4.

// --- internal indexing endpoints (search-service, Ch6.3) ---
// Deliberately UNAUTHENTICATED: search-service's queue worker (event-driven
// reindex) and nightly full-reindex job have no end-user bearer token to
// forward at all (same documented service-to-service credential gap as
// settlement-service's scheduler, Ch5.3/6) - requiring auth here would
// simply make every reindex silently fail. The data exposed (product
// title/price/category/images, plus DRAFT/ARCHIVED status for products
// that aren't yet/no-longer publicly listed) is a minor, launch-acceptable
// disclosure for what is effectively an internal-network endpoint - a real
// service-to-service credential should gate this once one exists (Ch6/7).
catalogRouter.get('/internal/products/:id', async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const product = await getProductForIndex(id);
  res.status(200).json({ product });
});

catalogRouter.get('/internal/products-for-index', async (req, res) => {
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
// requireAuth + requireCatalogManager (TEMPORARY dev-only gate - replaced by
// real RBAC in Ch6, see catalogManager.middleware.ts).

catalogRouter.post('/products', requireAuth, requireCatalogManager, async (req, res) => {
  const body = CreateProductBody.parse(req.body);
  const product = await createProduct(body);
  res.status(201).json(product);
});

catalogRouter.patch('/products/:id', requireAuth, requireCatalogManager, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const body = UpdateProductBody.parse(req.body);
  const product = await updateProduct(id, body);
  res.status(200).json(product);
});

catalogRouter.delete('/products/:id', requireAuth, requireCatalogManager, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  await softDeleteProduct(id);
  res.status(204).send();
});

catalogRouter.post('/products/:id/skus', requireAuth, requireCatalogManager, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const body = AddSkuBody.parse(req.body);
  const product = await addSku(id, body);
  res.status(201).json(product);
});

catalogRouter.patch('/skus/:id', requireAuth, requireCatalogManager, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const body = UpdateSkuBody.parse(req.body);
  const product = await updateSku(id, body);
  res.status(200).json(product);
});

catalogRouter.post('/products/:id/images', requireAuth, requireCatalogManager, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const body = AddImageBody.parse(req.body);
  const product = await addImage(id, body);
  res.status(201).json(product);
});

catalogRouter.delete('/images/:id', requireAuth, requireCatalogManager, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  await softDeleteImage(id);
  res.status(204).send();
});

catalogRouter.post('/categories', requireAuth, requireCatalogManager, async (req, res) => {
  const body = CreateCategoryBody.parse(req.body);
  const category = await createCategory(body);
  res.status(201).json(category);
});

catalogRouter.patch('/categories/:id', requireAuth, requireCatalogManager, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const body = UpdateCategoryBody.parse(req.body);
  const category = await updateCategory(id, body);
  res.status(200).json(category);
});
