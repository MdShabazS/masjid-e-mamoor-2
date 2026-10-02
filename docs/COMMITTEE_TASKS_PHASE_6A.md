# Committee Tasks Phase 6A

This note records the implementation vocabulary and scope for the current
direct-assignment committee-task backend slice. It supplements, and does not
replace, the authoritative product, user-flow, permission, RLS, notification,
and UI/UX documents.

## Scope

- V1 Phase 6A supports direct assignment to one or more eligible active
  application users.
- Task statuses are `assigned`, `in_progress`, and `completed`.
- The only Phase 6A forward transitions are `assigned` to `in_progress`, then
  `in_progress` to `completed`.
- Task priorities are `low`, `normal`, and `high`.
- Assignment history and task activity are preserved; clients cannot delete
  task history.
- Progress remarks and completion are recorded through trusted operations with
  a database-derived actor and operation ID.

## Authorization

- Creation, assignment, reassignment, and task-definition changes require
  `committee.tasks.assign`.
- An assign-capable user may read and manage the direct-assignment task scope.
- Other users with `committee.tasks.read` may read only tasks currently
  assigned to them.
- An assigned user also requires `committee.tasks.manage` to add progress or
  perform a status transition.
- Assignees must be active application users whose current database role has
  both `committee.tasks.read` and `committee.tasks.manage`. Client-provided
  role claims are not authoritative.
- The Auditor's existing `committee.tasks.read` grant remains unchanged, but
  does not make the read-only Auditor assignable. Phase 6A defines no separate
  organization-wide Auditor task-sharing or oversight scope.

## Concurrency and idempotency

- Every mutation serializes its operation ID with a transaction-scoped
  advisory lock derived from the authenticated application-user ID and the
  operation ID.
- Operation IDs are unique per actor, not globally. The same actor and payload
  receives the original result on replay; changing the payload produces
  `operation_id_conflict`. Different actors may use the same textual operation
  ID without conflicting.
- Every mutation uses the consistent lock order: actor/operation advisory lock,
  then task-row lock when a new operation needs to mutate a task.
- Self-service progress and status operations authenticate the actor, require
  current `committee.tasks.manage`, and resolve an idempotent replay before
  acquiring a task-row lock. New operations revalidate current assignment and
  task state after acquiring the authoritative task-row lock.
- Progress replay returns the original immutable activity row. Task creation,
  task-definition updates, start, and completion replays return the same task
  identity with its current representation; no mutation or duplicate activity
  is performed on replay.

## Deferred

- Open/volunteer tasks and atomic claiming are outside Phase 6A.
- Attachments and task evidence storage are deferred to a later approved UI and
  storage slice.
- Notification delivery, workers, and push channels are deferred. Trusted task
  activity records include a notification event hint for later reliable
  delivery of `task_assigned`, `task_updated`, and `task_completed`.
- Reopening is not supported. `task_reopened` remains a future event that
  requires a separately approved workflow.
