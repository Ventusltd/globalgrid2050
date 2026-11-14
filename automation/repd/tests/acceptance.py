#!/usr/bin/env python3
"""End-to-end acceptance harness for a REPD release candidate.

Independent of how the candidate was built: it re-derives every expectation from the
official files and checks the candidate from first principles.

Inputs
  --official-csv   official DESNZ CSV (cp1252 or UTF-8)
  --official-xlsx  official DESNZ XLSX (optional; without it the XLSX-backed change
                   classes cannot be verified and fail closed)
  --cleaned        cleaned canonical CSV (one row per Ref ID)
  --root-dir       directory of root-format outputs, with file names given by
                   --full --batteries --solar-op --over4 --master (relative to
                   --root-dir or absolute)
  --baseline-master existing dist/repd_master.json (property-key superset check)

Checks (ids are stable; see CHECK_IDS)
  official.*   the official files read cleanly; duplicate refs are identical
  cleaned.*    every official ref exactly once; header; every changed cell belongs
               to a documented change class; month-first cells corrected; text
               agrees with the Excel; file hygiene
  full.* batteries.* solar_op.* over4.*   UTF-8, no mojibake, no bare CR, no
               embedded line breaks, field counts, content == filter(cleaned)
  master.*     GeoJSON parses, one feature per viable geocoded record under the
               scripts/repd_updater.py refine_dataset rules, property keys superset
  inputs.unchanged  sha256 of every input (and --pin) identical before and after

Usage
  python3 acceptance.py --official-csv X.csv --official-xlsx X.xlsx --cleaned C.csv \
      --root-dir OUT --full repd-2026q3.csv --batteries repd-grid-batteries-2026q3.csv \
      --solar-op repd-solar-operational-2026q3.csv --over4 repd-solar-operational-over-4mw-2026q3.csv \
      --master dist/repd_master_2026q3.json --baseline-master REPO/dist/repd_master.json \
      [--expect-month-first 25] [--json report.json]
  Exit 0 = all checks pass (SKIP allowed), 1 = at least one FAIL, 2 = bad arguments.

  As pytest:  REPD_ACCEPT_ARGS="<same arguments>" pytest -q automation/repd/tests/acceptance.py
  (every check becomes one test; all are skipped when REPD_ACCEPT_ARGS is unset).

Standard library only, plus openpyxl (XLSX) and pyproj (GeoJSON rules), both imported lazily.
"""
from __future__ import annotations

import argparse
import csv
import datetime as _dt
from decimal import ROUND_HALF_EVEN, ROUND_HALF_UP, Decimal
import hashlib
import io
import json
import math
import os
import re
import shlex
import sys
from dataclasses import dataclass, field
from pathlib import Path

# --------------------------------------------------------------------------------------
# Documented vocabulary
# --------------------------------------------------------------------------------------

REF = "Ref ID"
TECH = "Technology Type"
STATUS_SHORT = "Development Status (short)"
CAPACITY = "Installed Capacity (MWelec)"
MOUNTING = "Mounting Type for Solar"
SOLAR = "Solar Photovoltaics"

BATTERY_STATUSES = frozenset({
    "Operational", "Under Construction", "Awaiting Construction",
    "Application Submitted", "Appeal Lodged", "No Application Required",
})

# Header of the January root repd-solar-operational.csv, byte for byte (43 columns,
# including the official double space and trailing space).
SOLAR_OP_HEADER = [
    "Old Ref ID", "Ref ID", "Record Last Updated (dd/mm/yyyy)", "Operator (or Applicant)", "Site Name",
    "Technology Type", "Storage Co-location REPD Ref ID", "Installed Capacity (MWelec)", "CHP Enabled",
    "CfD Allocation Round", "RO Banding (ROC/MWh)", "FiT Tariff (p/kWh)", "CfD Capacity (MW)",
    "Mounting Type for Solar", "Development Status", "Development Status (short)",
    "Are they re-applying (New REPD Ref)", "Are they re-applying (Old REPD Ref) ", "Address", "County",
    "Region", "Country", "Post Code", "X-coordinate", "Y-coordinate", "Planning Authority",
    "Planning Application Reference", "Appeal Reference", "Secretary of State Reference",
    "Type of Secretary of State Intervention", "Judicial Review", "Planning Application Submitted",
    "Planning Application Withdrawn", "Planning Permission Refused", "Appeal Lodged", "Appeal Granted",
    "Planning Permission  Granted", "Secretary of State - Intervened", "Secretary of State - Granted",
    "Planning Permission Expired", "Under Construction", "Operational", "Solar Site Area (sqm)",
]

# Official 53-column header (identical in the January 2026 and October 2026 CSVs).
OFFICIAL_HEADER = [
    "Old Ref ID", "Ref ID", "Record Last Updated (dd/mm/yyyy)", "Operator (or Applicant)", "Site Name",
    "Technology Type", "Storage Type", "Storage Co-location REPD Ref ID", "Installed Capacity (MWelec)",
    "Share Community Scheme", "CHP Enabled", "CfD Allocation Round", "RO Banding (ROC/MWh)",
    "FiT Tariff (p/kWh)", "CfD Capacity (MW)", "Turbine Capacity (MW)", "No. of Turbines",
    "Height of Turbines (m)", "Mounting Type for Solar", "Development Status", "Development Status (short)",
    "Are they re-applying (New REPD Ref)", "Are they re-applying (Old REPD Ref) ", "Address", "County",
    "Region", "Country", "Post Code", "X-coordinate", "Y-coordinate", "Planning Authority",
    "Planning Application Reference", "Appeal Reference", "Secretary of State Reference",
    "Type of Secretary of State Intervention", "Judicial Review", "Offshore Wind Round",
    "Planning Application Submitted", "Planning Application Withdrawn", "Planning Permission Refused",
    "Appeal Lodged", "Appeal Withdrawn", "Appeal Refused", "Appeal Granted", "Planning Permission  Granted",
    "Secretary of State - Intervened", "Secretary of State - Refusal", "Secretary of State - Granted",
    "Planning Permission Expired", "Under Construction", "Operational", "Heat Network Ref",
    "Solar Site Area (sqm)",
]

DATE_COLUMNS = frozenset({
    "Record Last Updated (dd/mm/yyyy)", "Planning Application Submitted", "Planning Application Withdrawn",
    "Planning Permission Refused", "Appeal Lodged", "Appeal Withdrawn", "Appeal Refused", "Appeal Granted",
    "Planning Permission Granted", "Secretary of State - Intervened", "Secretary of State - Refusal",
    "Secretary of State - Granted", "Planning Permission Expired", "Under Construction", "Operational",
})  # whitespace-normalised names

