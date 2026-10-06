# @youmart/mobile — YouMart native app (Expo + React Native)

Phase 1 foundation: an Expo (managed) + React Native + TypeScript app in the monorepo that
**reuses `@youmart/shared-client`** (the same API client, types, money/format helpers, taxonomy,
and cart/wishlist/recently-viewed logic the web uses) and talks to the **same backend gateway**
(`/api`). No new backend, no duplicated logic.

- **Expo SDK:** 57 • **React Native:** 0.86 • **Router:** `expo-router` (Expo's recommended router)
- **Node:** the repo requires Node ≥ 20.19 (use the portable Node, see repo ops docs). Expo needs it too.

The home screen (`src/app/index.tsx`) is a **proof of life**: it calls
`api.catalog.listCategories()` through `@youmart/shared-client` → gateway → backend and lists the
real categories. If you see the category list, the full plumbing works.

## Run it (developer / Kavin tests on device; the agent cannot device-test)

From the repo root, with the backend + gateway running (`pnpm infra:up` + the services) and the
portable Node on PATH:

```powershell
# install (once, from repo root)
pnpm install

# start Metro + the dev server (QR code)
pnpm --filter @youmart/mobile start
```

Then scan the QR code with **Expo Go** (Android phone) or the Camera app (iPhone with Expo Go).
Other commands: `pnpm --filter @youmart/mobile android` (emulator), `... web` (browser preview).

## Point the app at the backend (IMPORTANT for a real phone)

A real phone on Expo Go **cannot reach your PC's `localhost`** — that resolves to the phone itself.
Set `EXPO_PUBLIC_API_URL` to your PC's **LAN IP** (same wifi), e.g.:

```
# apps/mobile/.env   (gitignored; copy from .env.example)
EXPO_PUBLIC_API_URL=http://192.168.1.50:4000/api
```

Find your IP with `ipconfig` → IPv4 Address. `EXPO_PUBLIC_*` vars are inlined by Expo at bundle
time, so **restart Metro after changing `.env`**. Alternatives: an Android emulator can use
`http://10.0.2.2:4000/api`; or run a tunnel (`pnpm --filter @youmart/mobile start --tunnel`) and
expose the gateway too.

> The gateway currently binds localhost; to accept LAN requests from a phone it must listen on
> `0.0.0.0` and your firewall must allow port 4000. (Out of scope for Phase 1 — noted for device
> testing.)

## Windows / iOS testing reality

- **Android:** fully testable on Windows — Expo Go on an Android phone, or an Android emulator.
- **iOS:** testable via **Expo Go on a real iPhone**. The **iOS Simulator needs a Mac** (not
  available on Windows). A standalone iOS build is produced via **EAS Build** (cloud, no Mac needed).

## Reuse of `@youmart/shared-client` (how it works)

`shared-client` is pure, platform-agnostic TypeScript (no `window`/`localStorage`/`document`; the
only external dependency is the global `fetch`, which React Native provides). Metro resolves and
transpiles it from the workspace via `metro.config.js` (`watchFolders` = monorepo root +
`nodeModulesPaths` + symlink support for pnpm). The api-client is constructed in `src/lib/api.ts`.

## Flagged for later phases (not solved in Phase 1)

- **Auth storage:** the web keeps the access token in memory and the refresh token in an httpOnly
  cookie (`ym_rt`). RN has no browser cookie — the app will store the refresh token in
  **expo-secure-store** and inject `getAccessToken`/`onUnauthorized` into `createApiClient`.
- **Guest persistence:** `guest-cart`, `guest-wishlist`, and `recently-viewed` need a storage
  adapter. The web injects `localStorage`; RN will inject **AsyncStorage/SecureStore** (same
  shared-client logic, different adapter). To be wired in the cart/auth phases.
- **UI:** the full app UI (matching the verified mobile web as the visual source of truth) comes in
  later phases. Phase 1 is foundation + plumbing only.
