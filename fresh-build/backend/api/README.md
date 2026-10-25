# First API contract and identity handler

`openapi.v1.json` is a 16-operation machine-readable draft for identity,
donor/claim and initial finance flows. `identity-handler.js` is a server-only
Fetch Request handler for the identity subset; it requires an injected durable
shared rate limiter, trusted proxy IP reader, and the server Auth service.
Unit tests do not make it a deployed endpoint.

`../../packages/contracts/` carries shared exact-paise, UUID, error and signed
cursor validation and target donor/claim parsers. The donor POST contract uses
a server-selected approved consent version and requires evidence reference;
the current `/api/management/enroll-donor` adapter still has an INR input and
is explicitly gated. These first slices still need live Auth/Data API validation,
complete storage rules, safe cookie/native session wiring and owner review.
Owner-gated donor management is revoked by the identity migration.
