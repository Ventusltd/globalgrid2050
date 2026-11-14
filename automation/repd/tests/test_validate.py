"""Tests for automation/repd/validate.py on small synthetic fixtures (no network, no real data)."""
import csv
import datetime
import io
import json
import os
import sys

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.dirname(HERE)
if PKG not in sys.path:
    sys.path.insert(0, PKG)

import validate as V  # noqa: E402
import verify_release as vr  # noqa: E402

COLS = vr.EXPECTED_COLUMNS
ASOF = '2026-11-13'


def row(ref, **kw):
    base = {c: '' for c in COLS}
    base.update({'Ref ID': str(ref), 'Record Last Updated (dd/mm/yyyy)': '01/09/2026', 'Site Name': f'Site {ref}',
                 'Technology Type': 'Solar Photovoltaics', 'Development Status (short)': 'Operational',
                 'Development Status': 'Operational', 'Installed Capacity (MWelec)': '5', 'Country': 'England',
                 'Region': 'South East', 'X-coordinate': str(450000 + int(ref) * 10), 'Y-coordinate': '150000',
                 'Planning Application Submitted': '01/02/2020', 'Operational': '01/03/2022'})
    for k, v in kw.items():
        base[k.replace('_', ' ') if k not in COLS else k] = v
    return base


def rows_default(n=12):
    return [row(i) for i in range(1, n + 1)]


def write_csv(path, rows, cols=COLS, truncate=0):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\r\n')
    w.writerow(cols)
    for r in rows:
        w.writerow([r.get(c, '') for c in cols])
    data = buf.getvalue().encode('cp1252')
    if truncate:
        data = data[:-truncate]
    path.write_bytes(data)
    return str(path)


def to_date(s):
    try:
        return datetime.datetime.strptime(s, '%d/%m/%Y')
    except ValueError:
        return s


def write_xlsx(path, rows, xlsx_dates=None):
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'REPD'
    ws.append(COLS)
    for r in rows:
        vals = []
        for c in COLS:
            v = r.get(c, '')
            if vr.nh(c) in vr.DATE_COLUMNS and v:
                v = to_date(v)
            if xlsx_dates and (r['Ref ID'], c) in xlsx_dates:
                v = xlsx_dates[(r['Ref ID'], c)]
            if c == 'Ref ID':
                v = int(v)
            vals.append(v if v != '' else None)
        ws.append(vals)
    wb.save(path)
    return str(path)


def write_baseline(path, rows=10, tech=('Solar Photovoltaics',), status=('Operational',), refs=None):
    b = {'schema': V.BASELINE_SCHEMA, 'release_id': 'prev', 'rows': rows, 'unique_refs': rows,
         'refs': refs if refs is not None else [str(i) for i in range(1, rows + 1)],
         'vocab': {'Technology Type': {t: 1 for t in tech}, 'Development Status (short)': {s: 1 for s in status}}}
    path.write_text(json.dumps(b))
    return str(path)


def run(tmp_path, rows, xrows=None, baseline_kw=None, extra=(), xlsx_dates=None, truncate=0, xlsx=True, cols=COLS):
    c = write_csv(tmp_path / 'r.csv', rows, cols=cols, truncate=truncate)
    b = write_baseline(tmp_path / 'b.json', **(baseline_kw or {}))
    out = tmp_path / 'rep.json'
    args = ['check', '--csv', c, '--baseline', b, '--asof', ASOF, '--json', str(out), '--quiet', *extra]
    if xlsx:
        args += ['--xlsx', write_xlsx(tmp_path / 'r.xlsx', xrows if xrows is not None else rows, xlsx_dates)]
    code = V.main(args)
    rep = json.loads(out.read_text()) if out.exists() else None
    return code, rep, ({g['id']: g for g in rep['gates']} if rep else {})


def test_clean_release_passes(tmp_path):
    code, rep, g = run(tmp_path, rows_default())
    assert code == 0 and rep['result'] == 'PASS'
    for gid in ('S1_columns_53_in_order', 'S2_ref_ids_unique_after_identical_dedupe', 'S3_csv_xlsx_ref_sets_equal',
                'S4_row_floor_vs_previous_release', 'S5_last_record_complete', 'C1_dates_valid', 'C2_future_dates',
                'C3_vocabularies_vs_previous', 'C4_coordinates_numeric_and_in_bounds'):
        assert g[gid]['status'] == 'pass', (gid, g[gid])


def test_missing_column_fails(tmp_path):
    cols = [c for c in COLS if c != 'Heat Network Ref']
    code, rep, g = run(tmp_path, rows_default(), cols=cols, xlsx=False, extra=['--csv-only'])
    assert code == 1 and g['S1_columns_53_in_order']['status'] == 'fail'


