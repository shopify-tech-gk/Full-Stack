# Homepage product rails — data-source seam (desktop-redesign-3)

Desktop (≥1025px) shows the five homepage rails as tabbed horizontal sliders
(`apps/web/src/components/home/ProductRailSliders.tsx` + `RailTabs.tsx`). Below 1025px the
live 2×2 rail cards (`ProductRails.tsx`) are unchanged and keep their own data (`rails`).

## Where the data comes from

`getHomeProducts(personal?)` in `apps/web/src/lib/catalog.ts` returns `sliders`, built by
`resolveProductRails(pools, personal)` in `packages/shared-client/src/product-rails.ts`.

Every rail has a **heading-matched fallback** of real catalog products (12 per rail), built
from the three catalog queries the homepage already makes (W3 wiring, no extra API calls):

| Rail (`key`)                             | Personal? | Fallback (real catalog products)                               |
| ---------------------------------------- | --------- | -------------------------------------------------------------- |
| Pick up where you left off (`left-off`)  | yes       | newest                                                         |
| Up to 10% off \| Trending (`trending`)   | no        | top-rated                                                      |
| Top Deals \| Up to 20% off (`top-deals`) | no        | highest discount first (only discounted products)              |
| Recommended for You (`recommended`)      | yes       | most-reviewed (rating count, then rating)                      |
| More Items to Explore (`explore`)        | no        | products the other rails don't show, then the rest of the pool |

A rail with no products is dropped, so the section never shows an empty slider.

## The seam (Step B: per-user recently viewed / recommendations)

```ts
// packages/shared-client/src/product-rails.ts
export type PersonalRailFeed = (
  key: 'left-off' | 'recommended',
) => Promise<readonly ProductCardData[] | null>;
```

Step B only has to implement a `PersonalRailFeed` and pass it to the homepage call:

```ts
// apps/web/src/app/page.tsx (Step B)
const { rails, sliders, showcase } = await getHomeProducts(recentlyViewedFeed(customerToken));
```

- Return the user's products for `'left-off'` (recently viewed) and/or `'recommended'`.
- Return `null` or `[]` when the user has no history (or is a guest) → that rail shows its
  heading-matched fallback above. A feed that throws is treated as `null`.
- Each slider carries `source: 'personal' | 'fallback'` (rendered as `data-source` on its tab
  panel) so tests and analytics can tell which one is showing.
- No UI change is needed: `ProductRailSliders` renders whatever `sliders` contains.

Rail headings and "View all" targets live in `PRODUCT_RAIL_DEFINITIONS` in the same file. Discount
badges are not hardcoded: rails with `discountBadge: true` (Trending, Top Deals) show
`railDiscountBadge(products)` - "Up to N% off" for the real best discount among the products the
rail actually shows (personal or fallback), or no badge below `RAIL_BADGE_MIN_DISCOUNT` (5%).
Products are never filtered to fit a badge.
