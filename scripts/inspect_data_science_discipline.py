#!/usr/bin/env python3
"""
GlobalGrid2050 data science discipline inspection.

Non destructive inspection script. It scans repository data, workflow and protocol
files, produces timestamped audit reports, maintains a latest report and appends a
compact change log. It does not delete, move or rewrite any repository content.
"""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
REPORT_DIR = ROOT / "data_science_protocol" / "inspection_reports"
HISTORY_DIR = REPORT_DIR / "history"
LATEST_MD = REPORT_DIR / "DATA_SCIENCE_DISCIPLINE_INSPECTION_LATEST.md"
LATEST_JSON = REPORT_DIR / "DATA_SCIENCE_DISCIPLINE_INSPECTION_LATEST.json"
CHANGELOG_MD = ROOT / "data_science_protocol" / "DATA_SCIENCE_DISCIPLINE_CHANGELOG.md"

TITLE = "GlobalGrid2050 Data Science Discipline Inspection"
SCRIPT_NAME = "scripts/inspect_data_science_discipline.py"
PROTOCOL_PATH = "data_science_protocol/DATA_STORAGE_DISCIPLINE_PROTOCOL.md"

WARN_FILE_MB = float(os.getenv("DATASCIENCE_WARN_FILE_MB", "5"))
ACTION_FILE_MB = float(os.getenv("DATASCIENCE_ACTION_FILE_MB", "25"))
HARD_FILE_MB = float(os.getenv("DATASCIENCE_HARD_FILE_MB", "100"))
FAIL_ON_ACTION = os.getenv("DATASCIENCE_FAIL_ON_ACTION", "false").lower() in {"1", "true", "yes"}

EXCLUDED_PARTS = {
    ".git",
    ".venv",
    "venv",
    "env",
    "node_modules",
    "__pycache__",
    ".mypy_cache",
    ".pytest_cache",
    ".DS_Store",
}

SCAN_EXTENSIONS = {
    ".csv",
    ".json",
    ".geojson",
    ".topojson",
    ".parquet",
    ".md",
    ".yml",
    ".yaml",
    ".py",
    ".html",
    ".js",
    ".css",
    ".txt",
}

DATA_HINTS = ("data/", "uk_energy_tracking", "generation", "electricity", "geojson", "pipeline")
RAW_HINTS = ("raw", "source", "half_hourly", "halfhourly", "archive", "master")
DASHBOARD_HINTS = ("annual", "monthly", "seasonal", "day_night", "daily", "recent")


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def safe_rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def mb(size_bytes: int) -> float:
    return round(size_bytes / 1024 / 1024, 3)


def should_skip(path: Path) -> bool:
    rel_parts = path.relative_to(ROOT).parts
    if any(part in EXCLUDED_PARTS for part in rel_parts):
        return True
    if path.name.endswith("~") or path.name.endswith(".tmp"):
        return True
    return False


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def run_git(args: list[str]) -> str:
    try:
        return subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True, check=True).stdout.strip()
    except Exception:
        return ""


def classify_file(rel: str, suffix: str, size_bytes: int) -> dict[str, str]:
    low = rel.lower()
    if rel.startswith("data_science_protocol/"):
        cls = "protocol or audit"
    elif rel.startswith(".github/workflows/"):
        cls = "workflow"
    elif rel.startswith("scripts/"):
        cls = "script"
    elif suffix in {".geojson", ".topojson"}:
        cls = "gis geometry"
    elif any(h in low for h in DASHBOARD_HINTS) and suffix in {".json", ".csv"}:
        cls = "dashboard intelligence"
    elif any(h in low for h in RAW_HINTS) and suffix in {".csv", ".json"}:
        cls = "raw or clean analytical archive"
    elif any(h in low for h in DATA_HINTS):
        cls = "data file"
    else:
        cls = "application or document"

    if size_bytes >= HARD_FILE_MB * 1024 * 1024:
        risk = "hard limit risk"
    elif size_bytes >= ACTION_FILE_MB * 1024 * 1024:
        risk = "action required"
    elif size_bytes >= WARN_FILE_MB * 1024 * 1024:
        risk = "watch"
    else:
        risk = "normal"

    return {"class": cls, "risk": risk}