def test_identical_duplicate_warns_conflicting_fails(tmp_path):
    rs = rows_default()
    code, rep, g = run(tmp_path, rs + [dict(rs[3])])
    assert code == 0 and g['S2_ref_ids_unique_after_identical_dedupe']['status'] == 'warn'
    assert g['S2_ref_ids_unique_after_identical_dedupe']['detail']['identical_duplicates'] == ['4']
    bad = dict(rs[3]); bad['Site Name'] = 'Different'
    code, rep, g = run(tmp_path, rs + [bad])
    assert code == 1 and g['S2_ref_ids_unique_after_identical_dedupe']['status'] == 'fail'


def test_ref_sets_differ_fails(tmp_path):
    rs = rows_default()
    code, rep, g = run(tmp_path, rs, xrows=rs[:-1])
    assert code == 1 and g['S3_csv_xlsx_ref_sets_equal']['status'] == 'fail'
    assert g['S3_csv_xlsx_ref_sets_equal']['detail']['refs_only_in_csv']['examples'] == ['12']


def test_row_floor_below_previous_release_fails(tmp_path):
    code, rep, g = run(tmp_path, rows_default(12), baseline_kw={'rows': 13, 'refs': [str(i) for i in range(1, 14)]})
    assert code == 1 and g['S4_row_floor_vs_previous_release']['status'] == 'fail'
    assert g['S4b_refs_dropped_since_previous_release']['detail']['refs'] == ['13']


def test_truncated_last_record_fails(tmp_path):
    code, rep, g = run(tmp_path, rows_default(), xlsx=False, extra=['--csv-only'], truncate=40)
    assert code == 1 and g['S5_last_record_complete']['status'] == 'fail'


def test_impossible_date_without_excel_fallback_fails(tmp_path):
    rs = rows_default(); rs[2]['Operational'] = '31/02/2022'
    code, rep, g = run(tmp_path, rs, xlsx=False, extra=['--csv-only'])
    assert code == 1 and g['C1_dates_valid']['status'] == 'fail'
    assert g['C1_dates_valid']['detail']['invalid'][0]['ref'] == '3'


def test_month_first_csv_date_resolved_by_typed_excel(tmp_path):
    rs = rows_default()
    rs[4]['Planning Application Submitted'] = '9/14/2026'   # impossible as d/m
    rs[5]['Planning Application Submitted'] = '09/11/2026'  # valid as d/m but swapped
    xd = {('5', 'Planning Application Submitted'): datetime.datetime(2026, 9, 14),
          ('6', 'Planning Application Submitted'): datetime.datetime(2026, 9, 11)}
    code, rep, g = run(tmp_path, rs, xlsx_dates=xd)
    assert code == 0
    c1 = g['C1_dates_valid']
    assert c1['status'] == 'warn' and sorted(i['ref'] for i in c1['detail']['resolvable_non_canonical']) == ['5', '6']


def test_na_marker_and_future_dates_are_warnings_with_refs(tmp_path):
    rs = rows_default()
    rs[0]['Operational'] = 'NA'
    rs[1]['Planning Permission  Granted'] = '15/12/2026'
    rs[2]['Planning Permission Expired'] = '01/01/2030'   # expiry may be in the future
    code, rep, g = run(tmp_path, rs, xlsx=False, extra=['--csv-only'])
    assert code == 0
    assert g['C1b_date_na_markers']['status'] == 'warn' and g['C1b_date_na_markers']['detail']['cells'][0]['ref'] == '1'
    fut = g['C2_future_dates']['detail']['future']
    assert [f['ref'] for f in fut] == ['2'] and g['C2_future_dates']['detail']['expiry_dates_in_future'] == {'Planning Permission Expired': 1}


def test_new_vocabulary_value_warns_or_fails_strict(tmp_path):
    rs = rows_default(); rs[0]['Technology Type'] = 'Fusion'
    code, rep, g = run(tmp_path, rs, xlsx=False, extra=['--csv-only'])
    c3 = g['C3_vocabularies_vs_previous']
    assert code == 0 and c3['status'] == 'warn' and c3['detail']['Technology Type']['new_values'] == {'Fusion': 1}
    assert c3['detail']['Technology Type']['new_value_refs'] == {'Fusion': ['1']}
    code, rep, g = run(tmp_path, rs, xlsx=False, extra=['--csv-only', '--strict-vocab'])
    assert code == 1


