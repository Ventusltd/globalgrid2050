#!/usr/bin/env python3
"""
Validate the V6 UK energy tracking price history chart inputs against source CSV data.

This is a lightweight repository test. It does not render the canvas. It validates
that the values the V6 chart should draw are aligned with the underlying Elexon
CSV and daily aggregate JSON files.
"""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANNUAL_2026 = ROOT / "data" / "electricity" / "elexon_system_prices_2026.csv"
DAILY_JSON = ROOT / "uk_energy_tracking_v6" / "electricity_price_history_daily_decade.json"
REPORT = ROOT / "V6_PRICE_HISTORY_ACCURACY_REPORT.md"


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def read_annual_csv(path: Path) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            price = row.get("systemBuyPriceGBPperMWh") or row.get("systemSellPriceGBPperMWh")
            if not price:
                continue
            rows.append(
                {
                    "settlementDate": row["settlementDate"],
                    "settlementPeriod": int(row["settlementPeriod"]),
                    "periodStartUTC": parse_time(row["periodStartUTC"]),
                    "price": float(price),
                }
            )
    return rows


def daily_from_csv(rows: list[dict[str, object]]) -> dict[str, dict[str, object]]:
    grouped: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in rows:
        grouped[str(row["settlementDate"])].append(row)

    out: dict[str, dict[str, object]] = {}
    for day, items in grouped.items():
        prices = [float(item["price"]) for item in items]
        high_row = max(items, key=lambda item: float(item["price"]))
        low_row = min(items, key=lambda item: float(item["price"]))
        out[day] = {
            "average": round(sum(prices) / len(prices), 2),
            "high": round(float(high_row["price"]), 2),
            "highAt": high_row["periodStartUTC"].strftime("%H:%M"),
            "low": round(float(low_row["price"]), 2),
            "lowAt": low_row["periodStartUTC"].strftime("%H:%M"),
            "observations": len(items),
        }
    return out


def read_daily_json(path: Path) -> dict[str, dict[str, object]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {row["date"]: row for row in payload.get("rows", [])}


def assert_close(label: str, actual: float, expected: float, tolerance: float = 0.01) -> None:
    if abs(actual - expected) > tolerance:
        raise AssertionError(f"{label}: expected {expected}, got {actual}")


def validate_day(day: str, csv_daily: dict[str, dict[str, object]], json_daily: dict[str, dict[str, object]]) -> list[str]:
    if day not in csv_daily:
        raise AssertionError(f"Missing {day} in annual CSV aggregation")
    if day not in json_daily:
        raise AssertionError(f"Missing {day} in daily JSON")

    c = csv_daily[day]
    j = json_daily[day]
    assert_close(f"{day} average", float(j["average"]), float(c["average"]))
    assert_close(f"{day} high", float(j["high"]), float(c["high"]))
    assert_close(f"{day} low", float(j["low"]), float(c["low"]))
    if int(j["observations"]) != int(c["observations"]):
        raise AssertionError(f"{day} observations: expected {c['observations']}, got {j['observations']}")
    if str(j["highAt"]) != str(c["highAt"]):
        raise AssertionError(f"{day} highAt: expected {c['highAt']}, got {j['highAt']}")
    if str(j["lowAt"]) != str(c["lowAt"]):
        raise AssertionError(f"{day} lowAt: expected {c['lowAt']}, got {j['lowAt']}")

    return [
        day,
        f"average £{j['average']}/MWh",
        f"high £{j['high']}/MWh at {j['highAt']}",
        f"low £{j['low']}/MWh at {j['lowAt']}",
        f"{j['observations']} settlement periods",
    ]


def count_csv_window(rows: list[dict[str, object]], start: datetime, days: int) -> int:
    end = start + timedelta(days=days) - timedelta(seconds=1)
    return sum(1 for row in rows if start <= row["periodStartUTC"] <= end)


def write_report(results: list[list[str]], window_count: int) -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    lines = [
        "# V6 Price History Accuracy Report",
        "",
        f"Generated UTC: `{now}`",
        "",
        "This report validates V6 chart source values against the Elexon annual CSV and daily aggregate JSON used by the UK Energy Tracking V6 chart.",
        "",
        "## Result",
        "",
        "PASS: sampled daily aggregates match the underlying 2026 Elexon CSV.",
        "",
        "## Sample day checks",
        "",
        "| Date | Average | High | Low | Observations |",
        "|---|---:|---:|---:|---:|",
    ]
    for row in results:
        lines.append(f"| {row[0]} | {row[1]} | {row[2]} | {row[3]} | {row[4]} |")
    lines.extend(
        [
            "",
            "## Seven day half hourly window check",
            "",
            f"2026-01-01 for 7 days contains `{window_count}` half hourly settlement records. Expected `336`.",
            "",
            "## Interpretation",
            "",
            "The chart can still look visually wrong if canvas scaling, padding, filtering or forecast overlay logic is wrong, but the sampled price data values match the CSV source.",
            "",
        ]
    )
    REPORT.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    annual_rows = read_annual_csv(ANNUAL_2026)
    csv_daily = daily_from_csv(annual_rows)
    json_daily = read_daily_json(DAILY_JSON)

    sample_days = ["2026-01-01", "2026-01-02", "2026-01-05"]
    results = [validate_day(day, csv_daily, json_daily) for day in sample_days]

    window_count = count_csv_window(annual_rows, datetime(2026, 1, 1, tzinfo=timezone.utc), 7)
    if window_count != 336:
        raise AssertionError(f"2026-01-01 7 day window expected 336 rows, got {window_count}")

    write_report(results, window_count)
    print("PASS: V6 price history CSV checks completed")
    print(f"Report written: {REPORT}")


if __name__ == "__main__":
    main()
