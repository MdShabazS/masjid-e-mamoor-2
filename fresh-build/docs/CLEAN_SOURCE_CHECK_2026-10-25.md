# Clean source restore and build — 25 October 2026

The verified `masjid-project-working-source-2026-10-25T180545Z.tar.gz` archive (SHA-256 `d079b24781da2b38cb0405bf66f8fd0c1308979fae5fefc3741a018f4ff4b071`) restored 989 files into a fresh temporary directory. No existing `node_modules`, `.next` or Android export was copied. On Node `v24.15.0`, `npm ci --offline --ignore-scripts --no-audit --no-fund` installed 593 packages with the Node 22 engine gate.

From the restored `fresh-build/`, these passed: 151 Node tests; lint, typecheck and formatting; the web production build; Android bundle export; environment-template and public-bundle regression tests; backup unit test; shell check; and the 30-migration/14-fixture inventory with three fixture-preflight tests. Rebuilding both clients with three synthetic server-only canaries and scanning 48 public assets found none. The unconfigured built-web HTTP smoke returned public pages and denied protected identity, jobs, management, receipt, WhatsApp and private QR/report routes.

The exported Android Hermes bundle SHA-256 was `061b6aace0879b3fe900f1af9d21a5c7f06d9067d35c035a53413593d0806a53`. The temporary checkout is test output, not a deployment artifact.

This is a local clean-source check. Hosted CI from a committed checkout, native signed Android build/device tests, hosted runtime secrets, staging, real-money reconciliation and production recovery remain open.
