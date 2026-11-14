#!/usr/bin/env python3
"""validate.py - release gates for a REPD quarterly extract (raw official files or a cleaned candidate).

Reuses (does not rewrite):
  automation/repd/verify_release.py  - verbatim copy of the private prototype tools/verify_release.py
                                       (CSV/XLSX parsing, 53-column header check, ref/duplicate analysis,
                                       last-record completeness, CSV-vs-XLSX comparison, expectations)
  work7/coord_audit.py               - coordinate parsing, hidden-character flags, BNG envelope, country/region
                                       boxes and the same-region neighbour test (constants copied below)
  scripts/repd_q3_staging_verify.py  - its "rows == unique refs after dedupe", "last Ref ID present" and
                                       dd/mm/yyyy date assertions are expressed here as named gates

Usage
  python3 -I validate.py check --csv REPD.csv [--xlsx REPD.xlsx | --csv-only] --baseline PREV.json
          [--known-anomalies KNOWN.json] [--asof YYYY-MM-DD] [--json report.json] [--verify-json full.json]
          [--expect-rows N] [--expect-unique-refs N] [--expect-csv-sha256 H] [--expect-xlsx-sha256 H]
          [--strict-vocab]
  python3 -I validate.py make-baseline (--from-csv PREV.csv | --from-identity-v6 project_identity_v6.json)
          --release-id 2026q2 --out PREV.json

Gate status: pass | warn | fail | skip.  Warnings never fail the run; skips are only allowed when asked for
(--csv-only skips the CSV-vs-XLSX gates explicitly and says so).
Exit status: 0 = every gate pass/warn/skip-as-requested; 1 = at least one gate failed;
             2 = could not run (missing/unreadable input, bad baseline, usage error).
"""
import argparse
import collections
import datetime
import hashlib
import json
import math
import os
import re
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
try:  # package import (automation.repd.validate)
    from . import verify_release as vr  # type: ignore
except ImportError:  # run as a script or imported from its own directory
    if _HERE not in sys.path:
        sys.path.insert(0, _HERE)
    import verify_release as vr  # type: ignore

SCHEMA = 'globalgrid2050.repd-validate.v1'
BASELINE_SCHEMA = 'globalgrid2050.repd-validate-baseline.v1'
REF = vr.REF
UPDATED = vr.UPDATED
DATE_COLUMNS = vr.DATE_COLUMNS
FUTURE_ALLOWED = vr.FUTURE_ALLOWED
VOCAB_COLUMNS = ('Development Status (short)', 'Technology Type')
NA_MARKERS = {'NA', 'N/A', '#N/A', 'N.A.'}

# ---- coordinate constants, copied from work7/coord_audit.py ----
OFFSHORE_TECH = {'Wind Offshore', 'Tidal Stream', 'Tidal Lagoon', 'Tidal Barrage and Tidal Stream',
                 'Shoreline Wave', 'Wave'}
COUNTRY_BOX = {
    'England': (49.80, 55.85, -6.50, 1.90),
    'Scotland': (54.60, 60.95, -8.70, -0.70),
    'Wales': (51.30, 53.50, -5.40, -2.60),
    'Northern Ireland': (54.00, 55.40, -8.20, -5.40),
}
REGION_BOX = {
    'North East': (54.40, 55.85, -2.70, -0.75),
    'North West': (52.90, 55.20, -3.70, -1.90),
    'Yorkshire and Humber': (53.25, 54.60, -2.60, 0.20),
    'East Midlands': (51.95, 53.65, -2.05, 0.40),
    'West Midlands': (51.80, 53.25, -3.25, -1.15),
    'Eastern': (51.40, 53.00, -0.80, 1.80),
    'London': (51.25, 51.72, -0.55, 0.35),
    'South East': (50.50, 52.25, -1.98, 1.50),
    'South West': (49.80, 52.15, -6.50, -1.45),
    'Wales': COUNTRY_BOX['Wales'],
    'Scotland': COUNTRY_BOX['Scotland'],
    'Northern Ireland': COUNTRY_BOX['Northern Ireland'],
}
REGION_COUNTRY = {r: 'England' for r in REGION_BOX}
REGION_COUNTRY.update({'Wales': 'Wales', 'Scotland': 'Scotland', 'Northern Ireland': 'Northern Ireland'})
PAD_ON, PAD_OFF = 0.10, 2.00
# soft envelope (coord_audit): outside it is an anomaly (warn); offshore arrays legitimately exceed E 700000
BNG_E, BNG_N = (-50000, 700000), (0, 1250000)
# hard bounds (gate): outside these the value cannot be a UK/offshore British National Grid coordinate
HARD_E, HARD_N = (-250000, 900000), (-50000, 1350000)
ISO_KM = 25.0
_NUM = re.compile(r'^-?\d+(\.\d+)?$')


