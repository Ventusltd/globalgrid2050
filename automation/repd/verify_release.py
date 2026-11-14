#!/usr/bin/env python3
"""verify_release.py - independent integrity check of a raw official REPD release.

Usage
  python3 -I verify_release.py REPD.csv [--xlsx REPD.xlsx] [--asof YYYY-MM-DD]
                               [--expect-october-2026] [--json report.json] [--max-examples N]
  (individual expectations: --expect-csv-bytes, --expect-csv-sha256, --expect-xlsx-bytes,
   --expect-xlsx-sha256, --expect-rows, --expect-unique-refs, --expect-duplicate-refs 7679,
   --expect-date-conflicts "Planning Application Submitted=21424,21438")

What it reports
  CSV : bytes, sha256, encoding, line endings, physical lines vs records, field-count histogram,
        header vs the 53 official columns in order, unique / duplicate refs (identical or conflicting),
        last-record completeness + trailing newline, unparseable and future dates per date column.
  XLSX: bytes, sha256, sheet, header, rows, refs, duplicates, cell typing of every date column.
  Both: ref-set equality and every field-level disagreement on the date columns, with both raw values,
        whether the Excel cell is a true date or a string, whether a day/month swap of one equals the
        other, and which value is plausible given "Record Last Updated" and --asof.
        Non-date columns get a per-column disagreement count with a coarse classification.

Nothing is assumed: expectations are only compared, never used to steer parsing. The script reads
its inputs and writes nothing except the optional --json file. Exit status: 0 = no expectation failed
and no structural error; 1 = an expectation failed; 2 = structural error (truncation, ragged rows,
header mismatch, ref sets differ).
"""
import argparse, collections, csv, datetime, hashlib, io, json, re, sys

EXPECTED_COLUMNS = [
    'Old Ref ID', 'Ref ID', 'Record Last Updated (dd/mm/yyyy)', 'Operator (or Applicant)', 'Site Name',
    'Technology Type', 'Storage Type', 'Storage Co-location REPD Ref ID', 'Installed Capacity (MWelec)',
    'Share Community Scheme', 'CHP Enabled', 'CfD Allocation Round', 'RO Banding (ROC/MWh)', 'FiT Tariff (p/kWh)',
    'CfD Capacity (MW)', 'Turbine Capacity (MW)', 'No. of Turbines', 'Height of Turbines (m)',
    'Mounting Type for Solar', 'Development Status', 'Development Status (short)',
    'Are they re-applying (New REPD Ref)', 'Are they re-applying (Old REPD Ref) ', 'Address', 'County', 'Region',
    'Country', 'Post Code', 'X-coordinate', 'Y-coordinate', 'Planning Authority', 'Planning Application Reference',
    'Appeal Reference', 'Secretary of State Reference', 'Type of Secretary of State Intervention', 'Judicial Review',
    'Offshore Wind Round', 'Planning Application Submitted', 'Planning Application Withdrawn',
    'Planning Permission Refused', 'Appeal Lodged', 'Appeal Withdrawn', 'Appeal Refused', 'Appeal Granted',
    'Planning Permission  Granted', 'Secretary of State - Intervened', 'Secretary of State - Refusal',
    'Secretary of State - Granted', 'Planning Permission Expired', 'Under Construction', 'Operational',
    'Heat Network Ref', 'Solar Site Area (sqm)',
]  # verbatim (including the trailing space and the double space) from the January 2026 raw CSV header
assert len(EXPECTED_COLUMNS) == 53

def nh(s):
    """normalised header: trim + collapse internal whitespace"""
    return ' '.join(str(s if s is not None else '').replace('﻿', '').split())

NORM_EXPECTED = [nh(c) for c in EXPECTED_COLUMNS]
REF, UPDATED = 'Ref ID', 'Record Last Updated (dd/mm/yyyy)'
DATE_COLUMNS = [UPDATED] + NORM_EXPECTED[37:51]
FUTURE_ALLOWED = {'Planning Permission Expired'}  # an expiry date is legitimately in the future
NUMERIC_COLUMNS = {'Installed Capacity (MWelec)', 'CfD Capacity (MW)', 'Turbine Capacity (MW)', 'No. of Turbines',
                   'Height of Turbines (m)', 'X-coordinate', 'Y-coordinate', 'Solar Site Area (sqm)',
                   'RO Banding (ROC/MWh)', 'FiT Tariff (p/kWh)'}

OCTOBER_2026 = dict(csv_bytes=5219160, csv_sha256='48e76c49f33a1090e78108d1ea9bfe689b35963ea3be1bb4f6516d038a5ff862',
                    xlsx_bytes=5378656, xlsx_sha256='87811e249395a05b223db6855952334f425e66cc9a2106caea0e38fd9e5037ea',
                    rows=14968, unique_refs=14967, duplicate_refs=['7679'],
                    date_conflicts={'Planning Application Submitted': ['21424', '21438', '21456', '21463', '21464']})