TEXT_COLUMNS = ("Site Name", "Operator (or Applicant)", "Address", "County", "Region", "Country",
                "Post Code", "Planning Authority")

# Change classes. The first five are the ones documented for October 2026; the other three
# are policies of the cleaner that the harness can still verify against the XLSX.
CHANGE_CLASSES = {
    "month_first_date": "m/d/yyyy CSV date corrected to dd/mm/yyyy from the typed Excel cell",
    "na_date": "text NA in a date column blanked",
    "whitespace_control": "leading/trailing/repeated whitespace, NBSP, tab or control characters normalised",
    "embedded_line_break": "CR/LF inside a field removed",
    "number_as_date": "number stored with a date format (CSV shows dd/mm/1900) restored to the number",
    "na_text": "text NA in a non-date column blanked (cleaner policy, not in the documented list)",
    "xlsx_precision": "CSV-rounded number replaced by the full-precision Excel value (cleaner policy)",
    "excel_text": "CSV text differs from the Excel text cell (e.g. lost leading zero); Excel text used (cleaner policy)",
}
DEFAULT_ALLOWED = frozenset(CHANGE_CLASSES)

FILE_ROLES = ("full", "batteries", "solar_op", "over4")
FILE_CHECKS = ("utf8", "no_mojibake", "no_bare_cr", "no_embedded_breaks", "field_count")

CHECK_IDS = (
    ["official.read", "official.duplicates_identical", "official.xlsx_agrees"]
    + ["cleaned.refs_exactly_once", "cleaned.header", "cleaned.cells_classified",
       "cleaned.month_first_corrected", "cleaned.text_matches_excel"]
    + [f"cleaned.{c}" for c in FILE_CHECKS]
    + [f"{r}.{c}" for r in FILE_ROLES for c in FILE_CHECKS]
    + ["full.equals_cleaned", "batteries.filter", "solar_op.header", "solar_op.filter",
       "over4.header", "over4.filter"]
    + ["master.parses", "master.features", "master.keys_superset"]
    + ["inputs.unchanged"]
)

# --------------------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------------------

_WS_RE = re.compile(r"[\s\u00a0\u200b-\u200d\u2060\ufeff\x00-\x1f\x7f-\x9f]+")
_MOJI_RE = re.compile("[\u00c2\u00c3][\u0080-\u00bf\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc"
                      "\u2013\u2014\u2018-\u201e\u2020-\u2022\u2026\u2030\u2039\u203a\u20ac\u2122]"
                      "|\u00e2\u0080|\u00e2\u20ac")
_DMY_RE = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{4})$")


def norm_ws(s: str) -> str:
    return _WS_RE.sub(" ", s).strip()


def norm_header(h: str) -> str:
    return re.sub(r"\s+", " ", h.replace("\ufeff", "")).strip()


def demojibake(s: str):
    """Return the repaired string if s is UTF-8 text that was decoded as cp1252/latin-1."""
    for enc in ("cp1252", "latin-1"):
        try:
            t = s.encode(enc).decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
        if t != s:
            return t
    return None


def is_mojibake(s: str) -> bool:
    return bool(_MOJI_RE.search(s)) or demojibake(s) is not None


def to_float(s):
    if s is None:
        return None
    t = str(s).replace(",", "").strip()
    if not t:
        return None
    try:
        v = float(t)
    except ValueError:
        return None
    return v if math.isfinite(v) else None


def clean_ref(v) -> str:
    s = "" if v is None else str(v).strip()
    if re.fullmatch(r"\d+\.0", s):
        s = s[:-2]
    return s


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def decimals(s: str) -> int:
    t = s.strip()
    return len(t.split(".", 1)[1]) if "." in t else 0


def excel_serial(d: _dt.datetime) -> float:
    """Excel 1900-system serial (openpyxl maps serials below 60 from 1899-12-31: 1 -> 1900-01-01)."""
    base = _dt.datetime(1899, 12, 31) if d < _dt.datetime(1900, 3, 1) else _dt.datetime(1899, 12, 30)
    delta = d - base
    return delta.days + delta.seconds / 86400.0


def month_first_format(fmt: str) -> bool:
    """True for an explicit custom number format that writes the month before the day."""
    if not fmt or fmt.lower() in ("general", "mm-dd-yy"):  # mm-dd-yy = builtin 14, rendered in locale order
        return False
    f = re.sub(r"\[[^\]]*\]", "", fmt.split(";")[0]).lower()
    f = re.sub(r'"[^"]*"', "", f)
    toks = [c for c in f if c in "dmy"]
    if "d" not in toks or "m" not in toks:
        return False
    return toks.index("m") < toks.index("d")


# --------------------------------------------------------------------------------------
# Reading
# --------------------------------------------------------------------------------------

@dataclass
class CsvFile:
    path: Path
    raw: bytes
    encoding: str
    utf8_ok: bool
    bom: bool
    header: list
    rows: list  # list of lists, exactly as parsed (no padding)
    utf8_error: str = ""

    @property
    def nheader(self):
        return [norm_header(h) for h in self.header]

    def index(self):
        return {h: i for i, h in enumerate(self.nheader)}


def read_csv(path: Path, prefer: str = "utf-8") -> CsvFile:
    raw = Path(path).read_bytes()
    bom = raw.startswith(b"\xef\xbb\xbf")
    utf8_ok, err = True, ""
    try:
        text = raw.decode("utf-8-sig")
        enc = "utf-8"
    except UnicodeDecodeError as e:
        utf8_ok, err = False, f"byte 0x{raw[e.start]:02x} at offset {e.start}"
        try:
            text, enc = raw.decode("cp1252"), "cp1252"
        except UnicodeDecodeError:
            text, enc = raw.decode("latin-1"), "latin-1"
    rdr = csv.reader(io.StringIO(text, newline=""))
    try:
        header = next(rdr)
    except StopIteration:
        header = []
    rows = [r for r in rdr if r != []]
    return CsvFile(Path(path), raw, enc, utf8_ok, bom, header, rows, err)


@dataclass
class XlsxData:
    header: list
    cells: dict  # ref -> list of (value, number_format)
    duplicates: dict


_OOXML_ESC = re.compile(r"_x([0-9A-Fa-f]{4})_")


def _unescape_ooxml(s: str) -> str:
    """openpyxl leaves OOXML escapes such as _x000D_ (a CR) in shared strings."""
    return _OOXML_ESC.sub(lambda m: chr(int(m.group(1), 16)), s) if "_x" in s else s


