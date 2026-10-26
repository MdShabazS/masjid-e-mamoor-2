# Phase 8 Android task participation — 26 October 2026

The Android signed-in screen now loads the role-scoped work-task list. A participant can accept an invitation or join an open task, leave an active task, and submit a completion note. The task creator can view participants and accept or return a submitted completion with a reason. The component uses the existing guarded RPCs and preserves an operation ID across a failed same-input retry. A failed refresh after a successful mutation is reported as a refresh problem, without encouraging a second mutation.

This is client coverage, not a signed-in device acceptance result. Task creation, invitation and cancellation remain available in the web client. The Android task screen does not display the proposed score until the Board approves an explanation and policy. A future signed-in Android test must check join, waitlist, promotion, completion, review, returned completion and cancellation against the database, including weak-network retries and screen-reader labels.

Verification: 157 Node tests passed, ESLint passed, TypeScript check passed, Prettier check passed, and the Android bundle exported. The existing local and hosted database task capacity and review races were proved separately in the earlier Phase 8 records. No Android device or staging journey was run for this change.
