#!/usr/bin/env python3
"""Check app .env.example files against statically referenced variables."""

from __future__ import annotations

import os
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
APPS = ("web", "android")
CODE_SUFFIXES = {".js", ".jsx", ".ts", ".tsx"}
ENV_REFERENCE = re.compile(r"process\.env\.([A-Z][A-Z0-9_]*)")
ENV_LINE = re.compile(r"^([A-Z][A-Z0-9_]*)=(.*)$")
PUBLIC_PREFIXES = ("NEXT_PUBLIC_", "EXPO_PUBLIC_")
SECRET_MARKERS = ("SECRET", "SERVICE_ROLE", "ACCESS_TOKEN", "PRIVATE_KEY")
GENERATED_DIRS = {"node_modules", ".next", "dist", "build"}


def check_app(app: str, root: pathlib.Path = ROOT) -> list[str]:
    app_root = root / "apps" / app
    template = app_root / ".env.example"
    errors: list[str] = []
    if not template.is_file():
        return [f"{template.relative_to(ROOT)} is missing"]

    declared: list[str] = []
    for line_number, line in enumerate(template.read_text().splitlines(), 1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        match = ENV_LINE.fullmatch(stripped)
        if not match:
            errors.append(f"{template.relative_to(root)}:{line_number}: invalid variable entry")
            continue
        name = match.group(1)
        declared.append(name)
        if name.startswith(PUBLIC_PREFIXES) and any(marker in name for marker in SECRET_MARKERS):
            errors.append(f"{template.relative_to(root)}:{line_number}: secret variable uses a public prefix: {name}")

    duplicates = sorted({name for name in declared if declared.count(name) > 1})
    if duplicates:
        errors.append(f"{template.relative_to(root)}: duplicate variables: {', '.join(duplicates)}")

    referenced: set[str] = set()
    for directory, subdirectories, filenames in os.walk(app_root):
        # Prune generated trees before walking them: builds can replace .next
        # while this source check runs.
        subdirectories[:] = [name for name in subdirectories if name not in GENERATED_DIRS]
        for filename in filenames:
            path = pathlib.Path(directory) / filename
            if path.suffix in CODE_SUFFIXES:
                referenced.update(ENV_REFERENCE.findall(path.read_text(errors="ignore")))

    missing = sorted(referenced - set(declared))
    if missing:
        errors.append(f"{template.relative_to(root)}: referenced variables are undocumented: {', '.join(missing)}")
    return errors


def main() -> int:
    errors = [error for app in APPS for error in check_app(app)]
    if errors:
        print("Environment template check failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print("Environment templates cover all statically referenced app variables; no public-prefixed secret names found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