# ------------------------------------------------------------------ dates
DMY = re.compile(r'^(\d{1,2})/(\d{1,2})/(\d{4})$')
DMY2 = re.compile(r'^(\d{1,2})/(\d{1,2})/(\d{2})$')
ISO = re.compile(r'^(\d{4})-(\d{2})-(\d{2})(?:[T ]00:00(?::00(?:\.0+)?)?)?$')
DMY_DASH = re.compile(r'^(\d{1,2})[-.](\d{1,2})[-.](\d{4})$')

def parse_text_date(s):
    """-> (date|None, form). The official layout is dd/mm/yyyy; anything else is reported by form."""
    s = (s or '').strip()
    if not s:
        return None, 'blank'
    for rx, form in ((DMY, 'dd/mm/yyyy'), (ISO, 'iso'), (DMY_DASH, 'dd-mm-yyyy'), (DMY2, 'dd/mm/yy')):
        m = rx.match(s)
        if not m:
            continue
        a, b, c = (int(x) for x in m.groups()[:3])
        try:
            if form == 'iso':
                return datetime.date(a, b, c), form
            if form == 'dd/mm/yy':
                return datetime.date(2000 + c if c < 70 else 1900 + c, b, a), form
            if form == 'dd/mm/yyyy' and (len(m.group(1)) != 2 or len(m.group(2)) != 2):
                form = 'd/m/yyyy (not zero-padded)'
            return datetime.date(c, b, a), form
        except ValueError:
            return None, 'impossible ' + form
    return None, 'unparseable'

def swap_dm(d):
    """date with day and month exchanged, or None when that is not a valid date"""
    if d is None:
        return None
    try:
        return datetime.date(d.year, d.day, d.month)
    except ValueError:
        return None

def excel_serial_to_date(v):
    try:
        return (datetime.datetime(1899, 12, 30) + datetime.timedelta(days=float(v))).date()
    except (OverflowError, ValueError, TypeError):
        return None

# ------------------------------------------------------------------ helpers
def sha256(b):
    return hashlib.sha256(b).hexdigest()

def norm_text(v):
    return ' '.join(str(v if v is not None else '').replace('_x000D_', ' ').replace('\xa0', ' ').split())

def as_number(v):
    s = norm_text(v).replace(',', '')
    if re.fullmatch(r'-?\d+(\.\d+)?([eE]-?\d+)?', s):
        try:
            return float(s)
        except ValueError:
            return None
    return None

def clean_ref(v):
    if v is None:
        return ''
    if isinstance(v, float) and v == int(v):
        v = int(v)
    s = str(v).strip()
    return s[:-2] if re.fullmatch(r'\d+\.0', s) else s

class Report:
    def __init__(self, max_examples):
        self.data = collections.OrderedDict(); self.lines = []; self.structural = []; self.n = max_examples
    def section(self, title):
        self.lines.append(''); self.lines.append('=' * 6 + ' ' + title + ' ' + '=' * 6)
    def put(self, key, value, show=True):
        self.data[key] = value
        if show:
            v = value if isinstance(value, str) else json.dumps(value, default=str, ensure_ascii=False)
            self.lines.append(f'{key}: {v}')
    def note(self, text):
        self.lines.append(text)
    def error(self, text):
        self.structural.append(text); self.lines.append('STRUCTURAL: ' + text)

