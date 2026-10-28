# Release configuration preflight — 27 October 2026

The existing template check covered variable names, and the synthetic bundle scan covered accidental server-secret inclusion. Neither checked that the web, Android and server builds point to the **same intended hosted Supabase project**. `scripts/check_release_config.py` adds that pre-deployment check without printing credential values.

In a private release shell, load the reviewed environment values for the same staging or production release, then run:

```sh
npm run check:release-config -- --environment staging \
  --expected-supabase-ref <reviewed-20-character-project-ref> \
  --expected-web-origin https://<reviewed-web-host>
```

Use `--environment production` for production. The command requires the three Supabase URLs to match the reviewed project, the Android API URL to match the reviewed HTTPS web origin, the three public keys to match, and a distinct server-only service key. It rejects placeholders, local/HTTP origins, public `sb_secret_` keys and legacy service-role JWTs. Run it before both client builds and repeat with the values actually injected into each hosted build. Keep service credentials in the private shell or hosting secret store; do not commit an env file or attach command output containing credentials.

**Local evidence:** 16 Python environment/bundle/audit regression tests pass, including matching configuration, mixed-project and mixed-origin rejection, missing key, public secret and legacy service-role JWT rejection. This is a synthetic preflight. No actual staging/production values were available for this check, and the Vercel connector currently lists projects but returns 404/403 for project detail/deployments; the browser requires account sign-in. A hosted build and live endpoint verification remain open.

## 28 October key-type follow-up

The preflight now also rejects a present but arbitrary service credential or public key. Public slots accept Supabase `sb_publishable_...` or a legacy JWT whose decoded role is `anon`; the server slot accepts `sb_secret_...` or a legacy JWT whose decoded role is `service_role`. Error output includes variable names and reasons, never key values. Two focused regressions join the suite; all 24 Python script tests pass. This checks key *type*, not validity or project ownership: opaque keys cannot be authenticated locally, and a decoded legacy JWT role is not a verified signature. The configured staging Preview's successful signed-in browser journey provides a separate runtime check. Production keys and Android values still need a private-shell preflight and live smoke before release. [Supabase API key types](https://supabase.com/docs/guides/getting-started/api-keys).