def read_xlsx(path: Path, sheet: str = "REPD") -> XlsxData:
    import openpyxl  # lazy
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    if sheet not in wb.sheetnames:
        raise ValueError(f"sheet {sheet!r} not in {wb.sheetnames}")
    it = wb[sheet].iter_rows()
    header = ["" if c.value is None else str(c.value) for c in next(it)]
    nh = [norm_header(h) for h in header]
    if REF not in nh:
        raise ValueError("XLSX has no Ref ID column")
    ri = nh.index(REF)
    cells, dups = {}, {}
    for r in it:
        vals = [(_unescape_ooxml(c.value) if isinstance(c.value, str) else c.value, c.number_format) for c in r]
        if not vals or ri >= len(vals) or vals[ri][0] is None:
            continue
        ref = clean_ref(vals[ri][0])
        if ref in cells:
            dups[ref] = dups.get(ref, 1) + 1
            continue
        cells[ref] = vals
    wb.close()
    return XlsxData(header, cells, dups)


# --------------------------------------------------------------------------------------
# Results
# --------------------------------------------------------------------------------------

@dataclass
class Check:
    id: str
    status: str  # PASS / FAIL / SKIP
    summary: str
    details: dict = field(default_factory=dict)


class Report:
    def __init__(self):
        self.checks: dict[str, Check] = {}

    def add(self, cid, ok, summary, **details):
        status = "SKIP" if ok is None else ("PASS" if ok else "FAIL")
        self.checks[cid] = Check(cid, status, summary, details)

    def skip(self, cid, why):
        self.add(cid, None, why)

    @property
    def failed(self):
        return [c for c in self.checks.values() if c.status == "FAIL"]

    def to_json(self):
        return {"checks": [c.__dict__ for c in self.checks.values()],
                "failed": [c.id for c in self.failed],
                "passed": sum(c.status == "PASS" for c in self.checks.values()),
                "skipped": sum(c.status == "SKIP" for c in self.checks.values())}

    def text(self):
        out = []
        for cid in list(CHECK_IDS) + [k for k in self.checks if k not in CHECK_IDS]:
            c = self.checks.get(cid)
            if c:
                out.append(f"{c.status:4}  {c.id:34} {c.summary}")
        out.append(f"-- {len(self.failed)} FAIL, {self.to_json()['passed']} PASS, {self.to_json()['skipped']} SKIP")
        return "\n".join(out)


def _ex(lst, n=8):
    return lst[:n]


# --------------------------------------------------------------------------------------
# File hygiene (applies to cleaned and every root CSV)
# --------------------------------------------------------------------------------------

def file_hygiene(rep: Report, prefix: str, f: CsvFile, reference: dict | None, official: dict | None = None):
    """reference: ref -> {column: correct text (Excel string, else official CSV)} used to name mojibake;
    official: ref -> {column: official CSV value}; mojibake already present in the official cell is
    reported as upstream and does not fail (repairing it would be an undocumented change)."""
    rep.add(f"{prefix}.utf8", f.utf8_ok,
            "valid UTF-8" + (" (with BOM)" if f.bom else "") if f.utf8_ok
            else f"not UTF-8 ({f.utf8_error}); decoded as {f.encoding} for the other checks",
            encoding=f.encoding, bom=f.bom)

    ix = f.index()
    ri = ix.get(REF)
    moj, fffd, named, upstream = [], [], [], []
    for n, r in enumerate(f.rows, start=2):
        rid = r[ri] if ri is not None and ri < len(r) else f"line {n}"
        for j, v in enumerate(r):
            if not v or v.isascii():
                continue
            col = f.nheader[j] if j < len(f.nheader) else f"#{j}"
            src = ((official or {}).get(rid) or {}).get(col)
            if src is not None and norm_ws(src) == norm_ws(v):
                if "\ufffd" in v or is_mojibake(v):
                    upstream.append((rid, col, v[:60]))
                continue
            if "\ufffd" in v:
                fffd.append((rid, col, v[:60]))
            elif is_mojibake(v):
                moj.append((rid, col, v[:60], (demojibake(v) or "")[:60]))
    if reference and ri is not None:
        for r in f.rows:
            if ri >= len(r) or r[ri] not in reference:
                continue
            exp = reference[r[ri]]
            for col in TEXT_COLUMNS:
                j = ix.get(col)
                if j is None or j >= len(r) or col not in exp:
                    continue
                got, want = norm_ws(r[j]), norm_ws(exp[col])
                if got != want and not got.isascii() and (
                        "\ufffd" in got or norm_ws(demojibake(r[j]) or "") == want):
                    named.append((r[ri], col, want[:50], got[:50]))
    bad = len(moj) + len(fffd) + len(named)
    rep.add(f"{prefix}.no_mojibake", bad == 0,
            ("no mojibake or U+FFFD introduced" + (f" ({len(upstream)} cells keep mojibake already present in the "
                                                   "official file)" if upstream else "")) if bad == 0 else
            f"{len(moj)} mojibake cells, {len(fffd)} U+FFFD cells, {len(named)} names differ from the Excel/official text",
            mojibake=_ex(moj), replacement=_ex(fffd), named=_ex(named), upstream=_ex(upstream, 20),
            counts={"mojibake": len(moj), "replacement": len(fffd), "named": len(named), "upstream": len(upstream)})

    bare = [m.start() for m in re.finditer(rb"\r(?!\n)", f.raw)]
    rep.add(f"{prefix}.no_bare_cr", not bare,
            "no bare CR" if not bare else f"{len(bare)} bare CR bytes (first at offsets {bare[:5]})",
            count=len(bare))

    br = [(r[ri] if ri is not None and ri < len(r) else n, f.nheader[j] if j < len(f.nheader) else j, v[:60]) for n, r in enumerate(f.rows, start=2)
          for j, v in enumerate(r) if "\r" in v or "\n" in v]
    rep.add(f"{prefix}.no_embedded_breaks", not br,
            "no line breaks inside fields" if not br else f"{len(br)} fields contain CR/LF",
            count=len(br), examples=_ex(br))

    w = len(f.header)
    wrong = [(n, len(r), (r[ri] if ri is not None and ri < len(r) else None)) for n, r in enumerate(f.rows, start=2)
             if len(r) != w]
    rep.add(f"{prefix}.field_count", not wrong,
            f"all {len(f.rows)} records have {w} fields" if not wrong else
            f"{len(wrong)} of {len(f.rows)} records do not have the header's {w} fields",
            count=len(wrong), examples=_ex(wrong, 10), records=len(f.rows), header_fields=w)


