#!/usr/bin/env python3
"""
Remove the entire optional/reference benchmark block from V6 and V7 GIS SLD.

Purpose:
- Remove benchmark UI from the main GIS SLD workflow.
- Remove irrelevant benchmark text from screen and print output.
- Preserve technical quantity summary, grid connection length, drawing, export and report sections.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "gridbot_reports"
REPORT = REPORTS / "remove_benchmark_block_from_v6_v7_gis_sld.md"

TARGETS = [
    ROOT / "solar-bess-topology-v6" / "gis-sld-financial-sandbox" / "index.html",
    ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox" / "index.html",
]

START_TOKENS = [
    '    <div class="benchmark-box">\n',
    '<div class="benchmark-box">\n',
]
END_TOKEN = '    <button class="btn draw-btn" id="btn_draw">⌖ DRAW NEAT GRID</button>'


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def remove_block(text: str) -> tuple[str, bool]:
    start = -1
    for token in START_TOKENS:
        start = text.find(token)
        if start != -1:
            break

    if start == -1:
        return text, False

    end = text.find(END_TOKEN, start)
    if end == -1:
        raise SystemExit("Benchmark block found but draw button end marker was not found")

    # Preserve the draw button and following content.
    new_text = text[:start].rstrip() + "\n\n" + text[end:]
    return new_text, True


def main() -> int:
    actions: list[str] = []

    for path in TARGETS:
        if not path.exists():
            raise SystemExit(f"Missing target: {path.relative_to(ROOT)}")

        text = read(path)
        new_text, changed = remove_block(text)

        # Final clean up in case a previous rename left benchmark wording elsewhere.
        for phrase in [
            "Custom Project X",
            "Optional Reference Benchmark",
            "Custom Reference Benchmark",
            "Reference Project",
            "Benchmark Name",
            "Reference Capacity (MW)",
            "Reference Module Count",
            "Implied Benchmark",
            "Optional benchmark",
        ]:
            if phrase in new_text:
                raise SystemExit(f"Refusing to leave benchmark phrase in {path.relative_to(ROOT)}: {phrase}")

        if changed:
            write(path, new_text)
            actions.append(f"removed benchmark block from {path.relative_to(ROOT)}")
        else:
            actions.append(f"benchmark block already absent from {path.relative_to(ROOT)}")

    REPORTS.mkdir(parents=True, exist_ok=True)
    timestamp = dt.datetime.now(dt.timezone.utc).isoformat()
    report = "\n".join([
        "# Remove Benchmark Block From V6 And V7 GIS SLD",
        "",
        f"UTC created: {timestamp}",
        "",
        "## Purpose",
        "",
        "Remove the whole benchmark section from the V6 and V7 GIS SLD Financial Sandbox because it was not useful in the main workflow and looked like placeholder content.",
        "",
        "## Actions",
        "",
        *[f"- {action}" for action in actions],
        "",
        "## Expected user facing change",
        "",
        "The benchmark card is gone. The interface now moves directly from Technical Quantity Summary to drawing/export and grid connection workflow content.",
        "",
    ])
    write(REPORT, report)
    print(f"Removed benchmark block. Report: {REPORT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
