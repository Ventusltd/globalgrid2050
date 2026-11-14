"""Tests of the cleaning step (automation/repd/clean.py) on small synthetic fixtures."""
from __future__ import annotations

import csv
import io
import json
from datetime import datetime

import pytest

from conftest import COLUMNS, MONTH_FIRST, base_rows, make_csv, make_xlsx

PAS = "Planning Application Submitted"
OWR = "Offshore Wind Round"
CAP = "Installed Capacity (MWelec)"


def run(cl, csv_bytes, xlsx_bytes, **opts):
    return cl.clean(csv_bytes, xlsx_bytes, cl.CleanOptions(**opts))


def read_out(result):
    text = result.csv_bytes.decode("utf-8")
    rows = list(csv.reader(io.StringIO(text, newline="")))
    return rows[0], rows[1:]


def cell(result, ref, column):
    header, rows = read_out(result)
    i = header.index(column)
    r = header.index("Ref ID")
    return next(row[i] for row in rows if row[r] == str(ref))


# ---- baseline -------------------------------------------------------------------------------
def test_clean_release_has_no_changes_and_verifies(cl):
    rows = base_rows()
    res = run(cl, make_csv(rows), make_xlsx(rows))
    assert res.log["status"] == "CLEANED"
    assert res.log["cells_changed_distinct"] == 0
    assert all(n == 0 for n in res.log["counts"].values())
    assert res.log["verification"]["ok"] and res.log["verification"]["unexplained_differences"] == 0
    assert len(res.log["date_columns"]) == 16


def test_output_encoding_order_and_terminators(cl):
    rows = base_rows()
    rows[0]["Site Name"] = "Café – Ørsted site"      # cp1252-representable
    res = run(cl, make_csv(rows), make_xlsx(rows))
    assert not res.csv_bytes.startswith(b"\xef\xbb\xbf")
    assert b"\r" not in res.csv_bytes and res.csv_bytes.endswith(b"\n")
    header, out = read_out(res)
    assert header == COLUMNS                     # official order and header text kept verbatim
    assert cell(res, 101, "Site Name") == "Café – Ørsted site"
    assert len(out) == 6


def test_normalise_headers_is_opt_in_and_logged(cl):
    rows = base_rows()
    res = run(cl, make_csv(rows), make_xlsx(rows), normalise_headers=True)
    header, _ = read_out(res)
    assert "Planning Permission Granted" in header and "Are they re-applying (Old REPD Ref)" in header
    assert res.log["counts"]["header_whitespace_normalised"] == 2


# ---- duplicates -----------------------------------------------------------------------------
def test_identical_duplicate_kept_once_and_logged(cl):
    rows = base_rows()
    rows.insert(3, dict(rows[2]))
    res = run(cl, make_csv(rows), make_xlsx(rows))
    _, out = read_out(res)
    assert len(out) == 6
    assert res.log["counts"]["identical_duplicate_row_removed"] == 1
    assert res.log["changes_by_kind"]["identical_duplicate_row_removed"][0] == {
        "ref": "103", "csv_record": 4, "kept_csv_record": 3, "kinds": ["identical_duplicate_row_removed"]}
    assert res.log["verification"]["ok"]


def test_conflicting_duplicate_rejects(cl):
    rows = base_rows()
    dup = dict(rows[2]); dup["Site Name"] = "Different"
    rows.insert(3, dup)
    with pytest.raises(cl.CleaningRejected, match="conflicting duplicate Ref ID 103"):
        run(cl, make_csv(rows), make_xlsx(rows))


def test_duplicate_differing_only_in_whitespace_is_conflicting(cl):
    rows = base_rows()
    rows.insert(3, dict(rows[2]))
    csv_b = make_csv(rows)
    # second occurrence of ref 103 gets a trailing space in Site Name (raw text differs)
    csv_b = csv_b.replace(b"Site 3,", b"Site 3 ,", 2).replace(b"Site 3 ,", b"Site 3,", 1)
    with pytest.raises(cl.CleaningRejected, match="conflicting duplicate"):
        run(cl, csv_b, make_xlsx(rows))


def test_duplicate_count_must_match_workbook(cl):
    rows = base_rows()
    with_dup = rows[:3] + [dict(rows[2])] + rows[3:]
    with pytest.raises(cl.CleaningRejected, match="different number of times"):
        run(cl, make_csv(with_dup), make_xlsx(rows))


def test_ref_sets_differ_rejects(cl):
    rows = base_rows()
    with pytest.raises(cl.CleaningRejected, match="Ref ID sets differ"):
        run(cl, make_csv(rows), make_xlsx(rows[:-1]))


