#!/usr/bin/env python3
"""General CSV/Excel date reconciliation rule for REPD quarterly extracts.

Replaces a per-release allow-list of "known month-first refs" with a rule that
is derived only from the two official files:

1. A column is a *date column* when it is required by the caller, or when every
   Excel cell in it that is not blank-equivalent is a true date cell (a number
   carrying a date number format) with a plausible calendar value.
2. For every cell of a date column the typed Excel date is the value.  The CSV
   text must be explained by it:
     * as d/m/yyyy, or
     * as m/d/yyyy, but ONLY if that cell's own Excel number format is an
       explicit month-first format (for example the custom code ``m/d/yyyy``).
       Built-in format 14 (which openpyxl reports as ``mm-dd-yy``) is the
       "system short date": Excel renders it in the locale of the machine, so
       it is NOT evidence of month-first text and never unlocks rule (b).
     * as yyyy-mm-dd (unambiguous).
3. Blank-equivalent text (empty, whitespace, NA, N/A) is emitted as blank and
   counted per column and per token.  Excel must also be blank(-equivalent).
4. Anything else is a failure: unparseable non-blank text, a date present in
   only one file, a day/month swap that the number format does not explain,
   two different dates, a time-of-day component, a non-date Excel cell.
5. Output is strict dd/mm/yyyy.  Every non-empty cell gets a provenance record.

Nothing here is specific to a release: no refs, no counts, no column positions.
The module has no network access and never writes unless asked to.
"""
from __future__ import annotations

import csv
import io
import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, time
from typing import Callable, Iterable

import openpyxl

# --------------------------------------------------------------------------
# Rule codes
# --------------------------------------------------------------------------
OK_DAY_FIRST = "EXCEL_DATE_CSV_DAY_FIRST"                    # CSV dd/mm/yyyy == Excel date
OK_DAY_FIRST_REPADDED = "EXCEL_DATE_CSV_DAY_FIRST_REPADDED"  # CSV d/m/yyyy, same date
OK_ISO = "EXCEL_DATE_CSV_ISO"                                # CSV yyyy-mm-dd == Excel date
OK_MONTH_FIRST = "EXCEL_DATE_CSV_MONTH_FIRST_CORRECTED"      # text changed from Excel
OK_MONTH_FIRST_INVARIANT = "EXCEL_DATE_CSV_MONTH_FIRST_INVARIANT"  # day == month
OK_BLANK_EQUIVALENT = "BLANK_EQUIVALENT"
OK_TEXT_UNAMBIGUOUS = "TEXT_DATE_BOTH_FILES_UNAMBIGUOUS"     # no typed date; day > 12

FAIL_UNPARSEABLE = "FAIL_CSV_UNPARSEABLE"
FAIL_SWAP = "FAIL_DAY_MONTH_SWAP_NOT_EXPLAINED_BY_FORMAT"
FAIL_MISMATCH = "FAIL_DIFFERENT_DATES"
FAIL_CSV_ONLY = "FAIL_CSV_DATE_EXCEL_BLANK"
FAIL_EXCEL_ONLY = "FAIL_EXCEL_DATE_CSV_BLANK"
FAIL_EXCEL_NOT_DATE = "FAIL_EXCEL_CELL_NOT_A_TRUE_DATE"
FAIL_TIME = "FAIL_EXCEL_TIME_COMPONENT"
FAIL_TEXT_AMBIGUOUS = "FAIL_TEXT_DATE_AMBIGUOUS_WITHOUT_TYPED_DATE"
FAIL_BLANK_CONFLICT = "FAIL_BLANK_EQUIVALENT_CONFLICT"

MONTH_FIRST_RULES = (OK_MONTH_FIRST, OK_MONTH_FIRST_INVARIANT)

DEFAULT_BLANK_TOKENS = frozenset({"na", "n/a"})
# Excel serial numbers below 61 sit before 1 March 1900, where Excel's calendar
# is wrong (phantom 29 Feb 1900).  A "date" there is a small number wearing a
# date format, never a planning date.
EARLIEST_PLAUSIBLE = date(1900, 3, 1)
LOCALE_SHORT_DATE_FORMAT_IDS = frozenset({14, 22})

_DMY = re.compile(r"(\d{1,2})/(\d{1,2})/(\d{4})")
_ISO = re.compile(r"(\d{4})-(\d{2})-(\d{2})")


