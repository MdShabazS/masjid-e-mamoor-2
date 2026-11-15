"""Guarded one-time synchronization from the writable worktree to the original repo.

Run --check first. --apply requires direct filesystem write access to the original.
The manifest pins both sides, and a backup is written before replacing any file.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile


SOURCE = Path(__file__).resolve().parents[1]
MANIFEST = SOURCE / "docs" / "PHASE1_SYNC_MANIFEST.json"


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def head(path: Path) -> str:
    return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=path, text=True).strip()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Back up and copy verified files")
    parser.add_argument("--original", type=Path, help="Override the original repository path")
    args = parser.parse_args()
    plan = json.loads(MANIFEST.read_text())
    target = (args.original or Path(plan["original"])).resolve()
    if not (target / ".git").exists() or head(target) != plan["head"]:
        raise SystemExit("Original repository HEAD changed; review and regenerate the sync plan.")
    if head(SOURCE) != plan["head"]:
        raise SystemExit("Source repository HEAD changed; review and regenerate the sync plan.")
    target_manifest = target / "docs" / MANIFEST.name
    if target_manifest.is_symlink() or (target_manifest.exists() and digest(target_manifest) != digest(MANIFEST)):
        raise SystemExit("Original sync manifest changed; review before continuing.")

    pending: list[tuple[Path, Path, dict]] = []
    completed = 0
    for item in plan["files"]:
        relative = Path(item["path"])
        if relative.is_absolute() or ".." in relative.parts:
            raise SystemExit(f"Unsafe path in plan: {relative}")
        src, dst = SOURCE / relative, target / relative
        if not src.is_file() or src.is_symlink() or digest(src) != item["source_sha256"]:
            raise SystemExit(f"Source changed: {relative}")
        if dst.is_symlink():
            raise SystemExit(f"Original has a symlink: {relative}")
        if dst.is_file():
            current = digest(dst)
            if current == item["source_sha256"]:
                completed += 1
                continue
            if current != item["original_sha256"]:
                raise SystemExit(f"Original changed since review: {relative}")
        elif dst.exists() or item["original_sha256"] is not None:
            raise SystemExit(f"Original path changed since review: {relative}")
        pending.append((src, dst, item))
    print(f"Verified {len(plan['files'])} planned files: {len(pending)} pending, {completed} already synchronized.")
    if not args.apply or (not pending and target_manifest.exists()):
        return

    backup = target.parent / f"masjid-phase1-backup-{os.getpid()}.tar.gz"
    with tarfile.open(backup, "w:gz") as archive:
        for _, dst, item in pending:
            if item["original_sha256"] is not None:
                archive.add(dst, arcname=item["path"], recursive=False)
    print(f"Original versions backed up to {backup}")
    for src, dst, item in pending:
        dst.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=dst.parent, prefix=".phase1-", delete=False) as stream:
            temp = Path(stream.name)
            with src.open("rb") as input_stream:
                for chunk in iter(lambda: input_stream.read(1024 * 1024), b""):
                    stream.write(chunk)
        try:
            temp.chmod(src.stat().st_mode & 0o777)
            os.replace(temp, dst)
        finally:
            temp.unlink(missing_ok=True)
        if digest(dst) != item["source_sha256"]:
            raise SystemExit(f"Copy verification failed: {item['path']}; restore from {backup}")
    if not target_manifest.exists():
        with tempfile.NamedTemporaryFile(dir=target_manifest.parent, prefix=".phase1-", delete=False) as stream:
            manifest_temp = Path(stream.name)
            stream.write(MANIFEST.read_bytes())
        os.replace(manifest_temp, target_manifest)
    if digest(target_manifest) != digest(MANIFEST):
        raise SystemExit("Sync manifest verification failed")
    print(f"Synchronized and SHA-256 verified {len(pending)} files in {target}")


if __name__ == "__main__":
    main()