def cell_flags(s):
    f = []
    if s != s.strip(' '):
        f.append('SPACE_PAD')
    if '\t' in s:
        f.append('TAB')
    if '\r' in s or '\n' in s:
        f.append('CR_LF')
    if '\xa0' in s:
        f.append('NBSP')
    if any(ord(c) < 32 and c not in '\t\r\n' for c in s) or '﻿' in s:
        f.append('OTHER_CONTROL')
    return f


def parse_coord(s):
    c = (s or '').replace('\xa0', ' ').replace('﻿', '').strip().replace(',', '')
    if c == '':
        return None, 'BLANK'
    if not _NUM.match(c):
        return None, 'NON_NUMERIC'
    return float(c), 'OK'


def inbox(lat, lon, box, pad):
    return box[0] - pad <= lat <= box[1] + pad and box[2] - pad <= lon <= box[3] + pad


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def _refkey(r):
    return (not r.isdigit(), int(r) if r.isdigit() else 0, r)


# =================================================================== baseline
def baseline_from_rows(dicts, release_id, source):
    refs = [vr.clean_ref(d.get(REF, '')) for d in dicts]
    vocab = {}
    for col in VOCAB_COLUMNS:
        vocab[col] = dict(sorted(collections.Counter((d.get(col) or '').strip() for d in dicts).items()))
    return {'schema': BASELINE_SCHEMA, 'release_id': release_id, 'source': source,
            'rows': len(dicts), 'unique_refs': len(set(refs)),
            'refs': sorted(set(r for r in refs if r), key=_refkey), 'vocab': vocab}


def baseline_from_identity_v6(path, release_id):
    d = json.load(open(path, encoding='utf-8'))
    recs = d['records']
    repd = [r for r in recs if r.get('repd_ref')]
    dicts = [{REF: str(r['repd_ref']), 'Development Status (short)': r.get('status') or '',
              'Technology Type': r.get('technology') or ''} for r in repd]
    b = baseline_from_rows(dicts, release_id, {'kind': 'project_identity_v6', 'path': path,
                                                'sha256': sha256_file(path),
                                                'declared_source_hashes': d.get('source_hashes'),
                                                'source_dataset_title': d.get('source_dataset_title')})
    declared = d.get('raw_record_count')
    if declared is not None and declared != b['rows']:
        raise ValueError(f'identity file declares raw_record_count={declared} but holds {b["rows"]} REPD records')
    b['rows'] = declared if declared is not None else b['rows']
    return b


def baseline_from_csv(path, release_id):
    rep = vr.Report(5)
    c = vr.check_csv(path, datetime.date.today(), rep)
    if c is None or rep.structural:
        raise ValueError(f'baseline CSV {path} has structural errors: {rep.structural}')
    return baseline_from_rows(c['dicts'], release_id, {'kind': 'csv', 'path': path, 'sha256': sha256_file(path)})


def load_baseline(path):
    b = json.load(open(path, encoding='utf-8'))
    if b.get('schema') == BASELINE_SCHEMA:
        for k in ('rows', 'vocab', 'release_id'):
            if k not in b:
                raise ValueError(f'baseline {path} lacks {k!r}')
        return b
    # accept the July repd_source_reconciliation_v6.json (counts only, no vocabularies)
    if b.get('schema') == 'globalgrid2050.repd-source-reconciliation.v6':
        m = b['metrics']
        return {'schema': BASELINE_SCHEMA, 'release_id': 'reconciliation_v6', 'rows': m['csv_rows'],
                'unique_refs': m['csv_unique_refs'], 'refs': None, 'vocab': {},
                'source': {'kind': 'repd_source_reconciliation_v6', 'path': path}}
    raise ValueError(f'{path}: not a validate baseline (schema {b.get("schema")!r})')


# =================================================================== gates
class Gates:
    def __init__(self):
        self.items = []

    def add(self, gid, group, status, summary, **detail):
        assert status in ('pass', 'warn', 'fail', 'skip')
        self.items.append({'id': gid, 'group': group, 'status': status, 'summary': summary, 'detail': detail})
        return status

    def failed(self):
        return [g for g in self.items if g['status'] == 'fail']