# --------------------------------------------------------------------------
# Data carriers
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class XCell:
    """One Excel cell, reduced to what the rule needs."""
    value: object = None
    is_date: bool = False            # numeric cell with a date number format
    number_format: str = "General"
    num_fmt_id: int | None = None    # raw numFmtId from styles.xml when known


@dataclass
class DateRuleResult:
    date_columns: list[str] = field(default_factory=list)
    output: dict[tuple[str, str], str] = field(default_factory=dict)
    provenance: list[dict] = field(default_factory=list)
    failures: list[dict] = field(default_factory=list)
    structural_failures: list[str] = field(default_factory=list)
    rule_counts: dict[str, dict[str, int]] = field(default_factory=dict)
    blank_equivalent_counts: dict[str, dict[str, int]] = field(default_factory=dict)
    plausibility_flags: list[dict] = field(default_factory=list)
    stray_excel_dates: list[dict] = field(default_factory=list)
    duplicates: dict[str, list[dict]] = field(default_factory=dict)
    refs: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.failures and not self.structural_failures

    @property
    def month_first_cells(self) -> list[dict]:
        return [p for p in self.provenance if p["rule"] in MONTH_FIRST_RULES]

    def failure_messages(self, limit: int = 10) -> list[str]:
        messages = list(self.structural_failures)
        if self.failures:
            by_rule = Counter(f["rule"] for f in self.failures)
            sample = [(f["ref"], f["column"], f["csv_text"], f["excel_value"], f["rule"])
                      for f in self.failures[:limit]]
            messages.append(
                f"Date rule: {len(self.failures)} unexplained date cells {dict(by_rule)}; first: {sample}")
        return messages

    def summary(self) -> dict:
        totals: Counter = Counter()
        for counts in self.rule_counts.values():
            totals.update(counts)
        return {
            "ok": self.ok,
            "date_columns": self.date_columns,
            "refs": len(self.refs),
            "rule_totals": dict(sorted(totals.items())),
            "rule_counts_by_column": self.rule_counts,
            "blank_equivalent_counts": self.blank_equivalent_counts,
            "month_first_cells": len(self.month_first_cells),
            "month_first_cells_text_changed": sum(p["rule"] == OK_MONTH_FIRST for p in self.provenance),
            "month_first_cells_also_valid_day_first": sum(
                p["rule"] == OK_MONTH_FIRST and p.get("csv_valid_day_first") for p in self.provenance),
            "failures": len(self.failures),
            "structural_failures": self.structural_failures,
            "plausibility_flags": len(self.plausibility_flags),
            "stray_excel_date_cells_in_non_date_columns": len(self.stray_excel_dates),
            "duplicates": self.duplicates,
        }


# --------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------
def collapse_header(name) -> str:
    return re.sub(r"\s+", " ", str(name if name is not None else "")).strip()


def clean_ref(value) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return str(value)
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    text = str(value).strip()
    return text[:-2] if re.fullmatch(r"\d+\.0", text) else text


def classify_number_format(code: str | None, num_fmt_id: int | None = None) -> str:
    """Return month_first | day_first | year_first | locale_short_date | not_date.

    Only an explicit code in which the month token precedes the day token is
    month-first.  Built-in ids 14 and 22 are locale-dependent short dates.
    openpyxl spells id 14 as ``mm-dd-yy``; when the raw id is unavailable that
    spelling is therefore treated as locale-dependent (the conservative choice:
    it can only cause a failure, never a silent month-first acceptance).
    """
    if num_fmt_id in LOCALE_SHORT_DATE_FORMAT_IDS:
        return "locale_short_date"
    if not code or code == "General":
        return "not_date"
    if num_fmt_id is None and code.lower() in {"mm-dd-yy", "m/d/yy h:mm"}:
        return "locale_short_date"
    body = code.split(";")[0]
    body = re.sub(r"\[[^\]]*\]", "", body)      # [$-809], [Red], [h]
    body = re.sub(r'"[^"]*"', "", body)          # quoted literals
    body = re.sub(r"\\.", "", body).lower()      # escaped characters
    body = re.sub(r"am/pm|a/p", "", body)
    # minutes: an m-run directly after hours or directly before seconds
    body = re.sub(r"(h+[^a-z]*)m+", r"\1", body)
    body = re.sub(r"m+([^a-z]*s+)", r"\1", body)
    first = {token: body.find(token) for token in "dmy"}
    if first["d"] < 0 or first["m"] < 0:
        return "not_date"
    if 0 <= first["y"] < min(first["d"], first["m"]):
        return "year_first"
    return "month_first" if first["m"] < first["d"] else "day_first"


