#!/usr/bin/env python3
"""Fail closed on mixed or unsafe staging/production client configuration.

Run in a private release shell containing both clients' public variables and
the web server variables. Only variable names and error codes are printed.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
from urllib.parse import urlsplit


PROJECT_REF = re.compile(r"^[a-z0-9]{20}$")
PLACEHOLDER = re.compile(r"your-|example|placeholder|change.me", re.I)


def _origin(value: str, *, name: str) -> tuple[str | None, str | None]:
    if not value or PLACEHOLDER.search(value):
        return None, f"{name}: missing or placeholder URL"
    try:
        parsed = urlsplit(value)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
            or parsed.path not in ("", "/")
            or parsed.port is not None
        ):
            return None, f"{name}: expected a bare HTTPS origin"
        host = parsed.hostname.lower()
        if host in ("localhost", "127.0.0.1", "::1") or host.endswith(".local"):
            return None, f"{name}: local origin is invalid for release"
        return f"https://{host}", None
    except ValueError:
        return None, f"{name}: invalid URL"


def _is_secret_key(value: str) -> bool:
    if value.startswith("sb_secret_"):
        return True
    # Legacy Supabase keys are JWTs. Only inspect the role claim; do not log it.
    segments = value.split(".")
    if len(segments) != 3:
        return False
    try:
        payload = base64.urlsafe_b64decode(segments[1] + "=" * (-len(segments[1]) % 4))
        return json.loads(payload).get("role") == "service_role"
    except (ValueError, UnicodeDecodeError):
        return False


def check_config(
    values: dict[str, str], *, environment: str, project_ref: str, web_origin: str
) -> list[str]:
    errors: list[str] = []
    if environment not in ("staging", "production"):
        return ["environment must be staging or production"]
    if not PROJECT_REF.fullmatch(project_ref):
        errors.append("expected Supabase project ref must be 20 lowercase letters or digits")

    expected_backend = f"https://{project_ref}.supabase.co"
    for name in ("NEXT_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_URL", "SUPABASE_URL"):
        origin, error = _origin(values.get(name, ""), name=name)
        if error:
            errors.append(error)
        elif origin != expected_backend:
            errors.append(f"{name}: does not match the expected Supabase project")

    expected_web, error = _origin(web_origin, name="expected web origin")
    if error:
        errors.append(error)
    android_web, error = _origin(values.get("EXPO_PUBLIC_WEB_API_URL", ""), name="EXPO_PUBLIC_WEB_API_URL")
    if error:
        errors.append(error)
    elif expected_web and android_web != expected_web:
        errors.append("EXPO_PUBLIC_WEB_API_URL: does not match the expected web origin")

    public_keys = ("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    server_public = "SUPABASE_PUBLISHABLE_KEY"
    private = "SUPABASE_SERVICE_ROLE_KEY"
    for name in (*public_keys, server_public, private):
        value = values.get(name, "").strip()
        if not value or PLACEHOLDER.search(value):
            errors.append(f"{name}: missing or placeholder key")
        elif name != private and _is_secret_key(value):
            errors.append(f"{name}: secret key in a public slot")
    if all(values.get(name) for name in (*public_keys, server_public)):
        if len({values[name] for name in (*public_keys, server_public)}) != 1:
            errors.append("public Supabase keys differ between clients and server")
    if values.get(private) and any(values[private] == values.get(name) for name in (*public_keys, server_public)):
        errors.append("service role key matches a public key")

    # These controls require a separate policy decision; they are not release defaults.
    for name in ("REPORT_EXPORTS_APPROVED", "PUBLIC_RECEIPT_LOOKUP_APPROVED"):
        if values.get(name, "false").lower() not in ("false", "true"):
            errors.append(f"{name}: expected true or false")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--environment", choices=("staging", "production"), required=True)
    parser.add_argument("--expected-supabase-ref", required=True)
    parser.add_argument("--expected-web-origin", required=True)
    args = parser.parse_args()
    errors = check_config(
        dict(os.environ),
        environment=args.environment,
        project_ref=args.expected_supabase_ref,
        web_origin=args.expected_web_origin,
    )
    for error in errors:
        print(error)
    if errors:
        return 1
    print("Release configuration origins and key boundaries passed; secret values were not printed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
