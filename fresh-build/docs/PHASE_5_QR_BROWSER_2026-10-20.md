# Phase 5 signed-in QR account screen — 20 October 2026

**Target:** disposable local `masjid-e-mamoor-2-fresh` Supabase stack and temporary Next.js server on port 18089. The reusable fixture is `backend/scripts/phase5_qr_browser_fixture.mjs`; `backend/scripts/phase5_synthetic_qr.swift` makes and independently decodes a synthetic `upi://pay?pa=synthetic@bank` PNG using macOS Core Image and Vision. No real account, payee or person was used.

## Browser observations

1. A synthetic, active President username/password signed in through `/login`. `/finance/accounts` listed its synthetic UPI account at ₹0.00. Selecting it displayed beneficiary version 1 and the matching `synthetic@bank` payee.
2. The President selected the generated PNG in the real file input. The preview appeared, and the activation button remained disabled until the payee attestation checkbox was checked. The image had been decoded independently to the expected synthetic UPI payee before attestation.
3. Submission displayed “Payment QR activated” and SHA-256 `0d949f2b41f367300d89cfb0afb44099b0f80918f06fa75e7205e06b07f4514f`. “Load active QR” displayed the private image, the same digest and version `7899c86b-a05f-485c-93b6-393b48afe9c6`.
4. After signing out through the app, a separate synthetic Treasurer signed in. Its account screen displayed beneficiary history and the private review control, but no upload control. Loading the active QR displayed the same digest and version; the browser image completed at 376×376 pixels.
5. The fixture's final disposable database reset removed synthetic accounts, sessions and objects. Final Auth user / QR version / Storage object counts were `0|0|0`. The temporary web server exited.

The first fixture attempt exposed an incorrect test email convention. The app derives internal Auth email from the username. The fixture now creates `username@accounts.masjid.invalid`; the failed attempt's disposable database was reset before the successful run. Browser work used `localhost` for the Next development origin.

**Scope:** this proves the synthetic local account-screen journey and role-specific controls. It does not approve a real masjid payee, run the hosted web path, test recipient-specific delivery or private-object restore. Those remain open in `tasks.md`.
