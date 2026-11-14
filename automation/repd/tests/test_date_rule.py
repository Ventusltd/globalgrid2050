"""Unit tests of the general date rule (automation/repd/date_rule.py; ported from work8)."""
from __future__ import annotations

from datetime import date, datetime

import pytest

from conftest import COLUMNS, LOCALE_SHORT_DATE, MONTH_FIRST, base_rows, make_csv, make_xlsx

D = datetime(2026, 9, 11)


def xcell(rule, value=D, fmt=LOCALE_SHORT_DATE, fmt_id=14):
    return rule.XCell(value, isinstance(value, datetime), fmt, fmt_id)


@pytest.mark.parametrize("code,fmt_id,expected", [
    ("mm-dd-yy", 14, "locale_short_date"),         # built-in 14 is the system short date
    ("mm-dd-yy", None, "locale_short_date"),       # id unknown: stay conservative
    ("m/d/yy h:mm", 22, "locale_short_date"),
    ("m/d/yyyy", 164, "month_first"),
    ("mm/dd/yyyy", 170, "month_first"),
    ("[$-409]m/d/yy h:mm AM/PM;@", 171, "month_first"),
    ("dd/mm/yyyy;@", 165, "day_first"),
    ("[$-10452]dd/mm/yyyy;@", 166, "day_first"),
    ("d-mmm-yy", 15, "day_first"),
    ("yyyy-mm-dd", 172, "year_first"),
    ("General", 0, "not_date"),
    ("0.00", 2, "not_date"),
    ("h:mm:ss", 21, "not_date"),
])
def test_number_format_classification(rule, code, fmt_id, expected):
    assert rule.classify_number_format(code, fmt_id) == expected


def test_day_first_text_matches_typed_date(rule):
    r = rule.resolve_cell("11/09/2026", xcell(rule))
    assert (r["rule"], r["output"]) == (rule.OK_DAY_FIRST, "11/09/2026")


def test_unpadded_day_first_text_is_repadded(rule):
    r = rule.resolve_cell("1/9/2026", xcell(rule, datetime(2026, 9, 1)))
    assert (r["rule"], r["output"]) == (rule.OK_DAY_FIRST_REPADDED, "01/09/2026")


def test_month_first_text_needs_month_first_format(rule):
    ok = rule.resolve_cell("9/14/2026", xcell(rule, datetime(2026, 9, 14), MONTH_FIRST, 164))
    assert (ok["rule"], ok["output"], ok["csv_valid_day_first"]) == (rule.OK_MONTH_FIRST, "14/09/2026", False)
    bad = rule.resolve_cell("9/14/2026", xcell(rule, datetime(2026, 9, 14)))
    assert bad["rule"] == rule.FAIL_SWAP and bad["output"] == ""


def test_ambiguous_swap_is_corrected_only_with_month_first_format(rule):
    ok = rule.resolve_cell("09/11/2026", xcell(rule, D, MONTH_FIRST, 164))
    assert (ok["rule"], ok["output"]) == (rule.OK_MONTH_FIRST, "11/09/2026")
    assert ok["csv_valid_day_first"] is True and ok["csv_day_first_reading"] == "2026-11-09"
    for fmt, fmt_id in ((LOCALE_SHORT_DATE, 14), ("dd/mm/yyyy;@", 165)):
        assert rule.resolve_cell("09/11/2026", xcell(rule, D, fmt, fmt_id))["rule"] == rule.FAIL_SWAP


def test_month_first_format_with_day_equal_month_is_invariant(rule):
    r = rule.resolve_cell("09/09/2026", xcell(rule, datetime(2026, 9, 9), MONTH_FIRST, 164))
    assert (r["rule"], r["output"]) == (rule.OK_MONTH_FIRST_INVARIANT, "09/09/2026")