def collect_files() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or should_skip(path):
            continue
        suffix = path.suffix.lower()
        if suffix and suffix not in SCAN_EXTENSIONS:
            continue
        rel = safe_rel(path)
        size = path.stat().st_size
        flags = classify_file(rel, suffix, size)
        rows.append(
            {
                "path": rel,
                "suffix": suffix or "no extension",
                "sizeBytes": size,
                "sizeMB": mb(size),
                "sha256": sha256_file(path),
                "class": flags["class"],
                "risk": flags["risk"],
            }
        )
    return rows


def previous_snapshot() -> dict[str, dict[str, Any]]:
    if not LATEST_JSON.exists():
        return {}
    try:
        payload = json.loads(LATEST_JSON.read_text(encoding="utf-8"))
        return {item["path"]: item for item in payload.get("files", []) if "path" in item}
    except Exception:
        return {}


def compare_snapshots(previous: dict[str, dict[str, Any]], current: list[dict[str, Any]]) -> dict[str, Any]:
    now_by_path = {item["path"]: item for item in current}
    added = [now_by_path[p] for p in sorted(set(now_by_path) - set(previous))]
    deleted = [previous[p] for p in sorted(set(previous) - set(now_by_path))]
    changed = []
    for path in sorted(set(previous) & set(now_by_path)):
        old = previous[path]
        new = now_by_path[path]
        if old.get("sha256") != new.get("sha256") or old.get("sizeBytes") != new.get("sizeBytes"):
            changed.append(
                {
                    "path": path,
                    "oldSizeMB": old.get("sizeMB"),
                    "newSizeMB": new.get("sizeMB"),
                    "oldRisk": old.get("risk"),
                    "newRisk": new.get("risk"),
                }
            )
    return {"added": added, "deleted": deleted, "changed": changed}


def directory_totals(files: list[dict[str, Any]]) -> list[dict[str, Any]]:
    totals: dict[str, dict[str, Any]] = defaultdict(lambda: {"files": 0, "sizeBytes": 0})
    for item in files:
        parts = item["path"].split("/")
        top = parts[0] if parts else "root"
        if top == "data" and len(parts) > 1:
            top = "/".join(parts[:2])
        if top.startswith("uk_energy_tracking") and len(parts) > 1:
            top = "/".join(parts[:2])
        totals[top]["files"] += 1
        totals[top]["sizeBytes"] += int(item["sizeBytes"])
    rows = []
    for path, data in totals.items():
        rows.append({"path": path, "files": data["files"], "sizeBytes": data["sizeBytes"], "sizeMB": mb(data["sizeBytes"])})
    return sorted(rows, key=lambda x: x["sizeBytes"], reverse=True)


def summarise(files: list[dict[str, Any]], delta: dict[str, Any]) -> dict[str, Any]:
    total_bytes = sum(int(item["sizeBytes"]) for item in files)
    risk_counts = defaultdict(int)
    class_counts = defaultdict(int)
    for item in files:
        risk_counts[item["risk"]] += 1
        class_counts[item["class"]] += 1
    watch_files = [f for f in files if f["risk"] in {"watch", "action required", "hard limit risk"}]
    action_files = [f for f in files if f["risk"] in {"action required", "hard limit risk"}]
    return {
        "totalScannedFiles": len(files),
        "totalScannedMB": mb(total_bytes),
        "riskCounts": dict(sorted(risk_counts.items())),
        "classCounts": dict(sorted(class_counts.items())),
        "watchFileCount": len(watch_files),
        "actionFileCount": len(action_files),
        "addedCount": len(delta["added"]),
        "changedCount": len(delta["changed"]),
        "deletedCount": len(delta["deleted"]),
        "protocolExists": (ROOT / PROTOCOL_PATH).exists(),
        "changeLogExists": CHANGELOG_MD.exists(),
        "gitHead": run_git(["rev-parse", "--short", "HEAD"]),
        "gitBranch": run_git(["branch", "--show-current"]),
    }


