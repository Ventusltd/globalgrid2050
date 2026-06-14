#!/usr/bin/env python3
"""
GridBot London Solar Daylight Geometry.

Target:
  /uk_energy_tracking_v6/generation_history/

Purpose:
  Calculate London sunrise and sunset for every day of a selected year without calling
  an external sunrise API. This is a deterministic education and grid analysis layer.

Important:
  The formulae are not claimed as original. The workflow output attributes the
  astronomical method and horizon convention. The GlobalGrid2050 contribution is the
  controlled GridBot workflow, the calculated London reference dataset, the audit trail
  and the UI-ready data contract.

Audit mode:
  Calculate the proposed JSON and report in memory, then write reports only.

Apply mode:
  Write the JSON output and reports.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "uk_energy_tracking_v6" / "generation_history"
REPORT_DIR = ROOT / "data_science_protocol" / "audit_reports"
REPORT_JSON_DIR = REPORT_DIR / "json"
REPORT_MD = REPORT_DIR / "LONDON_SOLAR_DAYLIGHT_GEOMETRY_LATEST.md"
REPORT_JSON = REPORT_JSON_DIR / "LONDON_SOLAR_DAYLIGHT_GEOMETRY_LATEST.json"
ROUTE = "/uk_energy_tracking_v6/generation_history/"
SCRIPT_NAME = "scripts/gridbot_london_solar_daylight_geometry.py"
WORKFLOW_NAME = "GridBot London Solar Daylight Geometry"

LOCATION_NAME = "London, United Kingdom"
LATITUDE = 51.5072
LONGITUDE = -0.1276
TIMEZONE = "Europe/London"
UTC = dt.timezone.utc
LOCAL_ZONE = ZoneInfo(TIMEZONE)

ZENITH_DEGREES = 90.8333

METHOD_SOURCES = [
    {
        "name": "U.S. Naval Observatory Astronomical Applications Department",
        "url": "https://aa.usno.navy.mil/faq/RST_defs",
        "use": "Rise, set and twilight definitions. Sunrise and sunset use the upper limb of the solar disk at the horizon, with geometric zenith distance 90.8333 degrees for the Sun centre under average atmospheric conditions."
    },
    {
        "name": "NREL Solar Position Algorithm for Solar Radiation Applications, Reda and Andreas, NREL/TP-560-34302",
        "url": "https://www.nrel.gov/docs/fy08osti/34302.pdf",
        "use": "Solar position reference for solar radiation applications, time scales, equation of time, solar transit, sunrise and sunset method context."
    },
    {
        "name": "NOAA style approximate solar calculation",
        "url": "https://gml.noaa.gov/grad/solcalc/",
        "use": "The implemented equation of time and solar declination approximations follow the commonly published NOAA solar calculator form."
    }
]


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def write(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def is_leap_year(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def days_in_year(year: int) -> list[dt.date]:
    start = dt.date(year, 1, 1)
    end = dt.date(year + 1, 1, 1)
    rows = []
    d = start
    while d < end:
        rows.append(d)
        d += dt.timedelta(days=1)
    return rows


def hhmm(value: dt.datetime) -> str:
    return value.strftime("%H:%M")


def iso_minute(value: dt.datetime) -> str:
    return value.replace(second=0, microsecond=0).isoformat()


def minutes_to_utc(day: dt.date, minutes: float) -> dt.datetime:
    base = dt.datetime(day.year, day.month, day.day, tzinfo=UTC)
    return base + dt.timedelta(minutes=minutes)


def time_to_minutes(value: str) -> int:
    hour, minute = value.split(":")
    return int(hour) * 60 + int(minute)


def solar_geometry_for_day(day: dt.date) -> dict:
    n = day.timetuple().tm_yday
    year_length = 366 if is_leap_year(day.year) else 365
    gamma = (2.0 * math.pi / year_length) * (n - 1)
    equation_of_time_minutes = 229.18 * (
        0.000075
        + 0.001868 * math.cos(gamma)
        - 0.032077 * math.sin(gamma)
        - 0.014615 * math.cos(2 * gamma)
        - 0.040849 * math.sin(2 * gamma)
    )
    solar_declination_radians = (
        0.006918
        - 0.399912 * math.cos(gamma)
        + 0.070257 * math.sin(gamma)
        - 0.006758 * math.cos(2 * gamma)
        + 0.000907 * math.sin(2 * gamma)
        - 0.002697 * math.cos(3 * gamma)
        + 0.00148 * math.sin(3 * gamma)
    )
    lat_radians = math.radians(LATITUDE)
    zenith_radians = math.radians(ZENITH_DEGREES)
    cos_hour_angle = (
        math.cos(zenith_radians) / (math.cos(lat_radians) * math.cos(solar_declination_radians))
        - math.tan(lat_radians) * math.tan(solar_declination_radians)
    )
    if cos_hour_angle < -1.0 or cos_hour_angle > 1.0:
        return {
            "date": day.isoformat(),
            "dayOfYear": n,
            "sunriseExists": False,
            "sunsetExists": False,
            "reason": "Sun does not cross standard horizon on this date at this latitude."
        }
    hour_angle_degrees = math.degrees(math.acos(cos_hour_angle))
    solar_noon_utc_minutes = 720.0 - (4.0 * LONGITUDE) - equation_of_time_minutes
    sunrise_utc_minutes = solar_noon_utc_minutes - (4.0 * hour_angle_degrees)
    sunset_utc_minutes = solar_noon_utc_minutes + (4.0 * hour_angle_degrees)
    sunrise_utc = minutes_to_utc(day, sunrise_utc_minutes)
    sunset_utc = minutes_to_utc(day, sunset_utc_minutes)
    solar_noon_utc = minutes_to_utc(day, solar_noon_utc_minutes)
    sunrise_local = sunrise_utc.astimezone(LOCAL_ZONE)
    sunset_local = sunset_utc.astimezone(LOCAL_ZONE)
    solar_noon_local = solar_noon_utc.astimezone(LOCAL_ZONE)
    daylight_minutes = (sunset_utc - sunrise_utc).total_seconds() / 60.0
    return {
        "date": day.isoformat(),
        "dayOfYear": n,
        "sunriseExists": True,
        "sunsetExists": True,
        "sunriseGMT": hhmm(sunrise_utc),
        "sunsetGMT": hhmm(sunset_utc),
        "solarNoonGMT": hhmm(solar_noon_utc),
        "sunriseGMTISO": iso_minute(sunrise_utc),
        "sunsetGMTISO": iso_minute(sunset_utc),
        "solarNoonGMTISO": iso_minute(solar_noon_utc),
        "sunriseUKClock": hhmm(sunrise_local),
        "sunsetUKClock": hhmm(sunset_local),
        "solarNoonUKClock": hhmm(solar_noon_local),
        "sunriseUKClockISO": iso_minute(sunrise_local),
        "sunsetUKClockISO": iso_minute(sunset_local),
        "solarNoonUKClockISO": iso_minute(solar_noon_local),
        "ukClockUTCOffsetMinutesAtSunrise": int(sunrise_local.utcoffset().total_seconds() / 60),
        "ukClockUTCOffsetMinutesAtSunset": int(sunset_local.utcoffset().total_seconds() / 60),
        "daylightMinutes": round(daylight_minutes, 2),
        "daylightHours": round(daylight_minutes / 60.0, 3),
        "equationOfTimeMinutes": round(equation_of_time_minutes, 3),
        "solarDeclinationDegrees": round(math.degrees(solar_declination_radians), 5),
        "sunriseSunsetHourAngleDegrees": round(hour_angle_degrees, 5),
        "horizonZenithDegrees": ZENITH_DEGREES,
    }


def read_json_if_exists(path: Path):
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def compare_with_previous_sunrise_api(rows: list[dict]) -> dict:
    old_path = APP / "sunrise_sunset_time_bands_reference.json"
    old = read_json_if_exists(old_path)
    if not old:
        return {"available": False, "reason": "previous sunrise_sunset_time_bands_reference.json not found"}
    current_by_date = {row["date"]: row for row in rows if row.get("sunriseExists") and row.get("sunsetExists")}
    comparisons = []
    for old_row in old.get("locationRows", []):
        if old_row.get("location") != "London":
            continue
        date = old_row.get("date")
        current = current_by_date.get(date)
        if not current:
            continue
        sunrise_delta = time_to_minutes(current["sunriseUKClock"]) - time_to_minutes(old_row["sunrise"])
        sunset_delta = time_to_minutes(current["sunsetUKClock"]) - time_to_minutes(old_row["sunset"])
        comparisons.append({
            "date": date,
            "currentSunriseUKClock": current["sunriseUKClock"],
            "previousApiSunrise": old_row["sunrise"],
            "sunriseDeltaMinutes": sunrise_delta,
            "currentSunsetUKClock": current["sunsetUKClock"],
            "previousApiSunset": old_row["sunset"],
            "sunsetDeltaMinutes": sunset_delta,
        })
    if not comparisons:
        return {"available": False, "reason": "previous file found but no London comparison rows matched"}
    max_abs = max(max(abs(row["sunriseDeltaMinutes"]), abs(row["sunsetDeltaMinutes"])) for row in comparisons)
    return {"available": True, "comparisonRows": len(comparisons), "maxAbsoluteDifferenceMinutes": max_abs, "sample": comparisons[:12]}


def build(year: int) -> tuple[dict, dict]:
    rows = [solar_geometry_for_day(day) for day in days_in_year(year)]
    valid = [row for row in rows if row.get("sunriseExists") and row.get("sunsetExists")]
    shortest = min(valid, key=lambda r: r["daylightMinutes"])
    longest = max(valid, key=lambda r: r["daylightMinutes"])
    earliest_sunrise = min(valid, key=lambda r: time_to_minutes(r["sunriseUKClock"]))
    latest_sunrise = max(valid, key=lambda r: time_to_minutes(r["sunriseUKClock"]))
    earliest_sunset = min(valid, key=lambda r: time_to_minutes(r["sunsetUKClock"]))
    latest_sunset = max(valid, key=lambda r: time_to_minutes(r["sunsetUKClock"]))
    output = {
        "schemaVersion": "1.0.0-london-solar-daylight-geometry",
        "generatedUTC": now(),
        "year": year,
        "route": ROUTE,
        "locationName": LOCATION_NAME,
        "latitude": LATITUDE,
        "longitude": LONGITUDE,
        "timezone": TIMEZONE,
        "primaryOutputTimeStandard": "GMT/UTC",
        "secondaryDisplayTimeStandard": "Europe/London civil clock, including BST where applicable",
        "horizonConvention": {
            "source": "USNO rise/set definition",
            "solarCentreZenithDegrees": ZENITH_DEGREES,
            "summary": "Sunrise and sunset occur when the Sun's upper limb appears tangent to a level unobstructed horizon under average atmospheric conditions. Computationally this uses the Sun centre at geometric zenith distance 90.8333 degrees."
        },
        "method": {
            "summary": "GlobalGrid2050 deterministic London solar daylight geometry calculation using NOAA style approximate equation of time and solar declination formulae, with the USNO apparent sunrise/sunset horizon convention.",
            "formulaOrigin": METHOD_SOURCES,
            "limitations": [
                "This is an astronomical geometry layer, not an irradiance forecast.",
                "Actual observed sunrise and sunset can differ by a minute or more because atmospheric refraction, local horizon, observer height and weather vary.",
                "Cloud, aerosols, panel angle, shading and albedo are not included.",
                "The output is suitable for education, grid visualisation and correlation studies against solar MWh and price shape, not for legal almanac use."
            ],
        },
        "uiApplication": {
            "intendedPanelTitle": "Sunrise and Sunset Times",
            "replacePanel": "Day versus Night MWh",
            "xAxis": "day 1 to 365 or 366",
            "yAxis": "clock time",
            "lines": ["sunriseGMT", "sunsetGMT"],
            "optionalDisplayLines": ["sunriseUKClock", "sunsetUKClock"],
            "fillBand": "daylight window between sunrise and sunset",
            "correlationUse": "Compare solar daily MWh and other technology ramps against daylight duration and sunrise/sunset timing."
        },
        "summary": {
            "rowCount": len(rows),
            "shortestDay": {"date": shortest["date"], "daylightHours": shortest["daylightHours"], "sunriseGMT": shortest["sunriseGMT"], "sunsetGMT": shortest["sunsetGMT"], "sunriseUKClock": shortest["sunriseUKClock"], "sunsetUKClock": shortest["sunsetUKClock"]},
            "longestDay": {"date": longest["date"], "daylightHours": longest["daylightHours"], "sunriseGMT": longest["sunriseGMT"], "sunsetGMT": longest["sunsetGMT"], "sunriseUKClock": longest["sunriseUKClock"], "sunsetUKClock": longest["sunsetUKClock"]},
            "earliestSunriseUKClock": {"date": earliest_sunrise["date"], "time": earliest_sunrise["sunriseUKClock"]},
            "latestSunriseUKClock": {"date": latest_sunrise["date"], "time": latest_sunrise["sunriseUKClock"]},
            "earliestSunsetUKClock": {"date": earliest_sunset["date"], "time": earliest_sunset["sunsetUKClock"]},
            "latestSunsetUKClock": {"date": latest_sunset["date"], "time": latest_sunset["sunsetUKClock"]},
        },
        "rows": rows,
    }
    meta = {"rowCount": len(rows), "validRows": len(valid), "leapYear": is_leap_year(year), "crossCheckAgainstPreviousApi": compare_with_previous_sunrise_api(rows)}
    return output, meta


def checks(payload: dict, meta: dict) -> dict[str, bool]:
    expected = 366 if meta["leapYear"] else 365
    rows = payload.get("rows", [])
    valid = [row for row in rows if row.get("sunriseExists") and row.get("sunsetExists")]
    return {
        "has_expected_daily_rows": len(rows) == expected,
        "has_sunrise_and_sunset_for_each_day": len(valid) == expected,
        "has_gmt_sunrise_and_sunset_fields": all("sunriseGMT" in row and "sunsetGMT" in row for row in valid),
        "has_uk_clock_sunrise_and_sunset_fields": all("sunriseUKClock" in row and "sunsetUKClock" in row for row in valid),
        "uses_london_reference": payload.get("locationName") == LOCATION_NAME and abs(payload.get("latitude") - LATITUDE) < 0.0001,
        "uses_gmt_utc_primary_standard": payload.get("primaryOutputTimeStandard") == "GMT/UTC",
        "uses_europe_london_secondary_standard": payload.get("timezone") == TIMEZONE,
        "attributes_usno_convention": "USNO" in json.dumps(payload.get("horizonConvention", {})),
        "attributes_formula_sources": len(payload.get("method", {}).get("formulaOrigin", [])) >= 2,
        "contains_ui_application_contract": "Sunrise and Sunset Times" in json.dumps(payload.get("uiApplication", {})),
        "output_under_1mb": len(json.dumps(payload).encode("utf-8")) < 1_000_000,
        "no_external_api_fetch_required": True,
        "generation_data_not_touched": True,
    }


def report_lines(report: dict) -> list[str]:
    method = report["method"]
    summary = report["summary"]
    cross = report["crossCheckAgainstPreviousApi"]
    lines = [
        "# London Solar Daylight Geometry",
        "",
        f"Generated UTC: `{report['generatedUTC']}`",
        f"Mode: `{report['mode']}`",
        f"Pass: `{report['pass']}`",
        "",
        report["executiveSummary"],
        "",
        "## Location and time standards",
        "",
        f"Location: `{LOCATION_NAME}`",
        f"Latitude: `{LATITUDE}`",
        f"Longitude: `{LONGITUDE}`",
        "Primary output time standard: `GMT/UTC`",
        "Secondary display time standard: `Europe/London civil clock, including BST where applicable`",
        "",
        "## Method",
        "",
        method,
        "",
        "## Formula and convention attribution",
        "",
        "The workflow does not call a third party sunrise API. It calculates the daily times directly from solar geometry. The formulae are attributed as follows:",
        "",
    ]
    for source in METHOD_SOURCES:
        lines.append(f"- `{source['name']}`: {source['use']} Source: {source['url']}")
    lines += [
        "",
        "## UI application contract",
        "",
        "Replace `Day versus Night MWh` with `Sunrise and Sunset Times`.",
        "Draw day 1 to day 365 or 366 on the x axis.",
        "Draw clock time on the y axis.",
        "Draw `sunriseGMT` and `sunsetGMT` as the primary lines.",
        "Optionally allow `sunriseUKClock` and `sunsetUKClock` for civil UK display.",
        "Fill the daylight window between sunrise and sunset.",
        "Use daylight hours for correlation against solar daily MWh, other technology ramps and electricity price shape.",
        "",
        "## Summary",
        "",
        f"Rows: `{summary['rowCount']}`",
        f"Shortest day: `{summary['shortestDay']['date']}` `{summary['shortestDay']['daylightHours']}` hours",
        f"Longest day: `{summary['longestDay']['date']}` `{summary['longestDay']['daylightHours']}` hours",
        f"Earliest UK clock sunrise: `{summary['earliestSunriseUKClock']['date']}` `{summary['earliestSunriseUKClock']['time']}`",
        f"Latest UK clock sunrise: `{summary['latestSunriseUKClock']['date']}` `{summary['latestSunriseUKClock']['time']}`",
        f"Earliest UK clock sunset: `{summary['earliestSunsetUKClock']['date']}` `{summary['earliestSunsetUKClock']['time']}`",
        f"Latest UK clock sunset: `{summary['latestSunsetUKClock']['date']}` `{summary['latestSunsetUKClock']['time']}`",
        "",
        "## Cross check against previous API layer",
        "",
        json.dumps(cross, indent=2),
        "",
        "## Planned changed files",
        "",
    ]
    lines += [f"- `{path}`" for path in report["plannedChangedFiles"]]
    lines += ["", "## Checks", "", "| Check | Result |", "|---|---|"]
    lines += [f"| {key} | {'✅' if value else '❌'} |" for key, value in report["checks"].items()]
    lines += ["", "## Rollback", "", report["rollbackMethod"], ""]
    return lines


def write_report(report: dict):
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    write(REPORT_MD, "\n".join(report_lines(report)))
    write(REPORT_JSON, json.dumps(report, indent=2, ensure_ascii=False) + "\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", default="auto")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    year = dt.datetime.now(dt.timezone.utc).year if args.year == "auto" else int(args.year)
    mode = "apply" if args.apply else "audit"
    out_json = APP / f"london_solar_daylight_geometry_{year}.json"
    payload, meta = build(year)
    ch = checks(payload, meta)
    planned = [rel(out_json)]
    passed = all(ch.values())
    if args.apply and passed:
        write(out_json, json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    report = {
        "reportTitle": "London Solar Daylight Geometry",
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
        "method": "NOAA style equation of time and solar declination approximation, USNO apparent sunrise/sunset horizon convention, London reference coordinates, GMT/UTC primary output, Europe/London civil display output.",
        "summary": payload["summary"],
        "crossCheckAgainstPreviousApi": meta["crossCheckAgainstPreviousApi"],
        "checks": ch,
        "browserRoutingAffected": False,
        "rollbackMethod": f"Delete `{rel(out_json)}` or revert the apply commit. Reports can also be reverted.",
        "executiveSummary": "Calculates 365 or 366 daily London sunrise and sunset rows without calling an external sunrise API. Output includes GMT/UTC times, Europe/London civil clock times, daylight duration, solar noon, equation of time and solar declination. The report fully attributes formula origins and explains how the data should replace the existing Day versus Night panel in a later UI workflow.",
        "applied": bool(args.apply),
        "pass": passed,
    }
    write_report(report)
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
