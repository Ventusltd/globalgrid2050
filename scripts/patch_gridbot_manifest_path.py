#!/usr/bin/env python3
"""
GlobalGrid2050 GridBot manifest path hotfix.

Audit first patcher for scripts/gridbot_mega_upgrade.py.
It fixes the first run failure where a relative manifest path was compared with
an absolute repository root using Path.relative_to().

The script is deliberately narrow:
- reads the full target file
- applies exact string replacements only
- writes Markdown and JSON audit reports
- does not delete files
- does not rewrite history
- changes the target only when --apply is supplied
"""

from __future__ import annotations

import argparse
import difflib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "scripts" / "gridbot_mega_upgrade.py"
REPORT_DIR = ROOT / "data_science_protocol" / "audit_reports"
JSON_DIR = REPORT_DIR / "json"

OLD_MANIFEST_ASSIGNMENT = "    manifest_path = Path(args.manifest)\n"
NEW_MANIFEST_ASSIGNMENT = (
    "    manifest_arg = Path(args.manifest)\n"
    "    manifest_path = manifest_arg if manifest_arg.is_absolute() else ROOT / manifest_arg\n"
    "    manifest_path = manifest_path.resolve()\n"
)

OLD_MANIFEST_PAYLOAD = '        "manifestPath": manifest_path.relative_to(ROOT).as_posix() if manifest_path.exists() else str(manifest_path),\n'
NEW_MANIFEST_PAYLOAD = (
    '        "manifestPath": manifest_path.relative_to(ROOT).as_posix() if manifest_path.exists() and manifest_path.is_relative_to(ROOT) else str(manifest_path),\n'
)


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def run_git(args: list[str]) -> str:
    try:
        return subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True, check=True).stdout.strip()
    except Exception:
        return ""


def patch_text(text: str) -> tuple[str, list[dict]]:
    changes = []
    updated = text

    if OLD_MANIFEST_ASSIGNMENT in updated:
        updated = updated.replace(OLD_MANIFEST_ASSIGNMENT, NEW_MANIFEST_ASSIGNMENT, 1)
        changes.append({"id": "resolve_relative_manifest_path", "applied": True})
    elif NEW_MANIFEST_ASSIGNMENT in updated:
        changes.append({"id": "resolve_relative_manifest_path", "applied": False, "reason": "already present"})
    else:
        changes.append({"id": "resolve_relative_manifest_path", "applied": False, "reason": "expected source line not found"})

    if OLD_MANIFEST_PAYLOAD in updated:
        updated = updated.replace(OLD_MANIFEST_PAYLOAD, NEW_MANIFEST_PAYLOAD, 1)
        changes.append({"id": "safe_manifest_report_path", "applied": True})
    elif NEW_MANIFEST_PAYLOAD in updated:
        changes.append({"id": "safe_manifest_report_path", "applied": False, "reason": "already present"})
    else:
        changes.append({"id": "safe_manifest_report_path", "applied": False, "reason": "expected source line not found"})

    return updated, changes


def write_reports(payload: dict, diff_lines: list[str]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    JSON_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    md_path = REPORT_DIR / f"GRIDBOT_MANIFEST_PATH_HOTFIX_{stamp}.md"
    json_path = JSON_DIR / f"GRIDBOT_MANIFEST_PATH_HOTFIX_{stamp}.json"
    latest_md = REPORT_DIR / "GRIDBOT_MANIFEST_PATH_HOTFIX_LATEST.md"
    latest_json = JSON_DIR / "GRIDBOT_MANIFEST_PATH_HOTFIX_LATEST.json"

    lines = [
        "# GlobalGrid2050 GridBot Manifest Path Hotfix Audit",
        "",
        f"Generated UTC: `{payload['generatedUTC']}`",
        f"Repository: `{payload['repository']}`",
        f"Branch: `{payload['branch'] or 'unknown'}`",
        f"Git head: `{payload['gitHead'] or 'unknown'}`",
        f"Mode: `{payload['mode']}`",
        "",
        "## Executive summary",
        "",
        payload["executiveSummary"],
        "",
        "## Change results",
        "",
        "| Change | Applied | Reason |",
        "| --- | --- | --- |",
    ]
    for change in payload["changes"]:
        lines.append(f"| {change['id']} | {change.get('applied')} | {change.get('reason', '')} |")

    lines.extend([
        "",
        "## Diff preview",
        "",
        "```diff",
        *diff_lines[:300],
        "```",
        "",
        "## Governance note",
        "",
        "This hotfix only changes path handling in the GridBot orchestrator. It does not run GridBot phases, delete files, change chart data or rewrite history.",
    ])

    md_text = "\n".join(lines) + "\n"
    json_text = json.dumps(payload, indent=2) + "\n"

    md_path.write_text(md_text, encoding="utf-8")
    json_path.write_text(json_text, encoding="utf-8")
    latest_md.write_text(md_text, encoding="utf-8")
    latest_json.write_text(json_text, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Apply the hotfix after writing the audit report.")
    args = parser.parse_args()

    before = TARGET.read_text(encoding="utf-8")
    after, changes = patch_text(before)
    diff_lines = list(difflib.unified_diff(before.splitlines(), after.splitlines(), fromfile=str(TARGET.relative_to(ROOT)), tofile=str(TARGET.relative_to(ROOT))))

    would_change = before != after
    applied = False
    if args.apply and would_change:
        TARGET.write_text(after, encoding="utf-8")
        applied = True

    if would_change and not args.apply:
        summary = "GridBot manifest path hotfix is required. Audit only mode produced a diff preview and did not change files."
    elif applied:
        summary = "GridBot manifest path hotfix was applied. The orchestrator should now accept relative manifest paths from workflow_dispatch."
    else:
        summary = "GridBot manifest path hotfix is already present. No target file change required."

    payload = {
        "reportTitle": "GlobalGrid2050 GridBot Manifest Path Hotfix Audit",
        "schemaVersion": "1.0.0",
        "generatedUTC": utc_now(),
        "repository": "Ventusltd/globalgrid2050",
        "branch": run_git(["branch", "--show-current"]),
        "gitHead": run_git(["rev-parse", "--short", "HEAD"]),
        "mode": "apply" if args.apply else "audit only",
        "targetPath": str(TARGET.relative_to(ROOT)),
        "wouldChange": would_change,
        "applied": applied,
        "changes": changes,
        "executiveSummary": summary,
    }

    write_reports(payload, diff_lines)
    print(summary)
    print("Wrote data_science_protocol/audit_reports/GRIDBOT_MANIFEST_PATH_HOTFIX_LATEST.md")
    print("Wrote data_science_protocol/audit_reports/json/GRIDBOT_MANIFEST_PATH_HOTFIX_LATEST.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
