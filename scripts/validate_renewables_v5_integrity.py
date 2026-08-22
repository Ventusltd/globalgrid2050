#!/usr/bin/env python3
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / "uk_renewables_pipeline"
FILES = {
    "v1": P / "dashboard.html",
    "v2": P / "dashboard_v2_2026-08-22.html",
    "v3": P / "dashboard_v3_live_2026-08-22.html",
    "v4": P / "dashboard_v4_live.html",
    "v5": P / "dashboard_v5_live.html",
}

errors = []
texts = {}
sizes = {}
for name, path in FILES.items():
    if not path.exists():
        errors.append(f"missing {name}: {path}")
        continue
    text = path.read_text(encoding="utf-8")
    texts[name] = text
    sizes[name] = len(text.encode("utf-8"))
    if "</html>" not in text.lower():
        errors.append(f"{name} missing closing </html>")

v5 = texts.get("v5", "")
required_v5 = {
    "Chart.js": "cdn.jsdelivr.net/npm/chart.js",
    "REPD master loader": "../dist/repd_master.json",
    "major-news loader": "../dist/major_project_news_v5.json",
    "three gauges": "id=\"g3\"",
    "technology filters": "data-tech=\"Solar\"",
    "status filters": "data-status=\"Operational\"",
    "county filter": "id=\"county\"",
    "site/operator search": "SEARCH OPERATOR OR SITE",
    "REPD table": "id=\"tbody\"",
    "CSV export": "EXPORT CSV",
    "news newspaper": "GLOBALGRID2050 <span>ENERGY DAILY</span>",
    "news signal column": "NEWS SIGNAL",
    "official status label": "REPD STATUS",
    "news/REPD disclaimer": "not REPD-confirmed",
    "mobile layout": "@media(max-width:768px)",
}
for label, token in required_v5.items():
    if token not in v5:
        errors.append(f"V5 missing required feature: {label}")

if "<iframe" in v5.lower():
    errors.append("V5 must be standalone; iframe detected")

# V2 is intentionally a historical iframe wrapper. V3/V4 are the relevant
# standalone predecessors for truncation comparison; V1 is the original full app.
if all(k in sizes for k in ("v1", "v2", "v3", "v4", "v5")):
    standalone_floor = int(min(sizes["v3"], sizes["v4"]) * 0.75)
    if sizes["v5"] < standalone_floor:
        errors.append(
            f"V5 suspiciously small: {sizes['v5']} bytes; "
            f"minimum 75% of smaller standalone V3/V4 = {standalone_floor}"
        )
    if sizes["v5"] <= sizes["v2"]:
        errors.append(
            f"V5 ({sizes['v5']} bytes) is not larger than historical V2 wrapper "
            f"({sizes['v2']} bytes)"
        )

report = {
    "files_bytes": sizes,
    "v2_role": "historical iframe wrapper around V1",
    "standalone_baseline": ["v1", "v3", "v4"],
    "v5_required_features": list(required_v5),
    "errors": errors,
}
print(json.dumps(report, indent=2))
if errors:
    sys.exit(1)
print("V5 integrity PASS: full standalone REPD + newspaper application retained.")
