# Phase 4 account history pagination — 18 October 2026

Web and Android account screens now load older ledger effects and reconciliation observations using the existing `(timestamp, id)` keyset RPC arguments. They display a load control when a page reaches its limit, append older rows without duplicate IDs on a retry, and discard responses from a previously selected account. A fresh account selection clears the old history before loading.

The shared cursor helper has two Node tests for ledger and observation cursors and retry deduplication. The `finance_foundation.sql` rollback-only fixture now records two observations and checks the second page and end of history, including ordering when records share a transaction timestamp. The transformed fixture passed on isolated hosted development; final synthetic Auth users, observations and finance effects were `0|0|0`.

Verification: 78 Node tests, lint, typecheck, formatting, production web build and Android bundle export passed. This is source/API proof; signed-in device scrolling, accessibility and poor-network retry remain Phase 4 acceptance work.
