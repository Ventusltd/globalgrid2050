#!/usr/bin/env bash
set -euo pipefail

WARN_MIB="${DATASCIENCE_WARN_FILE_MB:-5}"
FAIL_MIB="${DATASCIENCE_FAIL_FILE_MB:-25}"
HARD_MIB="${DATASCIENCE_HARD_FILE_MB:-100}"
REPORT_DIR="data_science_protocol/audit_reports"
JSON_DIR="${REPORT_DIR}/json"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT_MD="${REPORT_DIR}/repo_size_guard_${STAMP}.md"
REPORT_JSON="${JSON_DIR}/repo_size_guard_${STAMP}.json"
LATEST_MD="${REPORT_DIR}/REPO_SIZE_GUARD_LATEST.md"
LATEST_JSON="${JSON_DIR}/REPO_SIZE_GUARD_LATEST.json"

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
stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
report_dir = ROOT / "data_science_protocol" / "audit_reports"
json_dir = report_dir / "json"
report_md = report_dir / f"repo_size_guard_{stamp}.md"
report_json = json_dir / f"repo_size_guard_{stamp}.json"
latest_md = report_dir / "REPO_SIZE_GUARD_LATEST.md"
latest_json = json_dir / "REPO_SIZE_GUARD_LATEST.json"

excluded_parts = {
    ".git",
    ".venv",
    "venv",
    "env",
    "node_modules",
    "__pycache__",
    ".mypy_cache",
    ".pytest_cache",
    ".ipynb_checkpoints",
}

important_exts = {
    ".csv", ".json", ".geojson", ".topojson", ".parquet", ".zip", ".sqlite", ".db",
    ".html", ".js", ".css", ".py", ".md", ".yml", ".yaml", ".txt"
}


def run_git(args):
    try:
        return subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True, check=True).stdout.strip()
    except Exception:
        return ""


def mib(size):
    return round(size / 1024 / 1024, 3)


def should_skip(path):
    parts = path.relative_to(ROOT).parts
    return any(part in excluded_parts for part in parts)


def classify(path, size):
    rel = path.relative_to(ROOT).as_posix().lower()
    suffix = path.suffix.lower()
    if size >= hard_mib * 1024 * 1024:
        risk = "hard limit risk"
    elif size >= fail_mib * 1024 * 1024:
        risk = "fail"
    elif size >= warn_mib * 1024 * 1024:
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
for path in sorted(ROOT.rglob("*")):
    if not path.is_file() or should_skip(path):
        continue
    if path.suffix.lower() not in important_exts and path.stat().st_size < warn_mib * 1024 * 1024:
        continue
    size = path.stat().st_size
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

summary = {
    "reportTitle": "GlobalGrid2050 Repository Size Guard",
    "schemaVersion": "1.0.0",
    "generatedUTC": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "repository": os.environ.get("GITHUB_REPOSITORY", "Ventusltd/globalgrid2050"),
    "branch": run_git(["branch", "--show-current"]),
    "gitHead": run_git(["rev-parse", "--short", "HEAD"]),
    "thresholdsMiB": {"warn": warn_mib, "fail": fail_mib, "hard": hard_mib},
    "warnCount": len(warn_files),
    "failCount": len(fail_files),
    "hardLimitRiskCount": len(hard_files),
    "files": files,
}

executive = (
    f"Repository size guard scanned tracked working tree files using warn {warn_mib} MiB, "
    f"fail {fail_mib} MiB and hard {hard_mib} MiB thresholds. "
    f"It found {len(warn_files)} warning files and {len(fail_files)} fail threshold files."
)
if fail_files:
    executive += " Build should fail until action threshold files are justified, reduced, externalised or explicitly excluded by a later controlled policy."
else:
    executive += " No fail threshold breach was detected."

lines = [
    "# GlobalGrid2050 Repository Size Guard",
    "",
    f"Generated UTC: `{summary['generatedUTC']}`",
    f"Repository: `{summary['repository']}`",
    f"Branch: `{summary['branch'] or 'unknown'}`",
    f"Git head: `{summary['gitHead'] or 'unknown'}`",
    "",
    "## Executive summary",
    "",
    executive,
    "",
    "## Thresholds",
    "",
    f"Warn: `{warn_mib} MiB`",
    f"Fail: `{fail_mib} MiB`",
    f"Hard: `{hard_mib} MiB`",
    "",
    "## Files requiring review",
    "",
]
if files:
    lines += ["| Path | MiB | Risk | Kind |", "| --- | --- | --- | --- |"]
    for item in files[:100]:
        lines.append(f"| {item['path']} | {item['sizeMiB']} | {item['risk']} | {item['kind']} |")
else:
    lines.append("No files above watch threshold or matching raw or GIS review patterns.")
lines += [
    "",
    "## Governance note",
    "",
    "This guard is deliberately stricter than GitHub platform limits. It is intended to stop raw telemetry, heavy GIS basemaps and accidental archives entering Git history before the next major upgrade.",
]

report_dir.mkdir(parents=True, exist_ok=True)
json_dir.mkdir(parents=True, exist_ok=True)
report_md.write_text("\n".join(lines) + "\n", encoding="utf-8")
latest_md.write_text("\n".join(lines) + "\n", encoding="utf-8")
report_json.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
latest_json.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

print(executive)
print(f"Wrote {report_md.relative_to(ROOT)}")
print(f"Wrote {report_json.relative_to(ROOT)}")

if fail_files:
    raise SystemExit(2)
PY
