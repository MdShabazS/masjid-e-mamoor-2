#!/usr/bin/env python3
"""Reject server-only synthetic canaries in exported web/Android public assets."""

from __future__ import annotations

import argparse
import os
import pathlib
import sys


def check_public_roots(roots: list[pathlib.Path], canaries: list[str]) -> tuple[int, list[str]]:
    if not canaries or any(len(value) < 24 for value in canaries):
        return 0, ["Provide synthetic canaries of at least 24 characters"]
    needles = [value.encode() for value in canaries]
    errors: list[str] = []
    checked = 0
    for root in roots:
        if not root.is_dir() or root.is_symlink():
            errors.append(f"Public asset directory missing or unsafe: {root}")
            continue
        files = sorted(root.rglob("*"))
        assets = [item for item in files if item.is_file()]
        if not assets:
            errors.append(f"Public asset directory is empty: {root}")
        for item in files:
            if item.is_symlink():
                errors.append(f"Symlink in public assets: {item}")
        for item in assets:
            if item.is_symlink():
                continue
            checked += 1
            content = item.read_bytes()
            if any(needle in content for needle in needles):
                errors.append(f"Server-only canary found in public asset: {item}")
    return checked, errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", action="append", type=pathlib.Path, required=True)
    args = parser.parse_args()
    canaries = [value for value in os.environ.get("BUNDLE_SECRET_CANARIES", "").split(",") if value]
    checked, errors = check_public_roots(args.root, canaries)
    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1
    print(f"Checked {checked} public asset files; no server-only canaries found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
