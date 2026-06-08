#!/usr/bin/env bash
set -euo pipefail

WARN_MIB="${DATASCIENCE_WARN_FILE_MB:-5}"
FAIL_MIB="${DATASCIENCE_FAIL_FILE_MB:-25}"
HARD_MIB="${DATASCIENCE_HARD_FILE_MB:-100}"
ENFORCE="${DATASCIENCE_ENFORCE_SIZE_GUARD:-true}"
SCAN_SCOPE="${DATASCIENCE_SIZE_GUARD_SCOPE:-changed}"
BASE_REF="${DATASCIENCE_BASE_REF:-origin/main}"
REPORT_DIR="data_science_protocol/audit_reports"
JSON_DIR="${REPORT_DIR}/json"

mkdir -p "${REPORT_DIR}" "${JSON_DIR}"

python3 - <<'PY'
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path.cwd()

warn_mib = float(os.environ.get("DATASCIENCE_WARN_FILE_MB", "5"))
fail_mib = float(os.environ.get("DATASCIENCE_FAIL_FILE_MB", "25"))
hard_mib = float(os.environ.get("DATASCIENCE_HARD_FILE_MB", "100"))
enforce = os.environ.get("DATASCIENCE_ENFORCE_SIZE_GUARD", "true").lower() in {"1", "true", "yes"}
scan_scope = os.environ.get("DATASCIENCE_SIZE_GUARD_SCOPE", "changed").lower()
base_ref = os.environ.get("DATASCIENCE_BASE_REF", "origin/main")

stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
report_dir = ROOT / "data_science_protocol" / "audit_reports"
json_dir = report_dir / "json"
report_md = report_dir / f"repo_size_guard_{stamp}.md"
report_json = json_dir / f"repo_size_guard_{stamp}.json"
latest_md = report_dir / "REPO_SIZE_GUARD_LATEST.md"
latest_json = json_dir / "REPO_SIZE_GUARD_LATEST.json"

excluded_parts = {
    ".git", ".venv", "venv", "env", "node_modules", "__pycache__",
    ".mypy_cache", ".pytest_cache", ".ipynb_checkpoints"
}

review_extensions = {
    ".csv", ".json", ".geojson", ".topojson", ".parquet", ".zip",
    ".sqlite", ".db", ".html", ".js", ".css", ".py", ".md", ".yml",
    ".yaml", ".txt"
}

def run(cmd):
    return subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True)

def git(args):
    result = run(["git", *args])
    return result.stdout.strip() if result.returncode == 0 else ""

def mib(size_bytes):
    return round(size_bytes / 1024 / 1024, 3)

def skip(path):
    try:
        parts = path.relative_to(ROOT).parts
    except ValueError:
        return True
    return any(part in excluded_parts for part in parts)

def candidate_paths():
    if scan_scope == "all":
        return sorted([p for p in ROOT.rglob("*") if p.is_file() and not skip(p)])

    changed = set()
    diff_cmds = [
        ["git", "diff", "--name-only", "--diff-filter=ACMRT", f"{base_ref}...HEAD"],
        ["git", "diff", "--name-only", "--diff-filter=ACMRT", "HEAD~1..HEAD"],
    ]
    for cmd in diff_cmds:
        result = run(cmd)
        if result.returncode == 0 and result.stdout.strip():
            changed.update(line.strip() for line in result.stdout.splitlines() if line.strip())
            break

    local = run(["git", "diff", "--name-only", "--diff-filter=ACMRT"])
    if local.returncode == 0:
        changed.update(line.strip() for line in local.stdout.splitlines() if line.strip())

    staged = run(["git", "diff", "--cached", "--name-only", "--diff-filter=ACMRT"])
    if staged.returncode == 0:
        changed.update(line.strip() for line in staged.stdout.splitlines() if line.strip())

    paths = []
    for rel in sorted(changed):
        p = ROOT / rel
        if p.exists() and p.is_file() and not skip(p):
            paths.append(p)
    return paths

