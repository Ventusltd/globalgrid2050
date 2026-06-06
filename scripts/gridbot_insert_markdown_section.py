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


def increment_numbered_headings(text: str, start_at: int, offset: int) -> str:
    def top(match: re.Match[str]) -> str:
        num = int(match.group(2))
        if num >= start_at:
            return f"{match.group(1)}{num + offset}{match.group(3)}"
        return match.group(0)

    def sub(match: re.Match[str]) -> str:
        num = int(match.group(2))
        if num >= start_at:
            return f"{match.group(1)}{num + offset}.{match.group(3)}"
        return match.group(0)

    text = re.sub(r"(?m)^(# )(\d+)(\. .*)$", top, text)
    text = re.sub(r"(?m)^(## )(\d+)\.(\d+\. .*)$", sub, text)
    return text


def replace_contents(text: str, contents: str) -> str:
    start = "# Contents\n\n"
    end = "# 3. System Level Electrical Behaviour"
    if start not in text or end not in text:
        raise SystemExit("Contents markers not found")
    before, rest = text.split(start, 1)
    _old, after = rest.split(end, 1)
    return before + start + contents.strip() + "\n\n" + end + after


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", required=True)
    parser.add_argument("--fragment", required=True)
    parser.add_argument("--marker", required=True)
    parser.add_argument("--new-contents", required=True)
    parser.add_argument("--backup-dir", default="backups")
    parser.add_argument("--report-dir", default="gridbot_reports")
    parser.add_argument("--start-renumber", type=int, default=5)
    args = parser.parse_args()

    target = REPO_ROOT / safe_rel(args.target)
    fragment = REPO_ROOT / safe_rel(args.fragment)
    contents_file = REPO_ROOT / safe_rel(args.new_contents)

    if not target.exists():
        raise SystemExit(f"Target missing: {target}")
    if not fragment.exists():
        raise SystemExit(f"Fragment missing: {fragment}")
    if not contents_file.exists():
        raise SystemExit(f"Contents file missing: {contents_file}")

    original = target.read_text(encoding="utf-8")
    section = fragment.read_text(encoding="utf-8").strip() + "\n\n"
    new_contents = contents_file.read_text(encoding="utf-8")

    first_line = section.splitlines()[0].strip()
    if first_line in original:
        print(f"Section already present: {first_line}")
        return

    if args.marker not in original:
        raise SystemExit(f"Marker not found: {args.marker}")

    before, tail = original.split(args.marker, 1)
    tail = args.marker + tail
    tail = increment_numbered_headings(tail, args.start_renumber, 1)
    updated = before + section + tail
    updated = replace_contents(updated, new_contents)
    updated = updated.replace("Normative References", "Referenced Standards and Guidance")

    timestamp = dt.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_dir = REPO_ROOT / safe_rel(args.backup_dir)
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup_path = backup_dir / f"{target.stem}_before_dc_section_{timestamp}{target.suffix}"
    backup_path.write_text(original, encoding="utf-8")

    target.write_text(updated, encoding="utf-8")

    report_dir = REPO_ROOT / safe_rel(args.report_dir)
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / f"solar_dc_section_install_{timestamp}.md"
    report_path.write_text(
        "# Solar DC Section Install Report\n\n"
        f"UTC: {dt.datetime.utcnow().isoformat(timespec='seconds')}Z\n\n"
        f"Target: `{args.target}`\n\n"
        f"Fragment: `{args.fragment}`\n\n"
        f"Backup: `{backup_path.relative_to(REPO_ROOT)}`\n\n"
        "Change: inserted staged DC String and DC Cable System Requirements section and renumbered following headings.\n",
        encoding="utf-8",
    )

    print(f"Updated {target.relative_to(REPO_ROOT)}")
    print(f"Backup {backup_path.relative_to(REPO_ROOT)}")
    print(f"Report {report_path.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