def _is_blank_token(text: str, blank_tokens: Iterable[str]) -> str | None:
    """Return a display token if ``text`` is blank-equivalent, else None."""
    stripped = text.strip().strip(" ").strip()
    if stripped == "":
        return "" if text == "" else "<whitespace>"
    if stripped.casefold() in blank_tokens:
        return stripped
    return None


def _valid(year: int, month: int, day: int) -> date | None:
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _as_date(value) -> tuple[date | None, bool]:
    """(calendar date, has_time_component) for datetime/date cell values."""
    if isinstance(value, datetime):
        return value.date(), value.time() != time(0)
    if isinstance(value, date):
        return value, False
    return None, False


def _fmt(d: date) -> str:
    return d.strftime("%d/%m/%Y")


# --------------------------------------------------------------------------
# The per-cell rule
# --------------------------------------------------------------------------
def resolve_cell(csv_text: str, cell: XCell,
                 blank_tokens: Iterable[str] = DEFAULT_BLANK_TOKENS) -> dict:
    """Apply the rule to one cell.  Returns rule, output and evidence fields."""
    text = "" if csv_text is None else str(csv_text)
    stripped = text.strip()
    fmt_class = classify_number_format(cell.number_format, cell.num_fmt_id)
    xl_date, has_time = _as_date(cell.value) if cell.is_date or isinstance(cell.value, (datetime, date)) else (None, False)
    record = {
        "csv_text": text,
        "excel_value": xl_date.isoformat() if xl_date else (None if cell.value is None else str(cell.value)),
        "excel_type": "date" if xl_date else type(cell.value).__name__,
        "excel_number_format": cell.number_format,
        "excel_num_fmt_id": cell.num_fmt_id,
        "excel_format_class": fmt_class,
        "output": "",
    }

    def done(rule: str, output: str = "", **extra) -> dict:
        record.update(rule=rule, output=output, **extra)
        return record

    csv_blank = _is_blank_token(text, blank_tokens)

    # ---- Excel holds a true date -------------------------------------------------
    if xl_date is not None:
        if has_time:
            return done(FAIL_TIME)
        if csv_blank is not None:
            return done(FAIL_EXCEL_ONLY)
        iso = _ISO.fullmatch(stripped)
        if iso:
            parsed = _valid(*map(int, iso.groups()))
            return done(OK_ISO, _fmt(xl_date)) if parsed == xl_date else done(FAIL_MISMATCH)
        match = _DMY.fullmatch(stripped)
        if not match:
            return done(FAIL_UNPARSEABLE)
        a, b, year = map(int, match.groups())
        as_day_first = _valid(year, b, a)
        as_month_first = _valid(year, a, b)
        if as_day_first is None and as_month_first is None:
            return done(FAIL_UNPARSEABLE)
        if as_day_first == xl_date:
            if as_month_first == xl_date and fmt_class == "month_first":
                return done(OK_MONTH_FIRST_INVARIANT, _fmt(xl_date), csv_valid_day_first=True)
            exact = stripped == _fmt(xl_date)
            return done(OK_DAY_FIRST if exact else OK_DAY_FIRST_REPADDED, _fmt(xl_date))
        if as_month_first == xl_date:
            if fmt_class == "month_first":
                return done(OK_MONTH_FIRST, _fmt(xl_date),
                            csv_valid_day_first=as_day_first is not None,
                            csv_day_first_reading=as_day_first.isoformat() if as_day_first else None)
            return done(FAIL_SWAP,
                        csv_day_first_reading=as_day_first.isoformat() if as_day_first else None)
        return done(FAIL_MISMATCH)

    # ---- Excel holds no true date ------------------------------------------------
    if cell.value is None or (isinstance(cell.value, str) and _is_blank_token(cell.value, blank_tokens) is not None):
        if csv_blank is None:
            if _DMY.fullmatch(stripped) or _ISO.fullmatch(stripped):
                return done(FAIL_CSV_ONLY)
            return done(FAIL_UNPARSEABLE)
        xl_token = "" if cell.value is None else _is_blank_token(cell.value, blank_tokens)
        if csv_blank == "" and xl_token == "":
            return done("BLANK")
        return done(OK_BLANK_EQUIVALENT, "", blank_token=csv_blank or xl_token)
    if csv_blank is not None:
        return done(FAIL_BLANK_CONFLICT)
    if isinstance(cell.value, str):
        match = _DMY.fullmatch(stripped)
        if match and cell.value.strip() == stripped:
            a, b, year = map(int, match.groups())
            as_day_first = _valid(year, b, a)
            if as_day_first is not None and (a > 12 or a == b):
                return done(OK_TEXT_UNAMBIGUOUS, _fmt(as_day_first))
            return done(FAIL_TEXT_AMBIGUOUS)
        if not match and not _ISO.fullmatch(stripped):
            return done(FAIL_UNPARSEABLE)
    return done(FAIL_EXCEL_NOT_DATE)


