import { Router } from 'express';
import { optionalAuth } from '../authMiddleware';
import { SearchProductsQuery, SuggestQuery } from '../search/search.schema';
import { searchProducts, suggest } from '../search/search.service';

export const searchRouter: Router = Router();

// --- public search endpoints (storefront) ---
// optionalAuth only so a logged-in user's request is attributable in logs;
// search/browse never requires being signed in.
searchRouter.get('/products', optionalAuth, async (req, res) => {
  const query = SearchProductsQuery.parse(req.query);
  const result = await searchProducts(query);
  res.status(200).json(result);
});

searchRouter.get('/suggest', optionalAuth, async (req, res) => {
  const query = SuggestQuery.parse(req.query);
  const result = await suggest(query);
  res.status(200).json(result);
});
