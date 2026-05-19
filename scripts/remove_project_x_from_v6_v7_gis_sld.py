#!/usr/bin/env python3
"""
Remove placeholder Project X wording from V6 and V7 GIS SLD benchmark block.

Purpose:
- Replace demo style wording with professional optional benchmark wording.
- Keep the benchmark feature available.
- Avoid printing random placeholder names in PDF output.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "gridbot_reports"
REPORT = REPORTS / "remove_project_x_from_v6_v7_gis_sld.md"

TARGETS = [
    ROOT / "solar-bess-topology-v6" / "gis-sld-financial-sandbox" / "index.html",
    ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox" / "index.html",
]

REPLACEMENTS = {
    "Custom Reference Benchmark": "Optional Reference Benchmark",
    "Reference Project</label><input type=\"text\" id=\"ref_name\" value=\"Custom Project X\" style=\"width: 140px; text-align: left;\"/>": "Benchmark Name</label><input type=\"text\" id=\"ref_name\" value=\"\" placeholder=\"Optional benchmark\" style=\"width: 140px; text-align: left;\"/>",
    "Reference Project Custom Project X": "Benchmark Name Optional benchmark",
}


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def main() -> int:
    actions: list[str] = []

    for path in TARGETS:
        if not path.exists():
            raise SystemExit(f"Missing target: {path.relative_to(ROOT)}")

        text = read(path)
        original = text
        count = 0

        for old, new in REPLACEMENTS.items():
            occurrences = text.count(old)
            if occurrences:
                text = text.replace(old, new)
                count += occurrences

        if "Custom Project X" in text:
            text = text.replace("Custom Project X", "")
            count += 1

        if text != original:
            write(path, text)
            actions.append(f"patched {count} benchmark placeholder reference(s) in {path.relative_to(ROOT)}")
        else:
            actions.append(f"no benchmark placeholder changes required in {path.relative_to(ROOT)}")

    REPORTS.mkdir(parents=True, exist_ok=True)
    timestamp = dt.datetime.now(dt.timezone.utc).isoformat()
    report = "\n".join([
        "# Remove Project X From V6 And V7 GIS SLD",
        "",
        f"UTC created: {timestamp}",
        "",
        "## Purpose",
        "",
        "Remove the demo style `Custom Project X` default from the GIS SLD benchmark block and replace it with professional optional benchmark wording.",
        "",
        "## Actions",
        "",
        *[f"- {action}" for action in actions],
        "",
        "## Expected user facing change",
        "",
        "- `Custom Reference Benchmark` becomes `Optional Reference Benchmark`.",
        "- `Reference Project` becomes `Benchmark Name`.",
        "- The default project name is blank with placeholder text `Optional benchmark`.",
        "",
    ])
    write(REPORT, report)
    print(f"Removed Project X placeholder. Report: {REPORT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
