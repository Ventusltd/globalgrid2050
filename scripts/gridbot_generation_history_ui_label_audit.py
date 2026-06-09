#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPORT_DIR = ROOT / 'data_science_protocol' / 'audit_reports'
JSON_DIR = REPORT_DIR / 'json'

RENDER = ROOT / 'uk_energy_tracking_v6' / 'generation_history' / 'render_generation_history_chart.js'
INDEX = ROOT / 'uk_energy_tracking_v6' / 'generation_history' / 'index.md'

OLD_VERSION = 'render_generation_history_chart.js?v=20260609study1'
NEW_VERSION = 'render_generation_history_chart.js?v=20260609noecg1'
OLD_SOURCE = 'Embedded solar output is routed through a separate PVLive candidate layer where the solar browser file is present.'
NEW_SOURCE = 'Embedded solar output is routed through a separate PVLive candidate layer from Sheffield Solar PVLive, solar.sheffield.ac.uk, where the solar browser file is present.'


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def read(path: Path) -> str:
    return path.read_text(encoding='utf-8', errors='replace') if path.exists() else ''


def write_report(payload: dict) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    JSON_DIR.mkdir(parents=True, exist_ok=True)
    md = REPORT_DIR / 'GENERATION_HISTORY_UI_LABEL_AUDIT_LATEST.md'
    js = JSON_DIR / 'GENERATION_HISTORY_UI_LABEL_AUDIT_LATEST.json'
    md.write_text('# GridBot Generation History UI Label Audit\n\n```json\n' + json.dumps(payload, indent=2) + '\n```\n', encoding='utf-8')
    js.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()

    render_text = read(RENDER)
    index_text = read(INDEX)
    planned_render = render_text.replace("mode==='daily'?'Daily average':'30 min ECG'", "mode==='daily'?'Daily average':'30 min output'")
    planned_index = index_text.replace(OLD_VERSION, NEW_VERSION).replace(OLD_SOURCE, NEW_SOURCE)

    changed = []
    if args.apply and planned_render != render_text:
        RENDER.write_text(planned_render, encoding='utf-8')
        changed.append(str(RENDER.relative_to(ROOT)))
    if args.apply and planned_index != index_text:
        INDEX.write_text(planned_index, encoding='utf-8')
        changed.append(str(INDEX.relative_to(ROOT)))

    payload = {
        'generatedUTC': now(),
        'mode': 'apply' if args.apply else 'audit',
        'renderPath': str(RENDER.relative_to(ROOT)),
        'indexPath': str(INDEX.relative_to(ROOT)),
        'renderExists': RENDER.exists(),
        'indexExists': INDEX.exists(),
        'renderEcgBefore': render_text.count('30 min ECG'),
        'renderEcgAfterPlanned': planned_render.count('30 min ECG'),
        'renderHasThirtyMinOutputAfterPlanned': '30 min output' in planned_render,
        'oldVersionPresentBefore': OLD_VERSION in index_text,
        'newVersionPresentAfterPlanned': NEW_VERSION in planned_index,
        'sourceCreditBefore': index_text.count('Sheffield Solar PVLive'),
        'sourceCreditAfterPlanned': planned_index.count('Sheffield Solar PVLive'),
        'plannedChangedFiles': [str(p.relative_to(ROOT)) for p, old, new in ((RENDER, render_text, planned_render), (INDEX, index_text, planned_index)) if old != new],
        'changedFiles': changed,
        'pass': RENDER.exists() and INDEX.exists() and planned_render.count('30 min ECG') == 0 and NEW_VERSION in planned_index and 'Sheffield Solar PVLive' in planned_index,
    }
    write_report(payload)
    print(json.dumps(payload, indent=2))
    return 0 if payload['pass'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
