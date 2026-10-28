#!/usr/bin/env python3
"""Fail CI when npm reports a new high/critical advisory or an invalid audit."""

from __future__ import annotations

import json
import pathlib
import sys


KNOWN_HIGH_VIA = {
    "@expo/cli": {
        "@expo/code-signing-certificates",
        "@expo/config",
        "@expo/metro-config",
        "@expo/prebuild-config",
        "node-forge",
        "zod",
    },
    "@expo/code-signing-certificates": {"node-forge"},
    "expo": {
        "@expo/cli",
        "@expo/config",
        "@expo/local-build-cache-provider",
        "@expo/metro-config",
    },
    "node-forge": {"https://github.com/advisories/GHSA-86w9-cpqp-85rv"},
    "zod": {"https://github.com/advisories/GHSA-mrhx-c7xc-m3w5"},
}


def check_audit(audit: object) -> list[str]:
    if not isinstance(audit, dict):
        return ["npm audit output is not an object"]
    if "error" in audit:
        return ["npm audit returned an error instead of advisory results"]
    metadata = audit.get("metadata")
    vulnerabilities = audit.get("vulnerabilities")
    if not isinstance(metadata, dict) or not isinstance(vulnerabilities, dict):
        return ["npm audit output lacks vulnerability metadata"]
    counts = metadata.get("vulnerabilities")
    if not isinstance(counts, dict) or any(
        not isinstance(counts.get(level), int)
        for level in ("info", "low", "moderate", "high", "critical", "total")
    ):
        return ["npm audit output lacks valid severity counts"]
    if counts["total"] != len(vulnerabilities):
        return ["npm audit vulnerability count does not match its entries"]

    errors = []
    for name, finding in vulnerabilities.items():
        if not isinstance(finding, dict):
            errors.append(f"Invalid finding for {name}")
            continue
        severity = finding.get("severity")
        if severity == "critical":
            errors.append(f"Critical dependency finding: {name}")
        elif severity == "high":
            allowed_via = KNOWN_HIGH_VIA.get(name)
            if allowed_via is None:
                errors.append(f"New high dependency finding: {name}")
            via = finding.get("via")
            if not isinstance(via, list) or not via:
                errors.append(f"Missing advisory path: {name}")
            else:
                for item in via:
                    if isinstance(item, dict):
                        if item.get("url") not in (allowed_via or set()):
                            errors.append(f"New advisory or path for {name}")
                    elif not isinstance(item, str) or item not in (allowed_via or set()):
                        errors.append(f"Unexpected dependency path for {name}")
        elif severity not in ("info", "low", "moderate"):
            errors.append(f"Invalid severity for {name}")
    if counts["critical"] or counts["high"] != sum(
        item.get("severity") == "high"
        for item in vulnerabilities.values()
        if isinstance(item, dict)
    ):
        errors.append("npm audit severity counts do not match its entries")
    return errors


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: check_dependency_audit.py AUDIT_JSON", file=sys.stderr)
        return 2
    try:
        audit = json.loads(pathlib.Path(sys.argv[1]).read_text())
    except (OSError, ValueError) as error:
        print(f"Could not read npm audit JSON: {error}", file=sys.stderr)
        return 2
    errors = check_audit(audit)
    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1
    counts = audit["metadata"]["vulnerabilities"]
    print(
        f"npm audit baseline passed: {counts['high']} known high, "
        f"{counts['critical']} critical, no new high advisories. "
        "Known highs still require release-owner review."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
