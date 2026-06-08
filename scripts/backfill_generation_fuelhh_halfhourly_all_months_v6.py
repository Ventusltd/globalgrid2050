#!/usr/bin/env python3
"""
Backfill confirmed FUELHH half hourly generation as monthly shards.

WHY THIS EXISTS
  The existing recent generation layer sources FUELINST, which is provisional.
  THE_DATA_SPINE doctrine requires the confirmed historic spine to come from FUELHH,
  the settled half hourly generation dataset. This script fetches FUELHH per month,
  normalises fuels into the same technology buckets and writes one shard per year
  month under a dedicated FUELHH path so it never collides with FUELINST data.

DESIGN
  Resumable: a month whose shard already exists and is non empty is skipped unless
  FORCE=true. Re-running simply fills whatever is missing.
  Throttled: REQUEST_DELAY_SECONDS between requests and exponential backoff on failure.
  Time budgeted: stops starting new months once TIME_BUDGET_MINUTES is reached.
  Size disciplined: each monthly shard is checked against MAX_SHARD_MB.
  Provenance: every shard carries a source column and progress is written to JSON.
"""

from __future__ import annotations

import csv
import datetime as dt
import hashlib
import json
import os
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Any

ELEXON_FUELHH = "https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH"
OUT_ROOT = Path("data/generation/fuelhh_halfhourly")
PROGRESS_FILE = OUT_ROOT / "BACKFILL_PROGRESS.json"
REPORT_DIR = Path("data_science_protocol/audit_reports")
JSON_REPORT_DIR = REPORT_DIR / "json"
FIELDS = ["time", "technology", "generationMW", "source"]
SOURCE_LABEL = "Elexon BMRS FUELHH"
SCHEMA_VERSION = "1.0.0-fuelhh-shard"

GROUPS = {
    "Solar": ["SOLAR", "PV"],
    "Wind": ["WIND"],
    "Hydro": ["NPSHYD", "HYDRO"],
    "Gas": ["CCGT", "OCGT"],
    "Coal": ["COAL"],
    "Biomass": ["BIOMASS"],
    "Nuclear": ["NUCLEAR"],
    "Pumped Storage": ["PS"],
    "Imports & Exports": ["INT"],
}

START_YEAR_MONTH = os.getenv("START_YEAR_MONTH", "2016-01")
WINDOW_DAYS = int(os.getenv("WINDOW_DAYS", "7"))
REQUEST_DELAY_SECONDS = float(os.getenv("REQUEST_DELAY_SECONDS", "1.5"))
TIME_BUDGET_MINUTES = float(os.getenv("TIME_BUDGET_MINUTES", "300"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "5"))
FORCE = os.getenv("FORCE", "false").lower() in {"1", "true", "yes"}
MAX_SHARD_MB = float(os.getenv("MAX_SHARD_MB", "25"))


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def iso_z(value: Any) -> str:
    if not value:
        return ""
    text = str(value).replace("Z", "+00:00")
    try:
        d = dt.datetime.fromisoformat(text)
        if d.tzinfo is None:
            d = d.replace(tzinfo=dt.timezone.utc)
        return d.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z")
    except Exception:
        return str(value)


def pick(row: dict[str, Any], names: list[str]) -> Any:
    folded = {str(k).lower(): v for k, v in row.items()}
    for name in names:
        value = folded.get(name.lower())
        if value not in (None, ""):
            return value
    return ""


def group_for(fuel: str) -> str:
    f = str(fuel or "").upper()
    for label, prefixes in GROUPS.items():
        if any(f.startswith(prefix) for prefix in prefixes):
            return label
    return "Other"


def fetch_window(start_day: dt.date, end_day: dt.date) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode({
        "settlementDateFrom": start_day.isoformat(),
        "settlementDateTo": end_day.isoformat(),
        "format": "json",
    })
    url = f"{ELEXON_FUELHH}?{query}"
    last_err: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "GlobalGrid2050 GridBot"})
            with urllib.request.urlopen(req, timeout=90) as response:
                data = json.loads(response.read().decode("utf-8"))
            rows = data if isinstance(data, list) else data.get("data", [])
            return rows if isinstance(rows, list) else []
        except Exception as exc:
            last_err = exc
            backoff = min(60, REQUEST_DELAY_SECONDS * (2 ** attempt))
            print(f"retry {attempt}/{MAX_RETRIES} for {start_day} to {end_day}: {exc} sleep {backoff:.0f}s")
            time.sleep(backoff)
    raise RuntimeError(f"window {start_day} to {end_day} failed after {MAX_RETRIES} retries: {last_err}")