# ------------------------------------------------------------------ CSV
def check_csv(path, asof, rep):
    raw = open(path, 'rb').read()
    rep.section('CSV file')
    rep.put('csv.path', path); rep.put('csv.bytes', len(raw)); rep.put('csv.sha256', sha256(raw))
    bom = raw.startswith(b'\xef\xbb\xbf')
    non_ascii = sum(1 for b in raw if b > 127)
    try:
        text = raw.decode('utf-8-sig'); enc = 'utf-8-sig (BOM present)' if bom else ('ascii' if non_ascii == 0 else 'utf-8')
    except UnicodeDecodeError as e:
        undefined = {hex(x): raw.count(bytes([x])) for x in (0x81, 0x8d, 0x8f, 0x90, 0x9d) if raw.count(bytes([x]))}
        if undefined:
            text = raw.decode('latin-1'); enc = 'latin-1 (not UTF-8; contains bytes undefined in cp1252: %s)' % undefined
        else:
            text = raw.decode('cp1252'); enc = 'cp1252 (not valid UTF-8: first bad byte 0x%02x at offset %d)' % (raw[e.start], e.start)
    rep.put('csv.encoding', enc); rep.put('csv.non_ascii_bytes', non_ascii)
    rep.put('csv.nbsp_chars', text.count('\xa0')); rep.put('csv.c1_control_chars', sum(1 for ch in text if 0x80 <= ord(ch) <= 0x9f))
    rep.put('csv.mojibake_markers', {m: text.count(m) for m in ('Ã', 'Â\xa0', 'â€', '�', '_x000D_') if text.count(m)})
    crlf = raw.count(b'\r\n'); lf = raw.count(b'\n') - crlf; cr = raw.count(b'\r') - crlf
    rep.put('csv.line_endings', {'CRLF': crlf, 'bare_LF': lf, 'bare_CR': cr})
    rep.put('csv.ends_with_newline', raw.endswith(b'\n')); rep.put('csv.last_bytes', repr(raw[-40:]))
    rep.put('csv.nul_bytes', raw.count(b'\x00'))
    # parse (strict: an unterminated quoted field at end of file raises instead of being swallowed)
    records, linenos, parse_error = [], [], None
    reader = csv.reader(io.StringIO(text, newline=''), strict=True)
    try:
        for row in reader:
            records.append(row); linenos.append(reader.line_num)
    except csv.Error as e:
        parse_error = f'{e} near physical line {reader.line_num}'
        rep.error('CSV parse error (possible truncation inside a quoted field): ' + parse_error)
    rep.put('csv.parse_error', parse_error)
    if not records:
        rep.error('CSV has no records'); return None
    header = records[0]; body = records[1:]; body_lines = linenos[1:]
    rep.put('csv.physical_lines', raw.count(b'\n') + (0 if raw.endswith(b'\n') or not raw else 1))
    rep.put('csv.records_including_blank', len(body))
    blank = [i for i, r in enumerate(body) if not any(c.strip() for c in r)]
    rep.put('csv.blank_records', len(blank))
    keep = [i for i in range(len(body)) if i not in set(blank)]
    rows = [body[i] for i in keep]; rownum = [i + 2 for i in keep]; rowline = [body_lines[i] for i in keep]
    rep.put('csv.rows', len(rows))
    rep.note('  (a "row" is a parsed CSV record; quoted fields may span several physical lines, so line counts are not row counts)')
    rep.put('csv.records_with_embedded_newlines', sum(1 for r in rows if any('\n' in c or '\r' in c for c in r)))
    hist = collections.Counter(len(r) for r in rows)
    rep.put('csv.field_count_histogram', dict(sorted(hist.items())))
    ragged = [(rownum[i], rowline[i], len(r)) for i, r in enumerate(rows) if len(r) != len(header)]
    if ragged:
        rep.error(f'{len(ragged)} CSV records do not have {len(header)} fields; first (record_no, line, fields): {ragged[:rep.n]}')
    header_report(header, 'csv', rep)
    last = rows[-1] if rows else []
    complete = bool(rows) and len(last) == len(header) and raw.endswith(b'\n') and parse_error is None
    rep.put('csv.last_record', {'record_no': rownum[-1] if rows else None, 'fields': len(last), 'ref': last[idx(header, REF)] if rows and idx(header, REF) is not None and len(last) > idx(header, REF) else None,
                                'complete_field_count': len(last) == len(header), 'file_ends_with_newline': raw.endswith(b'\n'), 'verdict': 'complete' if complete else 'SUSPECT'})
    if not complete:
        rep.error('last CSV record is incomplete or the file does not end with a newline')
    hn = [nh(h) for h in header]
    dicts = [dict(zip(hn, r)) for r in rows]
    refs_report([d.get(REF, '') for d in dicts], dicts, rownum, 'csv', rep, hn, lambda v: v)
    formula = sum(1 for r in rows for c in r if c[:1] in ('=', '@') or (c[:1] in ('+', '-') and as_number(c) is None and len(c) > 1 and not c[1:2].isdigit()))
    rep.put('csv.formula_leading_cells', formula)
    # dates
    rep.section('CSV date columns (official layout dd/mm/yyyy; as-of %s)' % asof)
    out = collections.OrderedDict()
    for col in DATE_COLUMNS:
        if col not in hn:
            out[col] = 'COLUMN MISSING'; continue
        forms = collections.Counter(); bad = []; fut = []; pre = 0; after_upd = 0; nonblank = 0; mn = mx = None
        for d, rn in zip(dicts, rownum):
            v = d.get(col, '') or ''
            dt, form = parse_text_date(v)
            if form == 'blank':
                continue
            nonblank += 1; forms[form] += 1
            if dt is None:
                if len(bad) < rep.n: bad.append({'ref': d.get(REF), 'record_no': rn, 'value': v})
                continue
            mn = dt if mn is None or dt < mn else mn; mx = dt if mx is None or dt > mx else mx
            if dt > asof:
                fut.append({'ref': d.get(REF), 'record_no': rn, 'value': v})
            if dt.year < 1990: pre += 1
            if col != UPDATED:
                u, _ = parse_text_date(d.get(UPDATED, ''))
                if u and dt > u: after_upd += 1
        out[col] = {'nonblank': nonblank, 'forms': dict(forms), 'unparseable': sum(v for k, v in forms.items() if k in ('unparseable',) or k.startswith('impossible')),
                    'unparseable_examples': bad, 'min': str(mn), 'max': str(mx), 'future_after_asof': len(fut), 'future_examples': fut[:rep.n],
                    'future_is_expected_for_this_column': col in FUTURE_ALLOWED, 'before_1990': pre,
                    'later_than_record_last_updated': after_upd if col != UPDATED else None}
        rep.put('csv.dates.' + col, out[col])
    ups = [parse_text_date(d.get(UPDATED, ''))[0] for d in dicts]
    ups = [u for u in ups if u is not None and u <= asof]
    file_max_updated = max(ups) if ups else None
    rep.put('csv.max_record_last_updated_not_after_asof', str(file_max_updated))
    base = {col: {'nonblank': out[col]['nonblank'], 'later_than_record_last_updated': out[col]['later_than_record_last_updated']}
            for col in DATE_COLUMNS if isinstance(out.get(col), dict) and col != UPDATED}
    return {'raw': raw, 'header': header, 'hn': hn, 'dicts': dicts, 'rownum': rownum, 'file_max_updated': file_max_updated, 'base': base}

