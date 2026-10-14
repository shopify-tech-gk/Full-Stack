import { Router } from 'express';
import { AppError } from '@youmart/errors';
import { optionalAuth, requireAuth, requireServiceAuth } from '../authMiddleware';
import { LensRequestBody, lensSearch } from '../lens/lens.service';
import { SearchProductsQuery, SuggestQuery } from '../search/search.schema';
import { searchProducts, suggest } from '../search/search.service';
import { BrowseRequestBody } from '../search/browse.schema';
import { browse } from '../search/browse.service';

export const searchRouter: Router = Router();

// W3 generic attribute browse engine - SERVICE-ONLY: catalog-service owns the public listing
// contract (category + filter definition) and calls this with the resolved filters.
searchRouter.post('/internal/browse', requireServiceAuth, async (req, res) => {
  const body = BrowseRequestBody.parse(req.body);
  res.status(200).json(await browse(body));
});

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

// YouMart Lens: photo -> what it is, where it's sold, matching + related products. Signed-in only
// (each call costs money and is capped per user per day - see lens.service.ts).
searchRouter.post('/lens', requireAuth, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 401, 'Invalid or missing authentication token');
  }
  const body = LensRequestBody.parse(req.body);
  res.status(200).json(await lensSearch(userId, body));
});