def source_gates(G, rep, c, x, base, csv_only):
    d = rep.data
    # S1 columns
    hdr_ok = d.get('csv.header_match_after_whitespace_normalisation') is True and d.get('csv.columns') == 53
    det = {'csv_columns': d.get('csv.columns'), 'csv_exact_verbatim': d.get('csv.header_exact_match_53_in_order'),
           'csv_whitespace_differences': d.get('csv.header_whitespace_or_text_differences', [])}
    if x is not None:
        xok = d.get('xlsx.header_match_after_whitespace_normalisation') is True and d.get('xlsx.columns') == 53
        hdr_ok = hdr_ok and xok
        det.update(xlsx_columns=d.get('xlsx.columns'), xlsx_exact_verbatim=d.get('xlsx.header_exact_match_53_in_order'))
    if not hdr_ok:
        det.update(missing=d.get('csv.header_missing'), unexpected=d.get('csv.header_unexpected'))
    G.add('S1_columns_53_in_order', 'source', 'pass' if hdr_ok else 'fail',
          '53 official columns in order (whitespace-normalised)' if hdr_ok else 'header is not the 53 official columns in order', **det)

    # S2 ids unique after identical-duplicate handling
    dup = d.get('csv.duplicate_refs') or {}
    blank = d.get('csv.blank_refs', 0)
    conflicting = [x_ for x_ in dup.get('detail', []) if x_['kind'] != 'identical']
    identical = [x_['ref'] for x_ in dup.get('detail', []) if x_['kind'] == 'identical']
    status = 'fail' if (conflicting or blank) else ('warn' if identical else 'pass')
    xdet = {}
    if x is not None:
        xdup = d.get('xlsx.duplicate_refs') or {}
        xconf = [x_ for x_ in xdup.get('detail', []) if x_['kind'] != 'identical']
        xdet = {'xlsx_identical_duplicates': [x_['ref'] for x_ in xdup.get('detail', []) if x_['kind'] == 'identical'],
                'xlsx_conflicting_duplicates': xconf, 'xlsx_blank_refs': d.get('xlsx.blank_refs', 0)}
        if xconf or d.get('xlsx.blank_refs', 0):
            status = 'fail'
    G.add('S2_ref_ids_unique_after_identical_dedupe', 'source', status,
          f'{d.get("csv.unique_refs")} unique refs in {d.get("csv.rows")} rows; identical duplicates {identical}; '
          f'conflicting {len(conflicting)}; blank {blank}',
          rows=d.get('csv.rows'), unique_refs=d.get('csv.unique_refs'), identical_duplicates=identical,
          conflicting_duplicates=conflicting, blank_refs=blank,
          non_numeric_refs=d.get('csv.non_numeric_refs'), **xdet)

    # S3 CSV and XLSX ref sets equal
    if x is None:
        G.add('S3_csv_xlsx_ref_sets_equal', 'source', 'skip' if csv_only else 'fail',
              'skipped by --csv-only (cleaned candidate)' if csv_only else 'no XLSX given (use --csv-only to skip explicitly)')
    else:
        eq = d.get('compare.ref_sets_equal') is True
        occ = d.get('compare.refs_with_different_occurrence_counts') or []
        rc = d.get('compare.row_counts')
        ok = eq and not occ and rc['csv'] == rc['xlsx']
        G.add('S3_csv_xlsx_ref_sets_equal', 'source', 'pass' if ok else 'fail',
              f'ref sets equal={eq}; rows csv={rc["csv"]} xlsx={rc["xlsx"]}',
              refs_only_in_csv=d.get('compare.refs_only_in_csv'), refs_only_in_xlsx=d.get('compare.refs_only_in_xlsx'),
              refs_with_different_occurrence_counts=occ, row_counts=rc)

    # S4 row floor vs previous release (actual count from baseline file)
    uniq = d.get('csv.unique_refs') or 0
    floor = base['rows']
    det = {'baseline_release': base.get('release_id'), 'baseline_rows': floor, 'unique_refs': uniq,
           'rows': d.get('csv.rows'), 'baseline_source': base.get('source')}
    if base.get('refs'):
        cur = {vr.clean_ref(r.get(REF, '')) for r in c['dicts']}
        prev = set(base['refs'])
        dropped = sorted(prev - cur, key=_refkey)
        det.update(refs_dropped_since_baseline={'count': len(dropped), 'refs': dropped[:200]},
                   refs_new_since_baseline=len(cur - prev))
    G.add('S4_row_floor_vs_previous_release', 'source', 'pass' if uniq >= floor else 'fail',
          f'{uniq} unique refs vs previous release {floor} ({base.get("release_id")})', **det)
    if det.get('refs_dropped_since_baseline', {}).get('count'):
        G.add('S4b_refs_dropped_since_previous_release', 'source', 'warn',
              f'{det["refs_dropped_since_baseline"]["count"]} refs of the previous release are absent',
              refs=det['refs_dropped_since_baseline']['refs'])

    # S5 last record complete (and the whole file parsed with a constant field count)
    last = d.get('csv.last_record') or {}
    ragged = any('do not have' in s for s in rep.structural)
    ok = last.get('verdict') == 'complete' and not d.get('csv.parse_error') and not ragged
    det = {'csv_last_record': last, 'parse_error': d.get('csv.parse_error'), 'ragged_rows': ragged,
           'field_count_histogram': d.get('csv.field_count_histogram')}
    if x is not None and x['dicts']:
        xlast = vr.clean_ref(x['dicts'][-1][REF][0]) if REF in x['dicts'][-1] else None
        det['xlsx_last_ref'] = xlast
        if last.get('ref') is not None and xlast != vr.clean_ref(last.get('ref')):
            det['last_ref_differs'] = True
    G.add('S5_last_record_complete', 'source', 'pass' if ok else 'fail',
          f'last record ref {last.get("ref")}: {last.get("verdict")}', **det)

    # S6 expectations (descriptor-provided counts/hashes), only when given
    if d.get('expectations') is not None:
        res = d['expectations']
        bad = [r for r in res if not r['pass']]
        G.add('S6_descriptor_expectations', 'source', 'fail' if bad else 'pass',
              f'{len(res) - len(bad)}/{len(res)} expectations met', results=res)

    # S7 other structural findings of verify_release not already covered above
    other = [s for s in rep.structural if 'header' not in s and 'Ref ID sets' not in s and 'last CSV record' not in s
             and 'do not have' not in s]
    if other:
        G.add('S7_other_structural', 'source', 'fail', '; '.join(other), findings=other)