def classify(path, size_bytes):
    rel = path.relative_to(ROOT).as_posix().lower()
    suffix = path.suffix.lower()

    if size_bytes >= hard_mib * 1024 * 1024:
        risk = "hard limit risk"
    elif size_bytes >= fail_mib * 1024 * 1024:
        risk = "fail"
    elif size_bytes >= warn_mib * 1024 * 1024:
        risk = "warn"
    else:
        risk = "pass"

    if suffix in {".geojson", ".topojson"}:
        kind = "gis geometry"
    elif rel.startswith("data/raw") or "raw" in rel or "dump" in rel or "archive_full" in rel:
        kind = "raw or transient candidate"
    elif rel.startswith("data/"):
        kind = "data"
    elif rel.startswith("data_science_protocol/"):
        kind = "audit or protocol"
    elif rel.startswith(".github/"):
        kind = "workflow or guardrail"
    else:
        kind = "repository file"

    return risk, kind

files = []
for path in candidate_paths():
    size = path.stat().st_size
    suffix = path.suffix.lower()
    if suffix not in review_extensions and size < warn_mib * 1024 * 1024:
        continue
    risk, kind = classify(path, size)
    if risk != "pass" or kind in {"gis geometry", "raw or transient candidate"}:
        files.append({
            "path": path.relative_to(ROOT).as_posix(),
            "sizeBytes": size,
            "sizeMiB": mib(size),
            "risk": risk,
            "kind": kind,
        })

files = sorted(files, key=lambda item: item["sizeBytes"], reverse=True)
warn_files = [f for f in files if f["risk"] == "warn"]
fail_files = [f for f in files if f["risk"] in {"fail", "hard limit risk"}]
hard_files = [f for f in files if f["risk"] == "hard limit risk"]

payload = {
    "reportTitle": "GlobalGrid2050 Repository Size Guard",
    "schemaVersion": "1.2.0",
    "generatedUTC": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "repository": os.environ.get("GITHUB_REPOSITORY", "Ventusltd/globalgrid2050"),
    "branch": git(["branch", "--show-current"]),
    "gitHead": git(["rev-parse", "--short", "HEAD"]),
    "mode": "enforce" if enforce else "audit only",
    "scanScope": scan_scope,
    "baseRef": base_ref,
    "thresholdsMiB": {"warn": warn_mib, "fail": fail_mib, "hard": hard_mib},
    "warnCount": len(warn_files),
    "failCount": len(fail_files),
    "hardLimitRiskCount": len(hard_files),
    "files": files,
}

executive = (
    f"Repository size guard ran in {payload['mode']} mode with {scan_scope} scan scope. "
    f"Warn threshold {warn_mib} MiB. Fail threshold {fail_mib} MiB. Hard threshold {hard_mib} MiB. "
    f"Found {len(warn_files)} warning files and {len(fail_files)} fail threshold files."
)
if scan_scope == "changed":
    executive += " Legacy large files are not blocking this run unless they were changed or added."
if enforce and fail_files:
    executive += " Build failed because changed or scanned files breached the fail threshold."

lines = [
    "# GlobalGrid2050 Repository Size Guard",
    "",
    f"Generated UTC: `{payload['generatedUTC']}`",
    f"Repository: `{payload['repository']}`",
    f"Branch: `{payload['branch'] or 'unknown'}`",
    f"Git head: `{payload['gitHead'] or 'unknown'}`",
    f"Mode: `{payload['mode']}`",
    f"Scan scope: `{scan_scope}`",
    f"Base ref: `{base_ref}`",
    "",
    "## Executive summary",
    "",
    executive,
    "",
    "## Files requiring review",
    "",
]

if files:
    lines += ["| Path | MiB | Risk | Kind |", "| --- | --- | --- | --- |"]
    for item in files[:200]:
        lines.append(f"| {item['path']} | {item['sizeMiB']} | {item['risk']} | {item['kind']} |")
else:
    lines.append("No files above watch threshold or matching raw or GIS review patterns in this scan scope.")

lines += [
    "",
    "## Governance note",
    "",
    "Use changed scope for push and pull request enforcement. Use all scope for manual audit runs.",
]

report_dir.mkdir(parents=True, exist_ok=True)
json_dir.mkdir(parents=True, exist_ok=True)

report_text = "\n".join(lines) + "\n"
json_text = json.dumps(payload, indent=2) + "\n"

report_md.write_text(report_text, encoding="utf-8")
latest_md.write_text(report_text, encoding="utf-8")
report_json.write_text(json_text, encoding="utf-8")
latest_json.write_text(json_text, encoding="utf-8")

print(executive)
print(f"Wrote {report_md.relative_to(ROOT)}")
print(f"Wrote {report_json.relative_to(ROOT)}")

if enforce and fail_files:
    raise SystemExit(2)
PY
