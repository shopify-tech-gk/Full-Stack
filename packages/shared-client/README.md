# @youmart/shared-client

Platform-agnostic client LOGIC shared by the web storefront (`apps/web`, Next.js) and the
future mobile app (React Native). No React, no DOM rendering, no platform APIs beyond `fetch`.

| Module            | What it holds                                                                                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`        | TypeScript types mirroring the frozen public API contract v1 (`docs/contracts/API.md`)                                                                                                    |
| `api-client.ts`   | `createApiClient({ baseUrl, getAccessToken })` - typed calls to the api-gateway (`/api/*`), `ApiError` mapped from the `{ error: { code, message } }` envelope                            |
| `money.ts`        | Money-string helpers (`formatMoney`, `discountPercent`, `toPaise`) - display only, no float math                                                                                          |
| `categories.ts`   | The storefront category list (site order) + subcategories, URL/asset path conventions, and `buildCategoryTree` / `resolveStoreCategories` for the live `GET /api/catalog/categories` tree |
| `content.ts`      | Shared static content: promo banners, welcome text, search placeholder                                                                                                                    |
| `storefront.ts`   | Homepage section config + site copy: `ProductCardData` view model, rail titles, grid filter tabs, brand offers, feature cards, best-categories, footer copy/links                         |
| `catalog.ts`      | Listing + product page logic: sort/price/rating/brand query parsing (live query names), `applyListingQuery`, pagination, `ProductDetailData` view model                                   |
| `account.ts`      | My Account nav, phone -> E.164 (`toE164Phone`), address form <-> `AddressInput` mapping + validation mirroring address-service, order fulfilment progress from `sellerStatus`             |
| `cart.ts`         | Cart maths on the cart-service `CartView` (paise, optimistic qty/remove), totals, payment methods (Razorpay only), checkout blockers, order-received overview                             |
| `demo.ts`         | DEMO-only placeholder products/rails used until the catalog API is wired - delete once real data flows                                                                                    |
| `demo-account.ts` | DEMO-only user, OTP code, addresses and orders for the account/order-track pages - delete once auth/address/order APIs are wired                                                          |
| `demo-cart.ts`    | DEMO-only sample cart, shipping total and a fake place-order - delete once cart/checkout/payment APIs are wired                                                                           |
| `theme.ts`        | Design tokens (colors, fonts, breakpoints) - web feeds them into Tailwind, mobile into StyleSheet                                                                                         |

## The split

- **Here**: anything both clients must agree on (data shapes, API calls, category structure,
  copy, tokens). Changing it here changes both clients - this is how web/mobile drift is avoided.
- **In each app**: UI components, layout, navigation, platform image loading.

## Consumption

Shipped as TypeScript source (`main: src/index.ts`, no build step). Next.js compiles it via
`transpilePackages`; React Native's Metro bundler compiles TS natively.
