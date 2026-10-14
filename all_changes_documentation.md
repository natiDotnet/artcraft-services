# Artcraft Services — Comprehensive Change Documentation

This document provides a complete technical record of all features, fixes, and architecture updates implemented across the backend and frontend.

---

## 1. Google SSO Authentication & Verification Fix

### Root Cause Identified
- In `crates/service/web/storyteller_web/src/http_server/endpoints/users/google_sso/check_claims.rs`, `VerificationOptions` had hardcoded a legacy Google Client ID:
  ```rust
  allowed_audiences: Some(HashSet::from([
    "788843034237-uqcg8tbgofrcf1to37e1bqphd924jaf6.apps.googleusercontent.com".to_string(),
  ]))
  ```
- When a custom client ID was configured in the frontend (`VITE_GOOGLE_CLIENT_ID`), Google minted the ID token with `aud` set to the new ID, causing `jwt_simple` to reject the token with `JwtInvalidAudience` ("invalid google credential").

### Changes Implemented
- **Dynamic Audience Resolution:**
  Updated `crates/service/web/storyteller_web/src/http_server/endpoints/users/google_sso/check_claims.rs` to dynamically aggregate allowed audiences from:
  1. Environment variables: `GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_IDS` (supports comma-delimited lists).
  2. Local configuration files (`.env`, `build/selfhost/.env`, `frontend/apps/artcraft-webapp/.env.local`).
  3. Legacy client ID fallback for backward compatibility.
  4. Optional bypass flag `GOOGLE_AUTH_DISABLE_AUDIENCE_CHECK=true` for isolated local testing.
- **Environment Configuration:**
  - Added `GOOGLE_CLIENT_ID=744411206603-8thl38qpggdtcpr90b9f906shh8olce9.apps.googleusercontent.com` to root `.env`.
  - Added `GOOGLE_CLIENT_ID=unset` placeholder to `build/selfhost/.env`.

---

## 2. Mandatory Phone Number Requirement for Google SSO & Auth

### Business & Functional Requirement
- For Ethiopian payment operations (Chapa, Telebirr, CBEBirr), every user account must have a verified Ethiopian mobile number. Google OAuth tokens do not provide phone numbers, so accounts registered through Google lacked phone numbers, causing Chapa payment initiation to fail.

### Frontend Changes
- **Interactive Phone Number Modal (`GoogleLoginButton.tsx`):**
  - Added an interactive modal dialog that pops up immediately when Google SSO signals that a phone number is required (`phoneNumberRequired: true`).
  - Displays a prefix-masked input with a fixed `+251` badge and 9-digit numeric input (`9XXXXXXXX`).
  - Includes Ethiopian phone validation, error handling for already-registered numbers, and auto-submit with the Google credential.
- **Form Auto-Pass (`signup-form.tsx` & `login.tsx`):**
  - If the user already entered a phone number on the signup or login form, `GoogleLoginButton` passes it directly to `GoogleSSO`, eliminating redundant prompts.
- **API Client Update (`UsersApi.ts`):**
  - Updated `GoogleSSO({ credential, phoneNumber, ... })` to send `maybe_phone_number` and detect `phone_number_required` responses.

### Backend Changes
- **Phone Normalization Utility (`crates/service/web/storyteller_web/src/util/normalize_ethiopian_phone.rs`):**
  - Created standard utility normalizing Ethiopian formats (international `+2519...`, suffix `9...`, or local `09...` / `07...`) to canonical 10-digit local format (`09XXXXXXXX` / `07XXXXXXXX`).
  - Registered in `crates/service/web/storyteller_web/src/util/mod.rs`.
- **SSO Handlers (`google_sso_handler.rs`, `handle_new_sso_account.rs`, `handle_new_sso_account_for_new_user.rs`):**
  - Added `maybe_phone_number: Option<String>` to `GoogleCreateAccountRequest`.
  - For **new users**, Google SSO returns `phone_number_required` if no phone is provided. When provided, the normalized number is stored as the user's `username` and `display_name`.
  - For **existing users** with legacy/random usernames, the server detects the missing phone number and prompts the user to add it, updating the database record.
  - Returns `UsernameIsTaken` ("An account with this phone number already exists") if the phone is registered to another account.
- **Chapa Checkout Guard (`chapa_artcraft_create_checkout_handler.rs`):**
  - Enforced that checkout returns an error if `resolve_phone_number_from_session` fails, guaranteeing Chapa transactions always have a valid payer phone number.

---

## 3. Chapa Payment Gateway & ETB Billing Rail

### Implementation Details
- **Checkout Handler (`billing_artcraft`):**
  - Implemented `chapa_artcraft_create_checkout_handler.rs` supporting both prepaid subscription plans and one-off credit packs.
  - Automatically resolves customer name and mobile number from the authenticated user session.
  - Added helper `normalize_ethiopian_phone` and `resolve_customer_name` with unit tests.