def idx(header, name):
    hn = [nh(h) for h in header]
    return hn.index(name) if name in hn else None

def header_report(header, tag, rep):
    hs = ['' if h is None else str(h) for h in header]
    exact = hs == EXPECTED_COLUMNS
    hn = [nh(h) for h in hs]
    normeq = hn == NORM_EXPECTED
    rep.put(f'{tag}.columns', len(hs))
    rep.put(f'{tag}.header_exact_match_53_in_order', exact)
    rep.put(f'{tag}.header_match_after_whitespace_normalisation', normeq)
    if not exact:
        rep.put(f'{tag}.header_whitespace_or_text_differences', [{'position': i + 1, 'found': a, 'expected': b} for i, (a, b) in enumerate(zip(hs, EXPECTED_COLUMNS)) if a != b][:60])
    if not normeq:
        rep.put(f'{tag}.header_missing', [c for c in NORM_EXPECTED if c not in hn])
        rep.put(f'{tag}.header_unexpected', [c for c in hn if c not in NORM_EXPECTED])
        common = [c for c in hn if c in NORM_EXPECTED]
        rep.put(f'{tag}.header_common_columns_in_expected_order', common == [c for c in NORM_EXPECTED if c in hn])
        rep.error(f'{tag} header does not match the 53 official columns in order (after whitespace normalisation)')
    dup = [c for c, n in collections.Counter(hn).items() if n > 1]
    if dup:
        rep.error(f'{tag} header has duplicated column names: {dup}')

def refs_report(refs, dicts, rownum, tag, rep, hn, render):
    refs = [clean_ref(r) for r in refs]
    rep.put(f'{tag}.unique_refs', len(set(refs)))
    rep.put(f'{tag}.blank_refs', sum(1 for r in refs if not r))
    nonnum = [r for r in refs if r and not r.isdigit()]
    rep.put(f'{tag}.non_numeric_refs', {'count': len(nonnum), 'examples': nonnum[:rep.n]})
    nums = [int(r) for r in refs if r.isdigit()]
    rep.put(f'{tag}.ref_min_max', [min(nums), max(nums)] if nums else None)
    pos = collections.defaultdict(list)
    for i, r in enumerate(refs): pos[r].append(i)
    dups = []
    for r, ii in pos.items():
        if len(ii) < 2 or not r: continue
        diff = sorted({c for i in ii[1:] for c in hn if render(dicts[i].get(c)) != render(dicts[ii[0]].get(c))}, key=hn.index)
        dups.append({'ref': r, 'occurrences': len(ii), 'record_nos': [rownum[i] for i in ii], 'kind': 'identical' if not diff else 'CONFLICTING',
                     'differing_fields': {c: [str(render(dicts[i].get(c))) for i in ii] for c in diff[:12]}})
    dups.sort(key=lambda d: (not d['ref'].isdigit(), int(d['ref']) if d['ref'].isdigit() else 0))
    rep.put(f'{tag}.duplicate_refs', {'refs': len(dups), 'surplus_rows': sum(d['occurrences'] - 1 for d in dups),
                                      'identical': sum(1 for d in dups if d['kind'] == 'identical'), 'conflicting': sum(1 for d in dups if d['kind'] != 'identical'),
                                      'detail': dups[:max(rep.n, 20)]})
    return refs

