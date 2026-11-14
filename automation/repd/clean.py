#!/usr/bin/env python3
"""REPD cleaning step: official CSV + XLSX -> canonical cleaned CSV + complete cleaning log.

Policy (every change is counted and listed cell by cell in the log; nothing else changes):

* Rows: identical duplicate records (all fields byte-equal in the CSV, and the same record
  repeated the same number of times in the workbook) are kept once.  A conflicting
  duplicate Ref ID, a blank Ref ID, or a different Ref ID set between CSV and workbook
  rejects the release.
* Columns: the official CSV column order and header text are kept.  ``--normalise-headers``
  collapses whitespace runs in header names (logged).
* Date columns (the 16 official date columns are required by default, plus any column the
  workbook typing proves to be a date column): the general date rule in ``date_rule.py``.
  The typed Excel date wins; CSV month-first text is accepted only where that cell's own
  Excel number format is explicitly month-first; no ref allow-list.  Output is strict
  dd/mm/yyyy.  Blank-equivalent text (whitespace, NA, N/A) becomes blank and is counted.
  Any unexplained cell rejects the release.
* Numbers stored as dates (a non-date column whose workbook cell is a number before
  1 March 1900 carrying a date format, e.g. "Offshore Wind Round" 1, 2, 2.5, 3 printed in
  the CSV as 01/01/1900 ...): restored to the workbook number, after checking the CSV text
  is exactly that serial rendered as a date.
* Other text: an edge run of whitespace at the start or end of a cell that contains a tab,
  CR or LF is removed (edge runs of plain spaces are left alone); inside the cell each line
  break run (with the spaces/tabs around it) becomes one space.  Text ``NA`` and
  whitespace-only cells outside date columns are data and are kept exactly.
* Installed Capacity: kept exactly as the official CSV text.  ``--capacity-source excel``
  substitutes the workbook value (.15g) where it agrees with the CSV within 0.0050001 MW.
* Output: UTF-8 without BOM, LF line endings, csv.QUOTE_MINIMAL.

The log ends with a self-verification: the written file is re-read and compared cell by
cell with the official CSV; every difference must be a logged change and every logged
change a difference.  A hash manifest of the inputs and of any ``--protect`` path is taken
before and after the run; any difference fails the run.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import os
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path

try:  # package import (automation.repd.clean) or standalone script
    from . import date_rule as dr
except ImportError:  # pragma: no cover - exercised when run as a script
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import date_rule as dr  # type: ignore

from openpyxl.utils.datetime import to_excel

TOOL = "automation/repd/clean.py"
LOG_SCHEMA = "repd-cleaning-log/1"
CAPACITY_COLUMN = "Installed Capacity (MWelec)"
REF_COLUMN = "Ref ID"
CAPACITY_TOLERANCE_MW = 0.0050001
NUMERIC_TOLERANCE = 0.0050001

# Header names after whitespace collapse.  Required so that a column that happens to be
# wholly blank in the workbook is still validated as a date column.
DEFAULT_REQUIRED_DATE_COLUMNS = (
    "Record Last Updated (dd/mm/yyyy)",
    "Judicial Review",
    "Planning Application Submitted",
    "Planning Application Withdrawn",
    "Planning Permission Refused",
    "Appeal Lodged",
    "Appeal Withdrawn",
    "Appeal Refused",
    "Appeal Granted",
    "Planning Permission Granted",
    "Secretary of State - Intervened",
    "Secretary of State - Refusal",
    "Secretary of State - Granted",
    "Planning Permission Expired",
    "Under Construction",
    "Operational",
)
# Columns whose dates are legitimately in the future (not flagged against --as-of).
DEFAULT_FUTURE_OK_COLUMNS = ("Planning Permission Expired",)

# Change kinds (the complete vocabulary; every changed cell carries one or more).
K_HEADER = "header_whitespace_normalised"
K_DUP = "identical_duplicate_row_removed"
K_EDGE = "edge_control_whitespace_trimmed"
K_BREAK = "embedded_line_break_replaced"
K_DATE_MF = "date_month_first_corrected"
K_DATE_NA = "date_na_text_blanked"
K_DATE_WS = "date_whitespace_blanked"
K_DATE_OTHER = "date_text_normalised"
K_NUM_DATE = "number_stored_as_date_restored"
K_CAPACITY = "capacity_excel_precision"
K_EDGE_SPACE = "edge_space_trimmed"              # only with --whitespace all
K_WS_BLANK = "whitespace_only_cell_blanked"      # only with --whitespace all
CELL_KINDS = (K_EDGE, K_BREAK, K_EDGE_SPACE, K_WS_BLANK, K_DATE_MF, K_DATE_NA, K_DATE_WS, K_DATE_OTHER, K_NUM_DATE, K_CAPACITY)
ALL_KINDS = (K_HEADER, K_DUP) + CELL_KINDS

_EDGE_LEAD = re.compile(r"\A[ \t\r\n]+")
_EDGE_TRAIL = re.compile(r"[ \t\r\n]+\Z")
_BREAK = re.compile(r"[ \t]*[\r\n]+[ \t]*")
_STRICT_DATE = re.compile(r"\d{2}/\d{2}/\d{4}")


class CleaningRejected(RuntimeError):
    """The release cannot be cleaned without inventing or guessing data."""

    def __init__(self, reasons: list[str]):
        super().__init__("; ".join(reasons))
        self.reasons = reasons


@dataclass
class CleanOptions:
    capacity_source: str = "csv"            # csv | excel
    whitespace: str = "control"             # control (default) | all
    normalise_headers: bool = False
    required_date_columns: tuple[str, ...] = DEFAULT_REQUIRED_DATE_COLUMNS
    sheet: str | None = None
    as_of: date | None = None
    future_ok_columns: tuple[str, ...] = DEFAULT_FUTURE_OK_COLUMNS
    expected_csv_sha256: str | None = None
    expected_xlsx_sha256: str | None = None


@dataclass
class CleanResult:
    header: list[str]
    rows: list[list[str]]
    log: dict
    csv_bytes: bytes = b""
    changes: list[dict] = field(default_factory=list)


# --------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------
def sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def clean_text(value: str, whitespace: str = "control") -> tuple[str, list[str]]:
    """Apply the whitespace policy to one non-date cell.  Returns (text, kinds).

    control: edge runs containing tab/CR/LF removed, internal line-break runs -> one space.
    all:     additionally every leading/trailing whitespace character (spaces, NBSP, ...) is
             removed and whitespace-only cells become blank (each counted separately)."""
    kinds: list[str] = []
    text = value
    lead = _EDGE_LEAD.match(text)
    if lead and re.search(r"[\t\r\n]", lead.group()):
        text = text[lead.end():]
        kinds.append(K_EDGE)
    trail = _EDGE_TRAIL.search(text)
    if trail and re.search(r"[\t\r\n]", trail.group()):
        text = text[:trail.start()]
        if K_EDGE not in kinds:
            kinds.append(K_EDGE)
    replaced = _BREAK.sub(" ", text)
    if replaced != text:
        text = replaced
        kinds.append(K_BREAK)
    if whitespace == "all":
        if text and not text.strip():
            text = ""
            kinds.append(K_WS_BLANK)
        elif text.strip() != text:
            text = text.strip()
            kinds.append(K_EDGE_SPACE)
    return text, kinds


def parse_number(text) -> float | None:
    if text is None:
        return None
    if isinstance(text, bool):
        return None
    if isinstance(text, (int, float)):
        return float(text) if math.isfinite(float(text)) else None
    stripped = str(text).strip().replace(",", "")
    if not stripped:
        return None
    try:
        number = float(stripped)
    except ValueError:
        return None
    return number if math.isfinite(number) else None


def format_number(value: float) -> str:
    if float(value).is_integer():
        return str(int(value))
    return format(float(value), ".15g")


def excel_text(cell: "dr.XCell") -> str:
    """Render a workbook value as text for comparison (not for output)."""
    value = cell.value
    if value is None:
        return ""
    if isinstance(value, bool):
        return str(value).upper()
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return format_number(value)
    if isinstance(value, datetime):
        return value.isoformat(sep=" ")
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def _cmp_norm(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("_x000D_", " ")).strip()


def hash_paths(paths: list[Path]) -> dict[str, str]:
    """sha256 of every file under the given files/directories (sorted, recursive)."""
    manifest: dict[str, str] = {}
    for root in paths:
        root = Path(root)
        if root.is_file():
            manifest[str(root.resolve())] = sha256(root.read_bytes())
        elif root.is_dir():
            for path in sorted(p for p in root.rglob("*") if p.is_file()):
                manifest[str(path.resolve())] = sha256(path.read_bytes())
        else:
            manifest[str(root.resolve())] = "MISSING"
    return manifest


def manifest_diff(before: dict[str, str], after: dict[str, str]) -> list[dict]:
    diffs = []
    for path in sorted(set(before) | set(after)):
        if before.get(path) != after.get(path):
            diffs.append({"path": path, "before": before.get(path), "after": after.get(path)})
    return diffs


def serialise(header: list[str], rows: list[list[str]]) -> bytes:
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\n", quoting=csv.QUOTE_MINIMAL)
    writer.writerow(header)
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8")


# --------------------------------------------------------------------------
# The cleaning step
# --------------------------------------------------------------------------
def clean(csv_raw: bytes, xlsx_raw: bytes, options: CleanOptions | None = None,
          csv_name: str = "official.csv", xlsx_name: str = "official.xlsx") -> CleanResult:
    """Pure function: official bytes in, cleaned table + log out.  Raises CleaningRejected."""
    opts = options or CleanOptions()
    reasons: list[str] = []
    if opts.capacity_source not in ("csv", "excel"):
        raise CleaningRejected([f"capacity_source must be csv or excel, not {opts.capacity_source!r}"])
    if opts.whitespace not in ("control", "all"):
        raise CleaningRejected([f"whitespace must be control or all, not {opts.whitespace!r}"])

    inputs = {
        "csv": {"name": csv_name, "bytes": len(csv_raw), "sha256": sha256(csv_raw)},
        "xlsx": {"name": xlsx_name, "bytes": len(xlsx_raw), "sha256": sha256(xlsx_raw)},
    }
    for label, expected in (("csv", opts.expected_csv_sha256), ("xlsx", opts.expected_xlsx_sha256)):
        if expected and expected.lower() != inputs[label]["sha256"]:
            reasons.append(f"{label} sha256 {inputs[label]['sha256']} != expected {expected.lower()}")
    if reasons:
        raise CleaningRejected(reasons)

    # ---- read (csv module + openpyxl: keeps text NA and number formats) --------------------
    try:
        c_header, c_rows, encoding = dr.read_csv_table(csv_raw)
    except (ValueError, csv.Error) as exc:
        raise CleaningRejected([f"CSV unreadable: {exc}"]) from exc
    try:
        x_header, x_rows, sheet = dr.read_xlsx_table(xlsx_raw, sheet=opts.sheet)
    except (ValueError, KeyError) as exc:
        raise CleaningRejected([f"XLSX unreadable: {exc}"]) from exc
    inputs["csv"].update({
        "encoding": encoding, "bom": csv_raw.startswith(b"\xef\xbb\xbf"), "records": len(c_rows),
        "columns": len(c_header), "crlf_count": csv_raw.count(b"\r\n"),
        "lf_count": csv_raw.count(b"\n"),
    })
    inputs["xlsx"].update({"sheet": sheet, "records": len(x_rows), "columns": len(x_header)})

    names = [dr.collapse_header(h) for h in c_header]
    x_names = [dr.collapse_header(h) for h in x_header]
    if names != x_names:
        reasons.append(f"CSV and XLSX headers differ: csv_only={sorted(set(names) - set(x_names))} "
                       f"xlsx_only={sorted(set(x_names) - set(names))} (or order differs)")
    dupe_headers = [n for n, k in Counter(names).items() if k > 1]
    if dupe_headers:
        reasons.append(f"duplicate CSV headers after whitespace collapse: {dupe_headers}")
    if REF_COLUMN not in names:
        reasons.append("CSV has no Ref ID column")
    if reasons:
        raise CleaningRejected(reasons)
    ref_pos = names.index(REF_COLUMN)

    # ---- duplicates (strict: raw CSV text of every field) ---------------------------------
    occurrences: dict[str, list[int]] = defaultdict(list)
    first_row: dict[str, list[str]] = {}
    for number, row in enumerate(c_rows, start=1):
        ref = dr.clean_ref(row[ref_pos])
        if not ref:
            reasons.append(f"CSV data record {number} has a blank Ref ID")
            continue
        occurrences[ref].append(number)
        if ref in first_row and first_row[ref] != row:
            differing = [c_header[i] for i, (a, b) in enumerate(zip(first_row[ref], row)) if a != b]
            reasons.append(f"conflicting duplicate Ref ID {ref} (CSV data records {occurrences[ref]}; "
                           f"fields differ: {differing})")
        first_row.setdefault(ref, row)
    x_ref_pos = x_names.index(REF_COLUMN)
    x_occ = Counter(dr.clean_ref(r[x_ref_pos].value) for r in x_rows)
    c_occ = Counter({ref: len(v) for ref, v in occurrences.items()})
    if set(c_occ) != set(x_occ):
        only_c, only_x = sorted(set(c_occ) - set(x_occ)), sorted(set(x_occ) - set(c_occ))
        reasons.append(f"CSV and XLSX Ref ID sets differ: csv_only={only_c[:20]} ({len(only_c)}) "
                       f"xlsx_only={only_x[:20]} ({len(only_x)})")
    else:
        count_diff = sorted(ref for ref in c_occ if c_occ[ref] != x_occ[ref])
        if count_diff:
            reasons.append(f"Ref IDs repeated a different number of times in CSV and XLSX: {count_diff[:20]}")
    if reasons:
        raise CleaningRejected(reasons)

    # ---- the date rule over the whole table -----------------------------------------------
    rule = dr.apply_rule(c_header, c_rows, x_header, x_rows,
                         required_date_columns=opts.required_date_columns, as_of=opts.as_of,
                         future_ok_columns=opts.future_ok_columns)
    if not rule.ok:
        raise CleaningRejected(rule.failure_messages(limit=25))
    date_cols = set(rule.date_columns)
    prov = {(p["ref"], p["column"]): p for p in rule.provenance}

    # workbook rows by ref (first occurrence; duplicates already proved identical by the rule)
    x_by_ref: dict[str, list] = {}
    for r in x_rows:
        x_by_ref.setdefault(dr.clean_ref(r[x_ref_pos].value), r)

    # ---- header ------------------------------------------------------------------------
    changes: list[dict] = []
    header_changes: list[dict] = []
    if opts.normalise_headers:
        out_header = list(names)
        for i, (a, b) in enumerate(zip(c_header, out_header)):
            if a != b:
                header_changes.append({"column_index": i, "before": a, "after": b, "kinds": [K_HEADER]})
    else:
        out_header = list(c_header)

    # ---- rows and cells ------------------------------------------------------------------
    removed_rows: list[dict] = []
    out_rows: list[list[str]] = []
    out_refs: list[str] = []
    na_preserved: Counter = Counter()
    ws_preserved: Counter = Counter()
    stray_dates: list[dict] = []
    num_date_columns: Counter = Counter()
    seen: set[str] = set()
    for number, row in enumerate(c_rows, start=1):
        ref = dr.clean_ref(row[ref_pos])
        if ref in seen:
            removed_rows.append({"ref": ref, "csv_record": number,
                                 "kept_csv_record": occurrences[ref][0], "kinds": [K_DUP]})
            continue
        seen.add(ref)
        xrow = x_by_ref[ref]
        out_row_number = len(out_rows) + 1
        new_row: list[str] = []
        for i, (name, before) in enumerate(zip(names, row)):
            kinds: list[str] = []
            detail: dict = {}
            xcell = xrow[i]
            if name in date_cols:
                after = rule.output.get((ref, name), "")
                if after != before:
                    p = prov.get((ref, name), {})
                    code = p.get("rule", "")
                    if code in dr.MONTH_FIRST_RULES:
                        kinds.append(K_DATE_MF)
                    elif code == dr.OK_BLANK_EQUIVALENT:
                        kinds.append(K_DATE_WS if p.get("blank_token") == "<whitespace>" else K_DATE_NA)
                    else:
                        kinds.append(K_DATE_OTHER)
                    detail = {"date_rule": code, "excel_value": p.get("excel_value"),
                              "excel_number_format": p.get("excel_number_format")}
                    if p.get("blank_token") is not None:
                        detail["blank_token"] = p.get("blank_token")
            elif (xcell.is_date and isinstance(xcell.value, datetime)
                  and xcell.value.date() < dr.EARLIEST_PLAUSIBLE):
                serial = float(to_excel(xcell.value))
                rendered = xcell.value.strftime("%d/%m/%Y")
                if before.strip() != rendered:
                    reasons.append(f"ref {ref} column {name!r}: workbook holds number {serial!r} with a date "
                                   f"format, but CSV text {before!r} is not its date rendering {rendered!r}")
                    after = before
                else:
                    after = format_number(serial)
                    kinds.append(K_NUM_DATE)
                    num_date_columns[name] += 1
                    detail = {"excel_serial": serial, "excel_number_format": xcell.number_format,
                              "csv_rendering": rendered}
            else:
                after, kinds = clean_text(before, opts.whitespace)
                if xcell.is_date and isinstance(xcell.value, (datetime, date)):
                    stray_dates.append({"ref": ref, "column": name, "csv_text": before,
                                        "excel_value": excel_text(xcell),
                                        "action": "NOT_ALTERED_REPORTED_ONLY"})
                if name == CAPACITY_COLUMN and opts.capacity_source == "excel":
                    x_num, c_num = parse_number(xcell.value), parse_number(after)
                    if x_num is None and c_num is None:
                        pass
                    elif x_num is None or c_num is None or abs(x_num - c_num) > CAPACITY_TOLERANCE_MW:
                        reasons.append(f"ref {ref}: capacity CSV {before!r} vs XLSX {xcell.value!r} disagree")
                    else:
                        precise = format(x_num, ".15g")
                        if precise != after:
                            detail = {"excel_value": xcell.value, "csv_value": after}
                            after = precise
                            kinds.append(K_CAPACITY)
                if after.strip().casefold() in dr.DEFAULT_BLANK_TOKENS:
                    na_preserved[name] += 1
                if after and not after.strip():
                    ws_preserved[name] += 1
            if after != before and not kinds:
                reasons.append(f"internal: unlogged change ref {ref} column {name!r}")
            if kinds:
                if after == before:
                    kinds = []
                else:
                    changes.append({"ref": ref, "column": c_header[i], "column_index": i,
                                    "csv_record": number, "out_row": out_row_number,
                                    "before": before, "after": after, "kinds": kinds, **detail})
            new_row.append(after)
        out_rows.append(new_row)
        out_refs.append(ref)
    if reasons:
        raise CleaningRejected(reasons)
    if len(set(out_refs)) != len(out_refs) or set(out_refs) != set(x_by_ref):
        raise CleaningRejected(["internal: output Ref IDs are not the unique workbook Ref IDs"])

    # ---- strict format check of every date cell -------------------------------------------
    date_idx = [i for i, n in enumerate(names) if n in date_cols]
    bad = []
    for r_no, row in enumerate(out_rows, start=1):
        for i in date_idx:
            v = row[i]
            if v and not (_STRICT_DATE.fullmatch(v) and _valid_dmy(v)):
                bad.append((out_refs[r_no - 1], names[i], v))
    if bad:
        raise CleaningRejected([f"internal: non-strict dates in output {bad[:10]}"])

    out_bytes = serialise(out_header, out_rows)
    observations = cross_check(names, c_header, out_rows, out_refs, x_by_ref, date_cols, num_date_columns)
    log = build_log(inputs=inputs, opts=opts, c_header=c_header, out_header=out_header,
                    header_changes=header_changes, removed_rows=removed_rows, changes=changes,
                    rule=rule, out_bytes=out_bytes, out_rows=out_rows, names=names,
                    na_preserved=na_preserved, ws_preserved=ws_preserved, stray_dates=stray_dates,
                    num_date_columns=num_date_columns, observations=observations, occurrences=occurrences)
    verification = verify_against_official(csv_raw, out_bytes, log)
    log["verification"] = verification
    if not verification["ok"]:
        raise CleaningRejected([f"self-verification failed: {verification['problems'][:10]}"])
    return CleanResult(header=out_header, rows=out_rows, log=log, csv_bytes=out_bytes, changes=changes)


def _valid_dmy(text: str) -> bool:
    try:
        datetime.strptime(text, "%d/%m/%Y")
        return True
    except ValueError:
        return False


# --------------------------------------------------------------------------
# Cross-check of the non-date columns against the workbook (report only)
# --------------------------------------------------------------------------
def cross_check(names, c_header, out_rows, out_refs, x_by_ref, date_cols, num_date_columns) -> dict:
    """Compare every non-date output cell with the workbook.  Reports, never changes."""
    per_column: dict[str, Counter] = defaultdict(Counter)
    cells: list[dict] = []
    for ref, row in zip(out_refs, out_rows):
        xrow = x_by_ref[ref]
        for i, name in enumerate(names):
            if name in date_cols:
                continue
            out = row[i]
            xc = xrow[i]
            if xc.is_date and isinstance(xc.value, datetime) and xc.value.date() < dr.EARLIEST_PLAUSIBLE:
                xt = format_number(float(to_excel(xc.value)))
            else:
                xt = excel_text(xc)
            a, b = _cmp_norm(out), _cmp_norm(xt)
            if a == b:
                continue
            na, nb = parse_number(a), parse_number(b)
            if na is not None and nb is not None and na == nb and "," in a:
                category = "numeric_equal_display_format"   # thousands separators / trailing zeros only
            elif na is not None and nb is not None and na == nb:
                category = "numeric_equal_text_differs"
            elif na is not None and nb is not None and abs(na - nb) <= NUMERIC_TOLERANCE:
                category = "numeric_rounded_in_csv"
            elif a.casefold() in dr.DEFAULT_BLANK_TOKENS and b == "":
                category = "csv_na_text_xlsx_blank"
            else:
                category = "text_differs"
            per_column[c_header[i]][category] += 1
            cells.append({"ref": ref, "column": c_header[i], "category": category,
                          "output_text": out, "xlsx_text": xt})
    totals = Counter()
    for c in per_column.values():
        totals.update(c)
    return {
        "description": ("Every non-date output cell compared with the workbook after whitespace collapse. "
                        "Differences are REPORTED ONLY; the official CSV text is kept (capacity excepted "
                        "when --capacity-source excel)."),
        "totals": dict(sorted(totals.items())),
        "by_column": {k: dict(sorted(v.items())) for k, v in sorted(per_column.items())},
        "cells": cells,
    }


# --------------------------------------------------------------------------
# Log
# --------------------------------------------------------------------------
def build_log(*, inputs, opts, c_header, out_header, header_changes, removed_rows, changes, rule,
              out_bytes, out_rows, names, na_preserved, ws_preserved, stray_dates, num_date_columns,
              observations, occurrences) -> dict:
    by_kind: dict[str, list[dict]] = {k: [] for k in ALL_KINDS}
    for h in header_changes:
        by_kind[K_HEADER].append(h)
    for r in removed_rows:
        by_kind[K_DUP].append(r)
    for c in changes:
        for k in c["kinds"]:
            by_kind[k].append(c)
    by_kind_column: dict[str, dict[str, int]] = {}
    for k in CELL_KINDS:
        cnt = Counter(c["column"] for c in by_kind[k])
        if cnt:
            by_kind_column[k] = dict(sorted(cnt.items()))
    return {
        "schema": LOG_SCHEMA,
        "tool": TOOL,
        "status": "CLEANED",
        "inputs": inputs,
        "options": {
            "capacity_source": opts.capacity_source,
            "whitespace": opts.whitespace,
            "normalise_headers": opts.normalise_headers,
            "required_date_columns": list(opts.required_date_columns),
            "sheet": opts.sheet,
            "as_of": opts.as_of.isoformat() if opts.as_of else None,
            "future_ok_columns": list(opts.future_ok_columns),
            "expected_csv_sha256": opts.expected_csv_sha256,
            "expected_xlsx_sha256": opts.expected_xlsx_sha256,
        },
        "policy": {
            "encoding_out": "utf-8 (no BOM)", "line_terminator": "\\n", "quoting": "QUOTE_MINIMAL",
            "column_order": "official CSV order",
            "dates": "typed Excel date wins; month-first CSV text only where the cell's number format is "
                     "explicitly month-first; strict dd/mm/yyyy; NA/N/A/whitespace blanked in date columns only",
            "duplicates": "byte-identical CSV records kept once (first); conflicting duplicates reject",
            "whitespace": ("edge runs containing tab/CR/LF removed; internal line-break runs -> one space; "
                           "plain-space edges, whitespace-only cells and text NA outside date columns kept")
            if opts.whitespace == "control" else
            ("edge runs containing tab/CR/LF removed; internal line-break runs -> one space; all other "
             "leading/trailing whitespace removed; whitespace-only cells blanked; text NA kept"),
            "capacity": "official CSV text" if opts.capacity_source == "csv" else
                        "workbook value (.15g) where within 0.0050001 MW of the CSV",
            "numbers_stored_as_dates": "workbook number restored where the CSV shows its 1900 date rendering",
        },
        "output": {
            "sha256": sha256(out_bytes), "bytes": len(out_bytes), "rows": len(out_rows),
            "columns": len(out_header), "header": out_header,
        },
        "official_header": c_header,
        "date_columns": rule.date_columns,
        "counts": {k: len(v) for k, v in by_kind.items()},
        "cells_changed_distinct": len(changes),
        "counts_by_kind_and_column": by_kind_column,
        "changes_by_kind": by_kind,
        "observations": {
            "duplicate_refs": {ref: nums for ref, nums in occurrences.items() if len(nums) > 1},
            "date_rule_totals": rule.summary()["rule_totals"],
            "date_rule_counts_by_column": rule.rule_counts,
            "date_blank_equivalent_counts": rule.blank_equivalent_counts,
            "date_plausibility_flags": rule.plausibility_flags,
            "number_stored_as_date_columns": dict(num_date_columns),
            "stray_excel_dates_left_unchanged": stray_dates,
            "na_text_preserved_outside_date_columns": dict(sorted(na_preserved.items())),
            "whitespace_only_cells_preserved_outside_date_columns": dict(sorted(ws_preserved.items())),
            "whitespace_only_cells_preserved_total": sum(ws_preserved.values()),
            "csv_vs_xlsx_non_date_columns": observations,
        },
    }


def verify_against_official(csv_raw: bytes, out_bytes: bytes, log: dict) -> dict:
    """Re-read both files independently and prove every difference is logged (and vice versa)."""
    problems: list[str] = []
    if out_bytes.startswith(b"\xef\xbb\xbf"):
        problems.append("output has a BOM")
    if b"\r" in out_bytes:  # LF terminators only; cell line breaks are replaced by the policy
        problems.append("output contains CR characters")
    try:
        out_text = out_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        problems.append(f"output is not UTF-8: {exc}")
        return {"ok": False, "problems": problems}
    out = list(csv.reader(io.StringIO(out_text, newline=""), strict=True))
    official_header, official_rows, _ = dr.read_csv_table(csv_raw)
    out_header, out_rows = out[0], out[1:]

    removed = {r["csv_record"] for r in log["changes_by_kind"][K_DUP]}
    kept = [row for n, row in enumerate(official_rows, start=1) if n not in removed]
    if len(kept) != len(out_rows):
        problems.append(f"row count {len(out_rows)} != official {len(official_rows)} - removed {len(removed)}")
    logged_header = {h["column_index"]: h for h in log["changes_by_kind"][K_HEADER]}
    for i, (a, b) in enumerate(zip(official_header, out_header)):
        if a != b and (i not in logged_header or logged_header[i]["after"] != b):
            problems.append(f"unlogged header change at {i}: {a!r} -> {b!r}")
    if len(out_header) != len(official_header):
        problems.append("column count changed")

    logged: dict[tuple[int, int], dict] = {}
    for kind in CELL_KINDS:
        for c in log["changes_by_kind"][kind]:
            logged[(c["out_row"], c["column_index"])] = c
    found = 0
    for r_no, (a_row, b_row) in enumerate(zip(kept, out_rows), start=1):
        for i, (a, b) in enumerate(zip(a_row, b_row)):
            if a == b:
                if (r_no, i) in logged:
                    problems.append(f"logged change has no effect: row {r_no} col {i}")
                continue
            found += 1
            entry = logged.get((r_no, i))
            if entry is None:
                problems.append(f"UNLOGGED difference row {r_no} col {official_header[i]!r}: {a!r} -> {b!r}")
            elif entry["before"] != a or entry["after"] != b:
                problems.append(f"log before/after mismatch row {r_no} col {i}")
    cells = len(out_rows) * len(out_header)
    return {
        "ok": not problems and found == len(logged),
        "method": "output re-read with csv module (utf-8, strict); official re-read independently; "
                  "rows aligned after removing the logged duplicate records; every cell compared",
        "cells_compared": cells,
        "cells_differing_from_official": found,
        "cells_logged": len(logged),
        "rows_removed_logged": len(removed),
        "unexplained_differences": sum("UNLOGGED" in p for p in problems),
        "problems": problems[:50],
    }


def render_text_log(log: dict) -> str:
    lines: list[str] = []
    w = lines.append
    w("REPD CLEANING LOG")
    w("=================")
    w(f"status: {log['status']}")
    w(f"tool: {log['tool']}   schema: {log['schema']}   generated_at: {log.get('generated_at', '')}")
    for label in ("csv", "xlsx"):
        i = log["inputs"][label]
        extra = (f" encoding={i.get('encoding')} records={i.get('records')}" if label == "csv"
                 else f" sheet={i.get('sheet')} records={i.get('records')}")
        w(f"input {label}: {i['name']} bytes={i['bytes']} sha256={i['sha256']}{extra}")
    if log["status"] != "CLEANED":
        w("")
        w("REJECTED:")
        for r in log.get("reasons", []):
            w(f"  - {r}")
        return "\n".join(lines) + "\n"
    o = log["output"]
    w(f"output: {log.get('output_file', '')} bytes={o['bytes']} rows={o['rows']} columns={o['columns']} "
      f"sha256={o['sha256']} (utf-8, no BOM, LF)")
    w(f"options: {json.dumps(log['options'], sort_keys=True)}")
    w(f"date columns ({len(log['date_columns'])}): {', '.join(log['date_columns'])}")
    w("")
    w("CHANGE COUNTS")
    for k, n in log["counts"].items():
        w(f"  {k:<40} {n:>6}")
    w(f"  {'distinct cells changed':<40} {log['cells_changed_distinct']:>6}")
    v = log["verification"]
    w("")
    w("SELF-VERIFICATION (output vs official CSV, cell by cell)")
    w(f"  ok={v['ok']} cells_compared={v['cells_compared']} differing={v['cells_differing_from_official']} "
      f"logged={v['cells_logged']} unexplained={v['unexplained_differences']} rows_removed={v['rows_removed_logged']}")
    for p in v["problems"]:
        w(f"  PROBLEM: {p}")
    w("")
    w("COUNTS BY KIND AND COLUMN")
    for k, cols in log["counts_by_kind_and_column"].items():
        w(f"  {k}")
        for c, n in cols.items():
            w(f"      {c!r}: {n}")
    obs = log["observations"]
    w("")
    w("OBSERVATIONS (not changes)")
    w(f"  duplicate refs (CSV data record numbers): {obs['duplicate_refs']}")
    w(f"  date rule totals: {obs['date_rule_totals']}")
    w(f"  date plausibility flags (kept, not changed): {len(obs['date_plausibility_flags'])}")
    for f in obs["date_plausibility_flags"]:
        w(f"      ref {f['ref']} {f['column']!r} {f['value']} {f['flag']}")
    w(f"  numbers stored as dates, by column: {obs['number_stored_as_date_columns']}")
    w(f"  stray Excel dates left unchanged: {len(obs['stray_excel_dates_left_unchanged'])}")
    w(f"  text NA preserved outside date columns: {obs['na_text_preserved_outside_date_columns']}")
    w(f"  whitespace-only cells preserved outside date columns: {obs['whitespace_only_cells_preserved_total']} "
      f"{obs['whitespace_only_cells_preserved_outside_date_columns']}")
    xc = obs["csv_vs_xlsx_non_date_columns"]
    w(f"  CSV vs XLSX, non-date columns (report only): {xc['totals']}")
    for col, cnt in xc["by_column"].items():
        w(f"      {col!r}: {cnt}")
    for c in xc["cells"]:
        if c["category"] not in ("numeric_rounded_in_csv", "numeric_equal_display_format"):
            w(f"      ref {c['ref']} {c['column']!r} [{c['category']}] csv={c['output_text']!r} xlsx={c['xlsx_text']!r}")
    w("      (numeric_rounded_in_csv and numeric_equal_display_format cells are listed in cleaning_log.json only)")
    w("")
    w("EVERY CHANGE")
    for k in ALL_KINDS:
        items = log["changes_by_kind"][k]
        w(f"-- {k} ({len(items)})")
        for c in items:
            if k == K_DUP:
                w(f"   ref {c['ref']}: CSV data record {c['csv_record']} removed (identical to record {c['kept_csv_record']})")
            elif k == K_HEADER:
                w(f"   column {c['column_index']}: {c['before']!r} -> {c['after']!r}")
            else:
                w(f"   ref {c['ref']} row {c['out_row']} {c['column']!r}: {c['before']!r} -> {c['after']!r}")
    return "\n".join(lines) + "\n"


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------
def _generated_at(explicit: str | None) -> str:
    if explicit:
        return explicit
    epoch = os.environ.get("SOURCE_DATE_EPOCH")
    if epoch and epoch.strip().isdigit():
        return datetime.fromtimestamp(int(epoch), timezone.utc).isoformat()
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Clean an official REPD CSV + XLSX pair.")
    parser.add_argument("--csv", required=True, type=Path)
    parser.add_argument("--xlsx", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path, help="output directory (created; never an input dir)")
    parser.add_argument("--output-name", default="REPD_cleaned.csv")
    parser.add_argument("--capacity-source", choices=("csv", "excel"), default="csv")
    parser.add_argument("--whitespace", choices=("control", "all"), default="control",
                        help="control: only tab/CR/LF edge runs and line breaks (default); all: also trim "
                             "spaces/NBSP at cell edges and blank whitespace-only cells")
    parser.add_argument("--normalise-headers", action="store_true")
    parser.add_argument("--sheet")
    parser.add_argument("--as-of", help="yyyy-mm-dd; later dates are flagged, not changed")
    parser.add_argument("--future-ok-column", action="append", default=None,
                        help="replace the default future-ok date columns (repeatable)")
    parser.add_argument("--require-date-column", action="append", default=None,
                        help="replace the default 16 required date columns (repeatable)")
    parser.add_argument("--expected-csv-sha256")
    parser.add_argument("--expected-xlsx-sha256")
    parser.add_argument("--protect", action="append", default=[], type=Path,
                        help="file or directory that must be byte-identical after the run (repeatable)")
    parser.add_argument("--overwrite", action="store_true", help="allow replacing existing outputs in --out")
    parser.add_argument("--generated-at", help="timestamp to record (default: SOURCE_DATE_EPOCH or now)")
    args = parser.parse_args(argv)

    out_dir = args.out.resolve()
    targets = [out_dir / args.output_name, out_dir / "cleaning_log.json", out_dir / "CLEANING-LOG.txt"]
    protected = [args.csv, args.xlsx, *args.protect]
    # --out may not hold, sit inside, or be the folder of any input or protected path
    fences = [Path(p).resolve() for p in args.protect] + [args.csv.resolve().parent, args.xlsx.resolve().parent]
    for rp in fences:
        if rp == out_dir or out_dir in rp.parents or rp in out_dir.parents:
            print(f"REFUSED: --out {out_dir} overlaps protected path {rp}", file=sys.stderr)
            return 2
    existing = [str(t) for t in targets if t.exists()]
    if existing and not args.overwrite:
        print(f"REFUSED: outputs already exist (use --overwrite): {existing}", file=sys.stderr)
        return 2
    before = hash_paths(protected)

    opts = CleanOptions(
        capacity_source=args.capacity_source, whitespace=args.whitespace, normalise_headers=args.normalise_headers,
        required_date_columns=tuple(args.require_date_column) if args.require_date_column
        else DEFAULT_REQUIRED_DATE_COLUMNS,
        future_ok_columns=tuple(args.future_ok_column) if args.future_ok_column is not None
        else DEFAULT_FUTURE_OK_COLUMNS,
        sheet=args.sheet, as_of=date.fromisoformat(args.as_of) if args.as_of else None,
        expected_csv_sha256=args.expected_csv_sha256, expected_xlsx_sha256=args.expected_xlsx_sha256,
    )
    csv_raw, xlsx_raw = args.csv.read_bytes(), args.xlsx.read_bytes()
    out_dir.mkdir(parents=True, exist_ok=True)
    generated_at = _generated_at(args.generated_at)
    try:
        result = clean(csv_raw, xlsx_raw, opts, csv_name=args.csv.name, xlsx_name=args.xlsx.name)
        log = result.log
        code = 0
    except CleaningRejected as exc:
        result = None
        log = {"schema": LOG_SCHEMA, "tool": TOOL, "status": "REJECTED", "reasons": exc.reasons,
               "inputs": {"csv": {"name": args.csv.name, "bytes": len(csv_raw), "sha256": sha256(csv_raw)},
                          "xlsx": {"name": args.xlsx.name, "bytes": len(xlsx_raw), "sha256": sha256(xlsx_raw)}}}
        code = 1
    log["generated_at"] = generated_at
    if result is not None:
        (out_dir / args.output_name).write_bytes(result.csv_bytes)
        log["output_file"] = args.output_name
    elif (out_dir / args.output_name).exists():
        (out_dir / args.output_name).unlink()  # never leave a stale cleaned file beside a rejection

    after = hash_paths(protected)
    diffs = manifest_diff(before, after)
    log["hash_manifest"] = {"protected_paths": [str(Path(p).resolve()) for p in protected],
                            "before": before, "after": after, "differences": diffs, "ok": not diffs}
    if diffs:
        log["status"] = "FAILED_PROTECTED_FILE_CHANGED"
        code = 3
    (out_dir / "cleaning_log.json").write_text(json.dumps(log, indent=1, ensure_ascii=False) + "\n",
                                               encoding="utf-8")
    text = render_text_log(log)
    text += "\nHASH MANIFEST (files this step must not change)\n"
    for path, digest in before.items():
        text += f"  {digest}  {path}  {'UNCHANGED' if after.get(path) == digest else 'CHANGED'}\n"
    (out_dir / "CLEANING-LOG.txt").write_text(text, encoding="utf-8")
    if code == 0:
        print(f"CLEANED rows={log['output']['rows']} sha256={log['output']['sha256']} "
              f"changes={log['cells_changed_distinct']} counts={json.dumps(log['counts'])}")
    elif code == 1:
        print("REJECTED: " + "; ".join(log["reasons"]), file=sys.stderr)
    else:
        print(f"FAILED: protected files changed: {diffs}", file=sys.stderr)
    return code


if __name__ == "__main__":
    raise SystemExit(main())