def _xlsx_date_index(x):
    """ref -> {col: (kind, date)} for the first occurrence of each ref in the XLSX"""
    out = {}
    if x is None:
        return out
    for dct in x['dicts']:
        ref = vr.clean_ref(dct[REF][0]) if REF in dct else ''
        if ref in out:
            continue
        out[ref] = {col: vr.classify_xlsx_date(dct[col])[:2] for col in DATE_COLUMNS if col in dct}
    return out


_MDY_ANY = re.compile(r'^(\d{1,2})/(\d{1,2})/(\d{4})$')


def _csv_text_is_date(raw, dt, xd):
    """True when CSV text ``raw`` (parsed day-first as ``dt``, or None) denotes the typed XLSX date ``xd``
    as written day-first, ISO, or month-first."""
    if dt is not None and (dt == xd or vr.swap_dm(dt) == xd):
        return True
    m = _MDY_ANY.match(raw.strip())
    if m:
        try:
            return datetime.date(int(m.group(3)), int(m.group(1)), int(m.group(2))) == xd
        except ValueError:
            return False
    return False


def date_gates(G, c, x, asof):
    xi = _xlsx_date_index(x)
    invalid, resolved, na_cells, future, future_allowed = [], [], [], [], collections.Counter()
    forms = collections.defaultdict(collections.Counter)
    for dct, rn in zip(c['dicts'], c['rownum']):
        ref = vr.clean_ref(dct.get(REF, ''))
        for col in DATE_COLUMNS:
            if col not in dct:
                continue
            raw = (dct.get(col) or '').strip()
            if not raw:
                continue
            if raw.upper() in NA_MARKERS:
                na_cells.append({'ref': ref, 'field': col, 'value': raw})
                continue
            dt, form = vr.parse_text_date(raw)
            forms[col][form] += 1
            xk, xd = xi.get(ref, {}).get(col, (None, None))
            if dt is not None and form == 'dd/mm/yyyy' and xk == 'true date' and xd is not None and xd != dt:
                # valid dd/mm/yyyy text that disagrees with the typed Excel cell. Resolvable only when the
                # CSV is the same date written month-first (e.g. 09/11/2026 for 11 Sep); any other
                # disagreement is two different dates in the two official files and fails.
                item = {'ref': ref, 'record_no': rn, 'field': col, 'csv_value': raw,
                        'csv_form': 'disagrees with typed XLSX date' + (' (day/month swap)' if vr.swap_dm(dt) == xd else ''),
                        'xlsx_kind': xk, 'xlsx_date': str(xd)}
                if vr.swap_dm(dt) == xd:
                    resolved.append(item)
                    dt = xd
                else:
                    item['csv_form'] = 'different date from typed XLSX date (not a day/month swap)'
                    invalid.append(item)
                    continue
            elif dt is None or form != 'dd/mm/yyyy':
                item = {'ref': ref, 'record_no': rn, 'field': col, 'csv_value': raw, 'csv_form': form,
                        'xlsx_kind': xk, 'xlsx_date': str(xd) if xd else None}
                if xk == 'true date' and xd is not None:
                    # typed Excel date wins (general date rule) only where the CSV text is that same date in
                    # some reading (non-padded, ISO, month-first); unparseable text or another date fails
                    if _csv_text_is_date(raw, dt, xd):
                        resolved.append(item)
                        dt = xd
                    else:
                        item['csv_form'] = f'{form}; not the typed XLSX date in any reading'
                        invalid.append(item)
                        continue
                elif dt is not None and form in ('d/m/yyyy (not zero-padded)', 'iso'):
                    resolved.append(item)          # unambiguous, just not in canonical layout
                else:
                    invalid.append(item)
                if dt is None:
                    continue
            if dt > asof:
                if col in FUTURE_ALLOWED:
                    future_allowed[col] += 1
                else:
                    future.append({'ref': ref, 'field': col, 'value': raw, 'record_last_updated': dct.get(UPDATED, '')})
    G.add('C1_dates_valid', 'content', 'fail' if invalid else ('warn' if resolved else 'pass'),
          f'{len(invalid)} date cells invalid with no typed-Excel fallback; {len(resolved)} non-canonical cells resolvable '
          f'(typed XLSX date or unambiguous form)',
          invalid=invalid, resolvable_non_canonical=resolved, forms={k: dict(v) for k, v in forms.items()})
    G.add('C1b_date_na_markers', 'content', 'warn' if na_cells else 'pass',
          f'{len(na_cells)} date cells hold a text missing-value marker (treated as blank/unknown)',
          cells=na_cells, by_field=dict(collections.Counter(n['field'] for n in na_cells)))
    G.add('C2_future_dates', 'content', 'warn' if future else 'pass',
          f'{len(future)} event dates after as-of {asof} (expiry dates excluded: {dict(future_allowed)})',
          asof=str(asof), future=sorted(future, key=lambda f: _refkey(f['ref'])), expiry_dates_in_future=dict(future_allowed))