# --------------------------------------------------------------------------------------
# Cell classification (official CSV -> cleaned)
# --------------------------------------------------------------------------------------

def classify_cell(col: str, off: str, new: str, xcell) -> str | None:
    """Return the change class of off -> new, or None if no documented class explains it."""
    o = norm_ws(off)
    if o == norm_ws(new):  # only whitespace / control characters differ (full or partial normalisation)
        return "embedded_line_break" if ("\r" in off or "\n" in off) else "whitespace_control"
    if o.upper() == "NA" and new == "":
        return "na_date" if col in DATE_COLUMNS else "na_text"
    xv, xf = (xcell if xcell is not None else (None, None))
    m = _DMY_RE.match(o)
    if m and isinstance(xv, _dt.datetime):
        # month-first: CSV m/d/yyyy, Excel cell has an explicit month-first format
        if month_first_format(xf or "") and new == xv.strftime("%d/%m/%Y") \
                and (int(m.group(1)), int(m.group(2))) == (xv.month, xv.day):
            return "month_first_date"
        # number stored as a date
        if col not in DATE_COLUMNS and xv.year < 1901:
            nv = to_float(new)
            if nv is not None and abs(nv - excel_serial(xv)) < 1e-9:
                return "number_as_date"
    if m and xcell is None and col not in DATE_COLUMNS and m.group(3) == "1900":
        # no XLSX: accept the serial the CSV date implies (fractional part unknown)
        nv = to_float(new)
        serial = excel_serial(_dt.datetime(1900, int(m.group(2)), int(m.group(1))))
        if nv is not None and serial <= nv < serial + 1:
            return "number_as_date"
    if isinstance(xv, (int, float)) and not isinstance(xv, bool):
        nv, ov = to_float(new), to_float(o)
        if nv is not None and ov is not None and abs(nv - xv) <= 1e-9 * max(1.0, abs(xv)) \
                and any(abs(float(Decimal(repr(xv)).quantize(Decimal(1).scaleb(-decimals(o)), rounding=mode)) - ov)
                        <= 1e-9 * max(1.0, abs(ov)) for mode in (ROUND_HALF_UP, ROUND_HALF_EVEN)):
            return "xlsx_precision"
    if isinstance(xv, str) and norm_ws(xv) == new and new != "":
        return "excel_text"
    return None


def check_cleaned(rep, off: CsvFile, cleaned: CsvFile, xl: XlsxData | None, allowed, expect_month_first,
                  waived=frozenset()):
    """waived: {(ref, normalised column)} the owner has explicitly accepted; reported, never silently."""
    waived_hits = []
    oix, cix = off.index(), cleaned.index()
    # header
    hdr_ok = off.nheader == cleaned.nheader
    exact = [(a, b) for a, b in zip(off.header, cleaned.header) if a != b]
    rep.add("cleaned.header", hdr_ok,
            f"{len(cleaned.header)} columns, same names as official" + (
                f" after whitespace normalisation ({len(exact)} differ exactly)" if exact else "")
            if hdr_ok else "cleaned header differs from the official header",
            exact_differences=exact,
            missing=[h for h in off.nheader if h not in cix], extra=[h for h in cleaned.nheader if h not in oix])

    if REF not in oix or REF not in cix:
        rep.add("cleaned.refs_exactly_once", False, "Ref ID column missing")
        return
    ori, cri = oix[REF], cix[REF]
    oref = {}
    for r in off.rows:
        oref.setdefault(r[ori].strip(), []).append(r)
    cref = {}
    for r in cleaned.rows:
        cref.setdefault(r[cri].strip() if cri < len(r) else "", []).append(r)
    missing = sorted(set(oref) - set(cref), key=lambda x: (len(x), x))
    extra = sorted(set(cref) - set(oref), key=lambda x: (len(x), x))
    multi = {k: len(v) for k, v in cref.items() if len(v) > 1}
    ok = not missing and not extra and not multi
    rep.add("cleaned.refs_exactly_once", ok,
            f"{len(oref)} official refs, each exactly once in {len(cleaned.rows)} cleaned rows" if ok else
            f"{len(missing)} official refs missing, {len(extra)} extra refs, {len(multi)} refs repeated",
            missing=_ex(missing, 20), extra=_ex(extra, 20), repeated=dict(list(multi.items())[:20]),
            official_rows=len(off.rows), official_refs=len(oref), cleaned_rows=len(cleaned.rows))

    # cell classification
    common = [h for h in off.nheader if h in cix]
    xix = {norm_header(h): i for i, h in enumerate(xl.header)} if xl else {}
    counts = {k: 0 for k in CHANGE_CLASSES}
    examples = {k: [] for k in CHANGE_CLASSES}
    unclassified, disallowed = [], []
    for ref, rows in oref.items():
        if ref not in cref or len(cref[ref]) != 1:
            continue
        o, c = rows[0], cref[ref][0]
        xrow = xl.cells.get(ref) if xl else None
        for h in common:
            oj, cj = oix[h], cix[h]
            ov = o[oj] if oj < len(o) else ""
            cv = c[cj] if cj < len(c) else ""
            if ov == cv:
                continue
            xcell = None
            if xrow is not None and h in xix and xix[h] < len(xrow):
                xcell = xrow[xix[h]]
            k = classify_cell(h, ov, cv, xcell)
            if k is None:
                if (ref, h) in waived:
                    waived_hits.append((ref, h, ov[:60], cv[:60]))
                else:
                    unclassified.append((ref, h, ov[:60], cv[:60]))
            else:
                counts[k] += 1
                if len(examples[k]) < 3:
                    examples[k].append((ref, h, ov[:40], cv[:40]))
                if k not in allowed:
                    disallowed.append((ref, h, k))
    ok = not unclassified and not disallowed
    used = {k: v for k, v in counts.items() if v}
    rep.add("cleaned.cells_classified", ok,
            f"{sum(used.values())} changed cells, all classified: {used}" if ok else
            f"{len(unclassified)} changed cells match no documented class; {len(disallowed)} in a disallowed class",
            counts=used, examples={k: v for k, v in examples.items() if v},
            unclassified=_ex(unclassified, 25), unclassified_count=len(unclassified),
            disallowed=_ex(disallowed, 25), xlsx_used=xl is not None,
            beyond_documented={k: used[k] for k in ("na_text", "xlsx_precision", "excel_text") if k in used})

    # month-first cells must all be corrected (needs XLSX)
    if xl is None:
        rep.skip("cleaned.month_first_corrected", "no XLSX given")
    else:
        targets, wrong = [], []
        for ref, xrow in xl.cells.items():
            for h, j in xix.items():
                if j < len(xrow) and isinstance(xrow[j][0], _dt.datetime) and month_first_format(xrow[j][1] or ""):
                    targets.append((ref, h))
                    want = xrow[j][0].strftime("%d/%m/%Y")
                    got = cref.get(ref, [[]])[0]
                    gv = got[cix[h]] if h in cix and cix[h] < len(got) else None
                    if gv != want:
                        wrong.append((ref, h, want, gv))
        ok = not wrong and (expect_month_first is None or len(targets) == expect_month_first)
        rep.add("cleaned.month_first_corrected", ok,
                f"{len(targets)} Excel month-first date cells, all written dd/mm/yyyy in the cleaned file"
                if ok else f"{len(wrong)} of {len(targets)} month-first cells not corrected"
                + (f"; expected {expect_month_first} such cells" if expect_month_first is not None
                   and len(targets) != expect_month_first else ""),
                cells=len(targets), wrong=_ex(wrong, 25))

    # cleaned text vs Excel strings
    if xl is None:
        rep.skip("cleaned.text_matches_excel", "no XLSX given")
    else:
        bad = []
        n = 0
        for ref, rows in cref.items():
            xrow = xl.cells.get(ref)
            if xrow is None:
                continue
            for col in TEXT_COLUMNS:
                if col not in xix or col not in cix:
                    continue
                xv = xrow[xix[col]][0] if xix[col] < len(xrow) else None
                if not isinstance(xv, str):
                    continue
                n += 1
                cv = rows[0][cix[col]]
                if norm_ws(cv) != norm_ws(xv):
                    if (ref, col) in waived:
                        waived_hits.append((ref, col, norm_ws(xv)[:50], cv[:50]))
                    else:
                        bad.append((ref, col, norm_ws(xv)[:50], cv[:50]))
        rep.add("cleaned.text_matches_excel", not bad,
                f"{n} text cells ({', '.join(TEXT_COLUMNS[:3])}...) equal the Excel strings" if not bad else
                f"{len(bad)} of {n} text cells differ from the Excel strings", examples=_ex(bad, 15))
    if waived_hits:
        rep.checks["cleaned.cells_classified"].details["waived"] = waived_hits
        rep.checks["cleaned.cells_classified"].summary += f" [{len(waived_hits)} cell(s) waived by --waive-cell]"


