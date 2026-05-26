from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from typing import Iterable

ROOT = Path('.')
V3 = ROOT / 'uk_energy_tracking_v3'
V4 = ROOT / 'uk_energy_tracking_v4'
REPORT = ROOT / 'gridbot_reports' / 'dependencies_v4.md'
JSON_REPORT = ROOT / 'gridbot_reports' / 'dependencies_v4.json'

V4_FILES = {
    'page': V4 / 'index.md',
    'css': V4 / 'price-history-ui.css',
    'price_ui_js': V4 / 'price-history-ui.js',
    'fullscreen_js': V4 / 'price-history-fullscreen.js',
    'live_energy': V4 / 'live_grid_energy.json',
    'live_price': V4 / 'live_grid_price.json',
    'price_history_json': V4 / 'electricity_price_history.json',
    'price_history_csv': V4 / 'electricity_price_history.csv',
    'oil_json': V4 / 'live_oil_prices.json',
    'oil_history': V4 / 'oil_price_history.geojson',
    'fuel_json': V4 / 'live_uk_fuel_prices.json',
    'ev_json': V4 / 'ev_charging_prices.json',
}

SCRIPT_FILES = {
    'energy_updater': ROOT / 'scripts' / 'update_uk_energy_v4.py',
    'price_updater': ROOT / 'scripts' / 'update_uk_price_v4.py',
    'oil_updater': ROOT / 'scripts' / 'update_oil_prices_v4.py',
    'fuel_updater': ROOT / 'scripts' / 'update_uk_fuel_prices_v4.py',
    'elexon_master_downloader': ROOT / 'scripts' / 'download_elexon_system_prices.py',
    'elexon_annual_splitter': ROOT / 'scripts' / 'split_elexon_system_prices_by_year.py',
}

DATA_FILES = {
    'elexon_master_csv': ROOT / 'data' / 'electricity' / 'elexon_system_prices_half_hourly.csv',
}

EXPECTED_DOM_IDS = [
    'price-history-range',
    'price-history-from',
    'price-history-to',
    'price-history-clear-dates',
    'price-history-canvas',
    'price-history-table-body',
    'price-history-fullscreen-btn',
    'price-history-fullscreen-overlay',
    'price-history-fullscreen-canvas',
]

HAZARD_SELECT_VALUES = ['10y', 'all']
MAX_SAFE_VISIBLE_ROWS = 20000


def read_text(path: Path) -> str:
    if not path.exists():
        return ''
    try:
        return path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        return ''


def exists(path: Path) -> bool:
    return path.exists() and path.is_file()


def count_csv_rows(path: Path) -> int:
    if not exists(path):
        return 0
    try:
        with path.open('r', encoding='utf-8', newline='') as handle:
            return max(0, sum(1 for _ in handle) - 1)
    except Exception:
        return 0


def csv_years(path: Path) -> list[str]:
    years: set[str] = set()
    if not exists(path):
        return []
    try:
        with path.open('r', encoding='utf-8', newline='') as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                value = (row.get('settlementDate') or row.get('periodStartUTC') or '').strip()
                if len(value) >= 4 and value[:4].isdigit():
                    years.add(value[:4])
    except Exception:
        pass
    return sorted(years)


def json_row_count(path: Path) -> int:
    if not exists(path):
        return 0
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
        if isinstance(data, dict) and isinstance(data.get('rows'), list):
            return len(data['rows'])
        if isinstance(data, list):
            return len(data)
    except Exception:
        pass
    return 0


def annual_files() -> list[Path]:
    folder = ROOT / 'data' / 'electricity'
    if not folder.exists():
        return []
    return sorted(folder.glob('elexon_system_prices_20*.csv'))


def extract_script_refs(page_text: str) -> list[str]:
    return re.findall(r'<script[^>]+src=[\"\']([^\"\']+)[\"\']', page_text)


def extract_css_refs(page_text: str) -> list[str]:
    return re.findall(r'<link[^>]+href=[\"\']([^\"\']+)[\"\']', page_text)


def has_id(page_text: str, dom_id: str) -> bool:
    return f'id="{dom_id}"' in page_text or f"id='{dom_id}'" in page_text


def status(ok: bool) -> str:
    return 'PASS' if ok else 'FAIL'


def warn(ok: bool) -> str:
    return 'OK' if ok else 'WARN'


def line(items: Iterable[str]) -> str:
    return '\n'.join(items)


