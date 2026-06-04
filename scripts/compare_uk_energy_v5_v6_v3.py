#!/usr/bin/env python3
"""
Generate UK Energy Tracking V5 to V6 Comparison Report V3.

V3 follows the existing naming convention:
- previous report: uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT_V2.md
- new report:      uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT_V3.md
- previous script: scripts/compare_uk_energy_v5_v6_v2.py
- new script:      scripts/compare_uk_energy_v5_v6_v3.py
- previous workflow: .github/workflows/compare_uk_energy_v5_v6_v2.yml
- new workflow:      .github/workflows/compare_uk_energy_v5_v6_v3.yml

The report explicitly compares the existing V2 report against the current repo state
before the next major V6 upgrade.
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
PREVIOUS_REPORT = V6 / "V5_V6_COMPARISON_REPORT_V2.md"
OUT = V6 / "V5_V6_COMPARISON_REPORT_V3.md"

TEXT_SUFFIXES = {".md", ".html", ".css", ".js", ".json", ".csv", ".txt", ".yml", ".yaml"}

REQUIRED_READS = [
    "AI_START_HERE.md",
    "uk_energy_tracking_v6/V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
    "uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT.md",
    "uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT_V2.md",
]

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
    "scripts/compare_uk_energy_v5_v6_v2.py",
    "scripts/compare_uk_energy_v5_v6_v3.py",
    "scripts/update_v5_v6_granular_change_tracker.py",
    "scripts/repair_v6_inpage_chart_real_estate.py",
    "scripts/update_uk_frequency_v6.py",
    ".github/workflows/compare_uk_energy_v5_v6_v2.yml",
    ".github/workflows/compare_uk_energy_v5_v6_v3.yml",
    ".github/workflows/update_v5_v6_granular_change_tracker.yml",
    ".github/workflows/fetch_uk_energy_and_prices_v5.yml",
    ".github/workflows/fetch_uk_energy_and_prices_v6.yml",
    ".github/workflows/fetch_uk_frequency_v6.yml",
    ".github/workflows/repair_v6_inpage_chart_real_estate.yml",
]

REPAIR_TOKENS = {
    "Oil trend range selector": "oil-range",
    "Oil trend canvas": "oil-trend-canvas",
    "Oil tooltip": "oil-tooltip",
    "Oil statistics grid": "oil-stats",
    "Petrol price card": "petrol-price",
    "Diesel price card": "diesel-price",
    "Fuel breakdown": "fuel-breakdown",
    "EV rapid price card": "ev-rapid-price",
    "EV ultra rapid price card": "ev-ultra-price",
    "Frequency script loaded": "frequency-history-ui.js",
    "V6 fuel feed config": "fuel:",
    "V6 EV feed config": "evPrices:",
    "V6 oil history config": "oilHistory:",
    "Fullscreen swipe function": "attachFullscreenSwipe",
    "Compact date helper": "compactDateText",
    "V5 style in-page event box helper": "function eventBox",
    "V5 style in-page pointer helper": "function drawPointer",
    "V5 fullscreen event text helper": "function eventText",
    "Split in-page event renderer": "function drawInPageEvents",
    "Split fullscreen event renderer": "function drawFullscreenEvents",
    "Fullscreen custom period menu": "V6FullscreenPeriodMenu",
    "Custom fullscreen period script loaded": "fullscreen_period_menu.js",
    "Native fullscreen select hidden by custom menu": "price-history-native-hidden",
    "Custom period menu black background": "background:#05070c",
    "Custom period menu cyan text": "color:#00ffff",
}

CORE_IDS = [
    "price-history-canvas",
    "price-history-fullscreen-overlay",
    "price-history-fullscreen-canvas",
    "price-history-fullscreen-btn",
    "price-history-fullscreen-period-select",
    "price-history-fullscreen-period-back",
    "price-history-fullscreen-period-forward",
    "price-history-start",
    "price-history-period",
    "price-history-year",
    "price-history-range-status",
    "ph-latest-price",
    "ph-latest-time",
    "ph-row-count",
    "ph-source",
    "price-history-table-body",
    "oil-range",
    "oil-trend-canvas",
    "oil-tooltip",
    "oil-stats",
    "petrol-price",
    "diesel-price",
    "fuel-breakdown",
    "ev-rapid-price",
    "ev-ultra-price",
]

DATA_FILES = [
    "live_grid_energy.json",
    "live_grid_price.json",
    "live_oil_prices.json",
    "oil_price_history.geojson",
    "live_uk_fuel_prices.json",
    "ev_charging_prices.json",
    "grid_frequency_history.csv",
    "live_grid_frequency.json",
    "grid_frequency_weekly_health.csv",
    "live_grid_frequency_weekly_health.json",
    "electricity_price_history_daily_decade.json",
    "electricity_price_history.csv",
]

WORKFLOW_FILES = [
    ".github/workflows/fetch_uk_energy_and_prices_v5.yml",
    ".github/workflows/fetch_uk_energy_and_prices_v6.yml",
    ".github/workflows/fetch_uk_frequency_v6.yml",
    ".github/workflows/compare_uk_energy_v5_v6_v2.yml",
    ".github/workflows/compare_uk_energy_v5_v6_v3.yml",
    ".github/workflows/update_v5_v6_granular_change_tracker.yml",
    ".github/workflows/diagnose_repair_v6_price_v5_ui_split.yml",
    ".github/workflows/repair_v6_inpage_chart_real_estate.yml",
]


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16] if path.exists() else "missing"


def files(base: Path) -> list[Path]:
    return sorted(p for p in base.rglob("*") if p.is_file()) if base.exists() else []


def line_count(path: Path) -> int:
    return read(path).count("\n") + 1 if path.exists() else 0


def ids(text: str) -> set[str]:
    return set(re.findall(r"\bid=[\"']([^\"']+)[\"']", text))


def classes(text: str) -> set[str]:
    out: set[str] = set()
    for raw in re.findall(r"\bclass=[\"']([^\"']+)[\"']", text):
        out.update(x.strip() for x in raw.split() if x.strip())
    return out


def scripts(text: str) -> list[str]:
    return re.findall(r"<script[^>]+src=[\"']([^\"']+)[\"']", text, flags=re.I)


def whole(base: Path) -> str:
    chunks: list[str] = []
    for p in files(base):
        if p.suffix in {".md", ".html", ".css", ".js", ".yml", ".yaml"}:
            chunks.append(read(p))
    return "\n".join(chunks)


def table(headers: list[str], rows: list[list[object]]) -> list[str]:
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join(["---"] * len(headers)) + "|"]
    for row in rows:
        out.append("| " + " | ".join(str(x).replace("\n", " ") for x in row) + " |")
    return out


def ok_text(value: bool) -> str:
    return "yes" if value else "no"


def status(value: bool) -> str:
    return "fixed" if value else "open"


def git(cmd: list[str]) -> str:
    try:
        return subprocess.check_output(cmd, cwd=ROOT, text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return ""


def recent_commits(rel: str, limit: int = 4) -> str:
    out = git(["git", "log", f"-{limit}", "--date=short", "--pretty=format:%h %ad %s", "--", rel])
    return out.replace("\n", "<br>") if out else "not available"


def file_summary(path: Path) -> dict[str, object]:
    if not path.exists():
        return {"exists": False}
    result: dict[str, object] = {"exists": True, "bytes": path.stat().st_size, "sha": sha(path)}
    if path.suffix in TEXT_SUFFIXES:
        result["lines"] = line_count(path)
    if path.suffix == ".json":
        try:
            payload = json.loads(read(path))
            result["type"] = type(payload).__name__
            if isinstance(payload, dict):
                for key in ["rows", "history", "operators"]:
                    if isinstance(payload.get(key), list):
                        result[key] = len(payload[key])
                if isinstance(payload.get("latest"), dict):
                    result["latest"] = payload["latest"]
        except Exception as exc:
            result["json_error"] = str(exc)
    if path.suffix == ".geojson":
        try:
            payload = json.loads(read(path))
            result["features"] = len(payload.get("features", [])) if isinstance(payload, dict) else None
        except Exception as exc:
            result["geojson_error"] = str(exc)
    return result


def previous_status_map(previous: str) -> dict[str, str]:
    result: dict[str, str] = {}
    for line in previous.splitlines():
        if not line.startswith("| ") or line.startswith("|---"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) >= 3:
            key = cells[0]
            value = cells[-1]
            if key and key not in {"Observation", "Check", "ID", "Contract", "Readiness check", "Workflow", "Data file", "Tracker or workflow", "File", "Folder", "App"}:
                result.setdefault(key, value)
    return result


def changed_summary(previous: dict[str, str], current_rows: list[list[object]]) -> list[list[object]]:
    out: list[list[object]] = []
    for row in current_rows:
        key = str(row[0])
        current = str(row[-1])
        old = previous.get(key, "not tracked in V2")
        movement = "same" if old == current else "changed"
        out.append([key, old, current, movement])
    return out


def main() -> None:
    for rel in REQUIRED_READS:
        path = ROOT / rel
        if not path.exists():
            raise FileNotFoundError(f"Required guardrail file missing: {rel}")
        read(path)

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    previous_report = read(PREVIOUS_REPORT)
    previous = previous_status_map(previous_report)
    v5_index = read(V5 / "index.md")
    v6_index = read(V6 / "index.md")
    v5_text = whole(V5)
    v6_text = whole(V6)
    render_text = read(V6 / "price_history_chart/render_price_chart/render_price_chart.js")
    v5_ids = ids(v5_index)
    v6_ids = ids(v6_index)
    v5_classes = classes(v5_index)
    v6_classes = classes(v6_index)

    lines: list[str] = []
    lines += [
        "# UK Energy Tracking V5 to V6 Comparison Report V3",
        "",
        f"Generated UTC: `{now}`",
        "",
        "## Purpose",
        "",
        "This is the V3 generated change tracker. It follows the V2 naming convention and explicitly compares the existing V2 report against the current repository state before the next major V6 upgrade.",
        "",
        "## Naming convention continuity",
        "",
    ]
    lines += table(["Item", "V2", "V3"], [
        ["Report", "uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT_V2.md", "uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT_V3.md"],
        ["Generator", "scripts/compare_uk_energy_v5_v6_v2.py", "scripts/compare_uk_energy_v5_v6_v3.py"],
        ["Workflow", ".github/workflows/compare_uk_energy_v5_v6_v2.yml", ".github/workflows/compare_uk_energy_v5_v6_v3.yml"],
    ])

    lines += ["", "## Governance reads", ""]
    lines += table(["File", "Exists", "SHA"], [[rel, ok_text((ROOT / rel).exists()), sha(ROOT / rel)] for rel in REQUIRED_READS])

    lines += ["", "## Previous report state", ""]
    generated = re.search(r"Generated UTC: `([^`]+)`", previous_report)
    lines += table(["Previous report", "Exists", "Generated UTC", "Lines", "SHA"], [[
        "uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT_V2.md",
        ok_text(PREVIOUS_REPORT.exists()),
        generated.group(1) if generated else "not found",
        line_count(PREVIOUS_REPORT),
        sha(PREVIOUS_REPORT),
    ]])

    lines += ["", "## Existing change tracker and workflow", ""]
    lines += table(["Tracker or workflow", "Exists", "SHA", "Purpose"], [
        ["uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT.md", ok_text((V6 / "V5_V6_COMPARISON_REPORT.md").exists()), sha(V6 / "V5_V6_COMPARISON_REPORT.md"), "Original baseline audit snapshot"],
        ["uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT_V2.md", ok_text(PREVIOUS_REPORT.exists()), sha(PREVIOUS_REPORT), "Previous generated current-state change tracker"],
        ["uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT_V3.md", ok_text(OUT.exists()), sha(OUT), "New generated current-state plus V2 delta tracker"],
        ["scripts/compare_uk_energy_v5_v6_v2.py", ok_text((ROOT / "scripts/compare_uk_energy_v5_v6_v2.py").exists()), sha(ROOT / "scripts/compare_uk_energy_v5_v6_v2.py"), "Regenerates V2"],
        ["scripts/compare_uk_energy_v5_v6_v3.py", ok_text((ROOT / "scripts/compare_uk_energy_v5_v6_v3.py").exists()), sha(ROOT / "scripts/compare_uk_energy_v5_v6_v3.py"), "Regenerates V3"],
        [".github/workflows/compare_uk_energy_v5_v6_v2.yml", ok_text((ROOT / ".github/workflows/compare_uk_energy_v5_v6_v2.yml").exists()), sha(ROOT / ".github/workflows/compare_uk_energy_v5_v6_v2.yml"), "Manual workflow to refresh V2"],
        [".github/workflows/compare_uk_energy_v5_v6_v3.yml", ok_text((ROOT / ".github/workflows/compare_uk_energy_v5_v6_v3.yml").exists()), sha(ROOT / ".github/workflows/compare_uk_energy_v5_v6_v3.yml"), "Manual workflow to refresh V3 and compare against V2"],
    ])

    lines += ["", "## App inventory", ""]
    lines += table(["Folder", "Files", "Text files", "Total bytes"], [
        ["uk_energy_tracking_v5", len(files(V5)), sum(1 for p in files(V5) if p.suffix in TEXT_SUFFIXES), sum(p.stat().st_size for p in files(V5))],
        ["uk_energy_tracking_v6", len(files(V6)), sum(1 for p in files(V6) if p.suffix in TEXT_SUFFIXES), sum(p.stat().st_size for p in files(V6))],
    ])

    repair_rows = []
    for name, token in REPAIR_TOKENS.items():
        present = token in v6_text or token in v6_index or token in render_text
        repair_rows.append([name, token, status(present)])
    lines += ["", "## Current repair observations", ""]
    lines += table(["Observation", "Token checked", "Current status"], repair_rows)
    fixed_count = sum(1 for row in repair_rows if row[-1] == "fixed")
    lines += ["", f"Repair observation count fixed: `{fixed_count}` of `{len(repair_rows)}`", ""]

    annotation_rows = [
        ["Only working V6 renderer loaded", "render_price_chart.js loaded and no clean replacement", ok_text("render_price_chart.js" in v6_index and "render_price_chart_v6_clean_boxes.js" not in v6_index)],
        ["Overlay workaround removed", "render_price_chart_box_overlay.js absent", ok_text("render_price_chart_box_overlay.js" not in v6_index)],
        ["Bottom summary draw call removed", "drawSummary call absent from render path", ok_text("drawSummary(g,s,q,w,h,pad,isFull,isLandscape);" not in render_text)],
        ["V5 in-page UI helper present", "function eventBox", ok_text("function eventBox" in render_text)],
        ["V5 in-page pointer helper present", "function drawPointer", ok_text("function drawPointer" in render_text)],
        ["Fullscreen SCADA period menu loaded", "fullscreen_period_menu.js", ok_text("fullscreen_period_menu.js" in v6_index)],
        ["Fullscreen SCADA period menu started", "V6FullscreenPeriodMenu.start", ok_text("V6FullscreenPeriodMenu.start" in read(V6 / "app_bootstrap/start_v6_app/start_v6_app.js"))],
        ["Native select retained for state", "price-history-fullscreen-period-select", ok_text("price-history-fullscreen-period-select" in v6_index)],
        ["Native select hidden by custom menu", "price-history-native-hidden", ok_text("price-history-native-hidden" in v6_text)],
        ["V5 files not targeted by V6 repair scripts", "diagnostic scripts read V5 only", ok_text("V5 /" in read(ROOT / "scripts/diagnose_repair_v6_price_v5_ui_split.py") if (ROOT / "scripts/diagnose_repair_v6_price_v5_ui_split.py").exists() else False)],
    ]
    lines += ["", "## Annotation and UI migration tracker", ""]
    lines += table(["Check", "Evidence", "Pass"], annotation_rows)

    lines += ["", "## V2 report versus current repo state", ""]
    delta_rows = changed_summary(previous, repair_rows) + changed_summary(previous, annotation_rows)
    lines += table(["Check", "V2 recorded state", "Current state", "Movement"], delta_rows)

    missing_v6 = sorted(v5_ids - v6_ids)
    extra_v6 = sorted(v6_ids - v5_ids)
    lines += ["", "## DOM id parity", ""]
    lines += table(["ID", "V5", "V6", "Status"], [[i, ok_text(i in v5_ids), ok_text(i in v6_ids), "ok" if i in v6_ids else "open"] for i in CORE_IDS])
    lines += ["", f"All V5 IDs still missing from V6: `{len(missing_v6)}`", ""]
    if missing_v6:
        lines.append(", ".join(f"`{x}`" for x in missing_v6[:160]))
        lines.append("")
    lines += [f"V6 IDs not present in V5: `{len(extra_v6)}`", ""]
    if extra_v6:
        lines.append(", ".join(f"`{x}`" for x in extra_v6[:160]))
        lines.append("")

    class_missing = sorted(v5_classes - v6_classes)
    class_extra = sorted(v6_classes - v5_classes)
    lines += ["## CSS class parity from index files", ""]
    lines += [f"V5 classes still missing from V6 index: `{len(class_missing)}`", ""]
    if class_missing:
        lines.append(", ".join(f"`{x}`" for x in class_missing[:160]))
        lines.append("")
    lines += [f"V6 classes not present in V5 index: `{len(class_extra)}`", ""]
    if class_extra:
        lines.append(", ".join(f"`{x}`" for x in class_extra[:160]))
        lines.append("")

    lines += ["## Page load order", ""]
    script_rows = []
    for i, src in enumerate(scripts(v5_index), 1):
        script_rows.append(["V5", i, src])
    for i, src in enumerate(scripts(v6_index), 1):
        script_rows.append(["V6", i, src])
    lines += table(["App", "Order", "Script source"], script_rows)

    lines += ["", "## Workflow comparison", ""]
    wf_rows = []
    for rel in WORKFLOW_FILES:
        text = read(ROOT / rel)
        wf_rows.append([rel, ok_text(bool(text)), "schedule" if "schedule:" in text else "manual only", "update_uk_price_v5.py" in text, "update_uk_price_v6.py" in text, "update_uk_frequency_v6.py" in text])
    lines += table(["Workflow", "Exists", "Trigger", "Runs V5 price", "Runs V6 price", "Runs V6 frequency"], wf_rows)

    lines += ["", "## Current data file presence", ""]
    data_rows = []
    summaries: dict[str, tuple[dict[str, object], dict[str, object]]] = {}
    for name in DATA_FILES:
        v5_sum = file_summary(V5 / name)
        v6_sum = file_summary(V6 / name)
        summaries[name] = (v5_sum, v6_sum)
        data_rows.append([name, json.dumps(v5_sum, default=str)[:600], json.dumps(v6_sum, default=str)[:600]])
    lines += table(["Data file", "V5 summary", "V6 summary"], data_rows)

    v6_csv_lines = int(summaries["electricity_price_history.csv"][1].get("lines", 0) or 0)
    v5_csv_lines = int(summaries["electricity_price_history.csv"][0].get("lines", 0) or 0)
    v6_decade_rows = int(summaries["electricity_price_history_daily_decade.json"][1].get("rows", 0) or 0)
    v6_frequency_exists = bool(summaries["live_grid_frequency.json"][1].get("exists"))

    contract_checks = [
        ["V6 raw chart remains based on loadWindow", "loadWindow plus forecastRows empty", ok_text("loadWindow" in v6_text and "forecastRows:[]" in v6_text)],
        ["Fullscreen period arrows exist", "fullscreen previous and forward IDs", ok_text("price-history-fullscreen-period-back" in v6_index and "price-history-fullscreen-period-forward" in v6_index)],
        ["Fullscreen swipe is installed", "attachFullscreenSwipe", ok_text("attachFullscreenSwipe" in v6_text)],
        ["Fullscreen SCADA period menu exists", "fullscreen_period_menu.js plus V6FullscreenPeriodMenu", ok_text("fullscreen_period_menu.js" in v6_index and "V6FullscreenPeriodMenu" in v6_text)],
        ["Road fuel rendering is installed", "renderFuelBreakdown", ok_text("renderFuelBreakdown" in v6_text)],
        ["EV rendering is installed", "renderEvPrices", ok_text("renderEvPrices" in v6_text)],
        ["Oil trend rendering is installed", "drawOilTrend", ok_text("drawOilTrend" in v6_text)],
        ["Frequency script is loaded", "frequency-history-ui.js", ok_text("frequency-history-ui.js" in v6_index)],
        ["V6 frequency live file exists", "live_grid_frequency.json", ok_text(v6_frequency_exists)],
        ["Refresh chart button removed from index", "price-history-refresh absent", ok_text('id="price-history-refresh"' not in v6_index)],
        ["V6 overlay workaround absent", "render_price_chart_box_overlay absent", ok_text("render_price_chart_box_overlay.js" not in v6_index)],
    ]
    lines += ["", "## Current V6 contract checks", ""]
    lines += table(["Contract", "Evidence", "Pass"], contract_checks)

    migration_checks = [
        ["V6 price workflow exists", ".github/workflows/fetch_uk_energy_and_prices_v6.yml", ok_text((ROOT / ".github/workflows/fetch_uk_energy_and_prices_v6.yml").exists())],
        ["V6 price workflow is scheduled", "schedule block in V6 workflow", ok_text("schedule:" in read(ROOT / ".github/workflows/fetch_uk_energy_and_prices_v6.yml"))],
        ["V5 price workflow is manual only", "no schedule block in V5 workflow", ok_text("schedule:" not in read(ROOT / ".github/workflows/fetch_uk_energy_and_prices_v5.yml"))],
        ["V6 workflow runs price updater", "update_uk_price_v6.py", ok_text("update_uk_price_v6.py" in read(ROOT / ".github/workflows/fetch_uk_energy_and_prices_v6.yml"))],
        ["V6 workflow commits V6 price history files", "git add V6 price files", ok_text("uk_energy_tracking_v6/electricity_price_history.csv" in read(ROOT / ".github/workflows/fetch_uk_energy_and_prices_v6.yml"))],
        ["V6 live price JSON exists", "live_grid_price.json", ok_text(bool(summaries["live_grid_price.json"][1].get("exists")))],
        ["V6 decade daily price history exists", "daily decade rows >= 3650", ok_text(v6_decade_rows >= 3650)],
        ["V6 short price CSV is populated comparably to V5", f"V6 lines {v6_csv_lines}, V5 lines {v5_csv_lines}", ok_text(v6_csv_lines >= max(10, min(v5_csv_lines, 50)))],
        ["V6 renderer is current and single path", "working renderer only", ok_text("render_price_chart.js" in v6_index and "render_price_chart_box_overlay.js" not in v6_index and "render_price_chart_v6_clean_boxes.js" not in v6_index)],
    ]
    lines += ["", "## Live price migration readiness", ""]
    lines += table(["Readiness check", "Evidence", "Pass"], migration_checks)

    lines += ["", "## Watched files for next major upgrade", ""]
    watched_rows = []
    for rel in WATCH_FILES:
        path = ROOT / rel
        watched_rows.append([rel, ok_text(path.exists()), line_count(path), sha(path), recent_commits(rel)])
    lines += table(["File", "Exists", "Lines", "SHA", "Recent commits touching file"], watched_rows)

    blockers = [row[0] for row in migration_checks if row[2] != "yes"]
    lines += ["", "## Live price migration decision note", ""]
    if blockers:
        lines += ["Open blockers before declaring V6 migration fully clean:", ""]
        lines += [f"{i + 1}. {item}" for i, item in enumerate(blockers)]
    else:
        lines += [
            "V6 has passed the generated readiness checks for the live price fetch migration.",
            "",
            "Next procedural step: do not combine the next analytics upgrade with UI repairs. Generate the price statistics JSON first, then add the collapsed panel in a separate controlled commit.",
        ]

    failed_contracts = [row[0] for row in contract_checks if row[2] != "yes"]
    lines += ["", "## Next major upgrade gate", ""]
    if failed_contracts:
        lines += ["Do not begin the next major V6 upgrade until these current contract checks are understood:", ""]
        lines += [f"{i + 1}. {item}" for i, item in enumerate(failed_contracts)]
    else:
        lines += [
            "All tracked V6 contract checks pass in the generated V3 report.",
            "",
            "Proceed one feature at a time with exact target files and a rollback commit plan.",
        ]

    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