def test_day_first_text_under_month_first_format_is_accepted_as_day_first(rule):
    """A publisher who fixes the CSV but leaves the cell format must not be failed."""
    r = rule.resolve_cell("14/09/2026", xcell(rule, datetime(2026, 9, 14), MONTH_FIRST, 164))
    assert (r["rule"], r["output"]) == (rule.OK_DAY_FIRST, "14/09/2026")


def test_iso_text(rule):
    assert rule.resolve_cell("2026-09-11", xcell(rule))["rule"] == rule.OK_ISO
    assert rule.resolve_cell("2026-09-12", xcell(rule))["rule"] == rule.FAIL_MISMATCH


@pytest.mark.parametrize("text,expected", [
    ("12/09/2026", "FAIL_DIFFERENT_DATES"),
    ("11/09/2025", "FAIL_DIFFERENT_DATES"),
    ("eleven Sept", "FAIL_CSV_UNPARSEABLE"),
    ("31/02/2026", "FAIL_CSV_UNPARSEABLE"),
    ("11/09/26", "FAIL_CSV_UNPARSEABLE"),
    ("", "FAIL_EXCEL_DATE_CSV_BLANK"),
    ("NA", "FAIL_EXCEL_DATE_CSV_BLANK"),
])
def test_failures_against_a_typed_date(rule, text, expected):
    r = rule.resolve_cell(text, xcell(rule))
    assert r["rule"] == expected and r["output"] == ""


def test_time_component_is_not_silently_truncated(rule):
    r = rule.resolve_cell("11/09/2026", xcell(rule, datetime(2026, 9, 11, 12, 0)))
    assert r["rule"] == rule.FAIL_TIME


@pytest.mark.parametrize("csv_text,xl_value,token", [
    ("NA", "NA", "NA"), ("N/A", None, "N/A"), (" ", " ", "<whitespace>"), (" ", None, "<whitespace>"),
    ("", "na", "na"),
])
def test_blank_equivalents(rule, csv_text, xl_value, token):
    r = rule.resolve_cell(csv_text, rule.XCell(xl_value))
    assert (r["rule"], r["output"], r["blank_token"]) == (rule.OK_BLANK_EQUIVALENT, "", token)


def test_true_blank_is_not_a_provenance_event(rule):
    assert rule.resolve_cell("", rule.XCell(None))["rule"] == "BLANK"


def test_csv_date_with_blank_or_untyped_excel(rule):
    assert rule.resolve_cell("11/09/2026", rule.XCell(None))["rule"] == rule.FAIL_CSV_ONLY
    assert rule.resolve_cell("11/09/2026", rule.XCell(46276))["rule"] == rule.FAIL_EXCEL_NOT_DATE
    # text in both files: accepted only when no day/month reading is possible but one
    assert rule.resolve_cell("14/09/2026", rule.XCell("14/09/2026"))["rule"] == rule.OK_TEXT_UNAMBIGUOUS
    assert rule.resolve_cell("09/11/2026", rule.XCell("09/11/2026"))["rule"] == rule.FAIL_TEXT_AMBIGUOUS
    assert rule.resolve_cell("TBC", rule.XCell("TBC"))["rule"] == rule.FAIL_UNPARSEABLE


def test_table_rule_discovers_date_columns_and_month_first_cells_without_being_told(rule):
    rows = base_rows()
    rows[4]["Planning Application Submitted"] = date(2026, 9, 14)
    rows[5]["Planning Application Submitted"] = date(2026, 9, 11)
    csv_bytes = make_csv(rows, {(105, "Planning Application Submitted"): "9/14/2026",
                                (106, "Planning Application Submitted"): "09/11/2026"})
    xlsx_bytes = make_xlsx(rows, {(105, "Planning Application Submitted"): MONTH_FIRST,
                                  (106, "Planning Application Submitted"): MONTH_FIRST})
    result = rule.evaluate(csv_bytes, xlsx_bytes)            # no refs, no column names
    assert result.ok
    assert result.date_columns == ["Record Last Updated (dd/mm/yyyy)", "Planning Application Submitted",
                                   "Appeal Lodged"]
    assert [(c["ref"], c["output"]) for c in result.month_first_cells] == [("105", "14/09/2026"),
                                                                           ("106", "11/09/2026")]
    assert result.output[("101", "Planning Application Submitted")] == "21/08/2026"
    assert result.summary()["month_first_cells_also_valid_day_first"] == 1