# ------------------------------------------------------------------ XLSX
def check_xlsx(path, sheet, rep):
    try:
        import openpyxl
    except ImportError:
        rep.error('openpyxl is not installed; the XLSX cannot be checked (pip install "openpyxl>=3.1,<4")'); return None
    raw = open(path, 'rb').read()
    rep.section('XLSX file')
    rep.put('xlsx.path', path); rep.put('xlsx.bytes', len(raw)); rep.put('xlsx.sha256', sha256(raw))
    rep.put('xlsx.is_zip_container', raw[:2] == b'PK')
    wb = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    rep.put('xlsx.sheets', wb.sheetnames); rep.put('xlsx.date_system_1904', bool(wb.epoch == openpyxl.utils.datetime.CALENDAR_MAC_1904))
    found = None
    for name in ([sheet] if sheet else wb.sheetnames):
        if name not in wb.sheetnames:
            rep.error(f'sheet {name!r} not found'); return None
        ws = wb[name]
        for r_i, row in enumerate(ws.iter_rows(min_row=1, max_row=25), 1):
            if REF in [nh(c.value) for c in row]:
                found = (name, r_i); break
        if found: break
    if not found:
        rep.error('no sheet with a header row containing "Ref ID" in its first 25 rows'); return None
    name, hrow = found; ws = wb[name]
    rep.put('xlsx.sheet_used', name); rep.put('xlsx.header_row', hrow)
    header = None; rows = []; rownum = []
    for r_i, row in enumerate(ws.iter_rows(min_row=hrow), hrow):
        if header is None:
            header = [c.value for c in row]
            while header and header[-1] is None: header.pop()
            continue
        cells = list(row[:len(header)])
        if not any(c.value is not None and str(c.value).strip() != '' for c in cells):
            continue
        rows.append([(c.value, getattr(c, 'is_date', False), getattr(c, 'number_format', None), getattr(c, 'data_type', None)) for c in cells] + [(None, False, None, None)] * (len(header) - len(cells)))
        rownum.append(r_i)
    header_report(header, 'xlsx', rep)
    hn = [nh(h) for h in header]
    rep.put('xlsx.rows', len(rows))
    dicts = [dict(zip(hn, r)) for r in rows]
    def render(c):
        if c is None: return ''
        v = c[0]
        if isinstance(v, (datetime.datetime, datetime.date)): return v.isoformat()
        return '' if v is None else str(v)
    refs_report([d[REF][0] if REF in d else '' for d in dicts], dicts, rownum, 'xlsx', rep, hn, render)
    rep.section('XLSX date-column cell typing')
    for col in DATE_COLUMNS:
        if col not in hn:
            rep.put('xlsx.dates.' + col, 'COLUMN MISSING'); continue
        kinds = collections.Counter(); fmts = collections.Counter(); timed = 0
        for d in dicts:
            k, dt, _ = classify_xlsx_date(d[col])
            kinds[k] += 1
            if k == 'true date':
                fmts[d[col][2]] += 1
                v = d[col][0]
                if isinstance(v, datetime.datetime) and (v.hour or v.minute or v.second): timed += 1
        rep.put('xlsx.dates.' + col, {'cell_kinds': dict(kinds), 'number_formats_of_true_dates': dict(fmts), 'true_dates_with_time_of_day': timed})
    return {'raw': raw, 'header': header, 'hn': hn, 'dicts': dicts, 'rownum': rownum, 'render': render}

def classify_xlsx_date(cell):
    """-> (kind, date|None, raw display).  kind: blank | true date | string | number (not date-formatted) | other"""
    v, is_date, fmt, _ = cell
    if v is None or (isinstance(v, str) and not v.strip()):
        return 'blank', None, ''
    if isinstance(v, datetime.datetime):
        return 'true date', v.date(), v.isoformat(sep=' ')
    if isinstance(v, datetime.date):
        return 'true date', v, v.isoformat()
    if isinstance(v, str):
        d, form = parse_text_date(v)
        return 'string', d, v
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return 'number (not date-formatted)', excel_serial_to_date(v) if 1 < v < 110000 else None, repr(v)
    return 'other', None, repr(v)

# ------------------------------------------------------------------ CSV vs XLSX
def plausible(d, updated, asof, col):
    """An event date is plausible when it is not after the record's own last update and not after the as-of date.
    Expiry dates are exempt (legitimately in the future)."""
    if d is None: return None
    if col in FUTURE_ALLOWED: return 'n/a (future allowed)'
    if d > asof: return False
    if updated is not None and d > updated: return False
    return True

