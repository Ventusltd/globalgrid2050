#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]


def safe_rel(path_text: str) -> Path:
    path = Path(path_text)
    if not path_text or path.is_absolute() or ".." in path.parts:
        raise SystemExit(f"Unsafe path: {path_text}")
    return path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", required=True)
    parser.add_argument("--summary", required=True)
    parser.add_argument("--backup-dir", default="backups")
    parser.add_argument("--report-dir", default="gridbot_reports")
    args = parser.parse_args()

    target = REPO_ROOT / safe_rel(args.target)
    summary_file = REPO_ROOT / safe_rel(args.summary)

    if not target.exists():
        raise SystemExit(f"Target missing: {target}")
    if not summary_file.exists():
        raise SystemExit(f"Summary missing: {summary_file}")

    original = target.read_text(encoding="utf-8")
    summary = summary_file.read_text(encoding="utf-8").strip()

    old_block = "# Modular Section Index\n\nThis page is intentionally shallow. Each technical topic opens into its own subpage so readers can navigate the guidance without being overwhelmed by the full depth of the document.\n\n"
    if old_block not in original:
        if "# Executive Summary" in original:
            print("Executive summary already installed")
            return
        raise SystemExit("Expected modular note block not found")

    updated = original.replace(old_block, summary + "\n\n", 1)

    timestamp = dt.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_dir = REPO_ROOT / safe_rel(args.backup_dir)
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup_path = backup_dir / f"{target.stem}_before_executive_summary_{timestamp}{target.suffix}"
    backup_path.write_text(original, encoding="utf-8")

    target.write_text(updated, encoding="utf-8")

    report_dir = REPO_ROOT / safe_rel(args.report_dir)
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / f"solar_er_executive_summary_install_{timestamp}.md"
    report_path.write_text(
        "# Solar ER Executive Summary Install Report\n\n"
        f"UTC: {dt.datetime.utcnow().isoformat(timespec='seconds')}Z\n\n"
        f"Target: `{args.target}`\n\n"
        f"Summary fragment: `{args.summary}`\n\n"
        f"Backup: `{backup_path.relative_to(REPO_ROOT)}`\n\n"
        "Change: replaced the modular note with an executive summary while preserving the section links, print page and disclaimer.\n",
        encoding="utf-8",
    )

    print(f"Updated {target.relative_to(REPO_ROOT)}")
    print(f"Backup {backup_path.relative_to(REPO_ROOT)}")
    print(f"Report {report_path.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
