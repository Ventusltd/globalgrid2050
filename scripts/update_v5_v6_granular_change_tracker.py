#!/usr/bin/env python3
"""
Generate a granular V5 to V6 change tracker before major V6 upgrades.

This report is intentionally procedural. It records exactly which V6 files are
currently carrying the live price, fullscreen, selector, frequency and workflow
changes so the next upgrade does not overwrite working code blindly.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V5 = ROOT / "uk_energy_tracking_v5"
V6 = ROOT / "uk_energy_tracking_v6"
OUT = V6 / "V5_V6_GRANULAR_CHANGE_TRACKER.md"
REPORT_V2 = V6 / "V5_V6_COMPARISON_REPORT_V2.md"

WATCH_FILES = [
    "uk_energy_tracking_v6/index.md",
    "uk_energy_tracking_v6/styles/app.css",
    "uk_energy_tracking_v6/price_history_chart/load_price_history_data/load_price_history_data.js",
    "uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js",
    "uk_energy_tracking_v6/price_history_chart/control_price_history/control_price_history.js",
    "uk_energy_tracking_v6/price_history_chart/fullscreen_period_menu/fullscreen_period_menu.js",
    "uk_energy_tracking_v6/app_bootstrap/start_v6_app/start_v6_app.js",
    "uk_energy_tracking_v6/frequency_history/frequency-history-ui.js",
    "uk_energy_tracking_v6/live_data_pipeline/live-config.js",
    "scripts/repair_v6_inpage_chart_real_estate.py",
    "scripts/update_uk_frequency_v6.py",
    "scripts/update_v5_v6_granular_change_tracker.py",
    ".github/workflows/fetch_uk_energy_and_prices_v5.yml",
    ".github/workflows/fetch_uk_energy_and_prices_v6.yml",
    ".github/workflows/fetch_uk_frequency_v6.yml",
    ".github/workflows/repair_v6_inpage_chart_real_estate.yml",
    ".github/workflows/update_v5_v6_granular_change_tracker.yml",
]

CONTRACT_TOKENS = [
    ("V6 index loads current stylesheet cache bust", "styles/app.css?v=20260604toolbargrid1", "uk_energy_tracking_v6/index.md"),
    ("V6 index loads working renderer", "render_price_chart.js", "uk_energy_tracking_v6/index.md"),
    ("V6 index loads control script", "control_price_history.js", "uk_energy_tracking_v6/index.md"),
    ("V6 index loads custom fullscreen period menu", "fullscreen_period_menu.js", "uk_energy_tracking_v6/index.md"),
    ("V6 app starts custom fullscreen period menu", "V6FullscreenPeriodMenu.start", "uk_energy_tracking_v6/app_bootstrap/start_v6_app/start_v6_app.js"),
    ("Native fullscreen select is hidden by custom menu", "price-history-native-hidden", "uk_energy_tracking_v6/price_history_chart/fullscreen_period_menu/fullscreen_period_menu.js"),
    ("Custom menu uses black background", "background:#05070c", "uk_energy_tracking_v6/price_history_chart/fullscreen_period_menu/fullscreen_period_menu.js"),
    ("Custom menu uses cyan text", "color:#00ffff", "uk_energy_tracking_v6/price_history_chart/fullscreen_period_menu/fullscreen_period_menu.js"),
    ("Fullscreen toolbar hard override exists", "V6 hard override: fullscreen toolbar grid", "uk_energy_tracking_v6/styles/app.css"),
    ("In page portrait chart height is current", "height:63dvh", "uk_energy_tracking_v6/styles/app.css"),
    ("V6 renderer keeps high and low event boxes", "drawV5StyleEvents", "uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js"),
    ("V6 renderer keeps pointer helper", "function drawPointer", "uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js"),
    ("V6 frequency collector exists", "GlobalGrid2050 V6 UK grid frequency collector", "scripts/update_uk_frequency_v6.py"),
    ("V6 frequency workflow exists", "fetch_uk_frequency_v6", ".github/workflows/fetch_uk_frequency_v6.yml"),
    ("V6 price workflow scheduled", "cron: '2-59/5 * * * *'", ".github/workflows/fetch_uk_energy_and_prices_v6.yml"),
    ("V5 price workflow manual only", "workflow_dispatch", ".github/workflows/fetch_uk_energy_and_prices_v5.yml"),
]


def read(rel: str) -> str:
    path = ROOT / rel
    return path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16] if path.exists() else "missing"


def line_count(path: Path) -> int:
    if not path.exists():
        return 0
    return path.read_text(encoding="utf-8", errors="replace").count("\n") + 1


def table(headers: list[str], rows: list[list[object]]) -> list[str]:
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join(["---"] * len(headers)) + "|"]
    for row in rows:
        out.append("| " + " | ".join(str(x).replace("\n", " ") for x in row) + " |")
    return out


def git(cmd: list[str]) -> str:
    try:
        return subprocess.check_output(cmd, cwd=ROOT, text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return ""


def recent_commits_for(rel: str, limit: int = 6) -> str:
    result = git(["git", "log", f"-{limit}", "--date=short", "--pretty=format:%h %ad %s", "--", rel])
    return result.replace("\n", "<br>") if result else "not available"


def script_sources(index_text: str) -> list[str]:
    return re.findall(r"<script[^>]+src=[\"']([^\"']+)[\"']", index_text, flags=re.I)


def main() -> None:
    required = [
        ROOT / "AI_START_HERE.md",
        V6 / "V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
        V6 / "V5_V6_COMPARISON_REPORT.md",
        REPORT_V2,
    ]
    for path in required:
        if not path.exists():
            raise FileNotFoundError(f"Missing guardrail file: {path.relative_to(ROOT)}")

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    index_v5 = read("uk_energy_tracking_v5/index.md")
    index_v6 = read("uk_energy_tracking_v6/index.md")

    lines: list[str] = []
    lines += [
        "# V5 to V6 Granular Change Tracker",
        "",
        f"Generated UTC: `{now}`",
        "",
        "## Purpose",
        "",
        "This file records the current V6 implementation at a granular level before the next major upgrade. It is not a marketing document. It is a procedural guardrail so working V6 files are not overwritten by broad repairs.",
        "",
        "## Hard rule before next major upgrade",
        "",
        "1. Read this tracker first.",
        "2. Read `V5_V6_COMPARISON_REPORT_V2.md` second.",
        "3. Change one feature at a time.",
        "4. Do not rewrite the renderer, control script or app bootstrap unless the exact affected lines are named first.",
        "5. Any UI repair must state whether it affects in page mode, fullscreen mode or both.",
        "6. V5 remains a protected reference and must not be patched by V6 repair workflows.",
        "",
        "## Watched file inventory",
        "",
    ]

    file_rows = []
    for rel in WATCH_FILES:
        path = ROOT / rel
        file_rows.append([rel, "yes" if path.exists() else "no", line_count(path), sha(path), recent_commits_for(rel)])
    lines += table(["File", "Exists", "Lines", "SHA", "Recent commits touching file"], file_rows)

    lines += ["", "## Current script load order", ""]
    rows = []
    for i, src in enumerate(script_sources(index_v5), 1):
        rows.append(["V5", i, src])
    for i, src in enumerate(script_sources(index_v6), 1):
        rows.append(["V6", i, src])
    lines += table(["App", "Order", "Script source"], rows)

    lines += ["", "## Current V6 contract tokens", ""]
    token_rows = []
    for name, token, rel in CONTRACT_TOKENS:
        text = read(rel)
        token_rows.append([name, rel, token, "yes" if token in text else "no"])
    lines += table(["Check", "File", "Token", "Pass"], token_rows)

    lines += ["", "## Current fullscreen period selector implementation", ""]
    lines += [
        "The native `select` remains in `index.md` for state compatibility. The visible fullscreen dropdown is now a custom SCADA menu generated by `fullscreen_period_menu.js`. This avoids mobile Safari and browser native option menus forcing a white dropdown that cannot be reliably styled by CSS.",
        "",
        "Current expected behaviour:",
        "",
        "1. Closed menu uses black background and cyan text.",
        "2. Open menu uses black background and cyan text.",
        "3. Active option uses dark cyan highlight.",
        "4. Native select is hidden only in fullscreen custom menu context.",
        "5. The underlying native select value still drives the existing V6 period logic.",
        "",
    ]

    lines += ["## Current electricity chart UI implementation", ""]
    lines += [
        "In page portrait height is controlled by the last hard override in `app.css`. Current target is `63dvh` and `470px` minimum height.",
        "",
        "Fullscreen chart drawing is controlled by `render_price_chart.js`; the toolbar position and selector appearance are controlled by `app.css` plus `fullscreen_period_menu.js`.",
        "",
        "The renderer currently keeps V5 style high and low event boxes with red markers and pointer lines. The bottom summary box has been removed from the render path.",
        "",
    ]

    lines += ["## Current live data migration status", ""]
    workflow_rows = []
    for rel in [
        ".github/workflows/fetch_uk_energy_and_prices_v5.yml",
        ".github/workflows/fetch_uk_energy_and_prices_v6.yml",
        ".github/workflows/fetch_uk_frequency_v6.yml",
    ]:
        text = read(rel)
        workflow_rows.append([
            rel,
            "yes" if text else "no",
            "yes" if "schedule:" in text else "no",
            "yes" if "workflow_dispatch" in text else "no",
            "yes" if "update_uk_price_v5.py" in text else "no",
            "yes" if "update_uk_price_v6.py" in text else "no",
            "yes" if "update_uk_frequency_v6.py" in text else "no",
        ])
    lines += table(["Workflow", "Exists", "Scheduled", "Manual", "V5 price", "V6 price", "V6 frequency"], workflow_rows)

    lines += ["", "## Next major upgrade gate", ""]
    failed = [row[0] for row in token_rows if row[-1] != "yes"]
    if failed:
        lines += ["Do not start the next major upgrade until these checks are understood:", ""]
        lines += [f"{i + 1}. {item}" for i, item in enumerate(failed)]
    else:
        lines += [
            "All tracked V6 guardrail tokens are present.",
            "",
            "Next upgrade may proceed only as a new isolated feature with a named target file list and a rollback commit plan.",
        ]

    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