def test_blank_ref_rejects(cl):
    rows = base_rows()
    with pytest.raises(cl.CleaningRejected, match="blank Ref ID"):
        run(cl, make_csv(rows, overrides={(102, "Ref ID"): ""}), make_xlsx(rows))


# ---- dates ----------------------------------------------------------------------------------
def test_month_first_csv_corrected_from_typed_excel_date(cl):
    rows = base_rows()
    rows[1][PAS] = datetime(2026, 9, 11)
    csv_b = make_csv(rows, overrides={(102, PAS): "09/11/2026"})     # month-first text
    res = run(cl, csv_b, make_xlsx(rows, formats={(102, PAS): MONTH_FIRST}))
    assert cell(res, 102, PAS) == "11/09/2026"
    assert res.log["counts"]["date_month_first_corrected"] == 1
    entry = res.log["changes_by_kind"]["date_month_first_corrected"][0]
    assert (entry["ref"], entry["before"], entry["after"]) == ("102", "09/11/2026", "11/09/2026")


def test_month_first_in_an_appeal_column_is_also_handled(cl):
    """H1: all 16 date columns are reconciled, not only the classic 7/8."""
    rows = base_rows()
    rows[1]["Appeal Lodged"] = datetime(2026, 1, 11)
    csv_b = make_csv(rows, overrides={(102, "Appeal Lodged"): "1/11/2026"})
    res = run(cl, csv_b, make_xlsx(rows, formats={(102, "Appeal Lodged"): MONTH_FIRST}))
    assert cell(res, 102, "Appeal Lodged") == "11/01/2026"


def test_swap_without_month_first_format_rejects(cl):
    rows = base_rows()
    rows[1]["Appeal Lodged"] = datetime(2006, 11, 1)
    csv_b = make_csv(rows, overrides={(102, "Appeal Lodged"): "11/01/2006"})
    with pytest.raises(cl.CleaningRejected, match="DAY_MONTH_SWAP"):
        run(cl, csv_b, make_xlsx(rows))


def test_unparseable_date_rejects(cl):
    rows = base_rows()
    with pytest.raises(cl.CleaningRejected, match="UNPARSEABLE"):
        run(cl, make_csv(rows, overrides={(101, PAS): "21st Aug"}), make_xlsx(rows))


def test_na_blanked_only_in_date_columns_and_counted(cl):
    rows = base_rows()
    csv_b = make_csv(rows, overrides={(101, "Operational"): "NA", (102, "Judicial Review"): "  ",
                                      (103, "Storage Co-location REPD Ref ID"): "NA",
                                      (104, "Planning Application Reference"): "NA"})
    xlsx_b = make_xlsx(rows, overrides={(101, "Operational"): "NA",
                                        (103, "Storage Co-location REPD Ref ID"): "NA",
                                        (104, "Planning Application Reference"): "NA"})
    res = run(cl, csv_b, xlsx_b)
    assert cell(res, 101, "Operational") == ""
    assert cell(res, 102, "Judicial Review") == ""
    assert cell(res, 103, "Storage Co-location REPD Ref ID") == "NA"
    assert cell(res, 104, "Planning Application Reference") == "NA"
    assert res.log["counts"]["date_na_text_blanked"] == 1
    assert res.log["counts"]["date_whitespace_blanked"] == 1
    assert res.log["observations"]["na_text_preserved_outside_date_columns"] == {
        "Planning Application Reference": 1, "Storage Co-location REPD Ref ID": 1}


def test_all_date_cells_strict_dd_mm_yyyy(cl):
    rows = base_rows()
    csv_b = make_csv(rows, overrides={(101, PAS): "21/8/2026", (103, PAS): "2026-08-23"})
    res = run(cl, csv_b, make_xlsx(rows))
    assert cell(res, 101, PAS) == "21/08/2026" and cell(res, 103, PAS) == "23/08/2026"
    assert res.log["counts"]["date_text_normalised"] == 2


# ---- whitespace -----------------------------------------------------------------------------
def test_edge_control_whitespace_trimmed_and_breaks_replaced(cl):
    rows = base_rows()
    over = {(101, "Planning Application Reference"): "26/01/FUL\n",
            (102, "Post Code"): "SY2 1AA\n\n ",
            (103, "Site Name"): "Site 3 \r",
            (104, "Site Name"): "Rassau Estate\n, Rassau - Biomass",
            (105, "Operator (or Applicant)"): "\tOperator 5\r\nLtd",
            (106, "Site Name"): "Site 6   "}                        # plain spaces: untouched
    res = run(cl, make_csv(rows, overrides=over), make_xlsx(rows))
    assert cell(res, 101, "Planning Application Reference") == "26/01/FUL"
    assert cell(res, 102, "Post Code") == "SY2 1AA"
    assert cell(res, 103, "Site Name") == "Site 3"
    assert cell(res, 104, "Site Name") == "Rassau Estate , Rassau - Biomass"
    assert cell(res, 105, "Operator (or Applicant)") == "Operator 5 Ltd"
    assert cell(res, 106, "Site Name") == "Site 6   "
    assert res.log["counts"]["edge_control_whitespace_trimmed"] == 4
    assert res.log["counts"]["embedded_line_break_replaced"] == 2
    assert res.log["cells_changed_distinct"] == 5
    assert res.log["verification"]["cells_differing_from_official"] == 5