def executive_summary(summary: dict[str, Any], top_actions: list[dict[str, Any]]) -> str:
    if summary["actionFileCount"]:
        opening = f"Inspection found {summary['actionFileCount']} files above the action threshold and {summary['watchFileCount']} files above the watch threshold."
    elif summary["watchFileCount"]:
        opening = f"Inspection found no action threshold breach, but {summary['watchFileCount']} files are above the watch threshold."
    else:
        opening = "Inspection found no files above the watch or action thresholds."
    change = f"Snapshot comparison recorded {summary['addedCount']} added, {summary['changedCount']} changed and {summary['deletedCount']} deleted files since the previous inspection."
    protocol = "The active data science protocol is present." if summary["protocolExists"] else "The active data science protocol was not found and should be restored."
    if top_actions:
        largest = top_actions[0]
        closing = f"Largest immediate review item is {largest['path']} at {largest['sizeMB']} MB."
    else:
        closing = "No immediate large file review item was identified."
    return " ".join([opening, change, protocol, closing])


def md_table(rows: list[dict[str, Any]], columns: list[tuple[str, str]], limit: int | None = None) -> list[str]:
    selected = rows[:limit] if limit else rows
    if not selected:
        return ["No rows."]
    header = "| " + " | ".join(name for name, _ in columns) + " |"
    divider = "| " + " | ".join("---" for _ in columns) + " |"
    lines = [header, divider]
    for row in selected:
        values = []
        for _, key in columns:
            value = row.get(key, "")
            values.append(str(value).replace("|", "/"))
        lines.append("| " + " | ".join(values) + " |")
    return lines


