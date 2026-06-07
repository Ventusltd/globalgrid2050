import json
import re
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ONS_XLSX_URL = 'https://www.ons.gov.uk/file?uri=/economy/environmentalaccounts/datasets/ukenvironmentalaccountsenergyusebyindustrysourceandfuel/current/11energyusebyindustrysourceandfuel.xlsx'
RAW_DIR = Path('data/ons')
RAW_XLSX = RAW_DIR / '11energyusebyindustrysourceandfuel.xlsx'
OUT_DIR = Path('uk_energy_tracking_v6/generation_history/mwh_energy_use')
ANNUAL_JSON = OUT_DIR / 'ons_mwh_energy_use_annual.json'
TOP_JSON = OUT_DIR / 'ons_mwh_summary_top_uses_latest.json'
FUEL_JSON = OUT_DIR / 'ons_mwh_summary_by_fuel.json'
REPORT_MD = OUT_DIR / 'ONS_MWH_ENERGY_USE_REPORT.md'
MTOE_TO_TWH = 11.63
TWH_TO_MWH = 1_000_000
NS = {'a': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
REL_NS = {'rel': 'http://schemas.openxmlformats.org/package/2006/relationships'}


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def col_to_num(col):
    n = 0
    for ch in col:
        n = n * 26 + (ord(ch.upper()) - 64)
    return n


def cell_col(ref):
    m = re.match(r'([A-Z]+)', ref or '')
    return col_to_num(m.group(1)) if m else 0


def cell_row(ref):
    m = re.search(r'(\d+)$', ref or '')
    return int(m.group(1)) if m else 0


def download_workbook():
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(ONS_XLSX_URL, headers={'User-Agent': 'GlobalGrid2050 open data pipeline'})
    with urllib.request.urlopen(req, timeout=120) as response:
        RAW_XLSX.write_bytes(response.read())
    print(f'Downloaded {RAW_XLSX} ({RAW_XLSX.stat().st_size} bytes)')


def load_shared_strings(zf):
    try:
        root = ET.fromstring(zf.read('xl/sharedStrings.xml'))
    except KeyError:
        return []
    out = []
    for si in root.findall('a:si', NS):
        text = ''.join(t.text or '' for t in si.findall('.//a:t', NS))
        out.append(text)
    return out


def workbook_sheets(zf):
    wb = ET.fromstring(zf.read('xl/workbook.xml'))
    rels = ET.fromstring(zf.read('xl/_rels/workbook.xml.rels'))
    rel_map = {rel.attrib['Id']: rel.attrib['Target'] for rel in rels.findall('rel:Relationship', REL_NS)}
    sheets = []
    for sheet in wb.findall('.//a:sheet', NS):
        rid = sheet.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        target = rel_map.get(rid, '')
        if target and not target.startswith('xl/'):
            target = 'xl/' + target
        sheets.append((sheet.attrib.get('name', ''), target))
    return sheets


def cell_value(cell, shared):
    t = cell.attrib.get('t')
    if t == 'inlineStr':
        return ''.join(x.text or '' for x in cell.findall('.//a:t', NS)).strip()
    v = cell.find('a:v', NS)
    if v is None:
        return ''
    raw = v.text or ''
    if t == 's':
        try:
            return shared[int(raw)].strip()
        except Exception:
            return ''
    return raw.strip()


def read_sheet(zf, path, shared):
    root = ET.fromstring(zf.read(path))
    rows = []
    for row in root.findall('.//a:sheetData/a:row', NS):
        values = {}
        for cell in row.findall('a:c', NS):
            ref = cell.attrib.get('r', '')
            values[cell_col(ref)] = cell_value(cell, shared)
        if values:
            rows.append((int(row.attrib.get('r', cell_row(next(iter(values), 0)) or 0)), values))
    return rows


def normalise_header(value):
    return re.sub(r'\s+', ' ', str(value or '').strip()).lower()


def find_data_table(rows):
    for row_num, values in rows:
        headers = {normalise_header(v): c for c, v in values.items()}
        if 'economic sector' in headers and 'sourcename' in headers:
            years = {}
            for col, value in values.items():
                s = str(value).strip()
                if re.fullmatch(r'19\d{2}|20\d{2}', s):
                    years[int(s)] = col
            if years:
                return row_num, values, years
    return None, None, None


def get_field(row, header_map, names):
    for name in names:
        col = header_map.get(name)
        if col:
            return str(row.get(col, '')).strip()
    return ''


def parse_float(value):
    try:
        if value in (None, ''):
            return None
        return float(str(value).replace(',', ''))
    except Exception:
        return None


def parse_workbook():
    records = []
    source_sheet = None
    with zipfile.ZipFile(RAW_XLSX) as zf:
        shared = load_shared_strings(zf)
        for sheet_name, path in workbook_sheets(zf):
            if not path or not path.endswith('.xml'):
                continue
            rows = read_sheet(zf, path, shared)
            header_row, header_values, years = find_data_table(rows)
            if not header_row:
                continue
            source_sheet = sheet_name
            header_map = {normalise_header(v): c for c, v in header_values.items()}
            for row_num, row in rows:
                if row_num <= header_row:
                    continue
                economic_sector = get_field(row, header_map, ['economic sector'])
                source_name = get_field(row, header_map, ['sourcename', 'source name'])
                activity_name = get_field(row, header_map, ['activity name', 'activityname'])
                fuel = get_field(row, header_map, ['fuel', 'fuel type', 'activityname'])
                subsection = get_field(row, header_map, ['subsection'])
                if not any([economic_sector, source_name, activity_name, fuel]):
                    continue
                for year, col in sorted(years.items()):
                    mtoe = parse_float(row.get(col))
                    if mtoe is None:
                        continue
                    twh = mtoe * MTOE_TO_TWH
                    records.append({
                        'year': year,
                        'subsection': subsection,
                        'economicSector': economic_sector,
                        'sourceName': source_name,
                        'activityName': activity_name,
                        'fuel': fuel,
                        'mtoe': round(mtoe, 6),
                        'twh': round(twh, 6),
                        'mwh': round(twh * TWH_TO_MWH, 3),
                        'sourceDataset': 'ONS Energy use by industry, source and fuel',
                    })
            break
    return source_sheet, records


def write_outputs(sheet, records):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    latest_year = max((r['year'] for r in records), default=None)
    total_by_year = defaultdict(float)
    by_fuel = defaultdict(float)
    for r in records:
        total_by_year[r['year']] += r['mwh']
        by_fuel[(r['year'], r['fuel'])] += r['mwh']
    latest_rows = [r for r in records if r['year'] == latest_year]
    latest_top = sorted(latest_rows, key=lambda r: r['mwh'], reverse=True)[:25]
    fuel_rows = [{'year': y, 'fuel': fuel, 'mwh': round(mwh, 3), 'twh': round(mwh / TWH_TO_MWH, 6)} for (y, fuel), mwh in sorted(by_fuel.items())]
    base = {
        'generatedUTC': utc_now(),
        'sourceUrl': ONS_XLSX_URL,
        'sourceWorkbook': str(RAW_XLSX),
        'sourceSheet': sheet,
        'conversion': {'mtoeToTwh': MTOE_TO_TWH, 'twhToMwh': TWH_TO_MWH, 'formula': 'MWh = Mtoe * 11.63 * 1000000'},
    }
    ANNUAL_JSON.write_text(json.dumps({**base, 'rows': records}, indent=2), encoding='utf-8')
    TOP_JSON.write_text(json.dumps({**base, 'latestYear': latest_year, 'rows': latest_top}, indent=2), encoding='utf-8')
    FUEL_JSON.write_text(json.dumps({**base, 'rows': fuel_rows}, indent=2), encoding='utf-8')
    total_twh = total_by_year.get(latest_year, 0) / TWH_TO_MWH if latest_year else 0
    REPORT_MD.write_text('\n'.join([
        '# ONS MWh Energy Use Report',
        '',
        f'Generated UTC: {base["generatedUTC"]}',
        f'Source workbook: {ONS_XLSX_URL}',
        f'Source sheet: {sheet}',
        f'Records: {len(records)}',
        f'Latest year: {latest_year}',
        f'Latest year total TWh: {total_twh:,.1f}',
        '',
        '## Outputs',
        '',
        f'- `{ANNUAL_JSON}`',
        f'- `{TOP_JSON}`',
        f'- `{FUEL_JSON}`',
    ]) + '\n', encoding='utf-8')
    print(f'Wrote {ANNUAL_JSON}')
    print(f'Wrote {TOP_JSON}')
    print(f'Wrote {FUEL_JSON}')
    print(f'Wrote {REPORT_MD}')


def main():
    download_workbook()
    sheet, records = parse_workbook()
    if not records:
        raise RuntimeError('No ONS energy use records parsed from workbook')
    write_outputs(sheet, records)


if __name__ == '__main__':
    main()
