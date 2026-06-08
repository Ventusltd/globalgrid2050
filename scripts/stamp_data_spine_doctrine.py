#!/usr/bin/env python3
"""
GlobalGrid2050 data spine doctrine stamper.

Adds a compact data spine backlink block to key architecture logs.
The script is idempotent and writes an audit report.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPORT_DIR = ROOT / "data_science_protocol" / "audit_reports"
REPORT_JSON_DIR = REPORT_DIR / "json"

STAMP_HEADING = "## Data spine doctrine stamp"
STAMP_TEXT = """## Data spine doctrine stamp

Data grain discipline applies. Store the right grain for the question, not raw bulk. Settled FUELHH is confirmed where available. Live FUELINST is provisional. Sums roll up. Peaks do not. Solar is provenance stamped. Every fact carries schema, source, completeness and status. Never overwrite good data. Commit facts and regenerate bulk. Full doctrine: data_science_protocol/THE_DATA_SPINE.md
"""

TARGETS = [
    "ARCHITECTURE.md",
    "PHILOSOPHY.md",
    "data_science_protocol/DATA_STORAGE_DISCIPLINE_PROTOCOL.md",
    "uk_energy_tracking_v6/V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
]

CHANGELOG = "data_science_protocol/DATA_SCIENCE_DISCIPLINE_CHANGELOG.md"


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.rstrip() + "\n", encoding="utf-8")


def insert_after_first_block(text: str) -> str:
    if "data_science_protocol/THE_DATA_SPINE.md" in text:
        return text
    lines = text.splitlines()
    if not lines:
        return STAMP_TEXT.rstrip() + "\n"
    insert_at = 1
    while insert_at < min(len(lines), 12) and lines[insert_at].strip():
        insert_at += 1
    new_lines = lines[:insert_at] + ["", STAMP_TEXT.rstrip(), ""] + lines[insert_at:]
    return "\n".join(new_lines) + "\n"


def update_target(rel: str, apply: bool) -> dict:
    path = ROOT / rel
    text = read_text(path)
    exists = path.exists()
    already = "data_science_protocol/THE_DATA_SPINE.md" in text
    changed = False
    if exists and not already:
        new_text = insert_after_first_block(text)
        changed = new_text != text
        if apply and changed:
            write_text(path, new_text)
    return {
        "path": rel,
        "exists": exists,
        "alreadyStamped": already,
        "wouldChange": bool(exists and not already and changed),
        "applied": bool(apply and exists and not already and changed),
    }


def update_changelog(apply: bool) -> dict:
    path = ROOT / CHANGELOG
    text = read_text(path)
    exists = path.exists()
    marker = "Data spine doctrine adopted"
    already = marker in text
    block = """
## 2026 06 08  Data spine doctrine adopted

Executive summary: The canonical data spine doctrine was added and stamped across the principal architecture logs. The doctrine defines right grain for the right question, live versus confirmed source discipline, additive and non additive data rules, solar provenance, never overwrite protection and commit facts regenerate bulk storage policy.

Files referenced:

data_science_protocol/THE_DATA_SPINE.md

Known risks:

The doctrine must now be enforced through compiler logic and workflow reports, not merely documented.

Next action:

Run the generation ECG and FUELHH candidate workflows, then ask an external reviewer to check outputs against the data spine acceptance criteria.
"""
    changed = exists and not already
    if apply and changed:
        write_text(path, text.rstrip() + "\n" + block.strip() + "\n")
    return {"path": CHANGELOG, "exists": exists, "alreadyLogged": already, "wouldChange": changed, "applied": bool(apply and changed)}


def render_report(payload: dict) -> str:
    lines = [
        "# GlobalGrid2050 Data Spine Stamp Report",
        "",
        f"Generated UTC: `{payload['generatedUTC']}`",
        f"Mode: `{payload['mode']}`",
        "",
        "## Results",
        "",
    ]
    for result in payload["targets"]:
        lines.append(f"{result['path']}  exists={result['exists']}  already={result.get('alreadyStamped', result.get('alreadyLogged'))}  applied={result['applied']}")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    targets = [update_target(rel, args.apply) for rel in TARGETS]
    targets.append(update_changelog(args.apply))

    payload = {
        "schemaVersion": "1.0.0",
        "generatedUTC": utc_now(),
        "mode": "apply" if args.apply else "audit only",
        "doctrine": "data_science_protocol/THE_DATA_SPINE.md",
        "targets": targets,
    }

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    s = stamp()
    md = REPORT_DIR / f"DATA_SPINE_STAMP_{s}.md"
    js = REPORT_JSON_DIR / f"DATA_SPINE_STAMP_{s}.json"
    latest_md = REPORT_DIR / "DATA_SPINE_STAMP_LATEST.md"
    latest_js = REPORT_JSON_DIR / "DATA_SPINE_STAMP_LATEST.json"
    md_text = render_report(payload)
    js_text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    write_text(md, md_text)
    write_text(latest_md, md_text)
    write_text(js, js_text)
    write_text(latest_js, js_text)
    print(md_text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