# --------------------------------------------------------------------------------------
# Root outputs
# --------------------------------------------------------------------------------------

def capacity(v):
    return to_float(v)  # blank / non-numeric = unknown, never zero


def expected_subsets(cleaned: CsvFile):
    ix = cleaned.index()
    need = [REF, TECH, STATUS_SHORT, CAPACITY, MOUNTING]
    missing = [n for n in need if n not in ix]
    if missing:
        raise ValueError(f"cleaned file lacks {missing}")
    T, S, C, M = ix[TECH], ix[STATUS_SHORT], ix[CAPACITY], ix[MOUNTING]
    g = lambda r, j: r[j].strip() if j < len(r) else ""  # noqa: E731
    bat = [r for r in cleaned.rows if g(r, T) == "Battery" and g(r, S) in BATTERY_STATUSES]
    sol = [r for r in cleaned.rows if g(r, T) == SOLAR and g(r, S) == "Operational"]
    so = [r for r in sol if (capacity(g(r, C)) or 0) > 1 and g(r, M) in ("Ground", "Roof")]
    o4 = [r for r in sol if (capacity(g(r, C)) or 0) > 4]
    return {"batteries": bat, "solar_op": so, "over4": o4}


def compare_rows(rep, cid, out: CsvFile, exp_rows, cleaned: CsvFile, label):
    """out must contain exactly the expected rows, each cell equal to the cleaned cell of the same column."""
    cix = cleaned.index()
    oix = out.index()
    if REF not in oix:
        rep.add(cid, False, "output has no Ref ID column")
        return
    cri, ori = cix[REF], oix[REF]
    exp = {r[cri]: r for r in exp_rows}
    got = {}
    dup = []
    for r in out.rows:
        k = r[ori] if ori < len(r) else ""
        if k in got:
            dup.append(k)
        got[k] = r
    missing = [k for k in exp if k not in got]
    extra = [k for k in got if k not in exp]
    unknown_cols = [h for h in out.nheader if h not in cix]
    diffs, reformatted, moj = [], 0, 0
    for k, r in got.items():
        if k not in exp:
            continue
        e = exp[k]
        for j, h in enumerate(out.nheader):
            if h not in cix:
                continue
            want = e[cix[h]] if cix[h] < len(e) else ""
            have = r[j] if j < len(r) else "<missing field>"
            if have != want:
                fw, fh = to_float(want), to_float(have)
                if fw is not None and fh is not None and abs(fw - fh) < 1e-9:
                    reformatted += 1
                elif demojibake(have) == want:
                    moj += 1
                diffs.append((k, h, want[:40], have[:40]))
    order_ok = [r[ori] for r in out.rows if ori < len(r) and r[ori] in exp] == [k for k in exp if k in got]
    ok = not missing and not extra and not dup and not diffs and not unknown_cols
    rep.add(cid, ok,
            f"{len(got)} rows = {label} applied to the cleaned file; every cell equal" if ok else
            f"expected {len(exp)} rows, got {len(out.rows)}: {len(missing)} missing, {len(extra)} extra, "
            f"{len(dup)} duplicated; {len(diffs)} cells differ ({reformatted} numeric re-formatting, {moj} mojibake)",
            expected=len(exp), rows=len(out.rows), missing=_ex(missing, 20), extra=_ex(extra, 20),
            duplicated=_ex(dup), cell_differences=len(diffs), examples=_ex(diffs, 12),
            numeric_reformatted=reformatted, mojibake_cells=moj, unknown_columns=unknown_cols,
            same_order_as_cleaned=order_ok)


def check_header_53(rep, cid, out: CsvFile, cleaned: CsvFile):
    ok = out.nheader == cleaned.nheader and len(out.header) == 53
    exact = [(a, b) for a, b in zip(cleaned.header, out.header) if a != b]
    rep.add(cid, ok,
            f"{len(out.header)} columns, same as the cleaned file" + (f" ({len(exact)} differ only in whitespace)"
                                                                       if exact else "")
            if ok else f"{len(out.header)} columns; header differs from the cleaned 53-column header",
            exact_differences=exact, columns=len(out.header))


