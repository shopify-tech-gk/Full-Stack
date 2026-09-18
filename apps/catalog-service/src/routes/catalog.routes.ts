import { Router } from 'express';
import { ListProductsQuery } from '../catalog/catalog.schema';
import { listProducts, getProductBySlug, listCategories } from '../catalog/catalog.service';
import { optionalAuth } from '../authMiddleware';

export const catalogRouter: Router = Router();

// Express 5 auto-forwards rejected promises from async handlers to the
// central error handler (app.ts) - no explicit try/catch + next(err) needed
// here, unlike Express 4.

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