def test_number_formatted_as_date_in_a_text_column_is_reported_not_treated_as_date_column(rule):
    """October's Offshore Wind Round: rounds 1-3 stored as numbers with a date format."""
    rows = base_rows()
    xlsx = make_xlsx(rows, overrides={(101, "Planning Authority"): datetime(1900, 1, 2)})
    result = rule.evaluate(make_csv(rows, {(101, "Planning Authority"): "02/01/1900"}), xlsx)
    assert "Planning Authority" not in result.date_columns
    assert [(s["ref"], s["column"], s["likely_number_formatted_as_date"]) for s in result.stray_excel_dates] == [
        ("101", "Planning Authority", True)]
    assert result.ok


def test_required_date_column_holding_text_fails(rule):
    rows = base_rows()
    result = rule.evaluate(make_csv(rows, {(103, "Operational"): "pending"}),
                           make_xlsx(rows, overrides={(103, "Operational"): "pending"}),
                           required_date_columns=["Operational"])
    assert not result.ok and result.failures[0]["rule"] == rule.FAIL_UNPARSEABLE


def test_structural_failures(rule):
    rows = base_rows()
    assert any("Ref ID sets differ" in m for m in
               rule.evaluate(make_csv(rows), make_xlsx(rows[:-1])).structural_failures)
    reordered = COLUMNS[:3] + [COLUMNS[4], COLUMNS[3]] + COLUMNS[5:]
    assert any("headers differ" in m for m in
               rule.evaluate(make_csv(rows), make_xlsx(rows, columns=reordered)).structural_failures)
    clash = dict(rows[2]); clash["Site Name"] = "other"
    assert any("conflicting duplicate" in m for m in
               rule.evaluate(make_csv(rows + [clash]), make_xlsx(rows + [clash])).structural_failures)
    same = rule.evaluate(make_csv(rows + [dict(rows[2])]), make_xlsx(rows + [dict(rows[2])]))
    assert same.ok and same.duplicates["csv"][0]["ref"] == "103" and len(same.refs) == 6


def test_strict_csv_reader_refuses_short_record(rule):
    data = make_csv(base_rows())
    with pytest.raises(ValueError, match="fields"):
        rule.read_csv_table(data + b",107,08/10/2026\r\n")


def test_future_and_serial_artefact_flags_do_not_fail(rule):
    rows = base_rows()
    rows[0]["Planning Permission  Granted"] = date(2026, 12, 15)
    rows[1]["Planning Permission Expired"] = date(2029, 12, 15)
    result = rule.evaluate(make_csv(rows), make_xlsx(rows), as_of=date(2026, 11, 13),
                           future_ok_columns=["Planning Permission Expired"])
    assert result.ok
    assert [(f["ref"], f["column"], f["flag"]) for f in result.plausibility_flags] == [
        ("101", "Planning Permission Granted", "AFTER_AS_OF_DATE")]


def test_provenance_records_every_non_empty_cell(rule, tmp_path):
    rows = base_rows()
    result = rule.evaluate(make_csv(rows), make_xlsx(rows))
    # 6 last-updated + 6 submitted + 1 appeal lodged
    assert len(result.provenance) == 13
    assert {p["rule"] for p in result.provenance} == {rule.OK_DAY_FIRST}
    rule.write_provenance_csv(result, tmp_path / "p.csv")
    assert (tmp_path / "p.csv").read_text(encoding="utf-8").count("\n") == 14
