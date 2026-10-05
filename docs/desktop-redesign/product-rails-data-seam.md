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

- Return the user's products for `'left-off'` (recently viewed) and/or `'recommended'`.
- Return `null` or `[]` when the user has no history (or is a guest) → that rail shows its
  heading-matched fallback above. A feed that throws is treated as `null`.
- Each slider carries `source: 'personal' | 'fallback'` (rendered as `data-source` on its tab
  panel) so tests and analytics can tell which one is showing.
- With personal products, a rail shows them first and tops up with its fallback (no repeats), so
  it is never sparse (`railProducts`); without, the fallback alone.

### Step B — filled (view tracking, `feat-view-tracking`)

The feed is `recentlyViewedFeed` in `apps/web/src/lib/recently-viewed.ts`, and it runs **in the
browser**: the customer's access token lives only in browser memory (API.md §2.1) and the refresh
cookie is scoped to the gateway's `/api/auth`, so the Next.js server rendering `/` cannot know who
is signed in. The server therefore renders the heading-matched fallback (`getHomeProducts()` is
called without a feed), and once the session is known the browser swaps in the shopper's own
products for the personal rails (`usePersonalRails`), through the same `personalRailProducts` +
`railProducts` rules the server path uses. `getHomeProducts(personal)` keeps accepting a feed for
any future server-side source.

| Rail                       | Signed in                                         | Guest (this browser only)                         | No history / failure |
| -------------------------- | ------------------------------------------------- | ------------------------------------------------- | -------------------- |
| Pick up where you left off | `GET /api/catalog/recently-viewed` (server, ≤ 50) | local ids → `GET /api/catalog/product-cards?ids=` | heading-matched      |
| Recommended for You        | heading-matched (not personalised yet)            | heading-matched                                   | heading-matched      |

Where it shows: desktop (≥ 1025px) — the "Pick up where you left off" slider tab; mobile/tablet
(< 1025px) — the live "Pick up where you left off" 2 × 2 rail card (data only; its markup is the
same component output, so the layout never changes).

Recording (`ProductViewTracker` on the product page, after hydration): signed in →
`POST /api/catalog/recently-viewed` (not awaited, failures ignored; the server also answers `202`
before writing); guest → `localStorage` `ym_guest_recently_viewed` (capped 50, de-duped, newest
first). On sign-in the guest list is merged (`POST .../merge`, latest view time wins) the first
time a tracked page or the homepage loads, then cleared locally; a failed merge puts it back.

Privacy: history is per user (customer token, own rows only), capped at 50 with older rows
deleted, clearable (`DELETE /api/catalog/recently-viewed`); guest history never leaves the browser
until that shopper signs in.

Rail headings and "View all" targets live in `PRODUCT_RAIL_DEFINITIONS` in the same file. Discount
badges are not hardcoded: rails with `discountBadge: true` (Trending, Top Deals) show
`railDiscountBadge(products)` - "Up to N% off" for the real best discount among the products the
rail actually shows (personal or fallback), or no badge below `RAIL_BADGE_MIN_DISCOUNT` (5%).
Products are never filtered to fit a badge.
