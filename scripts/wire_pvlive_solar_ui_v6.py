#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "uk_energy_tracking_v6" / "generation_history" / "live-config.js"
LOADER = ROOT / "uk_energy_tracking_v6" / "generation_history" / "load_generation_history_data.js"
INDEX = ROOT / "uk_energy_tracking_v6" / "generation_history" / "index.md"
REPORT = ROOT / "uk_energy_tracking_v6" / "generation_history" / "PVLIVE_SOLAR_UI_WIRE_REPORT.md"

SOLAR_PATH = "/uk_energy_tracking_v6/generation_history/pvlive_solar_daily_browser.json"


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def replace_once(text: str, old: str, new: str, label: str) -> tuple[str, bool]:
    if new in text:
        return text, False
    if old not in text:
        raise SystemExit(f"Expected text not found for {label}")
    return text.replace(old, new, 1), True


def patch_config() -> bool:
    text = CONFIG.read_text(encoding="utf-8")
    old = "  dailyHistoryFallback:'/data/generation/elexon_generation_sources_2016.json',\n"
    new = old + f"  solarDaily:'{SOLAR_PATH}',\n"
    text, changed = replace_once(text, old, new, "config solarDaily insertion")
    CONFIG.write_text(text, encoding="utf-8")
    return changed


def patch_loader() -> bool:
    text = LOADER.read_text(encoding="utf-8")
    old = "function loadDaily(){return loadJsonOnce('daily',cfg().dailyHistory)}\nfunction loadRecent(){return loadJsonOnce('recent',cfg().recentEcg||cfg().recentHalfHourly)}"
    new = "function loadDaily(){return loadJsonOnce('daily',cfg().dailyHistory)}\nfunction loadSolarDaily(){return loadJsonOnce('solarDaily',cfg().solarDaily||cfg().dailyHistory)}\nfunction loadRecent(){return loadJsonOnce('recent',cfg().recentEcg||cfg().recentHalfHourly)}"
    text, changed_a = replace_once(text, old, new, "loader solarDaily loader")
    old2 = "function loadDailyWindow(meta,technology){return loadDaily().then(function(all){var rows=all.filter(function(r){var t=new Date(r.date+'T12:00:00Z');return t>=meta.start&&t<=meta.end});rows=dedupe(sortDaily(rows),function(r){return r.date+'|'+r.technology});if(isAll(technology))return{rows:totalDaily(rows),series:seriesDaily(rows),technology:'All generation total'};var only=sortDaily(rows.filter(function(r){return r.technology===technology}));return{rows:only,series:[{technology:technology,rows:only}],technology:technology}})}"
    new2 = "function loadDailyWindow(meta,technology){var source=technology==='Solar'?loadSolarDaily():loadDaily();return source.then(function(all){var rows=all.filter(function(r){var t=new Date(r.date+'T12:00:00Z');return t>=meta.start&&t<=meta.end});rows=dedupe(sortDaily(rows),function(r){return r.date+'|'+r.technology});if(isAll(technology))return{rows:totalDaily(rows),series:seriesDaily(rows),technology:'All generation total'};var only=sortDaily(rows.filter(function(r){return r.technology===technology}));return{rows:only,series:[{technology:technology,rows:only}],technology:technology}})}"
    text, changed_b = replace_once(text, old2, new2, "loader solarDaily routing")
    LOADER.write_text(text, encoding="utf-8")
    return changed_a or changed_b


def patch_index_note() -> bool:
    text = INDEX.read_text(encoding="utf-8")
    old = "Embedded or national solar output will be added as a separate layer."
    new = "Embedded solar output is now routed through a separate PVLive candidate layer where the solar browser file is present."
    if new in text:
        return False
    if old not in text:
        raise SystemExit("Expected source transparency sentence not found")
    INDEX.write_text(text.replace(old, new, 1), encoding="utf-8")
    return True


def write_report(changes: dict[str, bool]) -> None:
    REPORT.write_text("\n".join([
        "# PVLive Solar UI Wire Report",
        "",
        f"Generated UTC: `{utc_now()}`",
        "",
        "## Purpose",
        "Wire the Generation History V6 Solar selection to a separate PVLive solar browser file for historic daily solar views.",
        "",
        "## Changes",
        f"live-config.js solarDaily added or already present: `{changes['config']}`",
        f"load_generation_history_data.js solarDaily route added or already present: `{changes['loader']}`",
        f"index.md source note updated or already present: `{changes['index']}`",
        "",
        "## Guardrails",
        "recentEcg is not changed.",
        "FUELHH dailyHistory remains available for non solar historic technologies.",
        "PVLive is marked as a candidate embedded solar estimate layer, not confirmed FUELHH transmission data.",
    ]) + "\n", encoding="utf-8")


def main() -> int:
    changes = {
        "config": patch_config(),
        "loader": patch_loader(),
        "index": patch_index_note(),
    }
    write_report(changes)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