def vocab_gates(G, c, base, strict):
    bv = base.get('vocab') or {}
    if not bv:
        G.add('C3_vocabularies_vs_previous', 'content', 'fail' if strict else 'warn',
              'baseline has no vocabularies; status/technology not compared')
        return
    det, new_any = {}, False
    for col in VOCAB_COLUMNS:
        cur = collections.Counter((dct.get(col) or '').strip() for dct in c['dicts'])
        prev = bv.get(col)
        if prev is None:
            det[col] = {'error': 'column missing from baseline'}
            new_any = True
            continue
        new = {k: v for k, v in cur.items() if k not in prev}
        new_refs = {k: sorted({vr.clean_ref(dct.get(REF, '')) for dct in c['dicts'] if (dct.get(col) or '').strip() == k},
                              key=_refkey)[:50] for k in new}
        gone = sorted(k for k in prev if k not in cur)
        det[col] = {'new_values': new, 'new_value_refs': new_refs, 'values_no_longer_present': gone,
                    'counts': dict(sorted(cur.items())), 'previous_counts': prev}
        new_any = new_any or bool(new)
    summ = '; '.join(f'{col}: new {list(det[col].get("new_values", {}))} gone {det[col].get("values_no_longer_present")}'
                     for col in VOCAB_COLUMNS if isinstance(det.get(col), dict))
    G.add('C3_vocabularies_vs_previous', 'content', ('fail' if strict else 'warn') if new_any else 'pass',
          summ, baseline_release=base.get('release_id'), **det)


