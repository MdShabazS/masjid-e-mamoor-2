# Node runtime gate — 25 October 2026

The root package advertised Node `>=20`, while the locked `@supabase/supabase-js` packages in the web and Android workspaces and `@supabase/storage-js` require Node `>=22.0.0`. [Supabase announced the end of Node 20 support](https://supabase.com/changelog?types=deprecation) for its JavaScript clients on 30 June 2026. A Node 20 installer could therefore accept the root project while warning about an unsupported dependency.

The root, web and Android package manifests and matching lockfile entries now specify Node `>=22.0.0`. The root `.npmrc` enables npm's `engine-strict` install check. The tested local runtime is Node `v24.15.0`; no Node 20 executable was available to exercise the rejection path directly.

Verification on Node 24: offline `npm ci --dry-run --ignore-scripts`, 151 Node tests, lint, typecheck, formatting, production web build and Android bundle export passed. This does not replace a committed clean checkout, hosted CI, native signed Android release or staging deployment with a recorded Node version.

On 26 October, the source CI workflow gained a separate Node 20 job. It runs the locked workspace's `npm ci --dry-run` and requires an `EBADENGINE` failure under `engine-strict=true`; any successful install or different failure fails the job. The Node 24 offline dry run still passes locally. [Hosted run 40264411970](https://github.com/MdShabazS/masjid-e-mamoor-2/actions/runs/40264411970) passed both the Node 20 rejection job and the Node 24 source-check job for commit `136fd63`. Signed native release and staging remain separate release gates.