def month_window(year: int, month: int) -> tuple[dt.date, dt.date]:
    start = dt.date(year, month, 1)
    end = dt.date(year, 12, 31) if month == 12 else dt.date(year, month + 1, 1) - dt.timedelta(days=1)
    today = dt.datetime.now(dt.timezone.utc).date()
    if (year, month) == (today.year, today.month):
        end = min(end, today - dt.timedelta(days=1))
    return start, end


def windows(start_day: dt.date, end_day: dt.date, span_days: int):
    cur = start_day
    while cur <= end_day:
        win_end = min(cur + dt.timedelta(days=span_days - 1), end_day)
        yield cur, win_end
        cur = win_end + dt.timedelta(days=1)


def clean_rows(raw_rows: list[Any]) -> tuple[list[dict[str, str]], int]:
    deduped: dict[tuple[str, str], tuple[str, str, float]] = {}
    for row in raw_rows:
        if not isinstance(row, dict):
            continue
        fuel = pick(row, ["fuelType", "fuelTypeName", "fuel", "psrType"])
        generation = pick(row, ["generation", "generationMW", "quantity"])
        timestamp = iso_z(pick(row, ["startTime", "settlementPeriodStartTime", "periodStartUTC", "publishDateTime", "settlementDate"])
        )
        if not fuel or generation == "" or not timestamp:
            continue
        try:
            mw = float(generation)
        except Exception:
            continue
        deduped[(timestamp, str(fuel).upper())] = (timestamp, str(fuel).upper(), mw)

    by_tech: dict[tuple[str, str], float] = defaultdict(float)
    for timestamp, fuel, mw in deduped.values():
        by_tech[(timestamp, group_for(fuel))] += mw

    out: list[dict[str, str]] = []
    for timestamp, tech in sorted(by_tech):
        out.append({
            "time": timestamp,
            "technology": tech,
            "generationMW": f"{by_tech[(timestamp, tech)]:.3f}",
            "source": SOURCE_LABEL,
        })
    return out, len(deduped)


def shard_path(year: int, month: int) -> Path:
    return OUT_ROOT / str(year) / f"generation_fuelhh_{year}_{month:02d}.csv"