def coordinate_gates(G, c, known_refs, known_scope='all known refs (legacy file without known_coordinates)'):
    try:
        from pyproj import Transformer
        t_bng = Transformer.from_crs('EPSG:27700', 'EPSG:4326', always_xy=True)
        t_ig = Transformer.from_crs('EPSG:29903', 'EPSG:4326', always_xy=True)
    except Exception:  # pyproj optional: box tests are then skipped, numeric/bounds tests still run
        t_bng = t_ig = None
    anomalies, nonnum, hard_out, blank_both, blank_one = [], [], [], [], []
    xy = {}
    rows = {}

    def add(dct, code, detail):
        ref = vr.clean_ref(dct.get(REF, ''))
        anomalies.append({'anomaly': code, 'ref': ref, 'site_name': dct.get('Site Name', ''),
                          'technology': dct.get('Technology Type', ''), 'country': dct.get('Country', ''),
                          'region': dct.get('Region', ''), 'x_raw': dct.get('X-coordinate', ''),
                          'y_raw': dct.get('Y-coordinate', ''), 'detail': detail, 'known': ref in known_refs})

    for dct in c['dicts']:
        ref = vr.clean_ref(dct.get(REF, ''))
        if ref in rows:
            continue  # identical duplicates are checked once
        rows[ref] = dct
        xr, yr = dct.get('X-coordinate', '') or '', dct.get('Y-coordinate', '') or ''
        fl = sorted(set(cell_flags(xr) + cell_flags(yr)))
        if fl:
            add(dct, 'HIDDEN_CHARS', '+'.join(fl))
        country, region, tech = (dct.get('Country') or '').strip(), (dct.get('Region') or '').strip(), (dct.get('Technology Type') or '').strip()
        if not country or not region:
            add(dct, 'COUNTRY_OR_REGION_BLANK', f'country={country!r} region={region!r}')
        elif region != 'Offshore' and REGION_COUNTRY.get(region) != country:
            add(dct, 'COUNTRY_REGION_LABEL_MISMATCH', f'country={country} region={region}')
        x, sx = parse_coord(xr)
        y, sy = parse_coord(yr)
        if sx == 'BLANK' and sy == 'BLANK':
            blank_both.append(ref)
            continue
        if 'BLANK' in (sx, sy) and 'NON_NUMERIC' not in (sx, sy):
            blank_one.append(ref)
            continue
        if 'NON_NUMERIC' in (sx, sy):
            nonnum.append({'ref': ref, 'x': xr, 'y': yr})
            continue
        if not (HARD_E[0] <= x <= HARD_E[1] and HARD_N[0] <= y <= HARD_N[1]) or (abs(x) < 1000 and abs(y) < 1000):
            hard_out.append({'ref': ref, 'x': x, 'y': y, 'known': ref in known_refs})
            add(dct, 'OUTSIDE_HARD_BOUNDS', f'E {x} N {y} outside E {HARD_E} N {HARD_N} (or both < 1000: degrees?)')
            continue
        xy[ref] = (x, y)
        if x == 0 or y == 0:
            add(dct, 'ZERO_VALUE', '')
        if not (BNG_E[0] <= x <= BNG_E[1] and BNG_N[0] <= y <= BNG_N[1]):
            add(dct, 'OUTSIDE_BNG_ENVELOPE', f'E range {BNG_E}, N range {BNG_N} (offshore arrays may exceed)')
        if t_bng is None:
            continue
        lon, lat = t_bng.transform(x, y)
        offshore = tech in OFFSHORE_TECH or region == 'Offshore'
        pad = PAD_OFF if offshore else PAD_ON
        if country == 'Northern Ireland':
            nb = COUNTRY_BOX['Northern Ireland']
            if not inbox(lat, lon, nb, pad):
                lon_ig, lat_ig = t_ig.transform(x, y)
                add(dct, 'NI_IRISH_GRID_NOT_BNG' if inbox(lat_ig, lon_ig, nb, pad) else 'OUTSIDE_COUNTRY_BOX',
                    f'BNG lat/lon {lat:.4f},{lon:.4f}')
            continue
        cb = COUNTRY_BOX.get(country)
        if cb is not None and not inbox(lat, lon, cb, pad):
            add(dct, 'OUTSIDE_COUNTRY_BOX', f'BNG lat/lon {lat:.4f},{lon:.4f}; offshore={offshore}')
        rb = REGION_BOX.get(region)
        if rb is not None and not inbox(lat, lon, rb, pad):
            add(dct, 'OUTSIDE_REGION_BOX', f'BNG lat/lon {lat:.4f},{lon:.4f}; offshore={offshore}')

    # neighbour test (coord_audit): onshore point whose nearest same-region record is > 25 km away and whose
    # 10 nearest records are all in other regions
    try:
        import numpy as np
        on = [k for k in xy if (rows[k].get('Region') or '').strip() in REGION_BOX
              and (rows[k].get('Technology Type') or '').strip() not in OFFSHORE_TECH]
        if len(on) > 10:
            P = np.array([xy[k] for k in on])
            reg = np.array([(rows[k].get('Region') or '').strip() for k in on])
            for i in range(0, len(on), 500):
                D = np.hypot(P[i:i + 500, None, 0] - P[None, :, 0], P[i:i + 500, None, 1] - P[None, :, 1])
                for j in range(D.shape[0]):
                    dd = D[j]
                    same = (reg == reg[i + j]) & (dd > 0)
                    dsame = dd[same].min() if same.any() else float('inf')
                    order = np.argsort(dd)
                    k10 = order[dd[order] > 0][:10]
                    if dsame > ISO_KM * 1000 and float((reg[k10] == reg[i + j]).mean()) == 0.0:
                        near = collections.Counter(reg[k10]).most_common(1)[0][0]
                        add(rows[on[i + j]], 'ISOLATED_FROM_STATED_REGION',
                            f'nearest other {reg[i + j]} record {dsame / 1000:.1f} km away; 10 nearest mostly {near}')
    except ImportError:
        pass

    unknown_hard = [h for h in hard_out if not h['known']]
    G.add('C4_coordinates_numeric_and_in_bounds', 'content',
          'fail' if (nonnum or unknown_hard) else ('warn' if hard_out else 'pass'),
          f'{len(xy)} numeric pairs in bounds; non-numeric {len(nonnum)}; outside hard bounds {len(hard_out)} '
          f'({len(unknown_hard)} not on known list); blank both {len(blank_both)}; one blank {len(blank_one)}',
          hard_bounds={'E': HARD_E, 'N': HARD_N}, non_numeric=nonnum, outside_hard_bounds=hard_out,
          blank_both=sorted(blank_both, key=_refkey), blank_one=sorted(blank_one, key=_refkey),
          pyproj_box_tests=t_bng is not None, known_scope=known_scope)
    return anomalies