# --------------------------------------------------------------------------------------
# GeoJSON rules (re-implementation of scripts/repd_updater.py REPDUpdater.refine_dataset)
# --------------------------------------------------------------------------------------

VIABLE_STATUSES = frozenset({
    "operational", "under construction", "awaiting construction", "consented",
    "planning permission granted", "planning approved", "application submitted", "pre-construction",
})
UK_LON = (-9.0, 2.5)
UK_LAT = (49.0, 61.0)
_PANDAS_NA = {"", "#N/A", "#N/A N/A", "#NA", "-1.#IND", "-1.#QNAN", "-NaN", "-nan", "1.#IND", "1.#QNAN",
              "<NA>", "N/A", "NA", "NULL", "NaN", "None", "n/a", "nan", "null"}


def expected_master(cleaned: CsvFile):
    """ref -> (lon, lat) for every viable geocoded record; raises on a duplicate viable ref."""
    from pyproj import Transformer  # lazy
    tr = Transformer.from_crs("epsg:27700", "epsg:4326", always_xy=True)
    ix = cleaned.index()
    R, S, X, Y = ix[REF], ix[STATUS_SHORT], ix["X-coordinate"], ix["Y-coordinate"]
    out, dup = {}, []
    for r in cleaned.rows:
        if len(r) != len(cleaned.header):
            continue  # pandas on_bad_lines="skip"
        st = r[S]
        st = "nan" if st in _PANDAS_NA else st.strip().lower()
        if st not in VIABLE_STATUSES:
            continue
        ref = "" if r[R] in _PANDAS_NA else clean_ref(r[R])
        if not ref:
            raise ValueError("viable row without Ref ID")
        if ref in out or ref in dup:
            dup.append(ref)
            continue
        try:
            e = float(r[X]) if r[X] not in _PANDAS_NA else float("nan")
            n = float(r[Y]) if r[Y] not in _PANDAS_NA else float("nan")
        except ValueError:
            continue
        if not e or not n:
            continue
        lon, lat = tr.transform(e, n)
        if not (math.isfinite(lon) and math.isfinite(lat)):
            continue
        if not (UK_LON[0] < lon < UK_LON[1] and UK_LAT[0] < lat < UK_LAT[1]):
            continue
        out[ref] = (round(lon, 6), round(lat, 6))
    return out, dup


def check_master(rep, path: Path | None, cleaned: CsvFile | None, baseline: Path | None):
    if path is None:
        for c in ("master.parses", "master.features", "master.keys_superset"):
            rep.skip(c, "no --master given")
        return
    try:
        gj = json.loads(path.read_bytes().decode("utf-8"))
        feats = gj["features"]
        assert gj.get("type") == "FeatureCollection" and isinstance(feats, list)
        bad_geom = [i for i, f in enumerate(feats)
                    if f.get("type") != "Feature" or (f.get("geometry") or {}).get("type") != "Point"
                    or len((f.get("geometry") or {}).get("coordinates") or []) != 2]
    except Exception as e:  # noqa: BLE001
        rep.add("master.parses", False, f"does not parse as a GeoJSON FeatureCollection: {e}")
        rep.skip("master.features", "master did not parse")
        rep.skip("master.keys_superset", "master did not parse")
        return
    rep.add("master.parses", not bad_geom,
            f"FeatureCollection with {len(feats)} Point features" if not bad_geom else
            f"{len(bad_geom)} features are not Point features", bad=_ex(bad_geom))

    if cleaned is None:
        rep.skip("master.features", "no cleaned file")
    else:
        try:
            exp, dup = expected_master(cleaned)
        except Exception as e:  # noqa: BLE001
            rep.add("master.features", False, f"could not apply the refine_dataset rules: {e}")
            exp, dup = None, []
        if exp is not None:
            has_ref = all("repd_ref" in (f.get("properties") or {}) for f in feats) and feats
            if has_ref:
                got = {}
                gdup = []
                for f in feats:
                    k = clean_ref(f["properties"]["repd_ref"])
                    if k in got:
                        gdup.append(k)
                    got[k] = tuple(f["geometry"]["coordinates"])
                missing = [k for k in exp if k not in got]
                extra = [k for k in got if k not in exp]
                moved = [(k, exp[k], got[k]) for k in exp if k in got
                         and (abs(exp[k][0] - got[k][0]) > 2e-6 or abs(exp[k][1] - got[k][1]) > 2e-6)]
                ok = not (missing or extra or gdup or moved or dup)
                rep.add("master.features", ok,
                        f"{len(feats)} features = {len(exp)} viable geocoded records, refs and coordinates match"
                        if ok else f"{len(feats)} features vs {len(exp)} viable geocoded records: {len(missing)} missing, "
                        f"{len(extra)} extra, {len(gdup)} duplicated, {len(moved)} at other coordinates"
                        + (f"; duplicate viable refs in cleaned file {dup[:5]}" if dup else ""),
                        expected=len(exp), features=len(feats), missing=_ex(missing, 20), extra=_ex(extra, 20),
                        moved=_ex(moved), matched_by="repd_ref")
            else:
                from collections import Counter
                ce = Counter(exp.values())
                cg = Counter(tuple(round(c, 6) for c in f["geometry"]["coordinates"]) for f in feats)
                missing = sum((ce - cg).values())
                extra = sum((cg - ce).values())
                ok = not missing and not extra and not dup
                rep.add("master.features", ok,
                        f"{len(feats)} features = {len(exp)} viable geocoded records (matched by coordinates; "
                        "no repd_ref property)" if ok else
                        f"{len(feats)} features vs {len(exp)} viable geocoded records (no repd_ref property; by "
                        f"coordinates {missing} expected points missing, {extra} unexpected points)",
                        expected=len(exp), features=len(feats), matched_by="coordinates")

    if baseline is None:
        rep.skip("master.keys_superset", "no --baseline-master given")
    else:
        try:
            base = json.loads(baseline.read_bytes().decode("utf-8"))
            bkeys = set()
            for f in base.get("features", []):
                bkeys |= set((f.get("properties") or {}).keys())
        except Exception as e:  # noqa: BLE001
            rep.add("master.keys_superset", False, f"baseline master unreadable: {e}")
            return
        lacking = {}
        for f in feats:
            miss = bkeys - set((f.get("properties") or {}).keys())
            for k in miss:
                lacking[k] = lacking.get(k, 0) + 1
        newkeys = set()
        for f in feats:
            newkeys |= set((f.get("properties") or {}).keys())
        rep.add("master.keys_superset", not lacking,
                f"every feature carries all {len(bkeys)} baseline property keys (+{len(newkeys - bkeys)} new)"
                if not lacking else f"features lack baseline keys: {lacking}",
                baseline_keys=sorted(bkeys), new_keys=sorted(newkeys - bkeys), lacking=lacking)