def compare(c, x, asof, rep):
    rep.section('CSV versus XLSX')
    def occ(dicts, getref):
        m = collections.defaultdict(list)
        for i, d in enumerate(dicts): m[clean_ref(getref(d))].append(i)
        return m
    co = occ(c['dicts'], lambda d: d.get(REF, '')); xo = occ(x['dicts'], lambda d: d[REF][0] if REF in d else '')
    only_c = sorted(set(co) - set(xo), key=lambda r: (not r.isdigit(), int(r) if r.isdigit() else 0))
    only_x = sorted(set(xo) - set(co), key=lambda r: (not r.isdigit(), int(r) if r.isdigit() else 0))
    rep.put('compare.row_counts', {'csv': len(c['dicts']), 'xlsx': len(x['dicts'])})
    rep.put('compare.ref_sets_equal', not only_c and not only_x)
    rep.put('compare.refs_only_in_csv', {'count': len(only_c), 'examples': only_c[:rep.n]})
    rep.put('compare.refs_only_in_xlsx', {'count': len(only_x), 'examples': only_x[:rep.n]})
    if only_c or only_x: rep.error('CSV and XLSX Ref ID sets differ')
    occ_mismatch = sorted(r for r in set(co) & set(xo) if len(co[r]) != len(xo[r]))
    rep.put('compare.refs_with_different_occurrence_counts', occ_mismatch[:rep.n])
    rep.put('compare.same_row_order', [clean_ref(d.get(REF, '')) for d in c['dicts']] == [clean_ref(d[REF][0]) for d in x['dicts']] if REF in x['hn'] else None)
    pairs = [(ci, xi, r) for r in co if r in xo for ci, xi in zip(co[r], xo[r])]
    rep.put('compare.row_pairs_compared', len(pairs))
    # ---- dates
    conflicts = []; per_col = collections.Counter(); kinds = collections.Counter()
    for ci, xi, ref in pairs:
        cd, xd = c['dicts'][ci], x['dicts'][xi]
        cu, _ = parse_text_date(cd.get(UPDATED, ''))
        _, xu, _ = classify_xlsx_date(xd[UPDATED]) if UPDATED in xd else ('blank', None, '')
        for col in DATE_COLUMNS:
            if col not in cd or col not in xd: continue
            craw = cd[col] or ''
            cdt, cform = parse_text_date(craw)
            xkind, xdt, xraw = classify_xlsx_date(xd[col])
            if cform == 'blank' and xkind == 'blank': continue
            if cdt is not None and cdt == xdt: continue
            swap = None
            if cdt is not None and xdt is not None:
                swap = (swap_dm(cdt) == xdt) or (swap_dm(xdt) == cdt)
            upd = cu or xu
            pc, px = plausible(cdt, upd, asof, col), plausible(xdt, upd, asof, col)
            fm = c.get('file_max_updated')
            late_c = None if cdt is None or fm is None or col in FUTURE_ALLOWED else cdt > fm
            late_x = None if xdt is None or fm is None or col in FUTURE_ALLOWED else xdt > fm
            if col == UPDATED:
                pc = None if cdt is None else cdt <= asof; px = None if xdt is None else xdt <= asof
            if pc is True and px is True: verdict = 'both plausible'
            elif pc is True and px is not True: verdict = 'only CSV value plausible'
            elif px is True and pc is not True: verdict = 'only XLSX value plausible'
            elif isinstance(pc, str) or isinstance(px, str): verdict = 'not assessed (future dates allowed in this column)'
            else: verdict = 'neither plausible'
            kind = ('day/month swap' if swap else 'one side blank' if (cform == 'blank' or xkind == 'blank') else
                    'unparseable value' if (cdt is None or xdt is None) else 'different dates')
            per_col[col] += 1; kinds[kind] += 1
            conflicts.append({'ref': ref, 'field': col, 'csv_record_no': c['rownum'][ci], 'xlsx_row': x['rownum'][xi],
                              'csv_raw': craw, 'csv_parsed': str(cdt) if cdt else None, 'csv_form': cform,
                              'xlsx_raw': xraw, 'xlsx_parsed': str(xdt) if xdt else None, 'xlsx_cell_kind': xkind,
                              'xlsx_number_format': xd[col][2], 'day_month_swap_explains': swap, 'kind': kind,
                              'record_last_updated_csv': cd.get(UPDATED, ''), 'record_last_updated_xlsx': str(xu) if xu else None,
                              'asof': str(asof), 'file_max_record_last_updated': str(c.get('file_max_updated')), 'csv_value_after_file_max_record_updated': late_c, 'xlsx_value_after_file_max_record_updated': late_x, 'csv_value_plausible': pc, 'xlsx_value_plausible': px, 'verdict': verdict})
    conflicts.sort(key=lambda d: (DATE_COLUMNS.index(d['field']), not d['ref'].isdigit(), int(d['ref']) if d['ref'].isdigit() else 0))
    rep.put('compare.date_disagreements.total', len(conflicts))
    rep.put('compare.date_disagreements.by_field', dict(per_col)); rep.put('compare.date_disagreements.by_kind', dict(kinds))
    rep.data['compare.date_disagreements.detail'] = conflicts
    for d in conflicts[:max(rep.n * 5, 50)]:
        rep.note(f"  ref {d['ref']} | {d['field']} | CSV {d['csv_raw']!r} ({d['csv_parsed']}) vs XLSX {d['xlsx_raw']!r} ({d['xlsx_parsed']}; {d['xlsx_cell_kind']}"
                 f"{', format ' + str(d['xlsx_number_format']) if d['xlsx_cell_kind'] == 'true date' else ''}) | swap explains: {d['day_month_swap_explains']} | "
                 f"record last updated {d['record_last_updated_csv']!r} | {d['verdict']} | later than newest record update in file ({d['file_max_record_last_updated']}): CSV {d['csv_value_after_file_max_record_updated']}, XLSX {d['xlsx_value_after_file_max_record_updated']}")
    if len(conflicts) > max(rep.n * 5, 50):
        rep.note(f'  ... {len(conflicts) - max(rep.n * 5, 50)} more (all are in the --json output)')
    rep.put('compare.base_rate_event_date_later_than_record_last_updated_in_csv', {k: v for k, v in c.get('base', {}).items() if k in per_col})
    rep.note('  Base rate above: how often, across the whole CSV, a date in that column is later than the same record\'s "Record Last Updated". If that is common, "later than last update" is weak evidence.')
    rep.note('  Plausibility is evidence only (an event dated after the record was last updated, or after the as-of date, is implausible); it is not an adjudication of the true date.')
    # ---- silent ambiguity: dates that agree but whose day/month swap is also valid are not flagged (they agree)
    # ---- non-date columns
    other = collections.OrderedDict()
    for col in [h for h in c['hn'] if h in x['hn'] and h not in DATE_COLUMNS]:
        cls = collections.Counter(); ex = []
        for ci, xi, ref in pairs:
            a = c['dicts'][ci].get(col, '') or ''; cell = x['dicts'][xi][col]; b = x['render'](cell)
            if a == b: continue
            na, nb = norm_text(a), norm_text(b)
            fa, fb = as_number(a), as_number(b)
            if na == nb: k = 'whitespace/control-code only'
            elif fa is not None and fb is not None and fa == fb: k = 'numeric formatting only'
            elif fa is not None and fb is not None and abs(fa - fb) <= 0.005 + 1e-12: k = 'numeric rounding (<=0.005)'
            elif na.upper() in ('', 'NA', 'N/A') and nb.upper() in ('', 'NA', 'N/A'): k = 'missing-value marker'
            elif na.lstrip('0') == nb.lstrip('0') and na and nb: k = 'leading zeros'
            else:
                k = 'MATERIAL'
                if len(ex) < rep.n: ex.append({'ref': ref, 'csv': a[:80], 'xlsx': b[:80]})
            cls[k] += 1
        if cls: other[col] = {'classes': dict(cls), 'material_examples': ex}
    rep.put('compare.non_date_field_differences', other)
    rep.put('compare.non_date_material_total', sum(v['classes'].get('MATERIAL', 0) for v in other.values()))
    return conflicts

