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

## Test on a REAL phone over Wi-Fi (Expo Go)

By default the gateway binds `localhost` (loopback only), so a phone can't reach it. Enable the
dev-only `0.0.0.0` bind and point the app at your PC's Wi-Fi IP:

1. **Enable the gateway's LAN bind (dev only).** In the repo-root `.env`, set:
   ```
   GATEWAY_HOST=0.0.0.0
   ```
   then restart the gateway (or the backend stack). Default stays `localhost`; this is dev-only.
2. **Find your PC's Wi-Fi LAN IP.** Run `ipconfig` and use the **Wireless LAN adapter Wi-Fi**
   IPv4 Address (e.g. `192.168.1.50`). **Ignore** WSL/Hyper-V/virtual adapters (`172.x`,
   `192.168.137.x`, `vEthernet`).
3. **Point the app at it.** In `apps/mobile/.env` (copy from `.env.example`):
   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.50:4000/api
   ```
   `EXPO_PUBLIC_*` is inlined at bundle time — **restart Metro** after changing it.
4. **Allow the firewall.** Windows Firewall must allow inbound TCP **4000** (approve the prompt, or
   add an inbound rule for port 4000 on the Private/Wi-Fi profile).
5. **Same Wi-Fi.** Phone and PC must be on the **same network** (and the Wi-Fi must not use client
   isolation / AP isolation).
6. **Run + scan.** `pnpm --filter @youmart/mobile start`, then scan the QR with **Expo Go**
   (Android) or the **Camera app** (iPhone with Expo Go installed). The category list should load.

> Android emulator alternative (no LAN bind needed): `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000/api`
> reaches the host's localhost directly. A tunnel is another option:
> `pnpm --filter @youmart/mobile start --tunnel` (you'd also need to expose the gateway).

## Auth & token storage (Phase 2b — the RN cookie-model replacement)

The web keeps the access token in memory and the refresh token in an httpOnly `ym_rt` cookie. On
React Native:

- **Access token** — in memory only (`setAccessToken` in [src/lib/api.ts](src/lib/api.ts)), sent as
  `Authorization: Bearer` by shared-client. Never persisted, never logged.
- **Refresh token** — handled by React Native's **native cookie jar** (iOS `NSHTTPCookieStorage` /
  Android `CookieManager`). The `ym_rt` cookie the server sets on login is stored and replayed
  automatically on `/auth/refresh`, **including across app restarts** (it's a 14-day persistent
  cookie). The api-client already sends `credentials: 'include'`, so this needs **no backend
  change** and no manual cookie handling.
- **Silent refresh** — on launch, [src/stores/session.tsx](src/stores/session.tsx) calls
  `/auth/refresh`; if the jar has `ym_rt` the session is restored without re-OTP. Any 401 triggers
  one refresh+retry. **Logout** revokes server-side (the clearing `Set-Cookie` empties the jar).

> An earlier attempt injected a custom `expo/fetch` fetchImpl to mirror the refresh token into
> expo-secure-store, but its `Response` did not read back reliably in Expo Go (requests reached the
> server yet responses hung). The native cookie jar is the robust, Expo-Go-safe path; a
> secure-store token model can return later with a native dev build if required.

Dev OTP (local, notifications simulated): request a code in the app, then on the PC run
`pnpm dev:otp 9876543210` (or `pnpm dev:otp you@example.com`) to print the code — see
[docs/ops/running.md](../../docs/ops/running.md).

## Payment (Razorpay) — Expo Go compatible

Razorpay's native `react-native-razorpay` **crashes in Expo Go** (native module). Instead the
payment screen ([src/app/payment.tsx](src/app/payment.tsx)) runs **Razorpay Checkout in a WebView**
(`react-native-webview`, Expo Go-compatible). The app uses only the **public key id + Razorpay order
id** from the backend — the **secret never touches the app**. Confirmation is **server-authoritative
via the webhook**: after the widget closes, the app **polls `GET /api/orders/:id` until CONFIRMED**
(the client callback alone is never trusted). Server owns all prices (anti-tampering).

- **Testable in Expo Go now:** login, cart/wishlist/addresses, checkout → create order → the
  Razorpay WebView → webhook-poll → CONFIRMED → success/orders.
- **Needs live Razorpay keys:** the backend must have real `RAZORPAY_KEY_ID`/secret + the webhook
  configured for an end-to-end paid confirmation. Without them the create-order + poll logic still
  runs; the widget needs valid keys.
- **Alternative (full native SDK):** `react-native-razorpay` gives a native sheet but requires an
  **Expo dev build / EAS Build** (not Expo Go). Not used here, to keep Expo Go testing working.

## Windows / iOS testing reality

- **Android:** fully testable on Windows — Expo Go on an Android phone, or an Android emulator.
- **iOS:** testable via **Expo Go on a real iPhone**. The **iOS Simulator needs a Mac** (not
  available on Windows). A standalone iOS build is produced via **EAS Build** (cloud, no Mac needed).

## Reuse of `@youmart/shared-client` (how it works)

`shared-client` is pure, platform-agnostic TypeScript. Metro resolves and transpiles it from the
workspace via `metro.config.js`. The app reuses its api-client, types, money math, catalog mappers,
auth helpers, and the **guest→account merge logic** (`mergeGuestCart` / `mergeGuestWishlist` /
`mergeRecentlyViewed`) — same logic as the web, with RN storage injected:

- guest cart/wishlist/recently-viewed → **AsyncStorage** (`src/stores/*`);
- refresh token → **expo-secure-store** (`src/lib/storage.ts`).

On login, the guest cart, wishlist, and recently-viewed history are merged into the account and the
local copies cleared — identical to the web W4 / view-tracking behaviour.