def test_whitespace_only_cells_outside_dates_are_kept(cl):
    rows = base_rows()
    res = run(cl, make_csv(rows, overrides={(101, "Old Ref ID"): "   ", (102, CAP): " "}), make_xlsx(rows,
              overrides={(102, CAP): None}))
    assert cell(res, 101, "Old Ref ID") == "   "
    assert cell(res, 102, CAP) == " "
    assert res.log["observations"]["whitespace_only_cells_preserved_total"] == 2


# ---- capacity -------------------------------------------------------------------------------
def test_capacity_kept_as_csv_text_by_default(cl):
    rows = base_rows()
    csv_b = make_csv(rows, overrides={(101, CAP): "49.90", (102, CAP): "0.67"})
    xlsx_b = make_xlsx(rows, overrides={(102, CAP): 0.666667})
    res = run(cl, csv_b, xlsx_b)
    assert cell(res, 101, CAP) == "49.90" and cell(res, 102, CAP) == "0.67"
    assert res.log["counts"]["capacity_excel_precision"] == 0
    xc = res.log["observations"]["csv_vs_xlsx_non_date_columns"]
    assert xc["by_column"][CAP] == {"numeric_rounded_in_csv": 1, "numeric_equal_text_differs": 1}


def test_capacity_excel_precision_flag(cl):
    rows = base_rows()
    csv_b = make_csv(rows, overrides={(102, CAP): "0.67"})
    xlsx_b = make_xlsx(rows, overrides={(102, CAP): 0.666667})
    res = run(cl, csv_b, xlsx_b, capacity_source="excel")
    assert cell(res, 102, CAP) == "0.666667"
    assert cell(res, 101, CAP) == "49.9"
    assert res.log["counts"]["capacity_excel_precision"] == 1


def test_capacity_excel_flag_rejects_disagreement(cl):
    rows = base_rows()
    with pytest.raises(cl.CleaningRejected, match="capacity"):
        run(cl, make_csv(rows, overrides={(102, CAP): "12"}), make_xlsx(rows), capacity_source="excel")


# ---- numbers stored as dates ------------------------------------------------------------------
def test_offshore_wind_round_restored_from_excel_number(cl):
    rows = base_rows()
    over_x = {(101, OWR): 1, (102, OWR): 2.5, (103, OWR): 3}
    fmts = {k: "dd/mm/yyyy" for k in over_x}
    csv_b = make_csv(rows, overrides={(101, OWR): "01/01/1900", (102, OWR): "02/01/1900",
                                      (103, OWR): "03/01/1900"})
    res = run(cl, csv_b, make_xlsx(rows, overrides=over_x, formats=fmts))
    assert [cell(res, r, OWR) for r in (101, 102, 103)] == ["1", "2.5", "3"]
    assert res.log["counts"]["number_stored_as_date_restored"] == 3
    assert OWR not in res.log["date_columns"]


def test_number_stored_as_date_with_unexpected_csv_text_rejects(cl):
    rows = base_rows()
    xlsx_b = make_xlsx(rows, overrides={(101, OWR): 2}, formats={(101, OWR): "dd/mm/yyyy"})
    with pytest.raises(cl.CleaningRejected, match="not its date rendering"):
        run(cl, make_csv(rows, overrides={(101, OWR): "1/2/1900"}), xlsx_b)


# ---- integrity ------------------------------------------------------------------------------
def test_expected_sha256_mismatch_rejects(cl):
    rows = base_rows()
    with pytest.raises(cl.CleaningRejected, match="sha256"):
        run(cl, make_csv(rows), make_xlsx(rows), expected_csv_sha256="0" * 64)


def test_truncated_last_record_rejects(cl):
    rows = base_rows()
    csv_b = make_csv(rows).rstrip(b"\r\n")
    csv_b = csv_b[: csv_b.rfind(b"\r\n")] + b"\r\n,106,08/10/2026\r\n"
    with pytest.raises(cl.CleaningRejected, match="CSV unreadable"):
        run(cl, csv_b, make_xlsx(rows))


