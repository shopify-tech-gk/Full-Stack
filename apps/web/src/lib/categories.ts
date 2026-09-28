import { resolveStoreCategories } from '@youmart/shared-client';

// Static list from shared-client for now. Once the catalog holds the storefront tree, pass the
// result of `api.catalog.listCategories()` here and the live data takes over automatically.
export const storeCategories = resolveStoreCategories();
