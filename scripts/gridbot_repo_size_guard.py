#!/usr/bin/env python3
"""GlobalGrid2050 repository size guard.

Fails when changed files exceed size budgets or when future commits try to add
raw/transient bulk data into normal Git history. Existing tracked bloat is handled
by migration/history-cleanup workflows, not by this guard.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent

BLOCKED_PREFIXES = (
    "data/raw/",
    "data/transient/",
    "data/tmp/",
    "data/temp/",
    "data/generation/fuelhh_halfhourly/",
    "cold_storage/",
    "external_archives/",
)

BLOCKED_NAME_FRAGMENTS = (
    "raw_api",
    "raw_elexon",
    "raw_pvlive",
    "fuelinst_raw",
    "fuelhh_raw",
    "backfill_tmp",
    "archive_full",
    "master_halfhourly",
)

REPORT_JSON = ROOT / "data_science_protocol" / "audit_reports" / "json" / "REPO_SIZE_GUARD_LATEST.json"


def mb(size: int) -> float:
    return round(size / 1024 / 1024, 3)


def run(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, cwd=ROOT, text=True, stderr=subprocess.DEVNULL).strip()


def changed_files() -> list[str]:
    candidates: list[str] = []
    base_ref = os.getenv("GITHUB_BASE_REF")
    event = os.getenv("GITHUB_EVENT_NAME", "")
    commands = []
    if event == "pull_request" and base_ref:
        commands.append(["git", "diff", "--name-only", f"origin/{base_ref}...HEAD"])
    commands.extend([
        ["git", "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"],
        ["git", "diff", "--name-only", "HEAD~1", "HEAD"],
    ])
    for cmd in commands:
        try:
            text = run(cmd)
            if text:
                candidates = [line.strip() for line in text.splitlines() if line.strip()]
                break
        except Exception:
            continue
    if not candidates:
        candidates = [p.relative_to(ROOT).as_posix() for p in ROOT.rglob("*") if p.is_file() and ".git/" not in p.as_posix()]
    return sorted(set(candidates))


def all_files() -> list[str]:
    out = []
    for p in ROOT.rglob("*"):
        if not p.is_file():
            continue
        r = p.relative_to(ROOT).as_posix()
        if r.startswith(".git/") or "/.git/" in r:
            continue
        out.append(r)
    return sorted(out)


def is_blocked_path(path: str) -> bool:
    lower = path.lower()
    if any(lower.startswith(prefix) for prefix in BLOCKED_PREFIXES):
        return True
    return any(fragment in lower for fragment in BLOCKED_NAME_FRAGMENTS)


def inspect(paths: list[str], warn_mb: float, fail_mb: float, allow_bulk: bool) -> dict[str, Any]:
    warnings = []
    failures = []
    inspected = []
    for r in paths:
        p = ROOT / r
        if not p.exists() or not p.is_file():
            continue
        try:
            size = p.stat().st_size
        except FileNotFoundError:
            continue
        row = {"path": r, "sizeBytes": size, "sizeMB": mb(size)}
        inspected.append(row)
        if size >= fail_mb * 1024 * 1024:
            failures.append({**row, "reason": f"file exceeds hard budget of {fail_mb} MB"})
        elif size >= warn_mb * 1024 * 1024:
            warnings.append({**row, "reason": f"file exceeds warning budget of {warn_mb} MB"})
        if is_blocked_path(r) and not allow_bulk:
            failures.append({**row, "reason": "raw/transient/cold path is blocked for normal app repos"})
    return {
        "schemaVersion": "1.0.0",
        "tool": "gridbot_repo_size_guard.py",
        "scopeFileCount": len(paths),
        "inspectedFileCount": len(inspected),
        "warnMB": warn_mb,
        "failMB": fail_mb,
        "allowBulk": allow_bulk,
        "warnings": warnings,
        "failures": failures,
        "pass": len(failures) == 0,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--scope", choices=["changed", "all"], default=os.getenv("REPO_GUARD_SCOPE", "changed"))
    ap.add_argument("--warn-mb", type=float, default=float(os.getenv("REPO_GUARD_WARN_MB", "5")))
    ap.add_argument("--fail-mb", type=float, default=float(os.getenv("REPO_GUARD_FAIL_MB", "25")))
    ap.add_argument("--write-report", action="store_true")
    args = ap.parse_args()

    allow_bulk = os.getenv("ALLOW_BULK_DATA_COMMIT", "false").lower() in {"1", "true", "yes"}
    paths = changed_files() if args.scope == "changed" else all_files()
    report = inspect(paths, args.warn_mb, args.fail_mb, allow_bulk)
    print(json.dumps(report, indent=2, ensure_ascii=False))

    if args.write_report:
        REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
        REPORT_JSON.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    if not report["pass"]:
        print("Repo size guard failed. Move raw/bulk data outside app repos or explicitly run an approved archive workflow.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
