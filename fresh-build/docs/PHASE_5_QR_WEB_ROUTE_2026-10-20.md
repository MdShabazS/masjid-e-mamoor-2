# Phase 5 QR web route check — 20 October 2026

**Target:** disposable local `masjid-e-mamoor-2-fresh` Supabase stack and a temporary Next.js server on port 18088. The test sent HTTP requests through the actual `/api/management/payment-qr` route with separate issued Auth sessions. It used generated PNG images and a synthetic UPI account; no masjid or production data was used.

`backend/scripts/phase5_qr_lifecycle.mjs` first ran its existing direct service, Storage and database checks. It then started Next.js with server-only local Supabase credentials and exercised the web route:

| Check | Expected | Actual |
| --- | --- | --- |
| GET without bearer or with Member/Data Entry | 401 without bearer; 403 for denied roles | Pass |
| GET as President/Treasurer | 200, private/no-store headers, exact current PNG bytes and SHA-256 | Pass |
| POST without bearer or as Member/Treasurer | 401 without bearer; 403 for denied roles | Pass |
| POST as Data Entry | 200, exact stored PNG digest and current QR version | Pass |
| Same operation retry and changed bytes | Same version for exact retry; HTTP 409 for different bytes | Pass |
| Later private review | Treasurer GET returns the Data Entry upload's version and exact bytes | Pass |
| Existing session after role change | Data Entry changed to Member on the server; the old token can no longer upload | 403 |
| Money isolation and cleanup | QR workflow creates no finance effects; reset removes all fixture records | Zero effects; final users/sessions/profiles/accounts/QR versions/QR assets/Storage objects/effects `0|0|0|0|0|0|0|0` |

The temporary web server exited, port 18088 had no listener, and only the fresh local Supabase stack was stopped. The 92 Node tests, lint, typecheck, formatting and production web build also passed after this change.

This tests the route over local HTTP, not the account-screen browser controls. Hosted web/Storage requests, real QR payee/operator approval, recipient-specific delivery, orphan cleanup, private-object backup/restore, staging and device journeys remain open.
