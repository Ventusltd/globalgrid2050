#!/usr/bin/env python3
"""
GlobalGrid2050 V5 daily frequency health and validation layer.

Reads the rolling 24 hour frequency CSV, updates a long term daily summary CSV,
and cross checks the latest stored sample against a fresh Elexon pull.
"""

from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean

from update_uk_frequency_v5 import (
    fetch_frequency_rows,
    iso_z,
    parse_time,
    utc_now,
)

ROOT = Path(__file__).resolve().parent.parent
FOLDER = ROOT / "uk_energy_tracking_v5"
RAW_CSV = FOLDER / "grid_frequency_history.csv"
DAILY_CSV = FOLDER / "grid_frequency_daily_health.csv"
DAILY_JSON = FOLDER / "live_grid_frequency_daily_health.json"
VALIDATION_CSV = FOLDER / "grid_frequency_validation.csv"
VALIDATION_JSON = FOLDER / "live_grid_frequency_validation.json"
REPORT_DIR = ROOT / "gridbot_reports"
REPORT_FILE = REPORT_DIR / "uk_frequency_daily_validation_v5_report.md"


def date_key(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d")


def read_raw_rows() -> list[dict]:
    if not RAW_CSV.exists():
        return []
    rows = []
    with RAW_CSV.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            dt = parse_time(row.get("source_time_utc"))
            if not dt:
                continue
            try:
                hz = float(row.get("frequency_hz") or 0)
            except ValueError:
                continue
            rows.append({
                "source_time_utc": iso_z(dt),
                "frequency_hz": hz,
                "captured_utc": row.get("captured_utc") or "",
                "source": row.get("source") or "Elexon",
                "status": row.get("status") or "ok",
            })
    return sorted(rows, key=lambda r: r["source_time_utc"])


def read_daily_existing() -> dict[str, dict]:
    if not DAILY_CSV.exists():
        return {}
    out = {}
    with DAILY_CSV.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            key = row.get("date_utc")
            if key:
                out[key] = row
    return out


def summarise_daily(rows: list[dict]) -> dict[str, dict]:
    buckets: dict[str, list[float]] = {}
    for row in rows:
        dt = parse_time(row.get("source_time_utc"))
        if not dt:
            continue
        buckets.setdefault(date_key(dt), []).append(float(row["frequency_hz"]))

    summaries = {}
    for day, values in buckets.items():
        if not values:
            continue
        min_hz = min(values)
        max_hz = max(values)
        avg_hz = mean(values)
        summaries[day] = {
            "date_utc": day,
            "sample_count": len(values),
            "avg_hz": round(avg_hz, 4),
            "min_hz": round(min_hz, 4),
            "max_hz": round(max_hz, 4),
            "samples_below_49_9": sum(1 for value in values if value < 49.9),
            "samples_above_50_1": sum(1 for value in values if value > 50.1),
            "largest_deviation_hz": round(max(abs(value - 50.0) for value in values), 4),
            "data_health": "ok" if len(values) >= 20 else "thin_sample",
            "last_updated_utc": iso_z(utc_now()),
        }
    return summaries


def write_daily(rows: list[dict]) -> list[dict]:
    existing = read_daily_existing()
    merged = {**existing, **summarise_daily(rows)}
    final = [merged[key] for key in sorted(merged.keys())]
    fields = [
        "date_utc",
        "sample_count",
        "avg_hz",
        "min_hz",
        "max_hz",
        "samples_below_49_9",
        "samples_above_50_1",
        "largest_deviation_hz",
        "data_health",
        "last_updated_utc",
    ]
    FOLDER.mkdir(parents=True, exist_ok=True)
    with DAILY_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(final)

    DAILY_JSON.write_text(json.dumps({
        "updated_utc": iso_z(utc_now()),
        "record_count": len(final),
        "latest_day": final[-1] if final else None,
        "source": "GlobalGrid2050 aggregation of Elexon frequency samples",
        "health": "ok" if final else "awaiting_daily_rows",
        "rows": final[-370:],
    }, indent=2), encoding="utf-8")
    return final


def read_validation_history() -> list[dict]:
    if not VALIDATION_CSV.exists():
        return []
    with VALIDATION_CSV.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def validate_latest(raw_rows: list[dict]) -> dict:
    stored = raw_rows[-1] if raw_rows else None
    source_rows, errors = fetch_frequency_rows()
    source_latest = source_rows[-1] if source_rows else None

    status = "awaiting_rows"
    delta_hz = None
    timestamp_match = False
    age_seconds = None
    if stored and source_latest:
        stored_dt = parse_time(stored.get("source_time_utc"))
        source_dt = parse_time(source_latest.get("source_time_utc"))
        if stored_dt and source_dt:
            age_seconds = int(abs((source_dt - stored_dt).total_seconds()))
            timestamp_match = stored_dt == source_dt
        delta_hz = round(abs(float(source_latest["frequency_hz"]) - float(stored["frequency_hz"])), 6)
        status = "ok" if delta_hz <= 0.0001 and age_seconds is not None and age_seconds <= 300 else "check_source_lag"
    elif stored:
        status = "source_fetch_failed"
    elif source_latest:
        status = "local_store_empty"

    return {
        "checked_utc": iso_z(utc_now()),
        "status": status,
        "stored_time_utc": stored.get("source_time_utc") if stored else None,
        "stored_hz": stored.get("frequency_hz") if stored else None,
        "source_time_utc": source_latest.get("source_time_utc") if source_latest else None,
        "source_hz": source_latest.get("frequency_hz") if source_latest else None,
        "delta_hz": delta_hz,
        "timestamp_match": timestamp_match,
        "source_lag_seconds": age_seconds,
        "errors": " | ".join(errors[-3:]),
    }


def write_validation(row: dict) -> list[dict]:
    history = read_validation_history()
    history.append(row)
    history = history[-500:]
    fields = [
        "checked_utc",
        "status",
        "stored_time_utc",
        "stored_hz",
        "source_time_utc",
        "source_hz",
        "delta_hz",
        "timestamp_match",
        "source_lag_seconds",
        "errors",
    ]
    with VALIDATION_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(history)
    VALIDATION_JSON.write_text(json.dumps({
        "updated_utc": iso_z(utc_now()),
        "latest": row,
        "history_count": len(history),
        "health": row["status"],
    }, indent=2), encoding="utf-8")
    return history


def write_report(daily_rows: list[dict], validation: dict) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    latest_day = daily_rows[-1] if daily_rows else None
    REPORT_FILE.write_text("\n".join([
        "# UK Frequency Daily Validation V5 Report",
        "",
        f"Updated UTC: {iso_z(utc_now())}",
        f"Daily records retained: {len(daily_rows)}",
        f"Latest daily row: {json.dumps(latest_day, ensure_ascii=False)}",
        f"Validation: {json.dumps(validation, ensure_ascii=False)}",
        "",
    ]), encoding="utf-8")


def main() -> None:
    raw_rows = read_raw_rows()
    daily_rows = write_daily(raw_rows)
    validation = validate_latest(raw_rows)
    write_validation(validation)
    write_report(daily_rows, validation)
    print(json.dumps({
        "raw_rows": len(raw_rows),
        "daily_rows": len(daily_rows),
        "validation": validation,
    }, indent=2))


if __name__ == "__main__":
    main()