# --------------------------------------------------------------------------------------
# Orchestration
# --------------------------------------------------------------------------------------

@dataclass
class Config:
    official_csv: Path
    cleaned: Path
    root_dir: Path | None = None
    official_xlsx: Path | None = None
    xlsx_sheet: str = "REPD"
    full: str | None = "repd.csv"
    batteries: str | None = "repd-grid-batteries.csv"
    solar_op: str | None = "repd-solar-operational.csv"
    over4: str | None = "repd-solar-operational-over-4mw.csv"
    master: str | None = "dist/repd_master.json"
    baseline_master: Path | None = None
    expect_month_first: int | None = None
    allowed: frozenset = DEFAULT_ALLOWED
    waived: frozenset = frozenset()
    pins: dict = field(default_factory=dict)


def _resolve(root, name):
    if not name:
        return None
    p = Path(name)
    if not p.is_absolute() and root is not None:
        p = Path(root) / p
    return p


def run(cfg: Config) -> Report:
    rep = Report()
    paths = {"official_csv": cfg.official_csv, "cleaned": cfg.cleaned, "official_xlsx": cfg.official_xlsx,
             "baseline_master": cfg.baseline_master}
    for role in FILE_ROLES + ("master",):
        paths[role] = _resolve(cfg.root_dir, getattr(cfg, role)) if cfg.root_dir else None
    present = {k: Path(v) for k, v in paths.items() if v is not None and Path(v).exists()}
    absent = [f"{k}={v}" for k, v in paths.items() if v is not None and not Path(v).exists()]
    before = {str(p): sha256_file(p) for p in present.values()}
    for p in cfg.pins:
        if Path(p).exists():
            before.setdefault(str(p), sha256_file(Path(p)))

    # official
    try:
        off = read_csv(cfg.official_csv)
        cleaned = read_csv(cfg.cleaned)
    except OSError as e:
        rep.add("official.read", False, f"cannot read inputs: {e}")
        return rep
    xl = None
    if cfg.official_xlsx:
        try:
            xl = read_xlsx(cfg.official_xlsx, cfg.xlsx_sheet)
        except Exception as e:  # noqa: BLE001
            rep.add("official.read", False, f"XLSX unreadable: {e}")
            return rep
    oix = off.index()
    widths = {len(r) for r in off.rows}
    ok = REF in oix and widths <= {len(off.header)}
    rep.add("official.read", ok and not absent,
            f"official CSV {off.encoding}, {len(off.rows)} rows x {len(off.header)} columns"
            + (f"; XLSX {len(xl.cells)} refs" if xl else "; no XLSX")
            + (f"; MISSING inputs {absent}" if absent else ""),
            rows=len(off.rows), columns=len(off.header), encoding=off.encoding, absent=absent)
    if REF not in oix:
        return rep

    ri = oix[REF]
    groups = {}
    for r in off.rows:
        groups.setdefault(r[ri].strip(), []).append(r)
    dups = {k: v for k, v in groups.items() if len(v) > 1}
    noniden = [k for k, v in dups.items() if any(x != v[0] for x in v)]
    rep.add("official.duplicates_identical", not noniden,
            (f"{len(dups)} duplicated refs, all identical: {sorted(dups)[:10]}" if dups else "no duplicated refs")
            if not noniden else f"conflicting duplicate refs {noniden[:10]}: cannot choose a row",
            duplicates={k: len(v) for k, v in dups.items()}, conflicting=noniden)

    if xl is None:
        rep.skip("official.xlsx_agrees", "no XLSX given")
    else:
        xh_ok = [norm_header(h) for h in xl.header] == off.nheader
        miss = sorted(set(groups) - set(xl.cells))
        extra = sorted(set(xl.cells) - set(groups))
        ok = xh_ok and not miss and not extra
        rep.add("official.xlsx_agrees", ok,
                f"XLSX has the same {len(xl.header)} columns and {len(xl.cells)} refs as the CSV" if ok else
                f"XLSX/CSV disagree: header equal={xh_ok}, {len(miss)} refs only in CSV, {len(extra)} only in XLSX",
                only_csv=_ex(miss, 20), only_xlsx=_ex(extra, 20), xlsx_duplicates=xl.duplicates)

    # reference text for naming mojibake: Excel strings where available, else official CSV text
    reference = {}
    for k, v in groups.items():
        r = v[0]
        reference[k] = {c: r[oix[c]] for c in TEXT_COLUMNS if c in oix and oix[c] < len(r)}
    if xl is not None:
        xix = {norm_header(h): i for i, h in enumerate(xl.header)}
        for k, xrow in xl.cells.items():
            for c in TEXT_COLUMNS:
                if c in xix and xix[c] < len(xrow) and isinstance(xrow[xix[c]][0], str):
                    reference.setdefault(k, {})[c] = xrow[xix[c]][0]

    official_cells = {k: {h: (v[0][j] if j < len(v[0]) else "") for j, h in enumerate(off.nheader)}
                      for k, v in groups.items()}
    check_cleaned(rep, off, cleaned, xl, cfg.allowed, cfg.expect_month_first, cfg.waived)
    file_hygiene(rep, "cleaned", cleaned, reference, official_cells)

    # root outputs
    files = {}
    for role in FILE_ROLES:
        p = paths.get(role)
        if p is None or not p.exists():
            for c in FILE_CHECKS:
                rep.skip(f"{role}.{c}", f"{role} file not given or absent ({p})")
            continue
        files[role] = read_csv(p)
        file_hygiene(rep, role, files[role], reference, official_cells)

    if "full" in files:
        compare_rows(rep, "full.equals_cleaned", files["full"], cleaned.rows, cleaned, "identity")
        if files["full"].nheader != cleaned.nheader:
            c = rep.checks["full.equals_cleaned"]
            c.status = "FAIL"
            c.summary += "; header differs from the cleaned header"
    else:
        rep.skip("full.equals_cleaned", "no full file")

    try:
        exp = expected_subsets(cleaned)
    except ValueError as e:
        exp = None
        for c in ("batteries.filter", "solar_op.filter", "over4.filter"):
            rep.add(c, False, str(e))
    if exp is not None:
        labels = {"batteries": "Battery + active short status filter",
                  "solar_op": "Solar PV + Operational + >1 MW + Ground/Roof filter",
                  "over4": "Solar PV + Operational + >4 MW filter"}
        for role in ("batteries", "solar_op", "over4"):
            if role in files:
                compare_rows(rep, f"{role}.filter", files[role], exp[role], cleaned, labels[role])
            else:
                rep.skip(f"{role}.filter", f"no {role} file")
    if "batteries" in files:
        pass  # batteries header is covered by .filter (unknown columns) and field_count
    if "solar_op" in files:
        h = files["solar_op"].header
        rep.add("solar_op.header", h == SOLAR_OP_HEADER,
                "43-column header identical to the January repd-solar-operational.csv" if h == SOLAR_OP_HEADER else
                f"header ({len(h)} columns) differs from the January 43-column header",
                columns=len(h), missing=[x for x in SOLAR_OP_HEADER if x not in h],
                extra=[x for x in h if x not in SOLAR_OP_HEADER])
    else:
        rep.skip("solar_op.header", "no solar_op file")
    if "over4" in files:
        check_header_53(rep, "over4.header", files["over4"], cleaned)
    else:
        rep.skip("over4.header", "no over4 file")

    mp = paths.get("master")
    check_master(rep, mp if mp is not None and mp.exists() else None, cleaned,
                 Path(cfg.baseline_master) if cfg.baseline_master else None)
    if mp is not None and not mp.exists():
        rep.add("master.parses", False, f"master GeoJSON not found: {mp}")

    after = {p: sha256_file(Path(p)) for p in before if Path(p).exists()}
    changed = [p for p in before if after.get(p) != before[p]]
    pin_bad = [(p, h, after.get(p) or (sha256_file(Path(p)) if Path(p).exists() else None))
               for p, h in cfg.pins.items()
               if (after.get(p) or (sha256_file(Path(p)) if Path(p).exists() else None)) != h]
    rep.add("inputs.unchanged", not changed and not pin_bad,
            f"{len(before)} files hashed before and after, none changed"
            + (f"; {len(cfg.pins)} pinned hashes match" if cfg.pins else "")
            if not changed and not pin_bad else f"{len(changed)} inputs changed during the run; {len(pin_bad)} pins differ",
            changed=changed, pins_differ=pin_bad, hashes=before)
    return rep