def anomaly_gate(G, c, x, rep, coord_anoms, known):
    """C5: known-anomaly report. Never fails; lists what is found, which known items are still present,
    which known items are gone, and which anomalies are not on the known list."""
    d = rep.data
    found = list(coord_anoms)
    for dup_ in (d.get('csv.duplicate_refs') or {}).get('detail', []):
        found.append({'anomaly': 'DUPLICATE_REF_' + dup_['kind'].upper(), 'ref': dup_['ref'],
                      'detail': f'{dup_["occurrences"]} occurrences', 'known': dup_['ref'] in known})
    for g in G.items:
        if g['id'] == 'C1_dates_valid':
            for it in g['detail']['resolvable_non_canonical']:
                found.append({'anomaly': 'CSV_DATE_NON_CANONICAL', 'ref': it['ref'],
                              'detail': f'{it["field"]}: CSV {it["csv_value"]!r} ({it["csv_form"]}) XLSX {it["xlsx_date"]}',
                              'known': it['ref'] in known})
        if g['id'] == 'C1b_date_na_markers':
            for it in g['detail']['cells']:
                found.append({'anomaly': 'DATE_TEXT_NA', 'ref': it['ref'], 'detail': it['field'], 'known': it['ref'] in known})
    if x is not None:
        for dd in d.get('compare.date_disagreements.detail', []):
            if (dd['csv_raw'] or '').strip().upper() in NA_MARKERS:
                continue  # reported as DATE_TEXT_NA
            found.append({'anomaly': 'CSV_XLSX_DATE_DISAGREEMENT', 'ref': dd['ref'],
                          'detail': f'{dd["field"]}: CSV {dd["csv_raw"]!r} vs XLSX {dd["xlsx_raw"]!r} ({dd["kind"]})',
                          'known': dd['ref'] in known})
        # XLSX numbers stored with a date format in a non-date column (e.g. "Offshore Wind Round")
        date_fmt_cols = collections.Counter()
        for dct in x['dicts']:
            for col, cell in dct.items():
                if col in DATE_COLUMNS or cell is None:
                    continue
                if isinstance(cell[0], (datetime.datetime, datetime.date)):
                    date_fmt_cols[col] += 1
        for col, n in date_fmt_cols.items():
            found.append({'anomaly': 'XLSX_DATE_TYPED_CELLS_IN_NON_DATE_COLUMN', 'ref': '', 'detail': f'{col}: {n} cells',
                          'known': ('column:' + col) in known})
    kinds = {k.split(':', 1)[1] for k in known if k.startswith('kind:')}
    for a in found:
        if a['anomaly'] in kinds:
            a['known'] = True
    present = {a['ref'] for a in found if a['ref']}
    present_cols = {'column:' + a['detail'].split(':')[0] for a in found if a['anomaly'] == 'XLSX_DATE_TYPED_CELLS_IN_NON_DATE_COLUMN'}
    present_kinds = {'kind:' + a['anomaly'] for a in found}
    known_missing = sorted([k for k in known if k not in present and k not in present_cols and k not in present_kinds
                            and not (k.startswith('column:') and x is None)], key=_refkey)
    unknown = [a for a in found if not a['known']]
    G.add('C5_known_anomaly_report', 'content', 'warn' if (unknown or known_missing) else 'pass',
          f'{len(found)} anomalies ({len(found) - len(unknown)} on known list, {len(unknown)} not); '
          f'{len(known_missing)} known items no longer present',
          counts=dict(collections.Counter(a['anomaly'] for a in found)), known_items_no_longer_present=known_missing,
          known_list=known, anomalies=found)


def load_known_coordinates(path):
    """Refs whose coordinates are known to be wrong or legitimately outside the boxes ("known_coordinates"
    in the known-anomalies file). None when the file has no such key: C4 then falls back to the whole
    known list (legacy behaviour, reported as such in the gate detail)."""
    if not path:
        return None
    k = json.load(open(path, encoding='utf-8'))
    if not isinstance(k, dict) or 'known_coordinates' not in k:
        return None
    items = k['known_coordinates']
    return {str(a): b for a, b in items.items()} if isinstance(items, dict) else {str(i): '' for i in items}


def load_known(path):
    if not path:
        return {}
    k = json.load(open(path, encoding='utf-8'))
    items = k.get('known', k) if isinstance(k, dict) else k
    if isinstance(items, dict):
        return {str(a): b for a, b in items.items()}
    return {str(i['ref']): i.get('note', '') for i in items}


# =================================================================== driver
def run_check(csv_path, xlsx_path=None, baseline=None, known=None, asof=None, csv_only=False, strict_vocab=False,
              expectations=None, sheet=None, max_examples=10, known_coordinates=None):
    """Run every gate; returns (report_dict, verify_release_data). Raises OSError/ValueError on unusable input."""
    asof = asof or datetime.date.today()
    known = known or {}
    rep = vr.Report(max_examples)
    c = vr.check_csv(csv_path, asof, rep)
    if c is None:
        raise ValueError(f'{csv_path}: no CSV records ({rep.structural})')
    x = vr.check_xlsx(xlsx_path, sheet, rep) if xlsx_path else None
    if xlsx_path and x is None:
        raise ValueError(f'{xlsx_path}: XLSX could not be read ({rep.structural})')
    if x is not None:
        vr.compare(c, x, asof, rep)
    if expectations:
        vr.check_expectations(expectations, rep)
    G = Gates()
    source_gates(G, rep, c, x, baseline, csv_only)
    date_gates(G, c, x, asof)
    vocab_gates(G, c, baseline, strict_vocab)
    if known_coordinates is None:
        coord_anoms = coordinate_gates(G, c, known)
    else:
        # a ref on the known list for another reason (a date, a duplicate) must not waive a coordinate failure
        coord_anoms = coordinate_gates(G, c, known_coordinates, 'known_coordinates only')
        for a in coord_anoms:
            a['known'] = a['known'] or (a['anomaly'] not in ('OUTSIDE_HARD_BOUNDS',) and a['ref'] in known)
    anomaly_gate(G, c, x, rep, coord_anoms, known)
    failed = G.failed()
    report = {
        'schema': SCHEMA, 'tool': 'automation/repd/validate.py', 'asof': str(asof),
        'generated_at': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
        'inputs': {'csv': {'path': csv_path, 'bytes': rep.data.get('csv.bytes'), 'sha256': rep.data.get('csv.sha256'),
                           'encoding': rep.data.get('csv.encoding')},
                   'xlsx': None if x is None else {'path': xlsx_path, 'bytes': rep.data.get('xlsx.bytes'),
                                                   'sha256': rep.data.get('xlsx.sha256'), 'sheet': rep.data.get('xlsx.sheet_used')},
                   'csv_only': csv_only, 'baseline_release': baseline.get('release_id'),
                   'baseline_source': baseline.get('source')},
        'summary': {s: sum(1 for g in G.items if g['status'] == s) for s in ('pass', 'warn', 'fail', 'skip')},
        'result': 'FAIL' if failed else 'PASS', 'exit_code': 1 if failed else 0,
        'failed_gates': [g['id'] for g in failed], 'gates': G.items,
    }
    return report, rep.data


