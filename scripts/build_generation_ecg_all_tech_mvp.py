#!/usr/bin/env python3
"""
GlobalGrid2050 all technology ECG MVP builder.

This keeps the ECG data for all technologies in one compact rolling hot tier file.
The browser should display only the selected technology from the dropdown.
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
    stamp,
    utc_now,
    write_payload,
)


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
            "source": "repository source candidate",
        })
    return out


def render_report(report: dict) -> str:
    lines = [
        "# GlobalGrid2050 All Technology ECG MVP Report",
        "",
        f"Generated UTC: `{report['generatedUTC']}`",
        f"Mode: `{report['mode']}`",
        f"ECG days: `{report['ecgDays']}`",
        f"Rows parsed: `{report['rowsParsed']}`",
        f"Daily rows: `{report['dailyRows']}`",
        f"Monthly rows: `{report['monthlyRows']}`",
        f"All technology ECG rows: `{report['ecgRows']}`",
        "",
        "## Outputs",
        "",
    ]
    for item in report["outputs"]:
        lines.append(f"{item['path']}  {item['sizeBytes']} bytes")
    lines += ["", "## Source files", ""]
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
    daily = build_daily(rows)
    monthly = build_monthly(daily)
    ecg = build_all_tech_ecg(rows, args.ecg_days)

    daily_path = ROOT / "data" / "confirmed" / "generation_daily_candidate.json"
    monthly_path = ROOT / "data" / "confirmed" / "generation_monthly_candidate.json"
    ecg_path = GEN_HISTORY / f"generation_ecg_all_technologies_{args.ecg_days}d_candidate.json"

    outputs = []
    if args.apply:
        write_payload(daily_path, daily, "Generation daily candidate facts", source_audit)
        write_payload(monthly_path, monthly, "Generation monthly candidate facts", source_audit)
        write_payload(ecg_path, ecg, "Generation ECG candidate for all technologies", source_audit)
        for p in [daily_path, monthly_path, ecg_path]:
            outputs.append({"path": p.relative_to(ROOT).as_posix(), "sizeBytes": p.stat().st_size})

    report = {
        "schemaVersion": "0.1.0-candidate",
        "generatedUTC": utc_now(),
        "mode": "apply" if args.apply else "audit only",
        "ecgDays": args.ecg_days,
        "rowsParsed": len(rows),
        "dailyRows": len(daily),
        "monthlyRows": len(monthly),
        "ecgRows": len(ecg),
        "sources": source_audit,
        "outputs": outputs,
        "browserRule": "The ECG hot tier stores all technologies for the rolling window. The chart must filter client side by selected technology and must not draw all technology traces by default.",
        "notes": "Candidate first. This does not promote confirmed data and does not overwrite production files. It proves the all technology hot tier ECG storage pattern while keeping browser display to one selected technology.",
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

    print(f"Parsed {len(rows)} rows")
    print(f"Daily candidate rows {len(daily)}")
    print(f"Monthly candidate rows {len(monthly)}")
    print(f"All technology ECG candidate rows {len(ecg)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
