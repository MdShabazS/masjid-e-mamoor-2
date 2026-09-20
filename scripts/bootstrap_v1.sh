#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "========================================"
echo " Masjid-e-Mamoor V1 Bootstrap"
echo "========================================"

echo
echo "[1/8] Checking repository..."
git diff --quiet
git diff --cached --quiet

echo
echo "[2/8] Checking required tools..."
command -v git >/dev/null
command -v node >/dev/null
command -v pnpm >/dev/null
command -v supabase >/dev/null
command -v docker >/dev/null

echo "Node:     $(node --version)"
echo "pnpm:     $(pnpm --version)"
echo "Supabase: $(supabase --version | head -1)"
echo "Docker:   $(docker --version | head -1)"

echo
echo "[3/8] Creating implementation directories..."
mkdir -p apps/web
mkdir -p apps/mobile
mkdir -p packages/shared
mkdir -p packages/types
mkdir -p packages/validation
mkdir -p packages/api-client
mkdir -p packages/config
mkdir -p scripts

echo
echo "[4/8] Creating workspace manifest..."
cat > pnpm-workspace.yaml <<'WORKSPACE'
packages:
  - "apps/*"
  - "packages/*"
WORKSPACE

cat > package.json <<'PACKAGE'
{
  "name": "masjid-e-mamoor",
  "private": true,
  "packageManager": "pnpm@10.0.0",
  "scripts": {
    "check": "pnpm -r run check",
    "test": "pnpm -r run test",
    "build": "pnpm -r run build"
  }
}
PACKAGE

echo
echo "[5/8] Creating shared package foundations..."

cat > packages/types/package.json <<'PACKAGE'
{
  "name": "@masjid/types",
  "private": true,
  "version": "0.1.0",
  "type": "module"
}
PACKAGE

cat > packages/types/index.ts <<'TS'
export type ApplicationUserStatus =
  | "pending"
  | "active"
  | "restricted"
  | "deactivated";

export type MemberStatus = "active" | "inactive";

export type ApplicationRole =
  | "president"
  | "vice_president"
  | "secretary"
  | "finance"
  | "auditor"
  | "committee_member"
  | "member";
TS

cat > packages/shared/package.json <<'PACKAGE'
{
  "name": "@masjid/shared",
  "private": true,
  "version": "0.1.0",
  "type": "module"
}
PACKAGE

cat > packages/shared/index.ts <<'TS'
export const APP_NAME = "Masjid-e-Mamoor";

export const APPLICATION_ROLES = [
  "president",
  "vice_president",
  "secretary",
  "finance",
  "auditor",
  "committee_member",
  "member",
] as const;
TS

cat > packages/validation/package.json <<'PACKAGE'
{
  "name": "@masjid/validation",
  "private": true,
  "version": "0.1.0",
  "type": "module"
}
PACKAGE

cat > packages/validation/index.ts <<'TS'
export const validationPackageReady = true;
TS

cat > packages/api-client/package.json <<'PACKAGE'
{
  "name": "@masjid/api-client",
  "private": true,
  "version": "0.1.0",
  "type": "module"
}
PACKAGE

cat > packages/api-client/index.ts <<'TS'
export const apiClientPackageReady = true;
TS

cat > packages/config/package.json <<'PACKAGE'
{
  "name": "@masjid/config",
  "private": true,
  "version": "0.1.0",
  "type": "module"
}
PACKAGE

cat > packages/config/index.ts <<'TS'
export const configPackageReady = true;
TS

echo
echo "[6/8] Creating implementation status..."
cat > docs/IMPLEMENTATION_STATUS.md <<'DOC'
# V1 Implementation Status

## Current Phase

Foundation bootstrap.

## Completed

- V1 documentation baseline
- Authentication decisions
- Role/permission catalogue
- Identity/membership database foundation
- V1 implementation decision closure
- pnpm workspace foundation
- shared package skeleton

## Next

1. Web application foundation
2. Mobile application foundation
3. Authorization database helpers
4. RLS policies
5. Authentication integration
6. Member profile vertical slice

## Rule

Implementation must preserve the V1 documentation baseline and must not
silently introduce new business rules.
DOC

echo
echo "[7/8] Validating repository..."
git diff --check
git status --short

echo
echo "[8/8] Bootstrap complete."
echo
echo "No commit or push was performed."
echo "Review the generated foundation before the implementation commit."