# ------------------------------------------------------------------ expectations
def check_expectations(exp, rep):
    rep.section('Expectations (compared, not assumed)')
    res = []
    def one(label, expected, actual):
        ok = expected == actual
        res.append({'check': label, 'expected': expected, 'actual': actual, 'pass': ok})
        rep.note(f"  {'PASS' if ok else 'FAIL'}  {label}: expected {expected!r}, actual {actual!r}")
    g = rep.data.get
    if exp.get('csv_bytes') is not None: one('CSV bytes', exp['csv_bytes'], g('csv.bytes'))
    if exp.get('csv_sha256'): one('CSV sha256', exp['csv_sha256'].lower(), g('csv.sha256'))
    if exp.get('rows') is not None: one('CSV rows', exp['rows'], g('csv.rows'))
    if exp.get('unique_refs') is not None: one('CSV unique refs', exp['unique_refs'], g('csv.unique_refs'))
    if exp.get('duplicate_refs') is not None:
        one('CSV duplicated refs', sorted(exp['duplicate_refs']), sorted(d['ref'] for d in (g('csv.duplicate_refs') or {}).get('detail', [])))
    if 'xlsx.bytes' in rep.data:
        if exp.get('xlsx_bytes') is not None: one('XLSX bytes', exp['xlsx_bytes'], g('xlsx.bytes'))
        if exp.get('xlsx_sha256'): one('XLSX sha256', exp['xlsx_sha256'].lower(), g('xlsx.sha256'))
        if exp.get('rows') is not None: one('XLSX rows', exp['rows'], g('xlsx.rows'))
        if exp.get('unique_refs') is not None: one('XLSX unique refs', exp['unique_refs'], g('xlsx.unique_refs'))
        if exp.get('duplicate_refs') is not None:
            one('XLSX duplicated refs', sorted(exp['duplicate_refs']), sorted(d['ref'] for d in (g('xlsx.duplicate_refs') or {}).get('detail', [])))
    elif any(exp.get(k) for k in ('xlsx_bytes', 'xlsx_sha256')):
        rep.note('  NOT CHECKED  XLSX expectations (no --xlsx given)')
    if exp.get('date_conflicts') is not None:
        if 'compare.date_disagreements.detail' in rep.data:
            actual = collections.defaultdict(list)
            for d in rep.data['compare.date_disagreements.detail']: actual[d['field']].append(d['ref'])
            want = {nh(k): sorted(v, key=int) for k, v in exp['date_conflicts'].items()}
            one('CSV-vs-XLSX date disagreements (field -> refs), complete list', want, {k: sorted(v, key=lambda r: int(r) if r.isdigit() else 0) for k, v in actual.items()})
        else:
            rep.note('  NOT CHECKED  date-conflict expectation (needs --xlsx)')
    rep.data['expectations'] = res
    return all(r['pass'] for r in res)

