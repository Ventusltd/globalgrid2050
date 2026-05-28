#!/usr/bin/env python3
"""
Manual V5 frequency weekly backfill.

Attempts to fetch compact weekly windows from Elexon and writes a 52 week
frequency health file. If the source does not serve older FREQ windows, the
report records the failed weeks and the live weekly file continues growing
forward from scheduled 5 minute collection.
"""

from __future__ import annotations

import json
import os
import time
from datetime import timedelta

from update_uk_frequency_v5 import (
    REPORT_DIR,
    fetch_frequency_rows_for_window,
    iso_z,
    utc_now,
    week_start,
    write_weekly_outputs,
)

REPORT_FILE = REPORT_DIR / "uk_frequency_weekly_backfill_v5_report.md"
WEEKS = max(1, min(int(os.getenv("GG_FREQUENCY_BACKFILL_WEEKS", "52")), 52))
SLEEP_SECONDS = max(0, min(int(os.getenv("GG_FREQUENCY_BACKFILL_SLEEP_SECONDS", "2")), 20))


def main() -> None:
    now = utc_now()
    current_week = week_start(now)
    all_rows = []
    report = [
        "# UK Frequency Weekly Backfill V5 Report",
        "",
        f"Started UTC: {iso_z(now)}",
        f"Requested weeks: {WEEKS}",
        "",
        "## Weekly windows",
    ]

    for offset in range(WEEKS - 1, -1, -1):
        start = current_week - timedelta(weeks=offset)
        end = min(start + timedelta(days=7), now)
        rows, errors = fetch_frequency_rows_for_window(start, end)
        all_rows.extend(rows)
        status = "ok" if rows else "no_rows"
        report.append(
            f"- {iso_z(start)} to {iso_z(end)}: {status}, rows={len(rows)}, errors={len(errors)}"
        )
        if errors:
            report.append(f"  - last error: {errors[-1]}")
        if SLEEP_SECONDS:
            time.sleep(SLEEP_SECONDS)

    write_weekly_outputs(all_rows)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    report.extend([
        "",
        "## Summary",
        f"Total source rows fetched: {len(all_rows)}",
        "If older weeks show no rows, Elexon may not expose historic FREQ data through the tested public endpoint windows.",
    ])
    REPORT_FILE.write_text("\n".join(report) + "\n", encoding="utf-8")
    print(json.dumps({"weeks_requested": WEEKS, "rows_fetched": len(all_rows)}, indent=2))


if __name__ == "__main__":
    main()
