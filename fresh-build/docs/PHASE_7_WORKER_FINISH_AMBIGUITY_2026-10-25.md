# Report artifact finish ambiguity — 25 October 2026

The private report worker uploaded and verified PDF/CSV bytes before calling `finish_finance_report_artifact`. If the database committed the ready state but the RPC response was lost, its catch block treated the response as a failure and deleted the uploaded object. The database could then point at a missing private report.

The worker now preserves the object once it reaches the finish call. If the finish did not commit, the failure RPC marks the attempt terminal as `upload_ambiguous`, retaining the object path for the guarded operator recovery process. If the finish committed, the failure RPC cannot change the ready row; the request reports an unavailable worker response while the ready object remains intact for a later authorized read. No automatic retry or deletion is made in that uncertain state.

Two unit cases simulate an uncommitted finish and a committed finish with a lost response. Both assert that the private object is not removed. Existing upload-ambiguity cleanup and normal ready behavior still pass. All 149 Node tests, lint, typecheck, formatting and the production web build passed. Hosted runtime, private Storage, delayed response, operator recovery and scheduler tests remain open; this code fix does not activate report exports.

## Hosted database boundary check

The rollback-only `phase7_report.sql` fixture now calls the service-only failure RPC after a successful finish. It asserts that the failure is refused and the ready row retains its private object path with no failure code. The converted fixture passed on isolated hosted development. The subsequent readback found zero Auth users, report runs, report artifacts, finance effects and Storage objects. This is database proof; the Node worker and private Storage were not run against hosted development because this workspace has no hosted service credential or worker secret.