# --------------------------------------------------------------------------
# Readers (typed; no pandas, because pandas discards number formats and turns
# the text "NA" into NaN)
# --------------------------------------------------------------------------
def read_csv_table(raw: bytes) -> tuple[list[str], list[list[str]], str]:
    """Strict CSV read: every record must have exactly the header's field count."""
    last_error: Exception | None = None
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            text = raw.decode(encoding)
        except UnicodeDecodeError as exc:
            last_error = exc
            continue
        rows = list(csv.reader(io.StringIO(text, newline=""), strict=True))
        if not rows:
            raise ValueError("CSV is empty")
        header, body = rows[0], rows[1:]
        for number, row in enumerate(body, start=2):
            if len(row) != len(header):
                raise ValueError(
                    f"CSV record {number} has {len(row)} fields, header has {len(header)} (truncated or malformed)")
        return header, body, encoding
    raise ValueError(f"Unable to decode CSV: {last_error}")


def _cell_fmt_id(cell) -> int | None:
    for getter in (lambda c: c._style.numFmtId, lambda c: c.style_array.numFmtId):
        try:
            return int(getter(cell))
        except Exception:
            continue
    return None


def read_xlsx_table(raw: bytes, sheet: str | None = None,
                    required_headers: Iterable[str] = ("Ref ID",)) -> tuple[list[str], list[list[XCell]], str]:
    book = openpyxl.load_workbook(io.BytesIO(raw), data_only=True)
    required = {collapse_header(h) for h in required_headers}
    candidates = [book[sheet]] if sheet else list(book.worksheets)
    for worksheet in candidates:
        rows = worksheet.iter_rows()
        try:
            head = next(rows)
        except StopIteration:
            continue
        header = [c.value for c in head]
        while header and header[-1] is None:
            header.pop()
        if not required.issubset({collapse_header(h) for h in header}):
            continue
        width = len(header)
        body: list[list[XCell]] = []
        for row in rows:
            cells = [XCell(c.value, bool(c.is_date) and not isinstance(c.value, str) and c.value is not None,
                           c.number_format, _cell_fmt_id(c)) for c in row[:width]]
            cells += [XCell()] * (width - len(cells))
            if all(c.value is None for c in cells):
                continue  # wholly empty trailing row
            body.append(cells)
        return [str(h) if h is not None else "" for h in header], body, worksheet.title
    raise ValueError(f"No worksheet with headers {sorted(required)}; sheets={book.sheetnames}")


def _index(rows: list, ref_position: int, as_key: Callable, label: str,
           structural: list[str]) -> tuple[dict[str, list], list[str], list[dict]]:
    """Index rows by ref; keep one of a set of exactly identical rows; flag conflicts."""
    table: dict[str, list] = {}
    order: list[str] = []
    seen_rows: dict[str, list[int]] = defaultdict(list)
    duplicates: list[dict] = []
    for number, row in enumerate(rows, start=2):
        ref = clean_ref(as_key(row[ref_position]))
        if not ref:
            structural.append(f"{label}: record {number} has no Ref ID")
            continue
        seen_rows[ref].append(number)
        if ref in table:
            if [as_key(c) for c in row] != [as_key(c) for c in table[ref]]:
                structural.append(f"{label}: conflicting duplicate Ref ID {ref} (records {seen_rows[ref]})")
            continue
        table[ref] = row
        order.append(ref)
    for ref, numbers in seen_rows.items():
        if len(numbers) > 1:
            duplicates.append({"ref": ref, "records_1_based_including_header": numbers})
    return table, order, duplicates