# --------------------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------------------

def build_parser():
    ap = argparse.ArgumentParser(description="REPD release-candidate acceptance harness")
    ap.add_argument("--official-csv", required=True, type=Path)
    ap.add_argument("--official-xlsx", type=Path)
    ap.add_argument("--xlsx-sheet", default="REPD")
    ap.add_argument("--cleaned", required=True, type=Path)
    ap.add_argument("--root-dir", type=Path)
    ap.add_argument("--full", default="repd.csv")
    ap.add_argument("--batteries", default="repd-grid-batteries.csv")
    ap.add_argument("--solar-op", dest="solar_op", default="repd-solar-operational.csv")
    ap.add_argument("--over4", default="repd-solar-operational-over-4mw.csv")
    ap.add_argument("--master", default="dist/repd_master.json")
    ap.add_argument("--baseline-master", type=Path)
    ap.add_argument("--expect-month-first", type=int)
    ap.add_argument("--disallow-class", action="append", default=[], choices=sorted(CHANGE_CLASSES),
                    help="treat this change class as a failure (repeatable)")
    ap.add_argument("--waive-cell", action="append", default=[], metavar="REF:COLUMN",
                    help="accept a reviewed cell difference (cells_classified / text_matches_excel); repeatable")
    ap.add_argument("--pin", action="append", default=[], metavar="PATH=SHA256",
                    help="file that must have this sha256 before and after (repeatable)")
    ap.add_argument("--json", type=Path, help="write the full report as JSON here")
    ap.add_argument("--verbose", "-v", action="store_true", help="print details of failing checks")
    return ap


def config_from_args(a) -> Config:
    pins = {}
    for p in a.pin:
        path, _, h = p.rpartition("=")
        if not path or len(h) != 64:
            raise SystemExit(f"bad --pin {p!r}; want PATH=SHA256")
        pins[path] = h.lower()
    return Config(official_csv=a.official_csv, cleaned=a.cleaned, root_dir=a.root_dir,
                  official_xlsx=a.official_xlsx, xlsx_sheet=a.xlsx_sheet, full=a.full, batteries=a.batteries,
                  solar_op=a.solar_op, over4=a.over4, master=a.master, baseline_master=a.baseline_master,
                  expect_month_first=a.expect_month_first,
                  allowed=frozenset(DEFAULT_ALLOWED - set(a.disallow_class)), pins=pins,
                  waived=frozenset((w.split(":", 1)[0], norm_header(w.split(":", 1)[1])) for w in a.waive_cell
                                   if ":" in w))


def main(argv=None) -> int:
    a = build_parser().parse_args(argv)
    for p in (a.official_csv, a.cleaned):
        if not p.exists():
            print(f"input not found: {p}", file=sys.stderr)
            return 2
    rep = run(config_from_args(a))
    print(rep.text())
    if a.verbose:
        for c in rep.failed:
            print(f"\n## {c.id}\n" + json.dumps(c.details, indent=1, default=str, ensure_ascii=False)[:4000])
    if a.json:
        a.json.parent.mkdir(parents=True, exist_ok=True)
        a.json.write_text(json.dumps(rep.to_json(), indent=1, default=str, ensure_ascii=False) + "\n",
                          encoding="utf-8")
    return 1 if rep.failed else 0


# --------------------------------------------------------------------------------------
# pytest entry: REPD_ACCEPT_ARGS="--official-csv ... --cleaned ..." pytest acceptance.py
# --------------------------------------------------------------------------------------

_REPORT_CACHE = {}


def _report_from_env():
    args = os.environ.get("REPD_ACCEPT_ARGS")
    if not args:
        return None
    if args not in _REPORT_CACHE:
        _REPORT_CACHE[args] = run(config_from_args(build_parser().parse_args(shlex.split(args))))
    return _REPORT_CACHE[args]


try:
    import pytest  # noqa: F401

    @pytest.mark.parametrize("check_id", CHECK_IDS)
    def test_acceptance(check_id):
        rep = _report_from_env()
        if rep is None:
            pytest.skip("REPD_ACCEPT_ARGS not set")
        c = rep.checks.get(check_id)
        if c is None or c.status == "SKIP":
            pytest.skip(c.summary if c else "not run")
        assert c.status == "PASS", f"{c.summary}\n{json.dumps(c.details, default=str, ensure_ascii=False)[:3000]}"
except ImportError:  # pragma: no cover
    pass


if __name__ == "__main__":
    sys.exit(main())