def main() -> None:
    page = read_text(V4_FILES['page'])
    price_js = read_text(V4_FILES['price_ui_js'])
    fullscreen_js = read_text(V4_FILES['fullscreen_js'])

    checks: list[dict[str, object]] = []
    warnings: list[str] = []

    for name, path in V4_FILES.items():
        checks.append({'group': 'v4_files', 'name': name, 'path': str(path), 'status': status(exists(path))})

    for name, path in SCRIPT_FILES.items():
        checks.append({'group': 'scripts', 'name': name, 'path': str(path), 'status': status(exists(path))})

    script_refs = extract_script_refs(page)
    css_refs = extract_css_refs(page)
    for ref in script_refs:
        local = ROOT / ref.split('?')[0].lstrip('/')
        checks.append({'group': 'page_script_refs', 'name': ref, 'path': str(local), 'status': status(local.exists())})
    for ref in css_refs:
        local = ROOT / ref.split('?')[0].lstrip('/')
        checks.append({'group': 'page_css_refs', 'name': ref, 'path': str(local), 'status': status(local.exists())})

    for dom_id in EXPECTED_DOM_IDS:
        checks.append({'group': 'dom_ids', 'name': dom_id, 'path': 'uk_energy_tracking_v4/index.md', 'status': status(has_id(page, dom_id))})

    v3_leaks = []
    for name, path in V4_FILES.items():
        text = read_text(path)
        if 'uk_energy_tracking_v3' in text or '/uk_energy_tracking_v3/' in text:
            v3_leaks.append(str(path))
    checks.append({'group': 'path_isolation', 'name': 'no V3 path leaks inside V4 files', 'path': 'uk_energy_tracking_v4', 'status': status(not v3_leaks), 'details': v3_leaks})

    master_rows = count_csv_rows(DATA_FILES['elexon_master_csv'])
    captured_rows = json_row_count(V4_FILES['price_history_json'])
    annual = annual_files()
    annual_counts = {p.name: count_csv_rows(p) for p in annual}

    load_master = 'elexon_system_prices_half_hourly.csv' in price_js
    has_annual_loader = 'elexon_system_prices_' in price_js and '<year>' not in price_js
    has_10y = 'value="10y"' in page or '"10y"' in price_js
    has_all = 'value="all"' in page or "range==='all'" in price_js

    checks.append({'group': 'price_history_loading', 'name': 'main chart does not fetch full master CSV', 'path': 'uk_energy_tracking_v4/price-history-ui.js', 'status': warn(not load_master), 'details': 'Current script fetches master CSV' if load_master else 'No master CSV fetch found'})
    checks.append({'group': 'price_history_loading', 'name': 'annual files exist for lazy loading', 'path': 'data/electricity/elexon_system_prices_*.csv', 'status': status(bool(annual)), 'details': annual_counts})
    checks.append({'group': 'price_history_loading', 'name': '10 year selector removed before annual lazy loading', 'path': 'uk_energy_tracking_v4/index.md', 'status': warn(not has_10y), 'details': '10y option still present' if has_10y else 'No 10y option found'})
    checks.append({'group': 'price_history_loading', 'name': 'all data selector removed before annual lazy loading', 'path': 'uk_energy_tracking_v4/index.md', 'status': warn(not has_all), 'details': 'all option still present' if has_all else 'No all option found'})

    if load_master and (has_10y or has_all) and master_rows > MAX_SAFE_VISIBLE_ROWS:
        warnings.append('Collapse risk: V4 price-history-ui.js can load the full Elexon master CSV and the UI still exposes 10y or all data ranges. This can crash mobile Safari and make the chart unreadable.')

    if 'window.__v4PriceHistoryState' in price_js and '__v4PriceHistoryState' not in fullscreen_js:
        warnings.append('Fullscreen and inline state may be out of sync. The full screen script should use the same loaded snapshot as the inline chart.')

    report = []
    report.append('# V4 Dependency Diagnostics')
    report.append('')
    report.append('Purpose: map all V4 page, script, data and workflow dependencies that must remain in sync before any modularisation or lazy loading patch is applied.')
    report.append('')
    report.append('## Executive diagnosis')
    report.append('')
    if warnings:
        for item in warnings:
            report.append(f'- WARNING: {item}')
    else:
        report.append('- No immediate collapse warning detected by static diagnostics.')
    report.append('')
    report.append('## Data scale')
    report.append('')
    report.append(f'- Elexon master CSV rows: {master_rows}')
    report.append(f'- V4 captured price JSON rows: {captured_rows}')
    report.append(f'- Elexon master CSV years: {", ".join(csv_years(DATA_FILES["elexon_master_csv"])) or "not detected"}')
    report.append(f'- Annual Elexon files found: {len(annual)}')
    for name, rows in annual_counts.items():
        report.append(f'  - {name}: {rows} rows')
    report.append('')
    report.append('## Dependency graph')
    report.append('')
    report.append('```text')
    report.append('uk_energy_tracking_v4/index.md')
    report.append('  -> /uk_energy_tracking_v4/price-history-ui.css')
    report.append('  -> /uk_energy_tracking_v4/price-history-ui.js')
    report.append('       -> /uk_energy_tracking_v4/electricity_price_history.json')
    report.append('       -> /data/electricity/elexon_system_prices_half_hourly.csv OR annual CSVs')
    report.append('       -> DOM ids: price-history-range, price-history-from, price-history-to, price-history-canvas, price-history-table-body')
    report.append('  -> /uk_energy_tracking_v4/price-history-fullscreen.js')
    report.append('       -> window.__v4PriceHistoryState from price-history-ui.js')
    report.append('  -> /uk_energy_tracking_v4/live_grid_energy.json')
    report.append('  -> /uk_energy_tracking_v4/live_grid_price.json')
    report.append('  -> /uk_energy_tracking_v4/live_oil_prices.json')
    report.append('  -> /uk_energy_tracking_v4/live_uk_fuel_prices.json')
    report.append('  -> /uk_energy_tracking_v4/ev_charging_prices.json')
    report.append('scripts/update_uk_energy_v4.py -> live_grid_energy.json')
    report.append('scripts/update_uk_price_v4.py -> live_grid_price.json and captured electricity history')
    report.append('scripts/update_oil_prices_v4.py -> oil price files')
    report.append('scripts/update_uk_fuel_prices_v4.py -> fuel price file')
    report.append('scripts/download_elexon_system_prices.py -> data/electricity/elexon_system_prices_half_hourly.csv')
    report.append('scripts/split_elexon_system_prices_by_year.py -> data/electricity/elexon_system_prices_YEAR.csv')
    report.append('```')
    report.append('')
    report.append('## Checks')
    report.append('')
    report.append('| Group | Item | Status | Path |')
    report.append('|---|---:|---:|---|')
    for c in checks:
        report.append(f"| {c['group']} | {c['name']} | {c['status']} | `{c['path']}` |")
    report.append('')
    report.append('## Why the lazy loading patch failed')
    report.append('')
    report.append('The failed V3 lazy loading patch changed too many coupled layers at once: the visible controls, the chart data source, the range logic, full screen behaviour and attribution text. The inline chart and full screen chart had separate JavaScript logic, so one could be corrected while the other stayed stale. The page also still had a path where the master 2016 to present Elexon CSV could be loaded directly, exposing the browser to too many points. The correct repair is not another large patch. The correct repair is modularisation plus a dependency gate that proves every selector, data source, script reference, DOM id and chart state object is synchronised before deployment.')
    report.append('')
    report.append('## Modularisation sequence for V4')
    report.append('')
    report.append('1. Run this dependency diagnostic and compare V4 against V3 before every patch.')
    report.append('2. Extract only CSS from inline style into a V4 stylesheet, with no behaviour change.')
    report.append('3. Extract price history JavaScript into modules: data loading, range selection, chart drawing, table rendering and full screen rendering.')
    report.append('4. Make full screen consume the same state object as the inline chart. No separate fetch path.')
    report.append('5. Add annual lazy loading after the module boundary exists.')
    report.append('6. Only then add year, season and explanatory text controls.')
    report.append('')
    report.append('## Rule')
    report.append('')
    report.append('Patch V4 only. V3 remains the benchmark.')
    report.append('')

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text('\n'.join(report), encoding='utf-8')
    JSON_REPORT.write_text(json.dumps({'checks': checks, 'warnings': warnings, 'data': {'master_rows': master_rows, 'captured_rows': captured_rows, 'annual_files': annual_counts}}, indent=2), encoding='utf-8')
    failed = [c for c in checks if c['status'] == 'FAIL']
    print(f'Wrote {REPORT}')
    print(f'Warnings: {len(warnings)}')
    print(f'Failures: {len(failed)}')
    if warnings:
        for item in warnings:
            print('WARNING:', item)


if __name__ == '__main__':
    main()
