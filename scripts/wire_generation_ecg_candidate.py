#!/usr/bin/env python3
"""
GlobalGrid2050 ECG candidate wiring helper.

Adds the browser safe all technology 30 minute ECG candidate path to the generation
history config and routes the recent generation loader to it without touching the
renderer.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPORT_DIR = ROOT / "data_science_protocol" / "audit_reports"
REPORT_JSON_DIR = REPORT_DIR / "json"

CONFIG_PATH = ROOT / "uk_energy_tracking_v6" / "generation_history" / "live-config.js"
LOADER_PATH = ROOT / "uk_energy_tracking_v6" / "generation_history" / "load_generation_history_data.js"
ECG_PATH = "/uk_energy_tracking_v6/generation_history/generation_ecg_all_technologies_30d_30min_candidate.json"
ECG_REPO_PATH = ROOT / "uk_energy_tracking_v6" / "generation_history" / "generation_ecg_all_technologies_30d_30min_candidate.json"


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""


def write_text(path: Path, text: str) -> None:
    path.write_text(text.rstrip() + "\n", encoding="utf-8")


def patch_config(apply: bool) -> dict:
    text = read_text(CONFIG_PATH)
    exists = CONFIG_PATH.exists()
    already = "recentEcg" in text and ECG_PATH in text
    changed = False
    if exists and not already:
        old = "  recentHalfHourly:'/uk_energy_tracking_v6/generation_history/generation_recent_30d_30min.json',"
        new = old + "\n  recentEcg:'" + ECG_PATH + "',"
        if old in text:
            text = text.replace(old, new)
            changed = True
        elif "recentHalfHourly:" in text:
            lines = text.splitlines()
            out = []
            inserted = False
            for line in lines:
                out.append(line)
                if "recentHalfHourly:" in line and not inserted:
                    out.append("  recentEcg:'" + ECG_PATH + "',")
                    inserted = True
            text = "\n".join(out) + "\n"
            changed = inserted
        if apply and changed:
            write_text(CONFIG_PATH, text)
    return {
        "path": CONFIG_PATH.relative_to(ROOT).as_posix(),
        "exists": exists,
        "recentEcgAlreadyPresent": already,
        "wouldChange": bool(exists and not already and changed),
        "applied": bool(apply and exists and not already and changed),
    }


def patch_loader(apply: bool) -> dict:
    text = read_text(LOADER_PATH)
    exists = LOADER_PATH.exists()
    old = "function loadRecent(){return loadJsonOnce('recent',cfg().recentHalfHourly)}"
    new = "function loadRecent(){return loadJsonOnce('recent',cfg().recentEcg||cfg().recentHalfHourly)}"
    already = new in text
    changed = False
    if exists and not already and old in text:
        text = text.replace(old, new)
        changed = True
        if apply:
            write_text(LOADER_PATH, text)
    return {
        "path": LOADER_PATH.relative_to(ROOT).as_posix(),
        "exists": exists,
        "rendererTouched": False,
        "usesRecentEcgFallback": already or changed,
        "wouldChange": bool(exists and not already and changed),
        "applied": bool(apply and exists and not already and changed),
    }


def render_report(payload: dict) -> str:
    lines = [
        "# GlobalGrid2050 ECG Candidate Wiring Report",
        "",
        f"Generated UTC: `{payload['generatedUTC']}`",
        f"Mode: `{payload['mode']}`",
        "",
        "## Results",
        "",
        f"ECG file exists: `{payload['ecgFileExists']}`",
        f"ECG file size bytes: `{payload['ecgFileSizeBytes']}`",
        f"Renderer touched: `False`",
        "",
        "## Config",
        "",
        json.dumps(payload["config"], indent=2),
        "",
        "## Loader",
        "",
        json.dumps(payload["loader"], indent=2),
        "",
        "## Rule",
        "",
        payload["rule"],
    ]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    config_result = patch_config(args.apply)
    loader_result = patch_loader(args.apply)
    size = ECG_REPO_PATH.stat().st_size if ECG_REPO_PATH.exists() else 0
    payload = {
        "schemaVersion": "1.0.0",
        "generatedUTC": utc_now(),
        "mode": "apply" if args.apply else "audit only",
        "ecgPath": ECG_PATH,
        "ecgRepoPath": ECG_REPO_PATH.relative_to(ROOT).as_posix(),
        "ecgFileExists": ECG_REPO_PATH.exists(),
        "ecgFileSizeBytes": size,
        "config": config_result,
        "loader": loader_result,
        "rule": "Renderer untouched. Loader uses recentEcg when present and falls back to recentHalfHourly. Dropdown filtering remains unchanged.",
    }

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    s = stamp()
    md = REPORT_DIR / f"ECG_CANDIDATE_WIRING_{s}.md"
    js = REPORT_JSON_DIR / f"ECG_CANDIDATE_WIRING_{s}.json"
    latest_md = REPORT_DIR / "ECG_CANDIDATE_WIRING_LATEST.md"
    latest_js = REPORT_JSON_DIR / "ECG_CANDIDATE_WIRING_LATEST.json"
    md_text = render_report(payload)
    js_text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    write_text(md, md_text)
    write_text(js, js_text)
    write_text(latest_md, md_text)
    write_text(latest_js, js_text)
    print(md_text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
