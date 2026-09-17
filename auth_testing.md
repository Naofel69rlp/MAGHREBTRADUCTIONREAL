# Apple Sign-In — Testing Guide (MaghrebTalk)

## Overview
Native Sign in with Apple (iOS only). Client obtains an Apple identity token via
`expo-apple-authentication` → backend `/api/auth/apple` verifies it against Apple's JWKS
(RS256, issuer `https://appleid.apple.com`, audience in `APPLE_AUDIENCES`) → issues a
7-day `session_token` (same model as Google auth). Token stored in expo-secure-store.

## Config
- app.json: `ios.usesAppleSignIn: true`, plugin `expo-apple-authentication`.
- Bundle id: `com.emergent.darijachat.mhdwef`.
- backend/.env: `APPLE_AUDIENCES="com.emergent.darijachat.mhdwef,host.exp.Exponent"`.

## What can be tested where
- **Button UI + real Apple login**: requires a real Apple ID on a physical iOS device /
  the deployed build (NOT Expo Go simulator reliably, NOT web/Android). Manual test only.
- **Backend `/api/auth/apple` verification logic**: testable with tokens.

## Backend tests (automatable)
1. POST `/api/auth/apple` with a bogus `identity_token` → expect **401** (invalid token).
2. POST with a real Apple identity token whose `aud` is NOT in APPLE_AUDIENCES → **401**.
3. Seed a user+session directly in Mongo and hit `/api/auth/me` with Bearer → 200 (unchanged flow).
4. Confirm `APPLE_AUDIENCES` env includes both the bundle id and `host.exp.Exponent`.

## Manual device test (user)
1. Build/deploy the app; open the Login screen on iOS.
2. Tap the black "Sign in with Apple" button → complete Face ID / Apple ID.
3. First sign-in: name+email sent once and saved. Subsequent logins: sub only.
4. App navigates to the tabs; `/api/auth/me` returns the user.

## Notes
- Users are keyed on `apple_sub` (not email; email may be a private relay or absent).
- Google and Apple share the same `users`/`user_sessions` collections; an Apple login is
  linked to an existing account if the email matches.