def test_coordinates_non_numeric_and_out_of_bounds(tmp_path):
    rs = rows_default(); rs[0]['X-coordinate'] = 'abc'; rs[1]['Y-coordinate'] = '9999999'
    code, rep, g = run(tmp_path, rs, xlsx=False, extra=['--csv-only'])
    c4 = g['C4_coordinates_numeric_and_in_bounds']
    assert code == 1 and c4['status'] == 'fail'
    assert c4['detail']['non_numeric'][0]['ref'] == '1' and c4['detail']['outside_hard_bounds'][0]['ref'] == '2'


def test_known_anomalies_downgrade_bounds_and_report(tmp_path):
    rs = rows_default(); rs[1]['Y-coordinate'] = '9999999'
    known = tmp_path / 'k.json'
    known.write_text(json.dumps({'known': {'2': 'bad coordinates in source', '99': 'gone'}}))
    code, rep, g = run(tmp_path, rs, xlsx=False, extra=['--csv-only', '--known-anomalies', str(known)])
    assert code == 0 and g['C4_coordinates_numeric_and_in_bounds']['status'] == 'warn'
    assert g['C5_known_anomaly_report']['detail']['known_items_no_longer_present'] == ['99']


def test_tab_padded_coordinates_are_numeric_but_reported(tmp_path):
    rs = rows_default(); rs[0]['X-coordinate'] = '\t450010'
    code, rep, g = run(tmp_path, rs, xlsx=False, extra=['--csv-only'])
    assert code == 0
    assert any(a['anomaly'] == 'HIDDEN_CHARS' and a['ref'] == '1' for a in g['C5_known_anomaly_report']['detail']['anomalies'])


def test_csv_only_skip_and_xlsx_required(tmp_path):
    code, rep, g = run(tmp_path, rows_default(), xlsx=False, extra=['--csv-only'])
    assert code == 0 and g['S3_csv_xlsx_ref_sets_equal']['status'] == 'skip'
    c = write_csv(tmp_path / 'x.csv', rows_default())
    b = write_baseline(tmp_path / 'bb.json')
    assert V.main(['check', '--csv', c, '--baseline', b, '--quiet']) == 2


def test_unusable_input_exit_2(tmp_path):
    b = write_baseline(tmp_path / 'b.json')
    assert V.main(['check', '--csv', str(tmp_path / 'missing.csv'), '--csv-only', '--baseline', b, '--quiet']) == 2
    (tmp_path / 'bad.json').write_text('{"schema": "x"}')
    c = write_csv(tmp_path / 'r.csv', rows_default())
    assert V.main(['check', '--csv', c, '--csv-only', '--baseline', str(tmp_path / 'bad.json'), '--quiet']) == 2


def test_make_baseline_from_csv_and_identity(tmp_path):
    c = write_csv(tmp_path / 'p.csv', rows_default(7))
    out = tmp_path / 'b.json'
    assert V.main(['make-baseline', '--from-csv', c, '--release-id', 'p', '--out', str(out)]) == 0
    b = json.loads(out.read_text())
    assert b['rows'] == 7 and b['refs'] == [str(i) for i in range(1, 8)]
    assert b['vocab']['Technology Type'] == {'Solar Photovoltaics': 7}
    ident = tmp_path / 'id.json'
    ident.write_text(json.dumps({'raw_record_count': 2, 'records': [
        {'repd_ref': '1', 'status': 'Operational', 'technology': 'Battery'},
        {'repd_ref': '5', 'status': 'Revised', 'technology': 'Battery'}]}))
    assert V.main(['make-baseline', '--from-identity-v6', str(ident), '--release-id', 'q', '--out', str(out)]) == 0
    b = json.loads(out.read_text())
    assert b['rows'] == 2 and b['vocab']['Development Status (short)'] == {'Operational': 1, 'Revised': 1}


def test_reconciliation_v6_accepted_as_count_baseline(tmp_path):
    r = tmp_path / 'rec.json'
    r.write_text(json.dumps({'schema': 'globalgrid2050.repd-source-reconciliation.v6',
                             'metrics': {'csv_rows': 11, 'csv_unique_refs': 11}}))
    c = write_csv(tmp_path / 'r.csv', rows_default(12))
    out = tmp_path / 'o.json'
    assert V.main(['check', '--csv', c, '--csv-only', '--baseline', str(r), '--json', str(out), '--quiet']) == 0
    g = {x['id']: x for x in json.loads(out.read_text())['gates']}
    assert g['S4_row_floor_vs_previous_release']['status'] == 'pass'
    assert g['C3_vocabularies_vs_previous']['status'] == 'warn'
