#!/usr/bin/env python3
"""
GlobalGrid2050 V6 UK grid frequency collector.

This deliberately reuses the proven V5 collector logic but retargets the output
paths to the V6 tracker. The V6 page keeps its own data files while the V5
collector remains untouched for rollback and comparison.
"""

from __future__ import annotations

import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
V5_SCRIPT = ROOT / "scripts" / "update_uk_frequency_v5.py"
V6_FOLDER = ROOT / "uk_energy_tracking_v6"
REPORT_DIR = ROOT / "gridbot_reports"


def main() -> None:
    if not V5_SCRIPT.exists():
        raise FileNotFoundError(f"Missing V5 reference collector: {V5_SCRIPT}")

    ns = runpy.run_path(str(V5_SCRIPT), run_name="gg_frequency_v5_reference_for_v6")

    ns["FOLDER"] = V6_FOLDER
    ns["CSV_FILE"] = V6_FOLDER / "grid_frequency_history.csv"
    ns["JSON_FILE"] = V6_FOLDER / "live_grid_frequency.json"
    ns["WEEKLY_CSV_FILE"] = V6_FOLDER / "grid_frequency_weekly_health.csv"
    ns["WEEKLY_JSON_FILE"] = V6_FOLDER / "live_grid_frequency_weekly_health.json"
    ns["REPORT_DIR"] = REPORT_DIR
    ns["REPORT_FILE"] = REPORT_DIR / "uk_frequency_v6_report.md"
    ns["USER_AGENT"] = "GlobalGrid2050 V6 frequency collector using public Elexon data"

    ns["main"]()


if __name__ == "__main__":
    main()
