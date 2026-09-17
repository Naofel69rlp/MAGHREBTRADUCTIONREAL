# RevenueCat — integrated (2026-08-16)
This file is a memory for interacting with the user's RevenueCat account via the
integration proxy later. NEVER call the RevenueCat REST API directly. All changes go
through `$INTEGRATION_PROXY_URL/internal/revenuecat/*` with the Emergent Bearer key.

## Identifiers (from /setup response)
- rc_project_id: proj869875d0
- apple_app_id: app24a98b8741
- play_app_id: appdc8b211028
- entitlement_lookup_key: premium  (app uses "premium"; user's two products unlock this entitlement)
- offering_lookup_key: default
- bundle_id (iOS): com.emergent.darijachat.mhdwef ; package_name (Android): com.maghrebtraduction.app
  (FINAL per user 2026-08-21: Google Play REQUIRES com.maghrebtraduction.app. App aligned to this package
   + entitlement "premium". User's manual products: 5mensuel:mensuel-premium (monthly 5€),
   45annuel:premium-annuel (annual 45€), both unlocking entitlement "premium". The RevenueCat Google Play
   app MUST also use package com.maghrebtraduction.app. DO NOT re-run /setup or modify the user's
   products/entitlements/offering unless they explicitly ask.)
- Packages (package -> product_id, current price):
  - $rc_monthly -> prod90e52edc2b  (5.00 EUR / P1M, trial: none)
  - $rc_annual  -> prod45c1c6e19e  (45.00 EUR / P1Y, trial: none)
- Dashboard: https://app.revenuecat.com/projects/proj869875d0

## Status check
curl -sS -H "$AUTH" "$INTEGRATION_PROXY_URL/internal/revenuecat/projects/3c8b06a5-1dcf-4b10-9e19-80eb0fb00e17/status"
(AUTH = 'Authorization: Bearer <emergent key>')
If project_state < project_created, re-fetch the RevenueCat playbook via integration_expert.

## Update products (integration proxy ONLY)
POST $INTEGRATION_PROXY_URL/internal/revenuecat/projects/3c8b06a5-1dcf-4b10-9e19-80eb0fb00e17/products
body: {"products":[{"package":"$rc_monthly","price":6.99,"currency":"EUR","period":"P1M","prices":[{"amount_micros":6990000,"currency":"EUR"}]}]}
Remove: DELETE .../products/%24rc_monthly  ($ -> %24)

## App integration facts
- Keys live in frontend/.env: EXPO_PUBLIC_REVENUECAT_TEST_API_KEY / _IOS_API_KEY / _ANDROID_API_KEY (do NOT print values here).
- SDK init at module scope in app/_layout.tsx via initializeRevenueCat() (src/lib/revenuecat.tsx).
- Entitlement gating is CLIENT-SIDE ONLY (customerInfo.entitlements.active["pro"]). Backend does
  NOT enforce premium and has no RC webhook/status endpoint. Free daily limit (3/day) is metered
  by backend /api/usage but the block is enforced client-side; RC `isSubscribed` OR the
  PREMIUM_EMAILS allowlist unlock unlimited.
- Paywall: coded (app/premium.tsx) using useSubscription() — packages from offerings.current,
  purchase + restore + custom confirm modal. No RevenueCat-hosted paywall (no offering design given).

## Going LIVE (user manual steps — App Store Connect / Google Play)
See the FAQ section of the Payments panel. Needed only for real store purchases; Test Store
(Expo Go / web preview / dev build) needs none of it. Product IDs in the stores must match the
RevenueCat product ids shown in the dashboard.