def write_reports(payload: dict[str, Any]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    stamp = payload["generatedUTC"].replace("-", "").replace(":", "")
    history_json = HISTORY_DIR / f"data_science_discipline_inspection_{stamp}.json"
    history_md = HISTORY_DIR / f"data_science_discipline_inspection_{stamp}.md"

    report_md = render_markdown(payload)
    report_json = json.dumps(payload, indent=2, ensure_ascii=False)

    LATEST_MD.write_text(report_md, encoding="utf-8")
    LATEST_JSON.write_text(report_json + "\n", encoding="utf-8")
    history_md.write_text(report_md, encoding="utf-8")
    history_json.write_text(report_json + "\n", encoding="utf-8")
    append_changelog(payload)


def render_markdown(payload: dict[str, Any]) -> str:
    generated = payload["generatedUTC"]
    summary = payload["summary"]
    lines: list[str] = []
    lines.extend(
        [
            f"# {TITLE}",
            "",
            f"Generated UTC: `{generated}`",
            f"Repository: `{payload['repository']}`",
            f"Script: `{SCRIPT_NAME}`",
            f"Git branch: `{summary.get('gitBranch') or 'unknown'}`",
            f"Git head: `{summary.get('gitHead') or 'unknown'}`",
            "",
            "## Executive summary",
            "",
            payload["executiveSummary"],
            "",
            "## Human review panel",
            "",
            f"Total scanned files: `{summary['totalScannedFiles']}`",
            f"Total scanned size: `{summary['totalScannedMB']} MB`",
            f"Files above watch threshold: `{summary['watchFileCount']}`",
            f"Files above action threshold: `{summary['actionFileCount']}`",
            f"Added files since previous inspection: `{summary['addedCount']}`",
            f"Changed files since previous inspection: `{summary['changedCount']}`",
            f"Deleted files since previous inspection: `{summary['deletedCount']}`",
            "",
            "## Files requiring size review",
            "",
        ]
    )
    lines.extend(md_table(payload["watchFiles"], [("Path", "path"), ("MB", "sizeMB"), ("Risk", "risk"), ("Class", "class")], limit=50))
    lines.extend(["", "## Largest directories", ""])
    lines.extend(md_table(payload["directoryTotals"], [("Directory", "path"), ("Files", "files"), ("MB", "sizeMB")], limit=30))
    lines.extend(["", "## Change summary", ""])
    lines.append(f"Added: `{summary['addedCount']}`  ")
    lines.append(f"Changed: `{summary['changedCount']}`  ")
    lines.append(f"Deleted: `{summary['deletedCount']}`")
    lines.extend(["", "### Changed files", ""])
    lines.extend(md_table(payload["delta"]["changed"], [("Path", "path"), ("Old MB", "oldSizeMB"), ("New MB", "newSizeMB"), ("Old risk", "oldRisk"), ("New risk", "newRisk")], limit=50))
    lines.extend(["", "### Added files", ""])
    lines.extend(md_table(payload["delta"]["added"], [("Path", "path"), ("MB", "sizeMB"), ("Risk", "risk"), ("Class", "class")], limit=50))
    lines.extend(["", "### Deleted files", ""])
    lines.extend(md_table(payload["delta"]["deleted"], [("Path", "path"), ("MB", "sizeMB"), ("Risk", "risk"), ("Class", "class")], limit=50))
    lines.extend(
        [
            "",
            "## AI and audit detail",
            "",
            "The full machine readable inspection is stored in the matching JSON report. This Markdown file keeps the human review layer short and pushes detailed file hashes, classes and deltas into JSON for audit use only.",
            "",
            "## Governance note",
            "",
            "This script is non destructive. It does not delete raw files, move basemaps, alter browser paths, rewrite Git history or change data schemas. It only reports, timestamps and maintains the inspection changelog.",
            "",
        ]
    )
    return "\n".join(lines)


def append_changelog(payload: dict[str, Any]) -> None:
    generated = payload["generatedUTC"]
    summary = payload["summary"]
    if CHANGELOG_MD.exists():
        existing = CHANGELOG_MD.read_text(encoding="utf-8")
    else:
        existing = "# GlobalGrid2050 Data Science Discipline Changelog\n\nThis changelog is maintained by `scripts/inspect_data_science_discipline.py`. Each entry is deliberately compact. Full inspection detail is stored in `data_science_protocol/inspection_reports/`.\n\n"
    entry = (
        f"## {generated}  Data Science Discipline Inspection\n\n"
        f"Executive summary: {payload['executiveSummary']}\n\n"
        f"Files scanned: `{summary['totalScannedFiles']}`. "
        f"Scanned size: `{summary['totalScannedMB']} MB`. "
        f"Watch files: `{summary['watchFileCount']}`. "
        f"Action files: `{summary['actionFileCount']}`. "
        f"Added: `{summary['addedCount']}`. "
        f"Changed: `{summary['changedCount']}`. "
        f"Deleted: `{summary['deletedCount']}`.\n\n"
    )
    if f"## {generated}  Data Science Discipline Inspection" not in existing:
        CHANGELOG_MD.write_text(existing.rstrip() + "\n\n" + entry, encoding="utf-8")


def main() -> int:
    previous = previous_snapshot()
    files = collect_files()
    delta = compare_snapshots(previous, files)
    summary = summarise(files, delta)
    watch_files = sorted([f for f in files if f["risk"] != "normal"], key=lambda x: x["sizeBytes"], reverse=True)
    payload = {
        "title": TITLE,
        "generatedUTC": utc_now(),
        "repository": os.getenv("GITHUB_REPOSITORY", "Ventusltd/globalgrid2050"),
        "script": SCRIPT_NAME,
        "thresholdsMB": {"watch": WARN_FILE_MB, "action": ACTION_FILE_MB, "hard": HARD_FILE_MB},
        "summary": summary,
        "executiveSummary": executive_summary(summary, watch_files),
        "directoryTotals": directory_totals(files),
        "watchFiles": watch_files,
        "delta": delta,
        "files": files,
    }
    write_reports(payload)
    print(payload["executiveSummary"])
    print(f"Wrote {LATEST_MD.relative_to(ROOT)}")
    print(f"Wrote {LATEST_JSON.relative_to(ROOT)}")
    print(f"Updated {CHANGELOG_MD.relative_to(ROOT)}")
    if FAIL_ON_ACTION and summary["actionFileCount"]:
        print("Action threshold breach detected and DATASCIENCE_FAIL_ON_ACTION is true.", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