# --------------------------------------------------------------------------
# The table-level rule
# --------------------------------------------------------------------------
def apply_rule(csv_header: list[str], csv_rows: list[list[str]],
               xl_header: list[str], xl_rows: list[list[XCell]], *,
               required_date_columns: Iterable[str] = (),
               date_columns: Iterable[str] | None = None,
               blank_tokens: Iterable[str] = DEFAULT_BLANK_TOKENS,
               as_of: date | None = None,
               future_ok_columns: Iterable[str] = (),
               ref_column: str = "Ref ID",
               normalise_header: Callable[[str], str] = collapse_header) -> DateRuleResult:
    """Reconcile every date column of two already-parsed tables.

    ``date_columns`` forces the set; otherwise it is ``required_date_columns``
    plus every column the Excel typing proves to be a date column.
    """
    result = DateRuleResult()
    blank_tokens = frozenset(t.casefold() for t in blank_tokens)
    c_names = [normalise_header(h) for h in csv_header]
    x_names = [normalise_header(h) for h in xl_header]
    for label, names in (("CSV", c_names), ("Excel", x_names)):
        dupes = [n for n, k in Counter(names).items() if k > 1]
        if dupes:
            result.structural_failures.append(f"{label}: duplicate headers after normalisation {dupes}")
    if c_names != x_names:
        result.structural_failures.append("CSV and Excel headers differ (names or order)")
    ref_name = normalise_header(ref_column)
    if ref_name not in c_names or ref_name not in x_names:
        result.structural_failures.append("Ref ID column missing")
        return result

    c_table, c_order, c_dupes = _index(csv_rows, c_names.index(ref_name), lambda v: v, "CSV",
                                       result.structural_failures)
    x_table, x_order, x_dupes = _index(xl_rows, x_names.index(ref_name),
                                       lambda c: c.value if isinstance(c, XCell) else c, "Excel",
                                       result.structural_failures)
    result.duplicates = {"csv": c_dupes, "xlsx": x_dupes}
    result.refs = c_order
    if set(c_table) != set(x_table):
        only_c, only_x = sorted(set(c_table) - set(x_table)), sorted(set(x_table) - set(c_table))
        result.structural_failures.append(
            f"CSV and Excel Ref ID sets differ: csv_only={only_c[:10]} ({len(only_c)}) xlsx_only={only_x[:10]} ({len(only_x)})")
    shared = [ref for ref in c_order if ref in x_table]
    x_pos = {name: i for i, name in enumerate(x_names)}
    c_pos = {name: i for i, name in enumerate(c_names)}

    required = [normalise_header(h) for h in required_date_columns]
    missing = [h for h in required if h not in x_pos or h not in c_pos]
    if missing:
        result.structural_failures.append(f"Required date columns missing: {missing}")

    # ---- which columns are date columns? ------------------------------------
    stray_columns: list[str] = []
    if date_columns is not None:
        chosen = [normalise_header(h) for h in date_columns]
    else:
        chosen = [h for h in required if h in x_pos and h in c_pos]
        for name in x_names:
            if name in chosen or name not in c_pos or name == ref_name:
                continue
            dates = other = implausible = 0
            for ref in shared:
                cell = x_table[ref][x_pos[name]]
                if cell.is_date:
                    d, has_time = _as_date(cell.value)
                    dates += 1
                    if d is None or d < EARLIEST_PLAUSIBLE or has_time:
                        implausible += 1
                elif cell.value is not None and not (
                        isinstance(cell.value, str) and _is_blank_token(cell.value, blank_tokens) is not None):
                    other += 1
            if dates and not other and not implausible:
                chosen.append(name)
            elif dates:
                stray_columns.append(name)
        chosen.sort(key=lambda h: x_pos.get(h, 10**9))
    result.date_columns = chosen

    # ---- the cells --------------------------------------------------------------
    future_ok = {normalise_header(h) for h in future_ok_columns}
    for name in chosen:
        if name not in x_pos or name not in c_pos:
            continue
        counts: Counter = Counter()
        blanks: Counter = Counter()
        for ref in shared:
            record = resolve_cell(c_table[ref][c_pos[name]], x_table[ref][x_pos[name]], blank_tokens)
            rule = record["rule"]
            counts[rule] += 1
            result.output[(ref, name)] = record["output"]
            if rule == "BLANK":
                continue
            record = {"ref": ref, "column": name, **record}
            result.provenance.append(record)
            if rule == OK_BLANK_EQUIVALENT:
                blanks[record["blank_token"]] += 1
            if rule.startswith("FAIL_"):
                result.failures.append(record)
                continue
            if record["output"]:
                value = datetime.strptime(record["output"], "%d/%m/%Y").date()
                if value < EARLIEST_PLAUSIBLE:
                    result.plausibility_flags.append({"ref": ref, "column": name, "value": record["output"],
                                                      "flag": "BEFORE_1900_03_01_EXCEL_SERIAL_ARTEFACT"})
                elif as_of is not None and value > as_of and name not in future_ok:
                    result.plausibility_flags.append({"ref": ref, "column": name, "value": record["output"],
                                                      "flag": "AFTER_AS_OF_DATE", "as_of": as_of.isoformat()})
        result.rule_counts[name] = dict(sorted(counts.items()))
        if blanks:
            result.blank_equivalent_counts[name] = dict(sorted(blanks.items()))

    # ---- date-typed cells sitting in columns that are not date columns ----------
    for name in stray_columns:
        for ref in shared:
            cell = x_table[ref][x_pos[name]]
            if not cell.is_date:
                continue
            d, has_time = _as_date(cell.value)
            result.stray_excel_dates.append({
                "ref": ref, "column": name, "csv_text": c_table[ref][c_pos[name]],
                "excel_value": str(cell.value), "excel_number_format": cell.number_format,
                "excel_num_fmt_id": cell.num_fmt_id,
                "likely_number_formatted_as_date": bool(d is None or d < EARLIEST_PLAUSIBLE or has_time),
                "action": "NOT_ALTERED_REPORTED_ONLY",
            })
    return result


