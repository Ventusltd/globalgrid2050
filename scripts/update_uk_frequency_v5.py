#!/usr/bin/env python3
"""
GlobalGrid2050 V5 UK grid frequency collector.

Keeps a rolling 24 hour UK grid frequency dataset for the V5 tracker.
The workflow is scheduled inside GitHub Actions limits and writes only data,
summary JSON and a GridBot report after the front end assets exist.
"""

from __future__ import annotations

import csv
import json
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from statistics import mean
from typing import Any
from urllib.parse import urlencode

import requests

ROOT = Path(__file__).resolve().parent.parent
FOLDER = ROOT / "uk_energy_tracking_v5"
CSV_FILE = FOLDER / "grid_frequency_history.csv"
JSON_FILE = FOLDER / "live_grid_frequency.json"
REPORT_DIR = ROOT / "gridbot_reports"
REPORT_FILE = REPORT_DIR / "uk_frequency_v5_report.md"

ELEXON = "https://data.elexon.co.uk/bmrs/api/v1"
TIMEOUT = 18
ROLLING_HOURS = int(os.getenv("GG_FREQUENCY_ROLLING_HOURS", "24"))
LOOKBACK_MINUTES = int(os.getenv("GG_FREQUENCY_LOOKBACK_MINUTES", "180"))
BURST_SAMPLES = max(1, min(int(os.getenv("GG_FREQUENCY_BURST_SAMPLES", "1")), 12))
SLEEP_SECONDS = max(0, min(int(os.getenv("GG_FREQUENCY_SLEEP_SECONDS", "120")), 300))
USER_AGENT = "GlobalGrid2050 V5 frequency collector using public Elexon data"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_z(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_time(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(float(value), timezone.utc)
    text = str(value).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M"):
            try:
                dt = datetime.strptime(text, fmt).replace(tzinfo=timezone.utc)
                break
            except ValueError:
                dt = None
        if dt is None:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def http_json(url: str) -> Any:
    response = requests.get(
        url,
        timeout=TIMEOUT,
        headers={"Accept": "application/json", "User-Agent": USER_AGENT},
    )
    response.raise_for_status()
    return response.json()


def candidate_urls(start: datetime, end: datetime) -> list[str]:
    start_min = start.strftime("%Y-%m-%dT%H:%MZ")
    end_min = end.strftime("%Y-%m-%dT%H:%MZ")
    start_sec = iso_z(start)
    end_sec = iso_z(end)
    return [
        f"{ELEXON}/datasets/FREQ?" + urlencode({"publishDateTimeFrom": start_min, "publishDateTimeTo": end_min, "format": "json"}),
        f"{ELEXON}/datasets/FREQ?" + urlencode({"from": start_min, "to": end_min, "format": "json"}),
        f"{ELEXON}/balancing/system-frequency?" + urlencode({"from": start_sec, "to": end_sec, "format": "json"}),
        f"{ELEXON}/balancing/system/frequency?" + urlencode({"from": start_sec, "to": end_sec, "format": "json"}),
    ]


def extract_rows(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        rows = payload.get("data") or payload.get("items") or payload.get("results") or []
    else:
        rows = payload
    if isinstance(rows, dict):
        rows = [rows]
    if not isinstance(rows, list):
        return []

    output: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        lower = {str(k).lower(): v for k, v in row.items()}
        frequency = None
        for key in ("frequency", "systemfrequency", "frequencyhz", "systemfrequencyhz", "value", "frequencyvalue"):
            value = lower.get(key)
            if value in (None, ""):
                continue
            try:
                candidate = float(value)
            except (TypeError, ValueError):
                continue
            if 45 <= candidate <= 55:
                frequency = candidate
                break
        if frequency is None:
            for value in row.values():
                try:
                    candidate = float(value)
                except (TypeError, ValueError):
                    continue
                if 45 <= candidate <= 55:
                    frequency = candidate
                    break
        if frequency is None:
            continue

        source_dt = None
        for key in ("publishtime", "publishdatetime", "starttime", "datetime", "time", "timestamp"):
            source_dt = parse_time(lower.get(key))
            if source_dt:
                break
        if source_dt is None:
            source_dt = utc_now()

        output.append({
            "source_time_utc": iso_z(source_dt),
            "frequency_hz": round(float(frequency), 4),
            "captured_utc": iso_z(utc_now()),
            "source": "Elexon",
            "status": "ok",
        })
    return output


def fetch_frequency_rows() -> tuple[list[dict[str, Any]], list[str]]:
    end = utc_now()
    start = end - timedelta(minutes=LOOKBACK_MINUTES)
    errors: list[str] = []
    for url in candidate_urls(start, end):
        try:
            rows = extract_rows(http_json(url))
            if rows:
                return rows, errors
            errors.append(f"no rows from {url}")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{type(exc).__name__}: {exc} from {url}")
    return [], errors


def read_existing() -> list[dict[str, Any]]:
    if not CSV_FILE.exists():
        return []
    rows = []
    with CSV_FILE.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            try:
                rows.append({
                    "source_time_utc": row.get("source_time_utc") or "",
                    "frequency_hz": round(float(row.get("frequency_hz") or 0), 4),
                    "captured_utc": row.get("captured_utc") or "",
                    "source": row.get("source") or "Elexon",
                    "status": row.get("status") or "ok",
                })
            except ValueError:
                continue
    return rows


def write_outputs(rows: list[dict[str, Any]], errors: list[str]) -> None:
    FOLDER.mkdir(parents=True, exist_ok=True)
    cutoff = utc_now() - timedelta(hours=ROLLING_HOURS)
    dedup: dict[str, dict[str, Any]] = {}
    for row in rows:
        dt = parse_time(row.get("source_time_utc") or row.get("captured_utc"))
        if not dt or dt < cutoff:
            continue
        key = iso_z(dt)
        row["source_time_utc"] = key
        dedup[key] = row

    final = [dedup[key] for key in sorted(dedup.keys())]
    with CSV_FILE.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["source_time_utc", "frequency_hz", "captured_utc", "source", "status"])
        writer.writeheader()
        writer.writerows(final)

    values = [float(row["frequency_hz"]) for row in final]
    latest = final[-1] if final else None
    snapshot = {
        "updated_utc": iso_z(utc_now()),
        "window_hours": ROLLING_HOURS,
        "record_count": len(final),
        "latest": latest,
        "min_hz": round(min(values), 4) if values else None,
        "max_hz": round(max(values), 4) if values else None,
        "avg_hz": round(mean(values), 4) if values else None,
        "source": "Elexon",
        "health": "ok" if latest else "awaiting_source_rows",
        "errors": errors[-4:],
    }
    JSON_FILE.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
    print(f"Retained {len(final)} frequency records")
    if latest:
        print(f"Latest frequency {latest['frequency_hz']} Hz at {latest['source_time_utc']}")
    if errors:
        print("::warning::" + " | ".join(errors[-2:]))


def write_report(errors: list[str]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    live = json.loads(JSON_FILE.read_text(encoding="utf-8")) if JSON_FILE.exists() else {}
    lines = [
        "# UK Frequency V5 GridBot Report",
        "",
        f"Updated UTC: {iso_z(utc_now())}",
        f"Rolling window hours: {ROLLING_HOURS}",
        f"Records retained: {live.get('record_count', 0)}",
        f"Latest: {json.dumps(live.get('latest'), ensure_ascii=False)}",
        f"Min Hz: {live.get('min_hz')}",
        f"Max Hz: {live.get('max_hz')}",
        f"Average Hz: {live.get('avg_hz')}",
        f"Health: {live.get('health')}",
        "",
        "## Recent fetch issues",
    ]
    lines.extend([f"- {error}" for error in errors[-8:]] or ["- none"])
    REPORT_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_once() -> list[str]:
    existing = read_existing()
    fetched, errors = fetch_frequency_rows()
    if not fetched:
        errors.append("No source rows fetched this pass. Existing 24 hour file preserved and trimmed.")
    write_outputs(existing + fetched, errors)
    return errors


def main() -> None:
    all_errors: list[str] = []
    for index in range(BURST_SAMPLES):
        print(f"Frequency sample pass {index + 1} of {BURST_SAMPLES}")
        all_errors.extend(run_once())
        if index < BURST_SAMPLES - 1:
            time.sleep(SLEEP_SECONDS)
    write_report(all_errors)


if __name__ == "__main__":
    main()
