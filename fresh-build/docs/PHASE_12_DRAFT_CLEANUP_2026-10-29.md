# Android offline draft cleanup — 29 October 2026

The SecureStore queue previously removed a draft ID from its index before deleting the private item. If storage failed between those writes, the item became invisible to the queue and could remain on the device. The same ordering followed a successful server submission.

The queue now deletes the item first, then updates the index. An interruption after deletion leaves only a stale ID; `list()` skips it and the next `add()` compacts the index. If deletion itself fails after the server has accepted a submission, the draft and its operation ID remain available for an idempotent retry. This change does not add offline authority to approve, verify, post money or issue receipts.

The Android reviewed-draft removal button now reports an interrupted cleanup and reloads the saved list, instead of leaving an unhandled button error.

Three storage-interruption tests cover reviewed removal, successful submission with a failed index update, and failed private-item deletion followed by an exact-ID retry. The full suite passed **172/172** Node tests, lint, typecheck and formatting; Android bundle export passed. These tests use a controlled storage double. Real SecureStore behavior across app kill, upgrade, reconnect and two devices still needs device and staging acceptance before the Phase 12 offline gate closes.
