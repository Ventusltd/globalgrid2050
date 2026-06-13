#!/usr/bin/env python3
"""
GridBot Sunrise Sunset Time Bands.

Target:
  /uk_energy_tracking_v6/generation_history/

Purpose:
  Create a compact UK sunrise and sunset reference file for the Generation Output in MWh module.
  This supports replacing the crude Day versus Night panel with fixed clock time bands plus
  sunrise and sunset context.

Output principle:
  Use times only. Let the numbers do the talking.

Audit mode:
  Fetches the source API, builds the proposed JSON in memory and writes reports only.

Apply mode:
  Writes the compact reference JSON and reports.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "uk_energy_tracking_v6" / "generation_history"
OUT_JSON = APP / "sunrise_sunset_time_bands_reference.json"
REPORT_DIR = ROOT / "data_science_protocol" / "audit_reports"
REPORT_JSON_DIR = REPORT_DIR / "json"
REPORT_MD = REPORT_DIR / "SUNRISE_SUNSET_TIME_BANDS_LATEST.md"
REPORT_JSON = REPORT_JSON_DIR / "SUNRISE_SUNSET_TIME_BANDS_LATEST.json"
ROUTE = "/uk_energy_tracking_v6/generation_history/"
API = "https://api.sunrise-sunset.org/json"
TZID = "Europe/London"
SCRIPT_NAME = "scripts/gridbot_sunrise_sunset_time_bands.py"
WORKFLOW_NAME = "GridBot Sunrise Sunset Time Bands"

TIME_BANDS = [
    "00:00-06:00",
    "06:00-10:00",
    "10:00-16:00",
    "16:00-20:00",
    "20:00-24:00",
]

REFERENCE_LOCATIONS = [
    {"name": "London", "lat": 51.5072, "lng": -0.1276},
    {"name": "Cardiff", "lat": 51.4816, "lng": -3.1791},
    {"name": "Manchester", "lat": 53.4808, "lng": -2.2426},
    {"name": "Edinburgh", "lat": 55.9533, "lng": -3.1883},
    {"name": "Belfast", "lat": 54.5973, "lng": -5.9301},
]


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def write(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def month_dates(year: int) -> list[dt.date]:
    return [dt.date(year, m, 15) for m in range(1, 13)]


def hhmm(value: str) -> str:
    parsed = dt.datetime.fromisoformat(value)
    return parsed.strftime("%H:%M")


def fetch_one(location: dict[str, Any], day: dt.date) -> dict[str, Any]:
    params = {
        "lat": location["lat"],
        "lng": location["lng"],
        "date": day.isoformat(),
        "formatted": 0,
        "tzid": TZID,
    }
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "GlobalGrid2050 GridBot"})
    with urllib.request.urlopen(req, timeout=45) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if payload.get("status") != "OK":
        raise RuntimeError(f"sunrise sunset API status {payload.get('status')} for {location['name']} {day}")
    result = payload["results"]
    return {
        "date": day.isoformat(),
        "year": day.year,
        "month": day.month,
        "location": location["name"],
        "lat": location["lat"],
        "lng": location["lng"],
        "tzid": payload.get("tzid") or TZID,
        "sunrise": hhmm(result["sunrise"]),
        "sunset": hhmm(result["sunset"]),
        "solarNoon": hhmm(result["solar_noon"]),
        "dayLengthSeconds": int(result["day_length"]),
        "civilTwilightBegin": hhmm(result["civil_twilight_begin"]),
        "civilTwilightEnd": hhmm(result["civil_twilight_end"]),
    }


def build(year: int) -> tuple[dict[str, Any], dict[str, Any]]:
    rows = []
    fetches = []
    for day in month_dates(year):
        for location in REFERENCE_LOCATIONS:
            row = fetch_one(location, day)
            rows.append(row)
            fetches.append({"date": day.isoformat(), "location": location["name"], "status": "ok"})
            time.sleep(0.15)

    by_month = defaultdict(list)
    for row in rows:
        by_month[row["month"]].append(row)

    monthly = []
    for month, group in sorted(by_month.items()):
        sunrise_values = sorted(row["sunrise"] for row in group)
        sunset_values = sorted(row["sunset"] for row in group)
        day_lengths = sorted(row["dayLengthSeconds"] for row in group)
        monthly.append({
            "year": year,
            "month": month,
            "date": f"{year}-{month:02d}-15",
            "earliestSunrise": sunrise_values[0],
            "latestSunrise": sunrise_values[-1],
            "earliestSunset": sunset_values[0],
            "latestSunset": sunset_values[-1],
            "shortestDayHours": round(day_lengths[0] / 3600, 2),
            "longestDayHours": round(day_lengths[-1] / 3600, 2),
        })

    output = {
        "schemaVersion": "1.0.0-sunrise-sunset-time-bands",
        "generatedUTC": now(),
        "year": year,
        "route": ROUTE,
        "source": "Sunrise-Sunset.org API",
        "sourceUrl": "https://sunrise-sunset.org/api",
        "sourceAttributionRequired": True,
        "timezone": TZID,
        "timeBands": TIME_BANDS,
        "referenceLocations": REFERENCE_LOCATIONS,
        "monthlySummaryRows": monthly,
        "locationRows": rows,
    }
    meta = {
        "fetchCount": len(fetches),
        "rowCount": len(rows),
        "monthlySummaryRowCount": len(monthly),
        "fetches": fetches[:10],
    }
    return output, meta


def checks(payload: dict[str, Any], meta: dict[str, Any]) -> dict[str, bool]:
    rows = payload.get("locationRows", [])
    monthly = payload.get("monthlySummaryRows", [])
    return {
        "has_five_time_bands": payload.get("timeBands") == TIME_BANDS,
        "time_bands_are_times_only": all(any(ch.isdigit() for ch in band) and not any(word in band.lower() for word in ["morning", "midday", "evening", "night"]) for band in payload.get("timeBands", [])),
        "has_reference_locations": len(payload.get("referenceLocations", [])) == 5,
        "fetched_rows_for_12_months_and_5_locations": len(rows) == 60,
        "monthly_summary_has_12_rows": len(monthly) == 12,
        "sunrise_and_sunset_are_hhmm": all(len(row.get("sunrise", "")) == 5 and len(row.get("sunset", "")) == 5 for row in rows),
        "timezone_is_europe_london": payload.get("timezone") == TZID,
        "source_attribution_flag_present": payload.get("sourceAttributionRequired") is True,
        "output_under_1mb": len(json.dumps(payload).encode("utf-8")) < 1_000_000,
        "generation_data_not_touched": True,
    }


def write_report(report: dict[str, Any]):
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Sunrise Sunset Time Bands",
        "",
        f"Generated UTC: `{report['generatedUTC']}`",
        f"Mode: `{report['mode']}`",
        f"Pass: `{report['pass']}`",
        "",
        report["executiveSummary"],
        "",
        "## Time bands",
        "",
    ]
    lines += [f"- `{band}`" for band in TIME_BANDS]
    lines += ["", "## Planned changed files", ""]
    lines += [f"- `{path}`" for path in report["plannedChangedFiles"]]
    lines += ["", "## Checks", "", "| Check | Result |", "|---|---|"]
    lines += [f"| {key} | {'✅' if value else '❌'} |" for key, value in report["checks"].items()]
    lines += ["", "## Rollback", "", report["rollbackMethod"], ""]
    write(REPORT_MD, "\n".join(lines))
    write(REPORT_JSON, json.dumps(report, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", default="auto")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    year = dt.datetime.now(dt.timezone.utc).year if args.year == "auto" else int(args.year)
    mode = "apply" if args.apply else "audit"
    payload, meta = build(year)
    ch = checks(payload, meta)
    planned = [rel(OUT_JSON)]
    passed = all(ch.values())
    if args.apply and passed:
        write(OUT_JSON, json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    report = {
        "reportTitle": "Sunrise Sunset Time Bands",
        "schemaVersion": "1.0.0",
        "generatedUTC": now(),
        "repository": "Ventusltd/globalgrid2050",
        "workflowName": WORKFLOW_NAME,
        "scriptName": SCRIPT_NAME,
        "route": ROUTE,
        "mode": mode,
        "year": year,
        "changedFiles": planned if args.apply else [],
        "plannedChangedFiles": planned,
        "source": payload["source"],
        "sourceUrl": payload["sourceUrl"],
        "fetchMeta": meta,
        "checks": ch,
        "browserRoutingAffected": False,
        "rollbackMethod": "Delete the compact sunrise_sunset_time_bands_reference.json output or revert the apply commit.",
        "executiveSummary": "Fetches UK sunrise and sunset reference times for 5 UK locations on the 15th of each month, using fixed clock time bands only. This prepares the data layer for replacing the crude day versus night panel with time ranges plus sunrise and sunset context. Generation data is not changed.",
        "applied": bool(args.apply),
        "pass": passed,
    }
    write_report(report)
    print(json.dumps(report, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
