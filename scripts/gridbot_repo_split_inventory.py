#!/usr/bin/env python3
"""GridBot repo split inventory.

Audit-only script. It scans the current working tree, estimates folder/file weight,
classifies likely app boundaries, and writes human + machine reports. It does not
move, delete, rewrite history or create repositories.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import subprocess
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
REPORT_DIR = ROOT / "data_science_protocol" / "audit_reports"
REPORT_JSON_DIR = REPORT_DIR / "json"
STEM = "REPO_SPLIT_INVENTORY"

EXCLUDE_DIRS = {
    ".git",
    ".github/.cache",
    ".jekyll-cache",
    ".bundle",
    "_site",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    "env",
}

APP_TARGETS = [
    {
        "app": "Generation History",
        "sourcePath": "uk_energy_tracking_v6/generation_history",
        "targetRepo": "globalgrid2050-generation-history",
        "priority": 1,
        "rule": "move app code and compact confirmed JSON only; exclude raw FUELHH shards",
    },
    {
        "app": "UK Energy Tracking shell",
        "sourcePath": "uk_energy_tracking_v6",
        "targetRepo": "globalgrid2050-uk-energy-tracking",
        "priority": 2,
        "rule": "move app shell after Generation History is isolated",
    },
    {
        "app": "UK Renewables Pipeline",
        "sourcePath": "uk_renewables_pipeline",
        "targetRepo": "globalgrid2050-uk-renewables-pipeline",
        "priority": 3,
        "rule": "move clean project facts; keep heavy GIS/raw basemaps outside normal app repo",
    },
    {
        "app": "Estimators",
        "sourcePath": "estimators",
        "targetRepo": "globalgrid2050-estimators",
        "priority": 4,
        "rule": "move calculator apps and small reference tables only",
    },
]

RAW_OR_COLD_PREFIXES = (
    "data/raw/",
    "data/transient/",
    "data/tmp/",
    "data/temp/",
    "data/generation/fuelhh_halfhourly/",
    "cold_storage/",
    "external_archives/",
)

LIKELY_BULK_EXTENSIONS = {".csv", ".geojson", ".json", ".parquet", ".zip", ".7z", ".gz"}


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def stamp() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def git_head() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:
        return ""


def should_skip_dir(path: Path) -> bool:
    r = rel(path) if path != ROOT else ""
    if path.name in EXCLUDE_DIRS:
        return True
    return r in EXCLUDE_DIRS


def iter_files() -> list[Path]:
    out: list[Path] = []
    for path in ROOT.rglob("*"):
        if path.is_dir():
            continue
        parts = set(path.relative_to(ROOT).parts)
        if parts & EXCLUDE_DIRS:
            continue
        out.append(path)
    return out


def mb(size: int) -> float:
    return round(size / 1024 / 1024, 3)


def classify_file(r: str) -> dict[str, Any]:
    destination = "KEEP_IN_MAIN_UNTIL_APP_SPLIT"
    reason = "default repository content"
    target_repo = "globalgrid2050"

    if r.startswith(RAW_OR_COLD_PREFIXES):
        destination = "MOVE_TO_COLD_ARCHIVE_OR_REGENERATE"
        reason = "raw/transient/cold data path"
        target_repo = "external-cold-archive"
    elif r.startswith("data/confirmed/"):
        destination = "COPY_COMPACT_FACT_TO_RELEVANT_APP"
        reason = "confirmed fact layer can be copied selectively"
        target_repo = "app-specific"
    elif r.startswith("data/generation/"):
        destination = "REVIEW_FOR_ARCHIVE_OR_COMPACT_FACT"
        reason = "generation data path; only compact confirmed facts belong in app repos"
        target_repo = "app-specific-or-cold-archive"
    elif r.startswith("data_science_protocol/"):
        destination = "KEEP_IN_MAIN_AND_COPY_RELEVANT_DOCS"
        reason = "doctrine and audit reports"
        target_repo = "globalgrid2050"
    elif r.startswith(".github/workflows/") or r.startswith("scripts/"):
        destination = "REWRITE_AS_APP_LOCAL_PIPELINE_IF_NEEDED"
        reason = "automation must be copied only when owned by the target app"
        target_repo = "app-specific"
    else:
        for app in APP_TARGETS:
            source = app["sourcePath"].rstrip("/") + "/"
            if r == app["sourcePath"] or r.startswith(source):
                destination = "MOVE_TO_APP_REPO"
                reason = app["rule"]
                target_repo = app["targetRepo"]
                break

    return {"destination": destination, "targetRepo": target_repo, "reason": reason}


def scan(warn_mb: float, fail_mb: float) -> dict[str, Any]:
    files = iter_files()
    top_files = []
    dir_sizes: dict[str, int] = defaultdict(int)
    classifications: dict[str, Any] = defaultdict(lambda: {"files": 0, "bytes": 0})
    red_flags = []

    for path in files:
        try:
            size = path.stat().st_size
        except FileNotFoundError:
            continue
        r = rel(path)
        top_files.append({"path": r, "sizeBytes": size, "sizeMB": mb(size), **classify_file(r)})
        parts = r.split("/")
        for depth in (1, 2, 3):
            if len(parts) >= depth:
                dir_sizes["/".join(parts[:depth])] += size
        c = classify_file(r)
        key = c["destination"]
        classifications[key]["files"] += 1
        classifications[key]["bytes"] += size
        if size >= fail_mb * 1024 * 1024:
            red_flags.append({"severity": "fail_threshold", "path": r, "sizeMB": mb(size), "detail": f"file is >= {fail_mb} MB"})
        elif size >= warn_mb * 1024 * 1024:
            red_flags.append({"severity": "warn_threshold", "path": r, "sizeMB": mb(size), "detail": f"file is >= {warn_mb} MB"})
        if r.startswith(RAW_OR_COLD_PREFIXES):
            red_flags.append({"severity": "raw_or_cold_path", "path": r, "sizeMB": mb(size), "detail": "raw/cold path should not remain in normal app repos"})
        if path.suffix.lower() in LIKELY_BULK_EXTENSIONS and size >= warn_mb * 1024 * 1024:
            red_flags.append({"severity": "bulk_file_review", "path": r, "sizeMB": mb(size), "detail": "large data-like artifact needs owner and tier"})

    top_files = sorted(top_files, key=lambda x: x["sizeBytes"], reverse=True)[:80]
    top_dirs = sorted(
        [{"path": k, "sizeBytes": v, "sizeMB": mb(v)} for k, v in dir_sizes.items()],
        key=lambda x: x["sizeBytes"],
        reverse=True,
    )[:80]

    app_summaries = []
    for app in APP_TARGETS:
        p = ROOT / app["sourcePath"]
        size = 0
        count = 0
        if p.exists():
            for f in p.rglob("*"):
                if f.is_file():
                    try:
                        size += f.stat().st_size
                        count += 1
                    except FileNotFoundError:
                        pass
        app_summaries.append({**app, "exists": p.exists(), "fileCount": count, "sizeBytes": size, "sizeMB": mb(size)})

    summary = {
        "fileCount": len(files),
        "workingTreeBytes": sum(x["sizeBytes"] for x in top_files) if False else sum((p.stat().st_size for p in files if p.exists()), 0),
        "workingTreeMB": mb(sum((p.stat().st_size for p in files if p.exists()), 0)),
        "classificationSummary": {
            k: {"files": v["files"], "sizeBytes": v["bytes"], "sizeMB": mb(v["bytes"])} for k, v in classifications.items()
        },
    }

    return {
        "reportTitle": "Repo Split Inventory",
        "schemaVersion": "1.0.0",
        "generatedUTC": utc_now(),
        "repository": "Ventusltd/globalgrid2050",
        "branch": "main",
        "gitHead": git_head(),
        "mode": "audit",
        "applied": False,
        "pass": True,
        "warnMB": warn_mb,
        "failMB": fail_mb,
        "summary": summary,
        "appTargets": app_summaries,
        "topDirectories": top_dirs,
        "topFiles": top_files,
        "redFlags": red_flags[:300],
        "nextActions": [
            "Review topDirectories and appTargets.",
            "Bootstrap app repositories with GridBot App Repo Bootstrap in audit mode first.",
            "Migrate Generation History first using clean-copy migration, not history-preserving clone.",
            "Move raw/cold data outside normal app repos or regenerate through GitHub Actions.",
            "Only after app routes are verified, remove moved app folders from the main repo at HEAD.",
        ],
    }


def write_reports(payload: dict[str, Any]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    s = stamp()
    lines = [
        "# Repo Split Inventory",
        "",
        f"Generated UTC: `{payload['generatedUTC']}`",
        f"Repository: `{payload['repository']}`",
        f"Git head: `{payload['gitHead']}`",
        f"Mode: `{payload['mode']}`",
        f"Applied: `{payload['applied']}`",
        f"Pass: `{payload['pass']}`",
        "",
        "## Working tree summary",
        "",
        f"Files scanned: `{payload['summary']['fileCount']}`",
        f"Working tree MB excluding .git/cache dirs: `{payload['summary']['workingTreeMB']}`",
        "",
        "## App targets",
        "",
        "| Priority | App | Source path | Target repo | Exists | Files | MB | Rule |",
        "|---:|---|---|---|---|---:|---:|---|",
    ]
    for app in payload["appTargets"]:
        lines.append(
            f"| {app['priority']} | {app['app']} | `{app['sourcePath']}` | `{app['targetRepo']}` | {app['exists']} | {app['fileCount']} | {app['sizeMB']} | {app['rule']} |"
        )
    lines.extend(["", "## Largest directories", "", "| Path | MB |", "|---|---:|"])
    for d in payload["topDirectories"][:30]:
        lines.append(f"| `{d['path']}` | {d['sizeMB']} |")
    lines.extend(["", "## Largest files", "", "| Path | MB | Proposed destination | Target repo |", "|---|---:|---|---|"])
    for f in payload["topFiles"][:40]:
        lines.append(f"| `{f['path']}` | {f['sizeMB']} | {f['destination']} | `{f['targetRepo']}` |")
    lines.extend(["", "## Red flags", ""])
    if payload["redFlags"]:
        for flag in payload["redFlags"][:80]:
            lines.append(f"- `{flag['severity']}` `{flag['path']}` {flag['sizeMB']} MB — {flag['detail']}")
    else:
        lines.append("No red flags above configured thresholds.")
    lines.extend(["", "## Next actions", ""])
    for action in payload["nextActions"]:
        lines.append(f"- {action}")
    lines.append("")

    md = "\n".join(lines)
    for p in (REPORT_DIR / f"{STEM}_{s}.md", REPORT_DIR / f"{STEM}_LATEST.md"):
        p.write_text(md, encoding="utf-8")
    js = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    for p in (REPORT_JSON_DIR / f"{STEM}_{s}.json", REPORT_JSON_DIR / f"{STEM}_LATEST.json"):
        p.write_text(js, encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--warn-mb", type=float, default=5.0)
    ap.add_argument("--fail-mb", type=float, default=25.0)
    args = ap.parse_args()
    payload = scan(args.warn_mb, args.fail_mb)
    write_reports(payload)
    print(json.dumps({"pass": payload["pass"], "workingTreeMB": payload["summary"]["workingTreeMB"], "redFlags": len(payload["redFlags"])}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