def main(argv=None):
    ap = argparse.ArgumentParser(description='Verify a raw official REPD CSV (and optionally the XLSX).')
    ap.add_argument('csv'); ap.add_argument('--xlsx'); ap.add_argument('--sheet')
    ap.add_argument('--asof', default=datetime.date.today().isoformat(), help='reference date for "future" and plausibility tests (YYYY-MM-DD)')
    ap.add_argument('--json'); ap.add_argument('--max-examples', type=int, default=10)
    ap.add_argument('--expect-october-2026', action='store_true', help='compare against the figures reported for the October 2026 (Q3) files')
    ap.add_argument('--expect-csv-bytes', type=int); ap.add_argument('--expect-csv-sha256')
    ap.add_argument('--expect-xlsx-bytes', type=int); ap.add_argument('--expect-xlsx-sha256')
    ap.add_argument('--expect-rows', type=int); ap.add_argument('--expect-unique-refs', type=int)
    ap.add_argument('--expect-duplicate-refs', help='comma-separated refs expected to be duplicated ("" for none)')
    ap.add_argument('--expect-date-conflicts', action='append', help='"Field name=ref,ref" (repeatable); the complete expected list')
    a = ap.parse_args(argv)
    asof = datetime.date.fromisoformat(a.asof)
    exp = dict(OCTOBER_2026) if a.expect_october_2026 else {}
    for k in ('csv_bytes', 'csv_sha256', 'xlsx_bytes', 'xlsx_sha256', 'rows', 'unique_refs'):
        v = getattr(a, 'expect_' + k)
        if v is not None: exp[k] = v
    if a.expect_duplicate_refs is not None: exp['duplicate_refs'] = [r for r in a.expect_duplicate_refs.split(',') if r.strip()]
    if a.expect_date_conflicts:
        exp['date_conflicts'] = {f.split('=', 1)[0]: [r.strip() for r in f.split('=', 1)[1].split(',') if r.strip()] for f in a.expect_date_conflicts}
    rep = Report(a.max_examples)
    rep.put('tool', 'verify_release.py'); rep.put('asof', str(asof))
    c = check_csv(a.csv, asof, rep)
    x = check_xlsx(a.xlsx, a.sheet, rep) if a.xlsx else None
    if c and x: compare(c, x, asof, rep)
    ok = check_expectations(exp, rep) if exp else True
    rep.section('Result')
    rep.put('structural_errors', rep.structural)
    status = 2 if rep.structural else (0 if ok else 1)
    rep.put('exit_status', status)
    rep.note({0: 'OK: no structural error and no failed expectation.', 1: 'EXPECTATION FAILED: see the Expectations section.',
              2: 'STRUCTURAL ERROR: see the STRUCTURAL lines above.'}[status])
    print('\n'.join(rep.lines))
    if a.json:
        with open(a.json, 'w', encoding='utf-8') as f:
            json.dump(rep.data, f, indent=1, default=str, ensure_ascii=False)
    return status

if __name__ == '__main__':
    sys.exit(main())
