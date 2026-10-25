# Phase 11 checkpoint — WhatsApp number deferred

**24 October 2026 owner decision:** WhatsApp automation is deferred to a future release, inspired by banking-style WhatsApp services. Do not make the Meta API integration a prerequisite for a first release that leaves automated outbound disabled. Receipt generation still follows Treasurer verification; any staff-led handoff uses only the issued receipt. A chatbot or incoming “paid” message must never verify money or change the ledger.

The masjid does not yet have its WhatsApp Business number. This checkpoint keeps all live sending disabled. The activation row is inserted with `enabled=false` and no sender, phone number ID, template names or reviewed date. The web environment example leaves credentials blank. There is no dispatch schedule or live worker route.

## Built in the worktree

- The existing first Friday and reminder scheduler creates unique, unsent request snapshots. The new migration adds a leased, service-only claim, a second consent/opt-out/payment/QR check before the provider call, at most five attempts, bounded backoff for a definite HTTP 429, and failed states for ambiguous network/provider outcomes. An ambiguous `sending` lease is deliberately not claimed again.
- A raw-body HMAC SHA-256 webhook boundary and challenge verifier, signed inbound ID deduplication, exact STOP/UNSUBSCRIBE/CANCEL handling, and append-only delivery status events. The web route requires the configured phone number ID and ignores events for other numbers.
- A provider transport that prepares a Meta template send and stores the accepted provider message ID. A service-role database adapter and an aggregate delivery health RPC expose queue state without donor phone numbers.
- Unit tests for wrong signatures, wrong number filtering, opt-out preflight, disabled sending, accepted responses, rate limits and ambiguous failures.

## Still required before activation

1. Obtain the masjid-owned Business account and phone number. Verify ownership, webhook subscription, appropriate current Meta permissions, payment method and expected budget. Record the phone number ID, displayed E.164 sender, app secret, webhook token and short-lived/renewable access token through server secrets only.
2. Approve exact request and reminder wording, locale, template category and parameter order with Meta. Complete the donor-facing consent wording/version and insert the approved version by reviewed migration. The template parameter renderer and image/QR delivery format depend on the approved text. The queue currently contains a QR digest/account snapshot, **not a public QR URL**; build a time-safe, account-matched media/link delivery contract before sending.
3. Add a server-only scheduled dispatch entrypoint and production secrets, and check it cannot run until both the database activation row and reviewed template renderer are present. Decide operator ownership for the health queue and provider reconciliation. Only reset an ambiguous send after independently checking the provider message history; otherwise it could double-send.
4. Build receipt/meeting message variants after their approved wording and trigger contracts are settled. A `PAID` reply or payment reference must never create a verified receipt; only Treasurer verification may do so.
5. Apply the migration in a staging Supabase project and test RLS/service-role grants and concurrency with a real Postgres database. Docker is unavailable in this worktree, so this SQL has not been executed here. Exercise sandbox and opted-in real-number sends, duplicate/forged webhooks, STOP races, stale QR, provider outage, late status, rate limits and costs before enabling production.

## Activation gate

Leave `app_private.whatsapp_activation.enabled=false` until an owner reviews the number, template names and locale, consent evidence, rendered content/QR URL, transport/billing, operator failure recovery and real-number test results. Filling an environment variable alone does not activate the database claim. This phase is a tested local foundation, **not a complete or live Phase 11**.