def test_verifier_catches_an_unlogged_change(cl):
    rows = base_rows()
    csv_b = make_csv(rows, overrides={(101, "Site Name"): "Site 1\n"})
    res = run(cl, csv_b, make_xlsx(rows))
    tampered = res.csv_bytes.replace(b"Site 2", b"Site X")
    v = cl.verify_against_official(csv_b, tampered, res.log)
    assert not v["ok"] and v["unexplained_differences"] == 1
    # and a logged change that did not happen is also caught
    log = json.loads(json.dumps(res.log))
    log["changes_by_kind"]["edge_control_whitespace_trimmed"][0]["after"] = "Other"
    assert not cl.verify_against_official(csv_b, res.csv_bytes, log)["ok"]


def test_clean_is_deterministic(cl):
    rows = base_rows()
    csv_b, xlsx_b = make_csv(rows, overrides={(101, "Site Name"): "Site 1\r"}), make_xlsx(rows)
    a, b = run(cl, csv_b, xlsx_b), run(cl, csv_b, xlsx_b)
    assert a.csv_bytes == b.csv_bytes and a.log == b.log


# ---- CLI and hash manifest ------------------------------------------------------------------
def _write_inputs(tmp_path, csv_b, xlsx_b):
    src = tmp_path / "official"
    src.mkdir()
    (src / "R.csv").write_bytes(csv_b)
    (src / "R.xlsx").write_bytes(xlsx_b)
    return src


def test_cli_writes_outputs_and_hash_manifest(cl, tmp_path):
    rows = base_rows()
    src = _write_inputs(tmp_path, make_csv(rows, overrides={(101, "Site Name"): "Site 1\n"}), make_xlsx(rows))
    out = tmp_path / "out"
    code = cl.main(["--csv", str(src / "R.csv"), "--xlsx", str(src / "R.xlsx"), "--out", str(out),
                    "--output-name", "C.csv", "--protect", str(src), "--generated-at", "2026-11-13T00:00:00Z"])
    assert code == 0
    log = json.loads((out / "cleaning_log.json").read_text())
    assert log["status"] == "CLEANED" and log["hash_manifest"]["ok"]
    assert len(log["hash_manifest"]["before"]) == 2
    assert (out / "C.csv").read_bytes().startswith(b"Old Ref ID,Ref ID")
    assert "SELF-VERIFICATION" in (out / "CLEANING-LOG.txt").read_text()
    # second run refuses to overwrite
    assert cl.main(["--csv", str(src / "R.csv"), "--xlsx", str(src / "R.xlsx"), "--out", str(out),
                    "--output-name", "C.csv"]) == 2


def test_cli_rejection_writes_log_and_no_csv(cl, tmp_path):
    rows = base_rows()
    src = _write_inputs(tmp_path, make_csv(rows), make_xlsx(rows[:-1]))
    out = tmp_path / "out"
    code = cl.main(["--csv", str(src / "R.csv"), "--xlsx", str(src / "R.xlsx"), "--out", str(out)])
    assert code == 1
    log = json.loads((out / "cleaning_log.json").read_text())
    assert log["status"] == "REJECTED" and any("Ref ID sets differ" in r for r in log["reasons"])
    assert not (out / "REPD_cleaned.csv").exists()


def test_cli_refuses_out_inside_protected_dir(cl, tmp_path):
    rows = base_rows()
    src = _write_inputs(tmp_path, make_csv(rows), make_xlsx(rows))
    assert cl.main(["--csv", str(src / "R.csv"), "--xlsx", str(src / "R.xlsx"), "--out", str(src / "o")]) == 2


def test_hash_manifest_detects_change(cl, tmp_path):
    f = tmp_path / "a.txt"
    f.write_text("x")
    before = cl.hash_paths([tmp_path])
    f.write_text("y")
    diffs = cl.manifest_diff(before, cl.hash_paths([tmp_path]))
    assert len(diffs) == 1 and diffs[0]["path"].endswith("a.txt")


def test_whitespace_all_option_trims_spaces_and_blanks_whitespace_only(cl):
    rows = base_rows()
    over = {(101, "Old Ref ID"): "   ", (102, "Site Name"): "Site 2 \u00a0", (103, "Site Name"): "Site 3\n",
            (104, CAP): " "}
    res = run(cl, make_csv(rows, overrides=over), make_xlsx(rows, overrides={(104, CAP): None}),
              whitespace="all")
    assert cell(res, 101, "Old Ref ID") == "" and cell(res, 104, CAP) == ""
    assert cell(res, 102, "Site Name") == "Site 2" and cell(res, 103, "Site Name") == "Site 3"
    c = res.log["counts"]
    assert (c["whitespace_only_cell_blanked"], c["edge_space_trimmed"], c["edge_control_whitespace_trimmed"]) == (2, 1, 1)
    assert res.log["verification"]["ok"]
