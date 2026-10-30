#!/usr/bin/env python3
"""Validate a signed release APK and write its public release manifest."""

from __future__ import annotations

import argparse
import hashlib
import ipaddress
import json
import os
import pathlib
import re
import subprocess
from urllib.parse import urlsplit

ROOT = pathlib.Path(__file__).resolve().parents[1]
APP = ROOT / "apps" / "android" / "app.json"


def android_tool(name: str) -> pathlib.Path:
    sdk = pathlib.Path(os.environ.get("ANDROID_HOME", pathlib.Path.home() / "Library/Android/sdk"))
    versions = sorted((sdk / "build-tools").glob("*"), reverse=True)
    for version in versions:
        candidate = version / name
        if candidate.is_file():
            return candidate
    raise ValueError(f"Android SDK build-tools with {name} are required")


def inspected_apk(path: pathlib.Path) -> tuple[str, int, str]:
    if not path.is_file() or path.suffix.lower() != ".apk":
        raise ValueError("A local APK file is required")
    badging = subprocess.check_output([android_tool("aapt"), "dump", "badging", str(path)], text=True)
    match = re.search(r"^package: name='([^']+)' versionCode='([0-9]+)'", badging, re.M)
    if not match:
        raise ValueError("Cannot read APK package and version")
    signatures = subprocess.check_output(
        [android_tool("apksigner"), "verify", "--print-certs", str(path)], text=True)
    signer_prefix = r"(?:Signer #\d+|V[1-4] Signer)"
    fingerprints = set(re.findall(
        rf"^{signer_prefix}:? certificate SHA-256 digest: ([0-9a-fA-F]{{64}})$",
        signatures, re.M))
    if len(fingerprints) != 1:
        raise ValueError("Expected exactly one verified APK signer")
    subjects = re.findall(rf"^{signer_prefix}:? certificate DN: (.+)$", signatures, re.M)
    if not subjects or any(re.search(r"(?:^|,)\s*CN=Android Debug(?:,|$)", subject, re.I)
                           for subject in subjects):
        raise ValueError("Release APK must use a non-debug signing certificate")
    return match[1], int(match[2]), fingerprints.pop().lower()


def secure_url(raw: str) -> str:
    if not isinstance(raw, str) or raw != raw.strip() or any(ord(char) < 32 for char in raw) or '\\' in raw:
        raise ValueError("Release URLs must use a real HTTPS host")
    try:
        url = urlsplit(raw)
        port = url.port
    except ValueError as error:
        raise ValueError("Release URLs must use a real HTTPS host") from error
    host = (url.hostname or "").lower()
    try:
        address = ipaddress.ip_address(host)
        unsafe_address = not address.is_global
    except ValueError:
        unsafe_address = False
    if (url.scheme != "https" or not url.hostname or url.username or url.password
            or url.query or url.fragment or (port is not None and port != 443)
            or unsafe_address or host == "localhost"
            or host in {"example.com", "example.net", "example.org"}
            or host.endswith((".invalid", ".example", ".test", ".localhost",
                              ".example.com", ".example.net", ".example.org"))):
        raise ValueError("Release URLs must use a real HTTPS host")
    return raw


def manifest(*, apk: pathlib.Path, web_url: str, apk_url: str,
             previous_apk: pathlib.Path | None, first_install: bool) -> dict:
    config = json.loads(APP.read_text())["expo"]
    expected_package = config["android"]["package"]
    expected_code = config["android"]["versionCode"]
    if expected_package.endswith(".fresh"):
        raise ValueError("Resolve the final Android package ID before release")
    if not isinstance(expected_code, int) or expected_code < 1:
        raise ValueError("Android versionCode must be a positive integer")
    if first_install == (previous_apk is not None):
        raise ValueError("Specify either --first-install or --previous-apk")
    package, code, signer = inspected_apk(apk)
    if (package, code) != (expected_package, expected_code):
        raise ValueError("APK package/version differs from app.json")
    if previous_apk:
        old_package, old_code, old_signer = inspected_apk(previous_apk)
        if old_package != package or old_signer != signer or old_code >= code:
            raise ValueError("Upgrade requires the same package and signer with a higher versionCode")
    web = secure_url(web_url)
    download = secure_url(apk_url)
    if not download.lower().split("?", 1)[0].endswith(".apk"):
        raise ValueError("APK download URL must end in .apk")
    return {
        "package": package, "version": config["version"], "versionCode": code,
        "signerSha256": signer, "apkSha256": hashlib.sha256(apk.read_bytes()).hexdigest(),
        "apkBytes": apk.stat().st_size, "webUrl": web, "apkUrl": download,
        "upgradeChecked": previous_apk is not None,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apk", required=True, type=pathlib.Path)
    parser.add_argument("--web-url", required=True)
    parser.add_argument("--apk-url", required=True)
    choice = parser.add_mutually_exclusive_group(required=True)
    choice.add_argument("--previous-apk", type=pathlib.Path)
    choice.add_argument("--first-install", action="store_true")
    parser.add_argument("--output", required=True, type=pathlib.Path)
    args = parser.parse_args()
    try:
        result = manifest(apk=args.apk, web_url=args.web_url, apk_url=args.apk_url,
                          previous_apk=args.previous_apk, first_install=args.first_install)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
        print(f"Release manifest verified: {args.output}")
    except (ValueError, subprocess.CalledProcessError) as error:
        parser.exit(2, f"Release blocked: {error}\n")