def evaluate(csv_raw: bytes, xlsx_raw: bytes, *, sheet: str | None = None, **options) -> DateRuleResult:
    """Convenience wrapper: official bytes in, DateRuleResult out."""
    csv_header, csv_rows, _ = read_csv_table(csv_raw)
    xl_header, xl_rows, _ = read_xlsx_table(xlsx_raw, sheet=sheet)
    return apply_rule(csv_header, csv_rows, xl_header, xl_rows, **options)


def write_provenance_csv(result: DateRuleResult, path) -> None:
    columns = ["ref", "column", "csv_text", "excel_value", "excel_type", "excel_number_format",
               "excel_num_fmt_id", "excel_format_class", "rule", "output"]
    with open(path, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        writer.writerows(result.provenance)


def main(argv: list[str] | None = None) -> int:
    import argparse
    from pathlib import Path

    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("csv")
    parser.add_argument("xlsx")
    parser.add_argument("--out", help="directory for date_rule_summary.json and date_rule_provenance.csv")
    parser.add_argument("--as-of", help="yyyy-mm-dd; dates after it are flagged (not failed)")
    parser.add_argument("--require", action="append", default=[], help="column that must be a date column")
    parser.add_argument("--future-ok", action="append", default=[])
    args = parser.parse_args(argv)
    result = evaluate(Path(args.csv).read_bytes(), Path(args.xlsx).read_bytes(),
                      required_date_columns=args.require, future_ok_columns=args.future_ok,
                      as_of=date.fromisoformat(args.as_of) if args.as_of else None)
    report = result.summary()
    report["month_first_cell_list"] = result.month_first_cells
    report["failure_list"] = result.failures
    report["plausibility_flag_list"] = result.plausibility_flags
    report["stray_excel_date_list"] = result.stray_excel_dates
    if args.out:
        out = Path(args.out)
        out.mkdir(parents=True, exist_ok=True)
        (out / "date_rule_summary.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        write_provenance_csv(result, out / "date_rule_provenance.csv")
    print(json.dumps({k: v for k, v in report.items() if not k.endswith("_list") and k != "rule_counts_by_column"},
                     indent=2))
    return 0 if result.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
