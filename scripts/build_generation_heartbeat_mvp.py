#!/usr/bin/env python3
"""
GlobalGrid2050 generation heartbeat MVP builder.

Purpose:
Build compact candidate generation intelligence from existing repository source files.
This is deliberately candidate first. It writes derived facts and audit reports.
It does not require the browser to load raw historic bulk.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from statistics import median
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
REPORT_DIR = ROOT / "data_science_protocol" / "audit_reports"
REPORT_JSON_DIR = REPORT_DIR / "json"

DATA_CONFIRMED = ROOT / "data" / "confirmed"
GEN_HISTORY = ROOT / "uk_energy_tracking_v6" / "generation_history"

SOURCE_CANDIDATES = [
    "uk_energy_tracking_v6/generation_history/generation_recent_halfhourly_30d.json",
    "uk_energy_tracking_v6/generation_history/generation_recent_30d_30min.json",
    "data/generation/elexon_generation_sources_half_hourly.csv",
    "data/generation/elexon_generation_sources_2026.csv",
    "data/generation/elexon_generation_sources_2025.csv",
]

SOURCE_GLOBS = [
    "data/generation/archive/**/*.csv",
]

TECH_MAP = {
    "solar": "Solar",
    "wind": "Wind",
    "wind offshore": "Wind",
    "wind onshore": "Wind",
    "offshore wind": "Wind",
    "onshore wind": "Wind",
    "hydro": "Hydro",
    "hydro pumped storage": "Pumped Storage",
    "pumped storage": "Pumped Storage",
    "gas": "Gas",
    "ccgt": "Gas",
    "ocgt": "Gas",
    "coal": "Coal",
    "biomass": "Biomass",
    "nuclear": "Nuclear",
    "imports": "Imports & Exports",
    "import": "Imports & Exports",
    "exports": "Imports & Exports",
    "export": "Imports & Exports",
    "other": "Other",
}

TIME_FIELDS = [
    "time",
    "ts",
    "timestamp",
    "datetime",
    "periodStartUTC",
    "settlementPeriodStartUTC",
    "startTime",
    "startTimeUTC",
    "localTime",
]

TECH_FIELDS = [
    "technology",
    "fuelType",
    "fuel_type",
    "generationType",
    "psrType",
    "fuel",
    "type",
]

MW_FIELDS = [
    "generationMW",
    "mw",
    "MW",
    "generation_mw",
    "quantityMW",
    "quantity",
    "value",
    "generation",
]

NON_WIDE_FIELDS = set(TIME_FIELDS + TECH_FIELDS + MW_FIELDS + [
    "settlementDate",
    "settlementPeriod",
    "period",
    "source",
    "status",
    "method",
    "capturedAtUTC",
    "fetchedAtUTC",
])


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def parse_time(value: Any) -> datetime | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        if text.endswith("Z"):
            return datetime.fromisoformat(text.replace("Z", "+00:00")).astimezone(timezone.utc)
        dt = datetime.fromisoformat(text.replace(" ", "T"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def parse_settlement_time(row: dict[str, Any]) -> datetime | None:
    for field in TIME_FIELDS:
        if field in row and row[field]:
            t = parse_time(row[field])
            if t:
                return t
    date_text = str(row.get("settlementDate") or row.get("date") or "").strip()
    sp_text = str(row.get("settlementPeriod") or row.get("period") or "").strip()
    if not date_text or not sp_text:
        return None
    try:
        sp = int(float(sp_text))
        base = datetime.fromisoformat(date_text[:10]).replace(tzinfo=timezone.utc)
        return base + timedelta(minutes=(sp - 1) * 30)
    except Exception:
        return None


def normalise_tech(value: Any) -> str:
    raw = str(value or "Other").strip()
    key = raw.lower().replace("_", " ").replace("-", " ")
    key = " ".join(key.split())
    return TECH_MAP.get(key, raw.title() if raw else "Other")


def to_float(value: Any) -> float | None:
    try:
        if value is None or str(value).strip() == "":
            return None
        v = float(str(value).replace(",", ""))
        if math.isfinite(v):
            return v
    except Exception:
        return None
    return None


def discover_sources() -> list[Path]:
    paths: list[Path] = []
    for rel in SOURCE_CANDIDATES:
        p = ROOT / rel
        if p.exists() and p.is_file():
            paths.append(p)
    for pattern in SOURCE_GLOBS:
        paths.extend(sorted(ROOT.glob(pattern)))
    seen = set()
    out = []
    for p in paths:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out


def row_from_json(obj: dict[str, Any], source: Path) -> list[dict[str, Any]]:
    t = parse_settlement_time(obj)
    if not t:
        return []
    tech = None
    for field in TECH_FIELDS:
        if obj.get(field):
            tech = obj.get(field)
            break
    mw = None
    for field in MW_FIELDS:
        if field in obj:
            mw = to_float(obj.get(field))
            if mw is not None:
                break
    if tech is not None and mw is not None:
        return [{"time": t, "technology": normalise_tech(tech), "mw": mw, "sourcePath": source.as_posix()}]
    rows = []
    for key, value in obj.items():
        if key in NON_WIDE_FIELDS:
            continue
        val = to_float(value)
        if val is not None:
            rows.append({"time": t, "technology": normalise_tech(key), "mw": val, "sourcePath": source.as_posix()})
    return rows


def load_json_rows(path: Path) -> list[dict[str, Any]]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8", errors="replace"))
    except Exception:
        return []
    src_rows = payload.get("rows", []) if isinstance(payload, dict) else payload
    if not isinstance(src_rows, list):
        return []
    out = []
    for obj in src_rows:
        if isinstance(obj, dict):
            out.extend(row_from_json(obj, path.relative_to(ROOT)))
    return out


def load_csv_rows(path: Path) -> list[dict[str, Any]]:
    out = []
    try:
        with path.open("r", encoding="utf-8", errors="replace", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                t = parse_settlement_time(row)
                if not t:
                    continue
                tech = None
                for field in TECH_FIELDS:
                    if row.get(field):
                        tech = row.get(field)
                        break
                mw = None
                for field in MW_FIELDS:
                    if field in row:
                        mw = to_float(row.get(field))
                        if mw is not None:
                            break
                if tech is not None and mw is not None:
                    out.append({"time": t, "technology": normalise_tech(tech), "mw": mw, "sourcePath": path.relative_to(ROOT).as_posix()})
                    continue
                for key, value in row.items():
                    if key in NON_WIDE_FIELDS:
                        continue
                    val = to_float(value)
                    if val is not None:
                        out.append({"time": t, "technology": normalise_tech(key), "mw": val, "sourcePath": path.relative_to(ROOT).as_posix()})
    except Exception:
        return []
    return out


def load_all_rows(limit_sources: int | None = None) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    all_rows = []
    audit = []
    sources = discover_sources()
    if limit_sources:
        sources = sources[:limit_sources]
    for path in sources:
        before = len(all_rows)
        if path.suffix.lower() == ".json":
            rows = load_json_rows(path)
        elif path.suffix.lower() == ".csv":
            rows = load_csv_rows(path)
        else:
            rows = []
        all_rows.extend(rows)
        size = path.stat().st_size if path.exists() else 0
        audit.append({
            "path": path.relative_to(ROOT).as_posix(),
            "sizeBytes": size,
            "rowsParsed": len(all_rows) - before,
        })
    return all_rows, audit


def infer_interval_hours(rows: list[dict[str, Any]]) -> dict[str, float]:
    by_tech: defaultdict[str, list[datetime]] = defaultdict(list)
    for r in rows:
        by_tech[r["technology"]].append(r["time"])
    intervals = {}
    for tech, times in by_tech.items():
        uniq = sorted(set(times))
        diffs = []
        for a, b in zip(uniq, uniq[1:]):
            minutes = (b - a).total_seconds() / 60
            if 0 < minutes <= 180:
                diffs.append(minutes)
        if diffs:
            intervals[tech] = round(median(diffs) / 60, 6)
        else:
            intervals[tech] = 0.5
    return intervals


def build_daily(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    intervals = infer_interval_hours(rows)
    groups: defaultdict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for r in rows:
        groups[(r["time"].date().isoformat(), r["technology"])].append(r)
    out = []
    for (date, tech), vals in sorted(groups.items()):
        mws = [v["mw"] for v in vals]
        high = max(vals, key=lambda v: v["mw"])
        low = min(vals, key=lambda v: v["mw"])
        ih = intervals.get(tech, 0.5)
        expected = round(24 / ih) if ih else 48
        actual = len(vals)
        mwh = sum(v["mw"] * ih for v in vals)
        out.append({
            "date": date,
            "technology": tech,
            "highMW": round(high["mw"], 3),
            "averageMW": round(sum(mws) / len(mws), 3),
            "lowMW": round(low["mw"], 3),
            "highTimeUTC": high["time"].isoformat().replace("+00:00", "Z"),
            "lowTimeUTC": low["time"].isoformat().replace("+00:00", "Z"),
            "mwh": round(mwh, 3),
            "periodCount": actual,
            "expectedPeriodCount": expected,
            "completeness": round(min(1.0, actual / expected), 4) if expected else 0,
            "status": "candidate",
            "source": "repository source candidate",
            "method": "derived daily high average low and MWh from parsed generation rows",
        })
    return out


def build_monthly(daily: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: defaultdict[tuple[int, int, str], list[dict[str, Any]]] = defaultdict(list)
    for r in daily:
        y, m = [int(x) for x in r["date"].split("-")[:2]]
        groups[(y, m, r["technology"])].append(r)
    out = []
    for (year, month, tech), vals in sorted(groups.items()):
        mwh = sum(float(v.get("mwh") or 0) for v in vals)
        high = max(vals, key=lambda v: float(v.get("highMW") or 0))
        low = min(vals, key=lambda v: float(v.get("lowMW") or 0))
        period_count = sum(int(v.get("periodCount") or 0) for v in vals)
        expected = sum(int(v.get("expectedPeriodCount") or 0) for v in vals)
        hours = expected * 0.5 if expected else len(vals) * 24
        avg = mwh / hours if hours else 0
        out.append({
            "year": year,
            "month": month,
            "technology": tech,
            "mwh": round(mwh, 3),
            "twh": round(mwh / 1_000_000, 6),
            "averageMW": round(avg, 3),
            "peakMW": high.get("highMW"),
            "lowMW": low.get("lowMW"),
            "peakTimeUTC": high.get("highTimeUTC"),
            "lowTimeUTC": low.get("lowTimeUTC"),
            "periodCount": period_count,
            "expectedPeriodCount": expected,
            "completeness": round(min(1.0, period_count / expected), 4) if expected else 0,
            "status": "candidate",
            "source": "repository source candidate",
            "method": "monthly MWh additive aggregation from daily candidate facts",
        })
    return out


def build_ecg(rows: list[dict[str, Any]], technology: str, days: int) -> list[dict[str, Any]]:
    if not rows:
        return []
    tech_norm = normalise_tech(technology)
    max_time = max(r["time"] for r in rows)
    start = max_time - timedelta(days=days)
    out = []
    for r in sorted(rows, key=lambda x: x["time"]):
        if r["technology"] != tech_norm:
            continue
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


def write_payload(path: Path, rows: list[dict[str, Any]], title: str, source_audit: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schemaVersion": "0.1.0-candidate",
        "generatedUTC": utc_now(),
        "title": title,
        "status": "candidate",
        "timezone": "UTC",
        "sourceDatasets": source_audit,
        "rows": rows,
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def render_report(report: dict[str, Any]) -> str:
    lines = [
        "# GlobalGrid2050 Generation Heartbeat MVP Report",
        "",
        f"Generated UTC: `{report['generatedUTC']}`",
        f"Mode: `{report['mode']}`",
        f"Technology: `{report['technology']}`",
        f"Rows parsed: `{report['rowsParsed']}`",
        f"Daily rows: `{report['dailyRows']}`",
        f"Monthly rows: `{report['monthlyRows']}`",
        f"ECG rows: `{report['ecgRows']}`",
        "",
        "## Outputs",
        "",
    ]
    for item in report["outputs"]:
        lines.append(f"{item['path']}  {item['sizeBytes']} bytes")
    lines += ["", "## Source files", ""]
    for src in report["sources"]:
        lines.append(f"{src['path']}  parsed {src['rowsParsed']} rows")
    lines += ["", "## Notes", "", report["notes"]]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--technology", default="Wind")
    parser.add_argument("--ecg-days", type=int, default=30)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--limit-sources", type=int, default=0)
    args = parser.parse_args()

    rows, source_audit = load_all_rows(args.limit_sources or None)
    daily = build_daily(rows)
    monthly = build_monthly(daily)
    ecg = build_ecg(rows, args.technology, args.ecg_days)

    daily_path = DATA_CONFIRMED / "generation_daily_candidate.json"
    monthly_path = DATA_CONFIRMED / "generation_monthly_candidate.json"
    ecg_path = GEN_HISTORY / f"generation_ecg_{args.technology.lower().replace(' ', '_')}_{args.ecg_days}d_candidate.json"

    outputs = []
    if args.apply:
        write_payload(daily_path, daily, "Generation daily candidate facts", source_audit)
        write_payload(monthly_path, monthly, "Generation monthly candidate facts", source_audit)
        write_payload(ecg_path, ecg, f"Generation ECG candidate for {args.technology}", source_audit)
        for p in [daily_path, monthly_path, ecg_path]:
            outputs.append({"path": p.relative_to(ROOT).as_posix(), "sizeBytes": p.stat().st_size})

    report = {
        "schemaVersion": "0.1.0-candidate",
        "generatedUTC": utc_now(),
        "mode": "apply" if args.apply else "audit only",
        "technology": args.technology,
        "ecgDays": args.ecg_days,
        "rowsParsed": len(rows),
        "dailyRows": len(daily),
        "monthlyRows": len(monthly),
        "ecgRows": len(ecg),
        "sources": source_audit,
        "outputs": outputs,
        "notes": "Candidate first. Raw source files are parsed and distilled into compact facts. This workflow does not promote confirmed data and does not overwrite production files.",
    }

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    s = stamp()
    md_path = REPORT_DIR / f"GENERATION_HEARTBEAT_MVP_{s}.md"
    js_path = REPORT_JSON_DIR / f"GENERATION_HEARTBEAT_MVP_{s}.json"
    latest_md = REPORT_DIR / "GENERATION_HEARTBEAT_MVP_LATEST.md"
    latest_js = REPORT_JSON_DIR / "GENERATION_HEARTBEAT_MVP_LATEST.json"

    md_text = render_report(report)
    js_text = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    md_path.write_text(md_text, encoding="utf-8")
    js_path.write_text(js_text, encoding="utf-8")
    latest_md.write_text(md_text, encoding="utf-8")
    latest_js.write_text(js_text, encoding="utf-8")

    print(f"Parsed {len(rows)} rows")
    print(f"Daily candidate rows {len(daily)}")
    print(f"Monthly candidate rows {len(monthly)}")
    print(f"ECG candidate rows {len(ecg)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