- **Payment Verification:**
  - Implemented `chapa_artcraft_verify_transaction_handler.rs` for server-to-server transaction verification and fulfillment.
  - Integrated `useChapaReturnVerify()` hook in frontend to handle redirect returns and update user balance.
- **Pricing & Credit Components:**
  - Integrated ETB subscription plans and credit packs into `pricing-table.tsx` and `credits-modal.tsx`.
  - Built custom PAYG slider with dynamic ETB calculation.

---

## 4. Phone Number Masking & Login Lookup

- **Input Masking (`signup-form.tsx`):**
  - Added fused `+251` prefix input to ensure users only input their 9-digit suffix.
  - Standardized local storage format to `09XXXXXXXX`.
- **Bidirectional Phone Login (`login_handler.rs`):**
  - Updated backend login to detect phone numbers and retry lookup using alternate Ethiopian formats:
    - International (`2519XXXXXXXX`, 12 digits) $\leftrightarrow$ Local (`09XXXXXXXX`, 10 digits).
- **Identifier Normalization (`login.tsx`):**
  - Added `normalizeIdentifier` so users can log in by typing email, `09XXXXXXXX`, `9XXXXXXXX`, or `+2519XXXXXXXX`.

---

## 5. Model Pricing Data & Spreadsheet Artifacts

- Researched and compiled comprehensive pricing data for all supported AI models:
  - **Image Models:** Flux Schnell, Flux Dev, Flux 1.1 Pro, Imagen 3, Ideogram 2, etc.
  - **Video Models:** Kling 1.5, Kling 2.0, MiniMax, Luma Dream Machine, Runway Gen-3, Google Veo 2, etc.
  - **Audio & TTS Models:** ElevenLabs, F5-TTS, Voice Conversion, Tacotron, TalkNet.
- Exported complete structured data with Credit costs, USD equivalent, ETB equivalent, and billing unit (per generation vs per minute/second):
  - Excel spreadsheet: [`artcraft_model_pricing.xlsx`](file:///C:/Users/Tesfaye/.gemini/antigravity-ide/brain/3f394026-389a-440e-a1c9-a5d3d3e93896/artcraft_model_pricing.xlsx)
  - Raw script and CSV data in scratchpad directory.

---

## 6. UI Polish & Theme Consistency

- Refined light/dark theme styling across:
  - Login page (`login.tsx`)
  - Signup page (`signup-form.tsx`)
  - Password reset flows (`forgot-password.tsx`, `verify-reset.tsx`)
  - Studio Chat & Sidebar
- Ensured consistent border styling, password visibility toggle interactions, and high-contrast accessible inputs in both light and dark modes.

---

## Summary of Modified Files

| Area | File Path | Key Changes |
|---|---|---|
| **Backend Auth** | `crates/service/web/storyteller_web/src/http_server/endpoints/users/google_sso/check_claims.rs` | Dynamic Google Client ID verification |
| **Backend Auth** | `crates/service/web/storyteller_web/src/http_server/endpoints/users/google_sso/google_sso_handler.rs` | Required phone number validation and update logic |
| **Backend Auth** | `crates/service/web/storyteller_web/src/http_server/endpoints/users/google_sso/handle_new_sso_account.rs` | Phone number linkage for existing user accounts |
| **Backend Auth** | `crates/service/web/storyteller_web/src/http_server/endpoints/users/google_sso/handle_new_sso_account_for_new_user.rs` | Set normalized phone number as user's username |
| **Backend Utils** | `crates/service/web/storyteller_web/src/util/normalize_ethiopian_phone.rs` | New utility for normalizing Ethiopian phone numbers |
| **Backend Billing** | `crates/service/plugins/billing_artcraft/src/endpoints/checkout/chapa_artcraft_create_checkout_handler.rs` | Session phone extraction & Chapa checkout initialization |
| **Backend Login** | `crates/service/web/storyteller_web/src/http_server/endpoints/users/login_handler.rs` | Dual format (local/international) phone login lookup |
| **Config** | `.env` & `build/selfhost/.env` | Added `GOOGLE_CLIENT_ID` configuration |
| **Frontend Auth** | `frontend/apps/artcraft-webapp/src/components/auth/GoogleLoginButton.tsx` | +251 Phone prompt modal & credential submission |
| **Frontend Auth** | `frontend/apps/artcraft-webapp/src/components/auth/signup-form.tsx` | Masked +251 input & phone prop forwarding |
| **Frontend Auth** | `frontend/apps/artcraft-webapp/src/pages/login/login.tsx` | Phone identifier normalization & Google SSO phone pass |
| **Frontend API** | `frontend/libs/api/src/lib/UsersApi.ts` | Added `phoneNumber` and `phoneNumberRequired` handling |