def write_shard(path: Path, rows: list[dict[str, str]]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    return path.stat().st_size


def row_hash(rows: list[dict[str, str]]) -> str:
    h = hashlib.sha256()
    for row in rows:
        h.update(f"{row['time']}|{row['technology']}|{row['generationMW']}".encode("utf-8"))
    return "sha256:" + h.hexdigest()


def already_done(year: int, month: int) -> bool:
    path = shard_path(year, month)
    return path.exists() and path.stat().st_size > 0


def month_iter(start_ym: str):
    sy, sm = (int(x) for x in start_ym.split("-"))
    today = dt.datetime.now(dt.timezone.utc).date()
    last = dt.date(today.year, today.month, 1) - dt.timedelta(days=1)
    year, month = sy, sm
    while (year, month) <= (last.year, last.month):
        yield year, month
        month += 1
        if month > 12:
            year, month = year + 1, 1


def build_month(year: int, month: int) -> tuple[list[dict[str, str]], int, float, list[str]]:
    start_day, end_day = month_window(year, month)
    if end_day < start_day:
        return [], 0, 0.0, []
    raw: list[Any] = []
    failed: list[str] = []
    for w_start, w_end in windows(start_day, end_day, WINDOW_DAYS):
        try:
            chunk = fetch_window(w_start, w_end)
            raw.extend(chunk)
            print(f"{year}-{month:02d} {w_start} to {w_end}: {len(chunk)} raw rows")
        except Exception as exc:
            failed.append(f"{w_start} to {w_end}: {exc}")
            print(f"WARNING {year}-{month:02d} {w_start} to {w_end} failed: {exc}")
        time.sleep(REQUEST_DELAY_SECONDS)
    rows, deduped_count = clean_rows(raw)
    days = (end_day - start_day).days + 1
    techs_seen = len({row["technology"] for row in rows}) or 1
    expected = 48 * days * techs_seen
    completeness = round(min(1.0, len(rows) / expected), 4) if expected else 0.0
    return rows, deduped_count, completeness, failed


def write_progress(done: list[str], failed: list[str], remaining: list[str]) -> None:
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    PROGRESS_FILE.write_text(json.dumps({
        "schemaVersion": SCHEMA_VERSION,
        "updatedUTC": utc_now(),
        "source": SOURCE_LABEL,
        "startYearMonth": START_YEAR_MONTH,
        "windowDays": WINDOW_DAYS,
        "requestDelaySeconds": REQUEST_DELAY_SECONDS,
        "monthsDone": sorted(set(done)),
        "monthsFailed": sorted(set(failed)),
        "monthsRemaining": sorted(set(remaining)),
        "complete": len(remaining) == 0,
    }, indent=2) + "\n", encoding="utf-8")


def write_run_report(processed: dict[str, Any], skipped: list[str], failed_months: dict[str, str], remaining: list[str], ran_out_of_time: bool) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    JSON_REPORT_DIR.mkdir(parents=True, exist_ok=True)
    s = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    payload = {
        "schemaVersion": SCHEMA_VERSION,
        "updatedUTC": utc_now(),
        "source": SOURCE_LABEL,
        "startYearMonth": START_YEAR_MONTH,
        "windowDays": WINDOW_DAYS,
        "requestDelaySeconds": REQUEST_DELAY_SECONDS,
        "timeBudgetMinutes": TIME_BUDGET_MINUTES,
        "monthsProcessedThisRun": len(processed),
        "monthsSkippedAlreadyPresent": len(skipped),
        "monthsFailedThisRun": len(failed_months),
        "monthsRemainingAfterRun": len(remaining),
        "stoppedOnTimeBudget": ran_out_of_time,
        "backfillComplete": len(remaining) == 0,
        "processed": processed,
        "failedMonths": failed_months,
        "remaining": remaining,
    }
    lines = [
        f"# FUELHH Half-Hourly Backfill Run {s}",
        "",
        f"Updated UTC: {payload['updatedUTC']}",
        f"Source: {SOURCE_LABEL}",
        f"Start year-month: {START_YEAR_MONTH}",
        f"Window days per request: {WINDOW_DAYS}",
        f"Request delay seconds: {REQUEST_DELAY_SECONDS}",
        f"Months processed this run: {len(processed)}",
        f"Months skipped already present: {len(skipped)}",
        f"Months failed this run: {len(failed_months)}",
        f"Months still remaining after run: {len(remaining)}",
        f"Stopped on time budget: {ran_out_of_time}",
        f"Backfill complete: {len(remaining) == 0}",
        "",
        "## Processed",
    ]
    for ym, info in processed.items():
        lines.append(f"- {ym}: rows={info['rows']} completeness={info['completeness']} size={info['sizeMB']:.2f} MB")
    lines.extend(["", "## Failed", ""])
    if failed_months:
        for ym, detail in failed_months.items():
            lines.append(f"- {ym}: {detail}")
    else:
        lines.append("No failed months.")
    text = "\n".join(lines) + "\n"
    for path in (REPORT_DIR / f"FUELHH_BACKFILL_{s}.md", REPORT_DIR / "FUELHH_BACKFILL_LATEST.md"):
        path.write_text(text, encoding="utf-8")
    js = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    for path in (JSON_REPORT_DIR / f"FUELHH_BACKFILL_{s}.json", JSON_REPORT_DIR / "FUELHH_BACKFILL_LATEST.json"):
        path.write_text(js, encoding="utf-8")


def main() -> int:
    deadline = time.monotonic() + TIME_BUDGET_MINUTES * 60
    all_months = list(month_iter(START_YEAR_MONTH))
    done: list[str] = []
    failed_all: list[str] = []
    processed: dict[str, Any] = {}
    skipped: list[str] = []
    failed_months: dict[str, str] = {}
    ran_out_of_time = False

    for year, month in all_months:
        ym = f"{year}-{month:02d}"
        if already_done(year, month) and not FORCE:
            skipped.append(ym)
            done.append(ym)
            continue
        if time.monotonic() > deadline:
            ran_out_of_time = True
            print(f"Time budget reached. Stopping before {ym}.")
            break
        print(f"Building {ym}")
        try:
            rows, raw_count, completeness, failed_windows = build_month(year, month)
        except Exception as exc:
            failed_months[ym] = str(exc)
            failed_all.append(ym)
            continue
        if not rows:
            failed_months[ym] = "no rows returned"
            failed_all.append(ym)
            continue
        size = write_shard(shard_path(year, month), rows)
        size_mb = size / 1024 / 1024
        if size_mb > MAX_SHARD_MB:
            failed_months[ym] = f"shard {size_mb:.2f} MB exceeds {MAX_SHARD_MB} MB"
            shard_path(year, month).unlink(missing_ok=True)
            failed_all.append(ym)
            continue
        processed[ym] = {
            "rows": len(rows),
            "rawRows": raw_count,
            "completeness": completeness,
            "sizeMB": size_mb,
            "hash": row_hash(rows),
            "failedWindows": failed_windows,
        }
        done.append(ym)
        print(f"wrote {ym}: {len(rows)} rows, {size_mb:.2f} MB, completeness {completeness}")

    remaining = [f"{year}-{month:02d}" for year, month in all_months if f"{year}-{month:02d}" not in done]
    write_progress(done, failed_all, remaining)
    write_run_report(processed, skipped, failed_months, remaining, ran_out_of_time)
    print(f"Done. processed={len(processed)} skipped={len(skipped)} failed={len(failed_months)} remaining={len(remaining)} complete={len(remaining) == 0}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
