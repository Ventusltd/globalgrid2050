#!/usr/bin/env python3
"""
GlobalGrid2050 daily MW spine builder.

Reads staged generation MW source files and produces compact daily average, high
and low MW facts per technology. This is the browser friendly 10 year shape.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import math
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
STAGE_ROOT = ROOT / "data" / "generation" / "staged_mw"
OUT_DIR = ROOT / "data" / "confirmed"
OUT_FILE = OUT_DIR / "generation_daily_mw_spine_candidate.json"
REPORT_DIR = ROOT / "data_science_protocol" / "audit_reports"
REPORT_JSON_DIR = REPORT_DIR / "json"

TECH_MAP = {
    "SOLAR": "Solar",
    "PV": "Solar",
    "WIND": "Wind",
    "WIND OFFSHORE": "Wind",
    "WIND ONSHORE": "Wind",
    "NPSHYD": "Hydro",
    "HYDRO": "Hydro",
    "CCGT": "Gas",
    "OCGT": "Gas",
    "GAS": "Gas",
    "COAL": "Coal",
    "BIOMASS": "Biomass",
    "NUCLEAR": "Nuclear",
    "PS": "Pumped Storage",
}


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def stamp() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def group_for(fuel: str) -> str:
    f = str(fuel or "").strip().upper()
    if f.startswith("INT"):
        return "Imports & Exports"
    for key, value in TECH_MAP.items():
        if f.startswith(key):
            return value
    return "Other"


def parse_time(value: str) -> dt.datetime | None:
    if not value:
        return None
    try:
        text = value.replace("Z", "+00:00")
        parsed = dt.datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.astimezone(dt.timezone.utc)
    except Exception:
        return None


def read_rows(years: list[int] | None) -> tuple[dict[tuple[str, str], list[dict[str, Any]]], dict[str, Any]]:
    buckets: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    files = []
    if years:
        for year in years:
            files.extend(sorted((STAGE_ROOT / str(year)).glob("*.csv")))
    else:
        files = sorted(STAGE_ROOT.glob("*/*.csv"))
    source_files = []
    raw_rows = 0
    parsed_rows = 0
    for path in files:
        file_rows = 0
        with path.open("r", encoding="utf-8", newline="") as handle:
            for row in csv.DictReader(handle):
                raw_rows += 1
                file_rows += 1
                t = parse_time(row.get("periodStartUTC", ""))
                try:
                    mw = float(row.get("generationMW", ""))
                except Exception:
                    continue
                if t is None or not math.isfinite(mw):
                    continue
                tech = group_for(row.get("fuelType", ""))
                key = (t.date().isoformat(), tech)
                buckets[key].append({
                    "time": t.isoformat().replace("+00:00", "Z"),
                    "mw": mw,
                    "sourceStatus": row.get("sourceStatus") or "candidate",
                    "sourceLineage": row.get("sourceLineage") or row.get("source") or "unknown",
                })
                parsed_rows += 1
        source_files.append({"path": path.relative_to(ROOT).as_posix(), "rows": file_rows, "sizeBytes": path.stat().st_size})
    return buckets, {"files": source_files, "rawRows": raw_rows, "parsedRows": parsed_rows}


def build_spine(buckets: dict[tuple[str, str], list[dict[str, Any]]]) -> list[dict[str, Any]]:
    out = []
    for (date, tech), rows in sorted(buckets.items()):
        if not rows:
            continue
        vals = [float(r["mw"]) for r in rows]
        hi = max(rows, key=lambda r: float(r["mw"]))
        lo = min(rows, key=lambda r: float(r["mw"]))
        lineage = sorted({str(r.get("sourceLineage") or "unknown") for r in rows})
        statuses = sorted({str(r.get("sourceStatus") or "candidate") for r in rows})
        expected = 48
        completeness = round(min(1.0, len(rows) / expected), 4)
        out.append({
            "date": date,
            "technology": tech,
            "averageMW": round(sum(vals) / len(vals), 3),
            "highMW": round(float(hi["mw"]), 3),
            "lowMW": round(float(lo["mw"]), 3),
            "highAtUTC": hi["time"],
            "lowAtUTC": lo["time"],
            "sampleCount": len(rows),
            "expectedSamples": expected,
            "completeness": completeness,
            "status": "candidate",
            "sourceStatus": "+".join(statuses),
            "sourceLineage": "; ".join(lineage),
        })
    return out


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def write_report(payload: dict[str, Any]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    s = stamp()
    md = REPORT_DIR / f"GENERATION_DAILY_MW_SPINE_{s}.md"
    js = REPORT_JSON_DIR / f"GENERATION_DAILY_MW_SPINE_{s}.json"
    latest_md = REPORT_DIR / "GENERATION_DAILY_MW_SPINE_LATEST.md"
    latest_js = REPORT_JSON_DIR / "GENERATION_DAILY_MW_SPINE_LATEST.json"
    lines = [
        "# GlobalGrid2050 Daily MW Spine Report",
        "",
        f"Generated UTC: `{payload['generatedUTC']}`",
        f"Mode: `{payload['mode']}`",
        f"Years: `{', '.join(map(str, payload['years'])) if payload['years'] else 'all staged years'}`",
        f"Source files: `{len(payload['sourceFiles'])}`",
        f"Raw rows: `{payload['rawRows']}`",
        f"Parsed rows: `{payload['parsedRows']}`",
        f"Daily fact rows: `{payload['dailyRows']}`",
        f"Output path: `{payload['outputPath']}`",
        f"Output size bytes: `{payload['outputSizeBytes']}`",
        "",
        "## Source discipline",
        "",
        "Daily average, high and low MW are candidate facts. High and low are not additive. MWh rollups must be built separately from interval energy.",
    ]
    text = "\n".join(lines) + "\n"
    for path in (md, latest_md):
        path.write_text(text, encoding="utf-8")
    js_text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    for path in (js, latest_js):
        path.write_text(js_text, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--years", default="", help="Comma separated years. Empty means all staged years.")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    years = [int(x.strip()) for x in args.years.split(",") if x.strip()] or None
    buckets, meta = read_rows(years)
    rows = build_spine(buckets)
    out_payload = {
        "schemaVersion": "0.1.0-candidate",
        "generatedUTC": utc_now(),
        "title": "Generation daily MW spine candidate",
        "timezone": "UTC",
        "status": "candidate",
        "grain": "daily average high low MW per technology",
        "sourceNote": "Built from staged source rows. FUELINST lineage is provisional. PVLive solar lineage is candidate embedded estimate.",
        "rows": rows,
    }
    if args.apply:
        write_json(OUT_FILE, out_payload)
    payload = {
        "generatedUTC": utc_now(),
        "mode": "apply" if args.apply else "audit only",
        "years": years or [],
        "sourceFiles": meta["files"],
        "rawRows": meta["rawRows"],
        "parsedRows": meta["parsedRows"],
        "dailyRows": len(rows),
        "outputPath": OUT_FILE.relative_to(ROOT).as_posix(),
        "outputSizeBytes": OUT_FILE.stat().st_size if OUT_FILE.exists() else 0,
    }
    write_report(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