def _print(report):
    for g in report['gates']:
        print(f'{g["status"].upper():5} {g["id"]}: {g["summary"]}')
    print(f'RESULT {report["result"]} (exit {report["exit_code"]}) {report["summary"]}')


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    ck = sub.add_parser('check')
    ck.add_argument('--csv', required=True)
    ck.add_argument('--xlsx')
    ck.add_argument('--sheet')
    ck.add_argument('--csv-only', action='store_true', help='cleaned candidate: skip CSV-vs-XLSX gates explicitly')
    ck.add_argument('--baseline', required=True, help='previous-release baseline JSON (make-baseline output, or repd_source_reconciliation_v6.json)')
    ck.add_argument('--known-anomalies')
    ck.add_argument('--asof', help='YYYY-MM-DD (default today, UTC)')
    ck.add_argument('--json')
    ck.add_argument('--verify-json', help='also write the full verify_release data (large)')
    ck.add_argument('--strict-vocab', action='store_true', help='new status/technology values fail instead of warn')
    ck.add_argument('--expect-rows', type=int)
    ck.add_argument('--expect-unique-refs', type=int)
    ck.add_argument('--expect-csv-sha256')
    ck.add_argument('--expect-xlsx-sha256')
    ck.add_argument('--quiet', action='store_true')
    mb = sub.add_parser('make-baseline')
    g = mb.add_mutually_exclusive_group(required=True)
    g.add_argument('--from-csv')
    g.add_argument('--from-identity-v6')
    mb.add_argument('--release-id', required=True)
    mb.add_argument('--out', required=True)
    try:
        a = ap.parse_args(argv)
    except SystemExit as e:
        return 2 if e.code else 0
    try:
        if a.cmd == 'make-baseline':
            b = baseline_from_csv(a.from_csv, a.release_id) if a.from_csv else baseline_from_identity_v6(a.from_identity_v6, a.release_id)
            with open(a.out, 'w', encoding='utf-8') as f:
                json.dump(b, f, indent=1, ensure_ascii=False)
                f.write('\n')
            print(f'baseline {a.release_id}: rows={b["rows"]} unique_refs={b["unique_refs"]} -> {a.out}')
            return 0
        if not a.xlsx and not a.csv_only:
            print('ERROR: give --xlsx, or --csv-only to skip the CSV-vs-XLSX gates explicitly', file=sys.stderr)
            return 2
        baseline = load_baseline(a.baseline)
        known = load_known(a.known_anomalies)
        known_coordinates = load_known_coordinates(a.known_anomalies)
        asof = datetime.date.fromisoformat(a.asof) if a.asof else datetime.datetime.now(datetime.timezone.utc).date()
        exp = {k: v for k, v in (('rows', a.expect_rows), ('unique_refs', a.expect_unique_refs),
                                 ('csv_sha256', a.expect_csv_sha256), ('xlsx_sha256', a.expect_xlsx_sha256)) if v is not None}
        report, vdata = run_check(a.csv, a.xlsx, baseline, known, asof, a.csv_only, a.strict_vocab, exp or None, a.sheet,
                                  known_coordinates=known_coordinates)
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as e:
        print(f'ERROR: cannot run validation: {e}', file=sys.stderr)
        return 2
    if not a.quiet:
        _print(report)
    if a.json:
        with open(a.json, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=1, default=str, ensure_ascii=False)
            f.write('\n')
    if a.verify_json:
        with open(a.verify_json, 'w', encoding='utf-8') as f:
            json.dump(vdata, f, indent=1, default=str, ensure_ascii=False)
    return report['exit_code']


if __name__ == '__main__':
    sys.exit(main())
