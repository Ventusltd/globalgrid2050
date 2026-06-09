#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "confirmed" / "pvlive_solar_daily_candidate.json"
REPORT_MD = ROOT / "data_science_protocol" / "audit_reports" / "PVLIVE_SOLAR_CANDIDATE_LATEST.md"
REPORT_JSON = ROOT / "data_science_protocol" / "audit_reports" / "json" / "PVLIVE_SOLAR_CANDIDATE_LATEST.json"
PVLIVE_URL = "https://api.solar.sheffield.ac.uk/pvlive/api/v4/gsp/0"


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


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
        return ""


def http_json(url: str) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": "GlobalGrid2050 GridBot"})
    with urllib.request.urlopen(req, timeout=45) as response:
        return json.loads(response.read().decode("utf-8"))


def extract_rows(payload: Any) -> list[Any]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("data", "results", "items"):
            if isinstance(payload.get(key), list):
                return payload[key]
    return []


def parse_power(value: Any) -> float | None:
    try:
        out = float(value)
        if out == out:
            return out
    except Exception:
        return None
    return None


def parse_pvlive_row(row: Any) -> tuple[str, float] | None:
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
    t = iso_z(timestamp)
    mw = parse_power(generation)
    if not t or mw is None:
        return None
    return t, mw


def candidate_urls(start: dt.datetime, end: dt.datetime) -> list[str]:
    start_iso = start.isoformat().replace("+00:00", "Z")
    end_iso = end.isoformat().replace("+00:00", "Z")
    start_plain = start.strftime("%Y-%m-%dT%H:%M:%SZ")
    end_plain = end.strftime("%Y-%m-%dT%H:%M:%SZ")
    start_date = start.date().isoformat()
    end_date = end.date().isoformat()
    params = [
        {"start": start_iso, "end": end_iso},
        {"start": start_plain, "end": end_plain},
        {"from": start_iso, "to": end_iso},
        {"datetime_from": start_iso, "datetime_to": end_iso},
        {"start_date": start_date, "end_date": end_date},
    ]
    return [PVLIVE_URL + "?" + urllib.parse.urlencode(p) for p in params]


def fetch_day(day: dt.date) -> tuple[list[float], str, str]:
    start = dt.datetime.combine(day, dt.time(0, 0), tzinfo=dt.timezone.utc)
    end = dt.datetime.combine(day, dt.time(23, 59), tzinfo=dt.timezone.utc)
    errors: list[str] = []
    for url in candidate_urls(start, end):
        try:
            values: list[float] = []
            for row in extract_rows(http_json(url)):
                parsed = parse_pvlive_row(row)
                if parsed:
                    values.append(parsed[1])
            if values:
                return values, url, ""
        except Exception as exc:
            errors.append(str(exc))
    return [], "", "; ".join(errors[-3:])


def load_existing() -> dict[str, Any]:
    if not OUT.exists():
        return {}
    try:
        payload = json.loads(OUT.read_text(encoding="utf-8"))
        return {row["date"]: row for row in payload.get("rows", []) if row.get("date")}
    except Exception:
        return {}


def write_json(path: Path, payload: Any) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    path.write_text(text, encoding="utf-8")
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def write_report(report: dict[str, Any]) -> None:
    REPORT_MD.parent.mkdir(parents=True, exist_ok=True)
    REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    REPORT_JSON.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    REPORT_MD.write_text("\n".join([
        "# PVLive Solar Candidate Fetch Audit",
        "",
        f"Generated UTC: `{report['generatedUTC']}`",
        f"Status: `{report['status']}`",
        f"Days requested: `{report['daysRequested']}`",
        f"Days with rows: `{report['daysWithRows']}`",
        f"Output path: `{report['outputPath']}`",
        f"Output rows: `{report['outputRows']}`",
        f"Output size bytes: `{report['outputSizeBytes']}`",
        f"SHA 256: `{report['sha256']}`",
        "",
        "Source: Sheffield Solar PVLive. Method state: PVLIVE EMBEDDED ESTIMATE.",
        "This is a solar output layer. It does not replace confirmed Elexon FUELHH for transmission metered fuels.",
    ]) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=30)
    args = ap.parse_args()
    today = dt.datetime.now(dt.timezone.utc).date()
    start_day = today - dt.timedelta(days=max(1, args.days))
    existing = load_existing()
    working_url = ""
    failures: list[dict[str, str]] = []
    days_with_rows = 0
    for offset in range(max(1, args.days)):
        day = start_day + dt.timedelta(days=offset)
        values, url, err = fetch_day(day)
        if values:
            days_with_rows += 1
            if not working_url:
                working_url = url
            existing[day.isoformat()] = {
                "date": day.isoformat(),
                "technology": "Solar",
                "averageMW": round(sum(values) / len(values), 3),
                "highMW": round(max(values), 3),
                "lowMW": round(min(values), 3),
                "sampleCount": len(values),
                "source": "Sheffield Solar PVLive",
                "methodState": "PVLIVE EMBEDDED ESTIMATE",
                "status": "candidate",
            }
        else:
            failures.append({"date": day.isoformat(), "error": err or "no rows"})
    rows = [existing[k] for k in sorted(existing)]
    payload = {
        "schemaVersion": "0.1.0-pvlive-solar-daily-candidate",
        "generatedUTC": utc_now(),
        "title": "PVLive solar daily MW candidate",
        "timezone": "UTC",
        "source": "Sheffield Solar PVLive",
        "methodState": "PVLIVE EMBEDDED ESTIMATE",
        "rows": rows,
    }
    sha = write_json(OUT, payload)
    report = {
        "generatedUTC": utc_now(),
        "status": "ok" if days_with_rows else "no rows fetched",
        "daysRequested": args.days,
        "daysWithRows": days_with_rows,
        "failures": failures[-10:],
        "workingUrl": working_url,
        "outputPath": str(OUT.relative_to(ROOT)),
        "outputRows": len(rows),
        "outputSizeBytes": OUT.stat().st_size,
        "sha256": sha,
    }
    write_report(report)
    if days_with_rows == 0:
        raise SystemExit("No PVLive solar rows fetched")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
