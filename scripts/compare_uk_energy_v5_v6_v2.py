#!/usr/bin/env python3
"""
Generate V5 to V6 comparison report V2.

This is a current state report after the V6 repair workflows. It preserves the
original V5_V6_COMPARISON_REPORT.md as the first audit and writes a new V2
report with explicit change observations.
"""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V5 = ROOT / "uk_energy_tracking_v5"
V6 = ROOT / "uk_energy_tracking_v6"
OUT = V6 / "V5_V6_COMPARISON_REPORT_V2.md"

TEXT_SUFFIXES = {".md", ".html", ".css", ".js", ".json", ".csv", ".txt", ".yml", ".yaml"}

REQUIRED_READS = [
    "AI_START_HERE.md",
    "uk_energy_tracking_v6/V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
    "uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT.md",
]

V5_TO_V6_REPAIR_TOKENS = {
    "Oil trend range selector": "oil-range",
    "Oil trend canvas": "oil-trend-canvas",
    "Oil tooltip": "oil-tooltip",
    "Oil statistics grid": "oil-stats",
    "Petrol price card": "petrol-price",
    "Diesel price card": "diesel-price",
    "Fuel breakdown": "fuel-breakdown",
    "EV rapid price card": "ev-rapid-price",
    "EV ultra rapid price card": "ev-ultra-price",
    "Frequency script": "frequency-history-ui.js",
    "V6 fuel feed config": "fuel:",
    "V6 EV feed config": "evPrices:",
    "V6 oil history config": "oilHistory:",
    "Fullscreen swipe function": "attachFullscreenSwipe",
    "Fullscreen summary repair": "compactDateText",
    "Mobile readability repair": "mobile chart readability",
}

DATA_FILES = [
    "live_grid_energy.json",
    "live_grid_price.json",
    "live_oil_prices.json",
    "oil_price_history.geojson",
    "live_uk_fuel_prices.json",
    "ev_charging_prices.json",
    "grid_frequency_history.csv",
    "live_grid_frequency.json",
    "live_grid_frequency_weekly_health.json",
    "electricity_price_history_daily_decade.json",
    "electricity_price_history.csv",
]

CORE_IDS = [
    "price-history-canvas",
    "price-history-fullscreen-overlay",
    "price-history-fullscreen-canvas",
    "price-history-fullscreen-btn",
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


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16] if path.exists() else ""


def files(base: Path) -> list[Path]:
    return sorted(p for p in base.rglob("*") if p.is_file()) if base.exists() else []


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
    chunks = []
    for p in files(base):
        if p.suffix in {".md", ".html", ".css", ".js"}:
            chunks.append(read(p))
    return "\n".join(chunks)


def table(headers: list[str], rows: list[list[object]]) -> list[str]:
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join(["---"] * len(headers)) + "|"]
    for row in rows:
        out.append("| " + " | ".join(str(x).replace("\n", " ") for x in row) + " |")
    return out


def file_summary(path: Path) -> dict[str, object]:
    if not path.exists():
        return {"exists": False}
    result = {"exists": True, "bytes": path.stat().st_size, "sha": sha(path)}
    if path.suffix in TEXT_SUFFIXES:
        result["lines"] = read(path).count("\n") + 1
    if path.suffix == ".json":
        try:
            payload = json.loads(read(path))
            result["type"] = type(payload).__name__
            if isinstance(payload, dict):
                if isinstance(payload.get("rows"), list):
                    result["rows"] = len(payload["rows"])
                if isinstance(payload.get("history"), list):
                    result["history"] = len(payload["history"])
                if isinstance(payload.get("operators"), list):
                    result["operators"] = len(payload["operators"])
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


def status(ok: bool) -> str:
    return "fixed" if ok else "open"


