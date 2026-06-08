#!/usr/bin/env python3
"""
GlobalGrid2050 all technology ECG MVP builder.

This keeps the ECG data for all technologies in one compact rolling hot tier file.
The browser should display only the selected technology from the dropdown.

Important rule:
The ECG hot tier must be built from recent source files only.
Historic archive files may feed daily and monthly candidate facts, but they must not be
allowed to inflate the rolling ECG file.
"""

from __future__ import annotations

import argparse
import json
from datetime import timedelta
from pathlib import Path

from build_generation_heartbeat_mvp import (
    ROOT,
    GEN_HISTORY,
    REPORT_DIR,
    REPORT_JSON_DIR,
    build_daily,
    build_monthly,
    load_all_rows,
    load_json_rows,
    stamp,
    utc_now,
    write_payload,
)

RECENT_ECG_SOURCES = [
    "uk_energy_tracking_v6/generation_history/generation_recent_halfhourly_30d.json",
    "uk_energy_tracking_v6/generation_history/generation_recent_30d_30min.json",
]


def build_all_tech_ecg(rows, days: int):
    if not rows:
        return []
    max_time = max(r["time"] for r in rows)
    start = max_time - timedelta(days=days)
    out = []
    for r in sorted(rows, key=lambda x: (x["technology"], x["time"])):
        if r["time"] < start:
            continue
        out.append({
            "time": r["time"].isoformat().replace("+00:00", "Z"),
            "technology": r["technology"],
            "generationMW": round(r["mw"], 3),
            "status": "candidate",
            "source": "recent ECG source candidate",
        })
    return out


def load_recent_ecg_rows():
    """Use only recent hot tier source files for the ECG.

    Prefer the existing high resolution recent file first because it gives the
    heartbeat effect. Fall back to the 30 minute file if the high resolution file
    is unavailable or empty.
    """
    audit = []
    for rel in RECENT_ECG_SOURCES:
        path = ROOT / rel
        if not path.exists():
            audit.append({"path": rel, "exists": False, "sizeBytes": 0, "rowsParsed": 0, "selected": False})
            continue
        rows = load_json_rows(path)
        audit.append({
            "path": rel,
            "exists": True,
            "sizeBytes": path.stat().st_size,
            "rowsParsed": len(rows),
            "selected": bool(rows),
        })
        if rows:
            return rows, rel, audit
    return [], None, audit


def render_report(report: dict) -> str:
    lines = [
        "# GlobalGrid2050 All Technology ECG MVP Report",
        "",
        f"Generated UTC: `{report['generatedUTC']}`",
        f"Mode: `{report['mode']}`",
        f"ECG days: `{report['ecgDays']}`",
        f"Rows parsed for daily and monthly candidates: `{report['rowsParsed']}`",
        f"Daily rows: `{report['dailyRows']}`",
        f"Monthly rows: `{report['monthlyRows']}`",
        f"Selected ECG source: `{report['ecgSourcePath'] or 'none'}`",
        f"Rows parsed for ECG source: `{report['ecgSourceRows']}`",
        f"All technology ECG rows: `{report['ecgRows']}`",
        "",
        "## Outputs",
        "",
    ]
    for item in report["outputs"]:
        lines.append(f"{item['path']}  {item['sizeBytes']} bytes")
    lines += ["", "## ECG source candidates", ""]
    for src in report["ecgSources"]:
        lines.append(f"{src['path']}  exists={src['exists']}  selected={src['selected']}  parsed {src['rowsParsed']} rows")
    lines += ["", "## Daily and monthly source files", ""]
    for src in report["sources"]:
        lines.append(f"{src['path']}  parsed {src['rowsParsed']} rows")
    lines += ["", "## Browser rule", "", report["browserRule"]]
    lines += ["", "## Notes", "", report["notes"]]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ecg-days", type=int, default=30)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--limit-sources", type=int, default=0)
    args = parser.parse_args()

    rows, source_audit = load_all_rows(args.limit_sources or None)
    ecg_rows, ecg_source_path, ecg_source_audit = load_recent_ecg_rows()

    daily = build_daily(rows)
    monthly = build_monthly(daily)
    ecg = build_all_tech_ecg(ecg_rows, args.ecg_days)

    daily_path = ROOT / "data" / "confirmed" / "generation_daily_candidate.json"
    monthly_path = ROOT / "data" / "confirmed" / "generation_monthly_candidate.json"
    ecg_path = GEN_HISTORY / f"generation_ecg_all_technologies_{args.ecg_days}d_candidate.json"

    outputs = []
    if args.apply:
        write_payload(daily_path, daily, "Generation daily candidate facts", source_audit)
        write_payload(monthly_path, monthly, "Generation monthly candidate facts", source_audit)
        write_payload(ecg_path, ecg, "Generation ECG candidate for all technologies", ecg_source_audit)
        for p in [daily_path, monthly_path, ecg_path]:
            outputs.append({"path": p.relative_to(ROOT).as_posix(), "sizeBytes": p.stat().st_size})

    report = {
        "schemaVersion": "0.2.0-candidate",
        "generatedUTC": utc_now(),
        "mode": "apply" if args.apply else "audit only",
        "ecgDays": args.ecg_days,
        "rowsParsed": len(rows),
        "dailyRows": len(daily),
        "monthlyRows": len(monthly),
        "ecgSourcePath": ecg_source_path,
        "ecgSourceRows": len(ecg_rows),
        "ecgRows": len(ecg),
        "ecgSources": ecg_source_audit,
        "sources": source_audit,
        "outputs": outputs,
        "browserRule": "The ECG hot tier stores all technologies for the rolling window. The chart must filter client side by selected technology and must not draw all technology traces by default.",
        "notes": "Candidate first. Daily and monthly facts may use wider repository source files. The ECG hot tier is restricted to recent source files only so historic archives do not inflate the live heartbeat file.",
    }

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    s = stamp()
    md_path = REPORT_DIR / f"GENERATION_ECG_ALL_TECH_MVP_{s}.md"
    js_path = REPORT_JSON_DIR / f"GENERATION_ECG_ALL_TECH_MVP_{s}.json"
    latest_md = REPORT_DIR / "GENERATION_ECG_ALL_TECH_MVP_LATEST.md"
    latest_js = REPORT_JSON_DIR / "GENERATION_ECG_ALL_TECH_MVP_LATEST.json"

    md_text = render_report(report)
    js_text = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    md_path.write_text(md_text, encoding="utf-8")
    js_path.write_text(js_text, encoding="utf-8")
    latest_md.write_text(md_text, encoding="utf-8")
    latest_js.write_text(js_text, encoding="utf-8")

    print(f"Parsed {len(rows)} rows for daily and monthly candidates")
    print(f"Daily candidate rows {len(daily)}")
    print(f"Monthly candidate rows {len(monthly)}")
    print(f"Selected ECG source {ecg_source_path or 'none'}")
    print(f"ECG source rows {len(ecg_rows)}")
    print(f"All technology ECG candidate rows {len(ecg)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
