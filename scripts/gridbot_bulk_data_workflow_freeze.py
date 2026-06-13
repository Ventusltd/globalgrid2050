#!/usr/bin/env python3
"""GridBot bulk-data workflow freeze.

Audit/apply control for stopping raw/bulk data workflows from continuing to
schedule commits into the monorepo during app-repo migration.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / ".github" / "workflows" / "backfill_generation_fuelhh_halfhourly_v6.yml"
REPORT_DIR = ROOT / "data_science_protocol" / "audit_reports"
REPORT_JSON_DIR = REPORT_DIR / "json"
STEM = "BULK_DATA_WORKFLOW_FREEZE"


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def stamp() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def rel(p: Path) -> str:
    return p.relative_to(ROOT).as_posix()


def has_schedule(text: str) -> bool:
    return "\n  schedule:\n" in "\n" + text


def commit_default(text: str) -> str:
    lines = text.splitlines()
    in_commit = False
    for line in lines:
        if line == "      commit:":
            in_commit = True
            continue
        if in_commit and line.startswith("      ") and not line.startswith("        "):
            in_commit = False
        if in_commit and "default:" in line:
            return line.split("default:", 1)[1].strip().strip("'\"")
    return "unknown"


def remove_schedule_block(text: str) -> str:
    lines = text.splitlines()
    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line == "  schedule:":
            i += 1
            while i < len(lines) and (lines[i].startswith("    ") or lines[i].strip() == ""):
                i += 1
            continue
        out.append(line)
        i += 1
    return "\n".join(out) + "\n"


def set_commit_default_false(text: str) -> str:
    lines = text.splitlines()
    out: list[str] = []
    in_commit = False
    for line in lines:
        if line == "      commit:":
            in_commit = True
            out.append(line)
            continue
        if in_commit and line.startswith("      ") and not line.startswith("        "):
            in_commit = False
        if in_commit and "default: 'true'" in line:
            out.append(line.replace("default: 'true'", "default: 'false'"))
        elif in_commit and 'default: "true"' in line:
            out.append(line.replace('default: "true"', 'default: "false"'))
        else:
            out.append(line)
    return "\n".join(out) + "\n"


def patch(text: str) -> str:
    return set_commit_default_false(remove_schedule_block(text))


def build_report(mode: str, before: str, after: str, applied: bool) -> dict[str, Any]:
    checks = {
        "target_exists": TARGET.exists(),
        "target_is_fuelhh_backfill_workflow": TARGET.name == "backfill_generation_fuelhh_halfhourly_v6.yml",
        "schedule_removed_after_patch": not has_schedule(after),
        "manual_dispatch_preserved": "workflow_dispatch:" in after,
        "commit_input_preserved": "      commit:" in after,
        "commit_default_false_after_patch": commit_default(after) == "false",
        "bulk_git_add_still_visible_for_manual_apply": "git add data/generation/fuelhh_halfhourly" in after,
    }
    return {
        "reportTitle": "Bulk Data Workflow Freeze",
        "schemaVersion": "1.0.0",
        "generatedUTC": utc_now(),
        "mode": mode,
        "targetFile": rel(TARGET),
        "scheduleBefore": has_schedule(before),
        "scheduleAfter": has_schedule(after),
        "commitDefaultBefore": commit_default(before),
        "commitDefaultAfter": commit_default(after),
        "changed": before != after,
        "checks": checks,
        "applied": applied,
        "pass": all(checks.values()),
        "executiveSummary": "Disables scheduled FUELHH raw half-hourly backfill churn during repo split, while preserving manual dispatch for deliberate regeneration.",
        "rollbackMethod": "Revert the apply commit or restore the schedule block in .github/workflows/backfill_generation_fuelhh_halfhourly_v6.yml.",
    }


def write_reports(payload: dict[str, Any]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    s = stamp()
    lines = [
        "# Bulk Data Workflow Freeze",
        "",
        f"Generated UTC: `{payload['generatedUTC']}`",
        f"Mode: `{payload['mode']}`",
        f"Target file: `{payload['targetFile']}`",
        f"Schedule before: `{payload['scheduleBefore']}`",
        f"Schedule after: `{payload['scheduleAfter']}`",
        f"Commit default before: `{payload['commitDefaultBefore']}`",
        f"Commit default after: `{payload['commitDefaultAfter']}`",
        f"Changed: `{payload['changed']}`",
        f"Applied: `{payload['applied']}`",
        f"Pass: `{payload['pass']}`",
        "",
        "## Executive summary",
        "",
        payload["executiveSummary"],
        "",
        "## Checks",
        "",
    ]
    for k, v in payload["checks"].items():
        lines.append(f"- `{k}`: `{v}`")
    lines.extend(["", "## Rollback", "", payload["rollbackMethod"], ""])
    text = "\n".join(lines)
    for p in (REPORT_DIR / f"{STEM}_{s}.md", REPORT_DIR / f"{STEM}_LATEST.md"):
        p.write_text(text, encoding="utf-8")
    js = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    for p in (REPORT_JSON_DIR / f"{STEM}_{s}.json", REPORT_JSON_DIR / f"{STEM}_LATEST.json"):
        p.write_text(js, encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    before = TARGET.read_text(encoding="utf-8") if TARGET.exists() else ""
    after = patch(before)
    if args.apply and before != after:
        TARGET.write_text(after, encoding="utf-8")
    payload = build_report("apply" if args.apply else "audit", before, after, args.apply)
    write_reports(payload)
    print(json.dumps({"pass": payload["pass"], "changed": payload["changed"], "applied": payload["applied"]}, indent=2))
    return 0 if payload["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
