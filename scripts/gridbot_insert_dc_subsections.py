#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]


def safe_rel(path_text: str) -> Path:
    path = Path(path_text)
    if not path_text or path.is_absolute() or ".." in path.parts:
        raise SystemExit(f"Unsafe path: {path_text}")
    return path


def renumber_dc_subsections(text: str) -> str:
    start = text.find("# 5. DC String and DC Cable System Requirements")
    end = text.find("# 6. Behaviour of Direct Current Systems")
    if start < 0 or end < 0 or end <= start:
        raise SystemExit("Expected DC section boundaries not found. Run first workflow successfully before this workflow.")

    before = text[:start]
    section = text[start:end]
    after = text[end:]

    counter = {"n": 0}

    def repl(match: re.Match[str]) -> str:
        counter["n"] += 1
        return f"## 5.{counter['n']}. {match.group(1).strip()}"

    section = re.sub(r"(?m)^## 5\.\d+\.\s+(.*)$", repl, section)
    return before + section + after


def insert_once(text: str, marker: str, fragment: str) -> str:
    first_line = fragment.strip().splitlines()[0].strip()
    if first_line in text:
        print(f"Already present: {first_line}")
        return text
    if marker not in text:
        raise SystemExit(f"Marker not found: {marker}")
    before, after = text.split(marker, 1)
    return before + fragment.strip() + "\n\n" + marker + after


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", required=True)
    parser.add_argument("--material-fragment", required=True)
    parser.add_argument("--duct-fragment", required=True)
    parser.add_argument("--backup-dir", default="backups")
    parser.add_argument("--report-dir", default="gridbot_reports")
    args = parser.parse_args()

    target = REPO_ROOT / safe_rel(args.target)
    material = REPO_ROOT / safe_rel(args.material_fragment)
    duct = REPO_ROOT / safe_rel(args.duct_fragment)

    if not target.exists():
        raise SystemExit(f"Target missing: {target}")
    if not material.exists():
        raise SystemExit(f"Material fragment missing: {material}")
    if not duct.exists():
        raise SystemExit(f"Duct fragment missing: {duct}")

    original = target.read_text(encoding="utf-8")
    updated = original

    material_text = material.read_text(encoding="utf-8")
    duct_text = duct.read_text(encoding="utf-8")

    updated = insert_once(updated, "## 5.5. Connector Compatibility and Termination Quality", material_text)
    updated = insert_once(updated, "## 5.20. Required DC Deliverables", duct_text)
    updated = renumber_dc_subsections(updated)

    timestamp = dt.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_dir = REPO_ROOT / safe_rel(args.backup_dir)
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup_path = backup_dir / f"{target.stem}_before_dc_subsections_{timestamp}{target.suffix}"
    backup_path.write_text(original, encoding="utf-8")

    target.write_text(updated, encoding="utf-8")

    report_dir = REPO_ROOT / safe_rel(args.report_dir)
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / f"solar_dc_subsections_install_{timestamp}.md"
    report_path.write_text(
        "# Solar DC Subsections Install Report\n\n"
        f"UTC: {dt.datetime.utcnow().isoformat(timespec='seconds')}Z\n\n"
        f"Target: `{args.target}`\n\n"
        f"Material fragment: `{args.material_fragment}`\n\n"
        f"Duct fragment: `{args.duct_fragment}`\n\n"
        f"Backup: `{backup_path.relative_to(REPO_ROOT)}`\n\n"
        "Change: inserted material life and duct congestion subsections, then renumbered Section 5 subsections.\n",
        encoding="utf-8",
    )

    print(f"Updated {target.relative_to(REPO_ROOT)}")
    print(f"Backup {backup_path.relative_to(REPO_ROOT)}")
    print(f"Report {report_path.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
