#!/usr/bin/env python3
"""
Compare UK Energy Tracking V5 and V6 without modifying either app.

Purpose
-------
Generate a comprehensive comparison report for the V6 folder so the maintainer
can see exactly where V6 differs from the protected V5 reference before any
repair patch is attempted.

Output
------
uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT.md
"""

from __future__ import annotations

import difflib
import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
V5 = ROOT / "uk_energy_tracking_v5"
V6 = ROOT / "uk_energy_tracking_v6"
REPORT = V6 / "V5_V6_COMPARISON_REPORT.md"

TEXT_SUFFIXES = {".md", ".html", ".css", ".js", ".json", ".csv", ".txt", ".yml", ".yaml"}

REQUIRED_DOCS = [
    "AI_START_HERE.md",
    "ARCHITECTURE.md",
    "PHILOSOPHY.md",
    "LAUNCH_FREEZE.md",
    "README.md",
    "OPERATOR_MANUAL_V1.md",
    "WORKFLOW_REGISTRY.md",
    "REPOSITORY_SIZE_REPORT.md",
    "GIS_SLD_APP_ADDRESS_MAP.md",
    "GIS_SLD_V2_MODULAR_SITE_MAP.md",
    "GRIDBOT_FEATURE_INSTALL_INSTRUCTIONS.md",
    "uk_energy_tracking_v5/README.md",
    "uk_energy_tracking_v5/AI_RELOAD_INSTRUCTIONS.md",
]

PRICE_FEATURES = [
    ("price-history-canvas", "main price history canvas"),
    ("price-history-fullscreen-overlay", "full screen overlay"),
    ("price-history-fullscreen-canvas", "full screen canvas"),
    ("price-history-fullscreen-btn", "full screen button"),
    ("price-history-start", "start date control"),
    ("price-history-period", "period control"),
    ("price-history-year", "year control"),
    ("price-history-refresh", "refresh button"),
    ("price-history-period-back", "previous period button"),
    ("price-history-period-forward", "next period button"),
    ("price-history-fullscreen-period-back", "full screen previous period button"),
    ("price-history-fullscreen-period-forward", "full screen next period button"),
    ("price-history-range-status", "range status text"),
    ("ph-latest-price", "latest price card"),
    ("ph-latest-time", "latest time card"),
    ("ph-row-count", "visible record count card"),
    ("ph-source", "source card"),
    ("price-history-table-body", "captured records table body"),
]

BEHAVIOUR_TERMS = [
    ("seasonColor", "season colouring"),
    ("Winter", "winter label"),
    ("Spring", "spring label"),
    ("Summer", "summer label"),
    ("Autumn", "autumn label"),
    ("fullscreen", "full screen behaviour"),
    ("devicePixelRatio", "retina canvas scaling"),
    ("roundRect", "canvas rounded panels"),
    ("highAt", "daily high time"),
    ("lowAt", "daily low time"),
    ("average", "daily average"),
    ("settlementPeriod", "settlement period"),
    ("periodStartUTC", "CSV period start"),
    ("priceGBPperMWh", "price value field"),
    ("12hday", "12 hour day filter"),
    ("12hnight", "12 hour night filter"),
    ("6m", "6 month period"),
    ("12m", "12 month period"),
    ("10y", "10 year period"),
]

V5_PRICE_FILES = [
    "index.md",
    "price-history-ui.js",
    "price-history-ui.css",
    "price-history-fullscreen.js",
    "live-config.js",
    "live-app.js",
    "live-helpers.js",
]

V6_PRICE_FILES = [
    "index.md",
    "styles/app.css",
    "live_data_pipeline/live-config.js",
    "shared_helpers/dom_text/dom_text.js",
    "price_history_chart/load_price_history_data/load_price_history_data.js",
    "price_history_chart/render_price_chart/render_price_chart.js",
    "price_history_chart/control_price_history/control_price_history.js",
    "app_bootstrap/start_v6_app/start_v6_app.js",
]

@dataclass
class FileInfo:
    path: Path
    exists: bool
    size: int = 0
    lines: int = 0
    sha256: str = ""


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def file_info(path: Path) -> FileInfo:
    if not path.exists():
        return FileInfo(path=path, exists=False)
    data = path.read_bytes()
    text = data.decode("utf-8", errors="replace")
    return FileInfo(path=path, exists=True, size=len(data), lines=text.count("\n") + 1, sha256=hashlib.sha256(data).hexdigest()[:16])


