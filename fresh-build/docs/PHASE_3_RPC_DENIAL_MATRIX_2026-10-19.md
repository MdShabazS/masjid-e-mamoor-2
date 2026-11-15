# Issued-session RPC denial matrix — 19 October 2026

**Targets:** disposable local `masjid-e-mamoor-2-fresh` stack (20 current migrations) and isolated hosted development project `necattvpncnsrfcrwpjn`. No production or masjid data was used.

The checked [matrix](../backend/tests/hosted_rpc_role_matrix.json) records the names, input arguments and role guards of all 65 authenticated `SECURITY DEFINER` RPCs that call `app_private.require_actor`. The three authenticated definer exceptions are `current_app_role`, `current_identity_gate` and `list_published_community_posts`; they have separate catalog/body checks. The matrix was extracted from the hosted function catalog and checked for unique RPC names and the expected count. This is a runtime check of implemented role guards, not an independent decision that each guard matches the accepted product policy.

Eight independently issued Auth sessions, one per application role, called every guarded RPC for which that role was not listed. Each call supplied all named input arguments as `null` to exercise the role gate without a valid business mutation. There were **288 wrong-role calls**. The expected response was HTTP 403 / SQLSTATE `42501` for every call.

| Environment | Result |
| --- | --- |
| Disposable local stack | 48 earlier role/read checks and all 288 wrong-role calls passed. Correctly signed expired JWT was denied; an existing token reflected a server role change and lost access after deactivation. After the script's reset, the stack was restarted and a direct query returned zero Auth users/sessions, app users, finance effects, tasks and Storage objects. Only the fresh stack was then stopped. |
| Isolated hosted development | Eight issued roles and all 288 wrong-role calls passed. Before cleanup, a direct SQL check found zero account, finance, task and Storage object rows. |

The local runner is `backend/scripts/phase3_issued_role_matrix.py`. The hosted runner is `backend/scripts/phase3_hosted_rpc_denials.py`; it requires a temporary credential file outside the repository and an exact development-project confirmation value. It uses only the publishable API key and issued user tokens. The temporary credential file was deleted after the run.

The hosted test profiles and aliases were removed, followed by all eight Auth users in the dashboard after action-time approval. Final hosted SQL counts were zero for Auth users/sessions, app users, aliases, accounts, finance effects/transfers/audit, tasks and Storage objects. The [dashboard screenshot](hosted-rpc-cleanup-2026-10-19.png) shows zero users.

**Remaining:** compare every allowed-role guard with the accepted policy, test successful and rejected business outcomes for allowed roles, all trusted web/service endpoints and private objects, stale/revoked sessions on every sensitive path, both signed-in clients, and staging. This slice does not complete Phase 3 or release acceptance.
