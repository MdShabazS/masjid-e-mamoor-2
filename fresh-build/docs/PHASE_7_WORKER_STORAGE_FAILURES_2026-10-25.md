# Report worker Storage failure handling — 25 October 2026

The report artifact worker now checks the downloaded Blob's size against the rendered byte count before calling `arrayBuffer()`. A mismatched or oversized readback is rejected and the attempted object is cleaned up. This avoids a second large in-memory copy after the Supabase SDK returns a Blob; it is not a streaming limit on the SDK's initial download.

If Storage cleanup throws after an upload or readback error, the worker now continues to call the database failure command. The attempt remains terminal and records its attempted path for guarded operator inspection and recovery. An uncertain final database response still preserves the uploaded object, as documented in `PHASE_7_WORKER_FINISH_AMBIGUITY_2026-10-25.md`.

Two new fault tests cover an oversized readback without `arrayBuffer()` and an exception from Storage cleanup. All eight focused worker tests, 151 Node tests, lint, typecheck, formatting and the production web build passed. The worker was not enabled in hosted development; hosted private Storage, scheduler and recovery acceptance remain open.