def rel(path: Path) -> str:
    return str(path.relative_to(ROOT)).replace("\\", "/")


def list_files(base: Path) -> list[Path]:
    if not base.exists():
        return []
    return sorted(p for p in base.rglob("*") if p.is_file())


def extract_script_sources(text: str) -> list[str]:
    return re.findall(r"<script[^>]+src=[\"']([^\"']+)[\"']", text, flags=re.I)


def extract_stylesheets(text: str) -> list[str]:
    return re.findall(r"<link[^>]+rel=[\"']stylesheet[\"'][^>]+href=[\"']([^\"']+)[\"']", text, flags=re.I)


def extract_ids(text: str) -> set[str]:
    return set(re.findall(r"\bid=[\"']([^\"']+)[\"']", text))


def extract_classes(text: str) -> set[str]:
    classes: set[str] = set()
    for raw in re.findall(r"\bclass=[\"']([^\"']+)[\"']", text):
        for item in raw.split():
            classes.add(item.strip())
    return classes


def extract_functions(text: str) -> set[str]:
    names = set(re.findall(r"function\s+([A-Za-z0-9_$]+)\s*\(", text))
    names.update(re.findall(r"\b([A-Za-z0-9_$]+)\s*:\s*function\s*\(", text))
    names.update(re.findall(r"\b([A-Za-z0-9_$]+)\s*=\s*function\s*\(", text))
    return names


def contains_any(base: Path, names: Iterable[str], needle: str) -> list[str]:
    hits = []
    for name in names:
        path = base / name
        if path.exists() and path.suffix in TEXT_SUFFIXES:
            try:
                if needle in read_text(path):
                    hits.append(name)
            except OSError:
                pass
    return hits


def whole_app_text(base: Path) -> str:
    chunks = []
    for path in list_files(base):
        if path.suffix in {".md", ".html", ".css", ".js"}:
            try:
                chunks.append(f"\n/* FILE {rel(path)} */\n" + read_text(path))
            except OSError:
                pass
    return "\n".join(chunks)


def markdown_table(headers: list[str], rows: list[list[object]]) -> list[str]:
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join(["---"] * len(headers)) + "|"]
    for row in rows:
        out.append("| " + " | ".join(str(x).replace("\n", " ") for x in row) + " |")
    return out


def unified_snippet(a_name: str, a_text: str, b_name: str, b_text: str, limit: int = 220) -> list[str]:
    diff = list(difflib.unified_diff(
        a_text.splitlines(),
        b_text.splitlines(),
        fromfile=a_name,
        tofile=b_name,
        lineterm="",
    ))
    if len(diff) > limit:
        diff = diff[:limit] + [f"... diff truncated after {limit} lines ..."]
    return diff


def analyse_json(path: Path) -> dict[str, object]:
    if not path.exists():
        return {"exists": False}
    try:
        payload = json.loads(read_text(path))
    except Exception as exc:
        return {"exists": True, "error": str(exc)}
    rows = payload.get("rows") if isinstance(payload, dict) else None
    result: dict[str, object] = {"exists": True, "type": type(payload).__name__}
    if isinstance(rows, list):
        result["rows"] = len(rows)
        if rows:
            result["first"] = rows[0]
            result["last"] = rows[-1]
            result["keys"] = sorted(rows[0].keys()) if isinstance(rows[0], dict) else []
    return result


