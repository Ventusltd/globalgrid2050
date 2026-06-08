#!/usr/bin/env python3
"""
GlobalGrid2050 staged generation MW fetcher.

Fetches one year of generation source rows through public APIs, writes staged files
under a per year directory and keeps each committed data file below the configured
size threshold where practical.

This is intentionally a source staging tool. The browser should consume the daily
MW spine generated from these staged rows, not the raw staged source files.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
STAGE_ROOT = ROOT / "data" / "generation" / "staged_mw"
REPORT_DIR = ROOT / "data_science_protocol" / "audit_reports"
REPORT_JSON_DIR = REPORT_DIR / "json"

ELEXON_FUELINST = "https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELINST"
PVLIVE_GSP0 = "https://api.solar.sheffield.ac.uk/pvlive/api/v4/gsp/0"

FIELDS = [
    "source",
    "periodStartUTC",
    "fuelType",
    "generationMW",
    "publishTimeUTC",
    "fetchedAtUTC",
    "sourceStatus",
    "sourceLineage",
]


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def stamp() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def iso_z(value: Any) -> str:
    if value in (None, ""):
        return ""
    text = str(value).replace("Z", "+00:00")
    try:
        parsed = dt.datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z")
    except Exception:
        return str(value)


def pick(row: dict[str, Any], names: list[str]) -> Any:
    folded = {str(k).lower(): v for k, v in row.items()}
    for name in names:
        value = folded.get(name.lower())
        if value not in (None, ""):
            return value
    return ""


def num(value: Any) -> str | None:
    if value in (None, ""):
        return None
    try:
        return f"{float(value):.3f}"
    except Exception:
        return None


def http_json(url: str, timeout: int = 60) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": "GlobalGrid2050 GridBot"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def extract_rows(payload: Any) -> list[Any]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("data", "results", "items"):
            value = payload.get(key)
            if isinstance(value, list):
                return value
    return []


def elexon_url(start_dt: dt.datetime, end_dt: dt.datetime) -> str:
    query = urllib.parse.urlencode({
        "publishDateTimeFrom": start_dt.strftime("%Y-%m-%dT%H:%MZ"),
        "publishDateTimeTo": end_dt.strftime("%Y-%m-%dT%H:%MZ"),
        "format": "json",
    })
    return f"{ELEXON_FUELINST}?{query}"


def fetch_elexon_day(day: dt.date) -> list[dict[str, str]]:
    start_dt = dt.datetime.combine(day, dt.time(0, 0), tzinfo=dt.timezone.utc)
    end_dt = dt.datetime.combine(day, dt.time(23, 59), tzinfo=dt.timezone.utc)
    payload = http_json(elexon_url(start_dt, end_dt))
    fetched = utc_now()
    out: list[dict[str, str]] = []
    for row in extract_rows(payload):
        if not isinstance(row, dict):
            continue
        fuel = pick(row, ["fuelType", "fuelTypeName", "fuel", "psrType"])
        generation = pick(row, ["generation", "generationMW", "currentUsage", "quantity"])
        period_start = pick(row, ["startTime", "publishDateTime", "periodStartUTC", "settlementDate"])
        publish_time = pick(row, ["publishDateTime", "publishTime", "createdTime"])
        mw = num(generation)
        if not fuel or mw is None or not period_start:
            continue
        out.append({
            "source": "Elexon BMRS FUELINST",
            "periodStartUTC": iso_z(period_start),
            "fuelType": str(fuel).strip().upper(),
            "generationMW": mw,
            "publishTimeUTC": iso_z(publish_time),
            "fetchedAtUTC": fetched,
            "sourceStatus": "provisional",
            "sourceLineage": "FUELINST LIVE OR RECENT PROVISIONAL",
        })
    return out


def pvlive_urls(start_dt: dt.datetime, end_dt: dt.datetime) -> list[str]:
    start_iso = start_dt.isoformat().replace("+00:00", "Z")
    end_iso = end_dt.isoformat().replace("+00:00", "Z")
    start_plain = start_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    end_plain = end_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    start_date = start_dt.date().isoformat()
    end_date = end_dt.date().isoformat()
    params = [
        {"start": start_iso, "end": end_iso},
        {"start": start_plain, "end": end_plain},
        {"from": start_iso, "to": end_iso},
        {"datetime_from": start_iso, "datetime_to": end_iso},
        {"start_date": start_date, "end_date": end_date},
    ]
    return [PVLIVE_GSP0 + "?" + urllib.parse.urlencode(p) for p in params]


def parse_pvlive_row(row: Any, fetched: str) -> dict[str, str] | None:
    if isinstance(row, list):
        if len(row) < 3:
            return None
        timestamp = row[1]
        generation = row[2]
    elif isinstance(row, dict):
        timestamp = row.get("datetime_gmt") or row.get("datetime") or row.get("time") or row.get("timestamp") or row.get("periodStartUTC")
        generation = row.get("generation_mw") or row.get("generationMW") or row.get("generation") or row.get("power")
    else:
        return None
    mw = num(generation)
    period_start = iso_z(timestamp)
    if not period_start or mw is None:
        return None
    return {
        "source": "Sheffield Solar PVLive",
        "periodStartUTC": period_start,
        "fuelType": "SOLAR",
        "generationMW": mw,
        "publishTimeUTC": "",
        "fetchedAtUTC": fetched,
        "sourceStatus": "candidate",
        "sourceLineage": "PVLIVE EMBEDDED ESTIMATE",
    }


def fetch_pvlive_day(day: dt.date) -> tuple[list[dict[str, str]], str, str]:
    start_dt = dt.datetime.combine(day, dt.time(0, 0), tzinfo=dt.timezone.utc)
    end_dt = dt.datetime.combine(day, dt.time(23, 59), tzinfo=dt.timezone.utc)
    errors: list[str] = []
    for url in pvlive_urls(start_dt, end_dt):
        try:
            payload = http_json(url)
            fetched = utc_now()
            rows = []
            for row in extract_rows(payload):
                parsed = parse_pvlive_row(row, fetched)
                if parsed:
                    rows.append(parsed)
            if rows:
                return rows, "ok", url
        except Exception as exc:
            errors.append(str(exc))
    return [], "; ".join(errors[-2:]) or "no parseable PVLive rows", ""


def year_dir(year: int) -> Path:
    return STAGE_ROOT / str(year)


def load_existing_rows(year: int) -> dict[tuple[str, str], dict[str, str]]:
    rows: dict[tuple[str, str], dict[str, str]] = {}
    for path in sorted(year_dir(year).glob("*.csv")):
        with path.open("r", encoding="utf-8", newline="") as handle:
            for row in csv.DictReader(handle):
                key = (row.get("periodStartUTC", ""), row.get("fuelType", ""))
                if key[0] and key[1]:
                    rows[key] = {field: row.get(field, "") for field in FIELDS}
    return rows


def existing_days(rows: dict[tuple[str, str], dict[str, str]]) -> set[str]:
    days = set()
    for period, _fuel in rows:
        if period:
            days.add(period[:10])
    return days


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def write_year_files(year: int, rows_by_key: dict[tuple[str, str], dict[str, str]], max_file_mb: float) -> list[dict[str, Any]]:
    ydir = year_dir(year)
    ydir.mkdir(parents=True, exist_ok=True)
    rows = [rows_by_key[k] for k in sorted(rows_by_key, key=lambda x: (x[0], x[1]))]
    annual = ydir / f"generation_mw_source_{year}.csv"
    write_csv(annual, rows)
    max_bytes = int(max_file_mb * 1024 * 1024)
    outputs: list[dict[str, Any]] = []
    if annual.stat().st_size <= max_bytes:
        for old in ydir.glob(f"generation_mw_source_{year}-*.csv"):
            old.unlink()
        outputs.append({"path": annual.relative_to(ROOT).as_posix(), "rows": len(rows), "sizeBytes": annual.stat().st_size})
        return outputs

    annual.unlink()
    by_month: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        month = row.get("periodStartUTC", "")[:7]
        if month:
            by_month[month].append(row)
    for old in ydir.glob(f"generation_mw_source_{year}*.csv"):
        old.unlink()
    for month, month_rows in sorted(by_month.items()):
        mpath = ydir / f"generation_mw_source_{month}.csv"
        write_csv(mpath, month_rows)
        outputs.append({"path": mpath.relative_to(ROOT).as_posix(), "rows": len(month_rows), "sizeBytes": mpath.stat().st_size})
    return outputs


def write_report(payload: dict[str, Any]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    year = payload["year"]
    s = stamp()
    md = REPORT_DIR / f"GENERATION_MW_FETCH_{year}_{s}.md"
    js = REPORT_JSON_DIR / f"GENERATION_MW_FETCH_{year}_{s}.json"
    latest_md = REPORT_DIR / f"GENERATION_MW_FETCH_{year}_LATEST.md"
    latest_js = REPORT_JSON_DIR / f"GENERATION_MW_FETCH_{year}_LATEST.json"
    lines = [
        f"# GlobalGrid2050 Generation MW Source Fetch {year}",
        "",
        f"Generated UTC: `{payload['generatedUTC']}`",
        f"Mode: `{payload['mode']}`",
        f"Year: `{year}`",
        f"Window: `{payload['startDay']}` to `{payload['endDay']}`",
        f"Rows before: `{payload['rowsBefore']}`",
        f"Rows after: `{payload['rowsAfter']}`",
        f"Elexon rows fetched: `{payload['elexonRowsFetched']}`",
        f"PVLive rows fetched: `{payload['solarRowsFetched']}`",
        f"Days attempted: `{payload['daysAttempted']}`",
        f"Days skipped because already staged: `{payload['daysSkippedExisting']}`",
        f"Errors: `{len(payload['errors'])}`",
        f"Max file MB: `{payload['maxFileMB']}`",
        "",
        "## Outputs",
        "",
    ]
    for item in payload["outputs"]:
        lines.append(f"{item['path']}  rows={item['rows']}  sizeBytes={item['sizeBytes']}")
    if payload["errors"]:
        lines.extend(["", "## Errors", ""])
        for item in payload["errors"][:60]:
            lines.append(f"{item['day']}  {item['source']}  {item['error']}")
    lines.extend(["", "## Source discipline", "", "FUELINST rows are provisional. PVLive solar rows are candidate embedded estimates. Browser views must use compact daily facts generated from these staged rows."])
    text = "\n".join(lines) + "\n"
    for path in (md, latest_md):
        path.write_text(text, encoding="utf-8")
    js_text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    for path in (js, latest_js):
        path.write_text(js_text, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--delay-seconds", type=float, default=0.25)
    parser.add_argument("--max-file-mb", type=float, default=25.0)
    parser.add_argument("--include-solar", action="store_true")
    parser.add_argument("--refetch-existing", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    now = dt.datetime.now(dt.timezone.utc)
    current_year = now.year
    current_date = now.date()
    start_day = dt.date(args.year, 1, 1)
    end_day = dt.date(args.year, 12, 31)
    if args.year == current_year:
        end_day = min(end_day, current_date - dt.timedelta(days=1))
    if end_day < start_day:
        payload = {"generatedUTC": utc_now(), "mode": "apply" if args.apply else "audit only", "year": args.year, "startDay": str(start_day), "endDay": str(end_day), "rowsBefore": 0, "rowsAfter": 0, "elexonRowsFetched": 0, "solarRowsFetched": 0, "daysAttempted": 0, "daysSkippedExisting": 0, "maxFileMB": args.max_file_mb, "outputs": [], "errors": [{"day": str(start_day), "source": "calendar", "error": "no complete days available"}]}
        write_report(payload)
        return 0

    rows_by_key = load_existing_rows(args.year)
    before = len(rows_by_key)
    staged_days = existing_days(rows_by_key)
    elexon_count = 0
    solar_count = 0
    attempted = 0
    skipped = 0
    errors: list[dict[str, str]] = []

    day = start_day
    while day <= end_day:
        day_text = day.isoformat()
        if day_text in staged_days and not args.refetch_existing:
            skipped += 1
            day += dt.timedelta(days=1)
            continue
        attempted += 1
        if args.apply:
            try:
                rows = fetch_elexon_day(day)
                elexon_count += len(rows)
                for row in rows:
                    rows_by_key[(row["periodStartUTC"], row["fuelType"])] = row
                print(f"{args.year} {day}: Elexon {len(rows)} rows")
            except Exception as exc:
                errors.append({"day": day_text, "source": "Elexon FUELINST", "error": str(exc)})
                print(f"Warning {args.year} {day}: Elexon failed: {exc}")
            if args.include_solar:
                try:
                    solar_rows, status, _url = fetch_pvlive_day(day)
                    solar_count += len(solar_rows)
                    for row in solar_rows:
                        rows_by_key[(row["periodStartUTC"], row["fuelType"])] = row
                    if not solar_rows and status:
                        errors.append({"day": day_text, "source": "PVLive", "error": status})
                    print(f"{args.year} {day}: PVLive solar {len(solar_rows)} rows")
                except Exception as exc:
                    errors.append({"day": day_text, "source": "PVLive", "error": str(exc)})
                    print(f"Warning {args.year} {day}: PVLive failed: {exc}")
            time.sleep(max(args.delay_seconds, 0))
        day += dt.timedelta(days=1)

    outputs: list[dict[str, Any]] = []
    if args.apply:
        outputs = write_year_files(args.year, rows_by_key, args.max_file_mb)
    payload = {
        "generatedUTC": utc_now(),
        "mode": "apply" if args.apply else "audit only",
        "year": args.year,
        "startDay": str(start_day),
        "endDay": str(end_day),
        "rowsBefore": before,
        "rowsAfter": len(rows_by_key),
        "elexonRowsFetched": elexon_count,
        "solarRowsFetched": solar_count,
        "daysAttempted": attempted,
        "daysSkippedExisting": skipped,
        "maxFileMB": args.max_file_mb,
        "outputs": outputs,
        "errors": errors,
    }
    write_report(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
