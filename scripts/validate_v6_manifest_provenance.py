#!/usr/bin/env python3
import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'dist' / 'manifest_v4.json').read_text(encoding='utf-8'))
source = json.loads((ROOT / 'dist' / 'repd_source_reconciliation_v6.json').read_text(encoding='utf-8'))

errors = []
def need(ok, message):
    if not ok:
        errors.append(message)

csv_url = str(manifest.get('source_url') or '')
xlsx_url = str(manifest.get('source_excel_url') or '')
page_date = str(manifest.get('source_page_last_updated') or '')
need(manifest.get('source_owner') == 'Department for Energy Security and Net Zero (DESNZ)', 'DESNZ source owner missing')
need(manifest.get('source_page') == 'https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract', 'GOV.UK quarterly REPD page mismatch')
need(urlparse(csv_url).netloc == 'assets.publishing.service.gov.uk' and csv_url.lower().endswith('.csv'), 'official CSV provenance invalid')
need(urlparse(xlsx_url).netloc == 'assets.publishing.service.gov.uk' and xlsx_url.lower().endswith('.xlsx'), 'official XLSX provenance invalid')
need(bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}', page_date)), f'GOV.UK page update date invalid: {page_date!r}')
need(bool(str(manifest.get('source_dataset_title') or '').strip()), 'REPD edition title missing')
need(source.get('pass') is True, 'CSV/XLSX reconciliation report did not pass')
need(source.get('csv_url') == csv_url, 'reconciled CSV differs from manifest CSV')
need(source.get('xlsx_url') == xlsx_url, 'reconciled XLSX differs from manifest XLSX')
if 'REPD_Publication_Q2_2026' in csv_url:
    need(page_date == '2026-08-03', f'Q2 2026 GOV.UK update date expected 2026-08-03, got {page_date}')

if errors:
    print('V6 MANIFEST PROVENANCE FAILED')
    for error in errors:
        print(' -', error)
    raise SystemExit(1)
print('V6 MANIFEST PROVENANCE PASS', page_date, csv_url)