def main() -> None:
    for rel in REQUIRED_READS:
        p = ROOT / rel
        if not p.exists():
            raise FileNotFoundError(f"Required guardrail file missing: {rel}")
        p.read_text(encoding="utf-8")

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    v5_index = read(V5 / "index.md")
    v6_index = read(V6 / "index.md")
    v5_text = whole(V5)
    v6_text = whole(V6)
    v5_ids = ids(v5_index)
    v6_ids = ids(v6_index)
    v5_classes = classes(v5_index)
    v6_classes = classes(v6_index)

    lines: list[str] = []
    lines += [
        "# UK Energy Tracking V5 to V6 Comparison Report V2",
        "",
        f"Generated UTC: `{now}`",
        "",
        "## Purpose",
        "",
        "This V2 report compares the protected V5 tracker against the current V6 tracker after the V6 restoration and mobile readability repair workflows. The original `V5_V6_COMPARISON_REPORT.md` remains preserved as the first audit snapshot.",
        "",
        "## Governance reads",
        "",
    ]
    lines += table(["File", "Exists", "SHA"], [[rel, "yes" if (ROOT / rel).exists() else "no", sha(ROOT / rel)] for rel in REQUIRED_READS])
    lines += ["", "## App inventory", ""]
    lines += table(["Folder", "Files", "Text files", "Total bytes"], [
        ["uk_energy_tracking_v5", len(files(V5)), sum(1 for p in files(V5) if p.suffix in TEXT_SUFFIXES), sum(p.stat().st_size for p in files(V5))],
        ["uk_energy_tracking_v6", len(files(V6)), sum(1 for p in files(V6) if p.suffix in TEXT_SUFFIXES), sum(p.stat().st_size for p in files(V6))],
    ])

    lines += ["", "## Current repair observations", ""]
    repair_rows = []
    for name, token in V5_TO_V6_REPAIR_TOKENS.items():
        present = token in v6_text or token in v6_index
        repair_rows.append([name, token, status(present)])
    lines += table(["Observation", "Token checked", "Current status"], repair_rows)

    fixed_count = sum(1 for _, token in V5_TO_V6_REPAIR_TOKENS.items() if token in v6_text or token in v6_index)
    lines += ["", f"Repair observation count fixed: `{fixed_count}` of `{len(V5_TO_V6_REPAIR_TOKENS)}`", ""]

    missing_v6 = sorted(v5_ids - v6_ids)
    extra_v6 = sorted(v6_ids - v5_ids)
    lines += ["## DOM id parity", ""]
    lines += table(["ID", "V5", "V6", "Status"], [[i, "yes" if i in v5_ids else "no", "yes" if i in v6_ids else "no", "ok" if i in v6_ids else "open"] for i in CORE_IDS])
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

    lines += ["", "## Current data file presence", ""]
    rows = []
    for name in DATA_FILES:
        rows.append([name, json.dumps(file_summary(V5 / name), default=str)[:600], json.dumps(file_summary(V6 / name), default=str)[:600]])
    lines += table(["Data file", "V5 summary", "V6 summary"], rows)

    contract_checks = [
        ("V6 raw chart remains based on loadWindow", "loadWindow" in v6_text and "forecastRows:[]" in v6_text),
        ("Fullscreen period arrows exist", "price-history-fullscreen-period-back" in v6_index and "price-history-fullscreen-period-forward" in v6_index),
        ("Fullscreen swipe is installed", "attachFullscreenSwipe" in v6_text),
        ("Mobile readability repair is installed", "mobile chart readability" in v6_text),
        ("Portrait summary compact date helper exists", "compactDateText" in v6_text),
        ("Landscape fullscreen no summary mode exists", "isLandscape" in v6_text and "if(isFull&&isLandscape)return" in v6_text),
        ("Road fuel rendering is installed", "renderFuelBreakdown" in v6_text),
        ("EV rendering is installed", "renderEvPrices" in v6_text),
        ("Oil trend rendering is installed", "drawOilTrend" in v6_text),
        ("Frequency script is loaded", "frequency-history-ui.js" in v6_index),
        ("Refresh chart button removed from index", 'id="price-history-refresh"' not in v6_index),
    ]
    lines += ["", "## Current V6 contract checks", ""]
    lines += table(["Contract", "Pass"], [[name, "yes" if ok else "no"] for name, ok in contract_checks])

    lines += ["", "## Current interpretation", ""]
    lines += [
        "1. V6 has moved from partial shell restoration to active functional restoration.",
        "2. Oil trend, road fuel, EV placeholder, frequency wiring, fullscreen swipe and mobile readability are now measurable V6 repair domains.",
        "3. `scada-mix` remains intentionally replaced by the V6 generation mix architecture rather than restored literally.",
        "4. `price-history-zoom-reset` remains the clearest optional open item from the original V5 ID gap.",
        "5. The comparison report should be regenerated after every structural V6 repair workflow, not edited by hand.",
        "",
    ]

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