def main() -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    lines: list[str] = []
    lines.append("# UK Energy Tracking V5 to V6 Comprehensive Comparison Report")
    lines.append("")
    lines.append(f"Generated UTC: `{now}`")
    lines.append("")
    lines.append("## Purpose")
    lines.append("")
    lines.append("This report compares the protected V5 UK Energy Tracking application against the modular V6 application before any further V6 repair work. It is non destructive and does not patch either app.")
    lines.append("")

    lines.append("## Doctrine files checked")
    lines.append("")
    doc_rows = []
    for doc in REQUIRED_DOCS:
        info = file_info(ROOT / doc)
        doc_rows.append([doc, "yes" if info.exists else "no", info.lines if info.exists else "", info.sha256 if info.exists else ""])
    lines.extend(markdown_table(["Document", "Exists", "Lines", "SHA"], doc_rows))
    lines.append("")

    lines.append("## App folder inventory")
    lines.append("")
    v5_files = list_files(V5)
    v6_files = list_files(V6)
    lines.extend(markdown_table(["Folder", "Files", "Text files", "Total bytes"], [
        [rel(V5), len(v5_files), sum(1 for p in v5_files if p.suffix in TEXT_SUFFIXES), sum(p.stat().st_size for p in v5_files)],
        [rel(V6), len(v6_files), sum(1 for p in v6_files if p.suffix in TEXT_SUFFIXES), sum(p.stat().st_size for p in v6_files)],
    ]))
    lines.append("")

    lines.append("## Price history file presence")
    lines.append("")
    file_rows = []
    for name in V5_PRICE_FILES:
        info = file_info(V5 / name)
        file_rows.append(["V5", name, "yes" if info.exists else "no", info.lines if info.exists else "", info.size if info.exists else ""])
    for name in V6_PRICE_FILES:
        info = file_info(V6 / name)
        file_rows.append(["V6", name, "yes" if info.exists else "no", info.lines if info.exists else "", info.size if info.exists else ""])
    lines.extend(markdown_table(["App", "File", "Exists", "Lines", "Bytes"], file_rows))
    lines.append("")

    v5_index = read_text(V5 / "index.md") if (V5 / "index.md").exists() else ""
    v6_index = read_text(V6 / "index.md") if (V6 / "index.md").exists() else ""

    lines.append("## Page load order")
    lines.append("")
    script_rows = []
    for i, src in enumerate(extract_script_sources(v5_index), start=1):
        script_rows.append(["V5", i, src])
    for i, src in enumerate(extract_script_sources(v6_index), start=1):
        script_rows.append(["V6", i, src])
    lines.extend(markdown_table(["App", "Order", "Script source"], script_rows))
    lines.append("")

    lines.append("## Stylesheet load order")
    lines.append("")
    style_rows = []
    for i, href in enumerate(extract_stylesheets(v5_index), start=1):
        style_rows.append(["V5", i, href])
    for i, href in enumerate(extract_stylesheets(v6_index), start=1):
        style_rows.append(["V6", i, href])
    lines.extend(markdown_table(["App", "Order", "Stylesheet"], style_rows))
    lines.append("")

    v5_ids = extract_ids(v5_index)
    v6_ids = extract_ids(v6_index)
    lines.append("## DOM id parity")
    lines.append("")
    id_rows = []
    for ident, meaning in PRICE_FEATURES:
        id_rows.append([ident, meaning, "yes" if ident in v5_ids else "no", "yes" if ident in v6_ids else "no", "ok" if (ident in v5_ids) == (ident in v6_ids) else "mismatch"])
    missing_v6 = sorted(v5_ids - v6_ids)
    extra_v6 = sorted(v6_ids - v5_ids)
    lines.extend(markdown_table(["ID", "Meaning", "V5", "V6", "Status"], id_rows))
    lines.append("")
    lines.append(f"V5 ids missing from V6: `{len(missing_v6)}`")
    if missing_v6:
        lines.append("")
        lines.append(", ".join(f"`{x}`" for x in missing_v6[:120]))
    lines.append("")
    lines.append(f"V6 ids not present in V5: `{len(extra_v6)}`")
    if extra_v6:
        lines.append("")
        lines.append(", ".join(f"`{x}`" for x in extra_v6[:120]))
    lines.append("")

    v5_classes = extract_classes(v5_index)
    v6_classes = extract_classes(v6_index)
    class_missing = sorted(v5_classes - v6_classes)
    class_extra = sorted(v6_classes - v5_classes)
    lines.append("## CSS class parity from index files")
    lines.append("")
    lines.append(f"V5 classes missing from V6 index: `{len(class_missing)}`")
    if class_missing:
        lines.append("")
        lines.append(", ".join(f"`{x}`" for x in class_missing[:120]))
    lines.append("")
    lines.append(f"V6 classes not present in V5 index: `{len(class_extra)}`")
    if class_extra:
        lines.append("")
        lines.append(", ".join(f"`{x}`" for x in class_extra[:120]))
    lines.append("")

    v5_text = whole_app_text(V5)
    v6_text = whole_app_text(V6)
    lines.append("## Behaviour keyword parity")
    lines.append("")
    term_rows = []
    for term, meaning in BEHAVIOUR_TERMS:
        term_rows.append([term, meaning, v5_text.count(term), v6_text.count(term), "ok" if bool(v5_text.count(term)) == bool(v6_text.count(term)) else "mismatch"])
    lines.extend(markdown_table(["Term", "Meaning", "V5 count", "V6 count", "Presence status"], term_rows))
    lines.append("")

    lines.append("## Function name comparison")
    lines.append("")
    v5_functions = extract_functions(v5_text)
    v6_functions = extract_functions(v6_text)
    only_v5_functions = sorted(v5_functions - v6_functions)
    only_v6_functions = sorted(v6_functions - v5_functions)
    lines.append(f"Function names only in V5: `{len(only_v5_functions)}`")
    if only_v5_functions:
        lines.append("")
        lines.append(", ".join(f"`{x}`" for x in only_v5_functions[:160]))
    lines.append("")
    lines.append(f"Function names only in V6: `{len(only_v6_functions)}`")
    if only_v6_functions:
        lines.append("")
        lines.append(", ".join(f"`{x}`" for x in only_v6_functions[:160]))
    lines.append("")

    lines.append("## Data file comparison")
    lines.append("")
    data_targets = [
        "live_grid_energy.json",
        "live_grid_price.json",
        "live_oil_prices.json",
        "electricity_price_history_daily_decade.json",
        "electricity_price_history.csv",
    ]
    data_rows = []
    for name in data_targets:
        v5_info = analyse_json(V5 / name) if name.endswith(".json") else file_info(V5 / name).__dict__
        v6_info = analyse_json(V6 / name) if name.endswith(".json") else file_info(V6 / name).__dict__
        data_rows.append([name, json.dumps(v5_info, default=str)[:500], json.dumps(v6_info, default=str)[:500]])
    lines.extend(markdown_table(["Data file", "V5 summary", "V6 summary"], data_rows))
    lines.append("")

    lines.append("## Critical chart contract checks")
    lines.append("")
    contract_checks = [
        ("Raw chart must load published Elexon data only", "forecastRows:[]" in v6_text and "loadWindow" in v6_text),
        ("6 month mode should be full half hourly if required by current decision", "'6m'" in v6_text and "isDaily" in v6_text),
        ("12 month plus should preserve daily high average low", "highAt" in v6_text and "lowAt" in v6_text and "drawDailyLines" in v6_text),
        ("Full screen arrows should exist", "price-history-fullscreen-period-back" in v6_text and "price-history-fullscreen-period-forward" in v6_text),
        ("Bottom period arrows should exist", "price-history-period-back" in v6_text and "price-history-period-forward" in v6_text),
        ("Season colours should exist", all(x in v6_text for x in ["Winter", "Spring", "Summer", "Autumn"])),
        ("Latest time card should be written", "ph-latest-time" in v6_text),
        ("Table body should be written or consciously omitted", "price-history-table-body" in v6_text and ("innerHTML" in v6_text or "textContent" in v6_text)),
        ("Forecast renderer should not be wired into raw chart unless approved", "render_forecast_chart" not in v6_index),
    ]
    lines.extend(markdown_table(["Contract", "Pass"], [[name, "yes" if ok else "no"] for name, ok in contract_checks]))
    lines.append("")

    lines.append("## V5 to V6 direct file diff snippets")
    lines.append("")
    pairings = [
        (V5 / "index.md", V6 / "index.md"),
        (V5 / "price-history-ui.css", V6 / "styles" / "app.css"),
        (V5 / "price-history-ui.js", V6 / "price_history_chart" / "render_price_chart" / "render_price_chart.js"),
        (V5 / "price-history-ui.js", V6 / "price_history_chart" / "load_price_history_data" / "load_price_history_data.js"),
        (V5 / "price-history-ui.js", V6 / "price_history_chart" / "control_price_history" / "control_price_history.js"),
    ]
    for left, right in pairings:
        lines.append(f"### `{rel(left)}` versus `{rel(right)}`")
        lines.append("")
        if not left.exists() or not right.exists():
            lines.append("One side is missing.")
            lines.append("")
            continue
        diff = unified_snippet(rel(left), read_text(left), rel(right), read_text(right), limit=260)
        lines.append("```diff")
        lines.extend(diff)
        lines.append("```")
        lines.append("")

    lines.append("## Initial interpretation rules")
    lines.append("")
    lines.append("1. Do not patch V6 from this report automatically.")
    lines.append("2. First identify whether a missing feature is intentional modularisation or an accidental regression.")
    lines.append("3. Restore V5 behaviour before adding any new forecast or annotation feature.")
    lines.append("4. Prefer one small patch at a time after the comparison report has been reviewed.")
    lines.append("5. Preserve V5 as the reference twin.")
    lines.append("")

    REPORT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {REPORT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
