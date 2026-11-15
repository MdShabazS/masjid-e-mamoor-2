#!/usr/bin/env python3
"""Archive the current project source, docs and uncommitted changes safely."""

import hashlib
import io
import json
import pathlib
import re
import subprocess
import tarfile
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
BACKUPS = ROOT / "backups"
BACKUPS.mkdir(exist_ok=True)
STAMP = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H%M%SZ")
ARCHIVE = BACKUPS / f"masjid-project-working-source-{STAMP}.tar.gz"


def is_private_artifact(relative: pathlib.Path) -> bool:
    name = relative.name.lower()
    if name.startswith(".env") and name != ".env.example":
        return True
    if name in {"google-services.json", "googleservice-info.plist", "credentials.json", "service-account.json"}:
        return True
    if name.endswith((".jks", ".keystore", ".p12", ".pfx", ".pem", ".key")):
        return True
    return bool(re.search(r"(^|[._-])(private[-_]?key|service[-_]?account)([._-]|$)", name))


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", *args], cwd=ROOT)


paths = [pathlib.Path(p.decode()) for p in git("ls-files", "-z", "--cached", "--others", "--exclude-standard").split(b"\0") if p]
files = []
deleted = []
for relative in paths:
    if relative.parts[0] == "backups" or is_private_artifact(relative):
        continue
    path = ROOT / relative
    if not path.exists():
        deleted.append(relative.as_posix())
    elif path.is_file() and not path.is_symlink():
        files.append(relative)

metadata = {
    "created_utc": STAMP,
    "branch": git("branch", "--show-current").decode().strip(),
    "head": git("rev-parse", "HEAD").decode().strip(),
    "scope": "git tracked and untracked nonignored source/docs; excludes backups, private credential filenames, ignored secrets, dependencies and generated outputs",
    "deleted_tracked_paths": deleted,
    "files": {p.as_posix(): hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in files},
}
with tarfile.open(ARCHIVE, "w:gz") as archive:
    for relative in sorted(files):
        archive.add(ROOT / relative, arcname=relative.as_posix(), recursive=False)
    payload = json.dumps(metadata, indent=2, sort_keys=True).encode() + b"\n"
    item = tarfile.TarInfo("BACKUP_MANIFEST.json")
    item.size = len(payload)
    archive.addfile(item, io.BytesIO(payload))

with tarfile.open(ARCHIVE, "r:gz") as archive:
    manifest = json.load(archive.extractfile("BACKUP_MANIFEST.json"))
    for relative, expected in manifest["files"].items():
        actual = hashlib.sha256(archive.extractfile(relative).read()).hexdigest()
        if actual != expected:
            raise RuntimeError(f"Backup verification failed: {relative}")

digest = hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()
(BACKUPS / f"{ARCHIVE.name}.sha256").write_text(f"{digest}  {ARCHIVE.name}\n")
print(f"Verified {len(files)} files; {len(deleted)} deleted paths recorded")
print(ARCHIVE)
print(digest)
