"""Synthetic-fixture tests for acceptance.py (no network, no real data needed).

A tiny official CSV + XLSX pair is built with one instance of every documented change
class; a correct candidate must pass every check, and each kind of real damage seen in
the January 2026 files (mojibake, bare CR, broken records, missing rows, re-formatted
numbers, month-first dates left in place, GeoJSON drift) must make the matching check fail.

Optional real-data check: set REPD_JAN_DIR to a globalgrid2050 checkout to assert that the
January root files fail the expected checks.
"""
from __future__ import annotations

import csv
import datetime as dt
import io
import json
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import acceptance as A  # noqa: E402

openpyxl = pytest.importorskip("openpyxl")
pytest.importorskip("pyproj")

H = A.OFFICIAL_HEADER
IX = {A.norm_header(h): i for i, h in enumerate(H)}


def blank():
    return [""] * len(H)


def setv(row, col, v):
    row[IX[A.norm_header(col)]] = v


# ref, tech, short status, capacity CSV, capacity XLSX, mounting, X, Y, site name
BASE = [
    ("1", "Battery", "Operational", "50", 50, "", "530000", "180000", "Ørsted Battery"),
    ("2", "Battery", "Refused", "20", 20, "", "400000", "300000", "Refused Battery"),
    ("3", "Solar Photovoltaics", "Operational", "5.20", 5.2, "Ground", "450000", "250000", "Big Solar"),
    ("4", "Solar Photovoltaics", "Operational", "2.00", 2, "Roof", "", "", "Roof Solar No Coords"),
    ("5", "Solar Photovoltaics", "Operational", "0.37", 0.365, "Ground", "460000", "260000", "Small Solar"),
    ("6", "Wind Offshore", "Application Submitted", "", None, "", "600000", "400000", "Sea Wind"),
    ("7", "Battery", "Application Submitted", "100", 100, "", "350000", "350000", "Bat\xa0Seven "),
]


def make_official():
    rows = []
    for ref, tech, st, cap, _x, mnt, x, y, name in BASE:
        r = blank()
        for c, v in (("Ref ID", ref), ("Technology Type", tech), ("Development Status (short)", st),
                     ("Development Status", st), ("Installed Capacity (MWelec)", cap), ("Mounting Type for Solar", mnt),
                     ("X-coordinate", x), ("Y-coordinate", y), ("Site Name", name),
                     ("Operator (or Applicant)", "Op " + ref), ("Record Last Updated (dd/mm/yyyy)", "01/10/2026"),
                     ("Address", "Road " + ref)):
            setv(r, c, v)
        rows.append(r)
    # change-class material
    setv(rows[0], "Planning Application Submitted", "9/14/2026")   # month-first, Excel m/d/yyyy
    setv(rows[1], "Operational", "NA")                               # NA in date column
    setv(rows[2], "Address", "Line one\nLine two")                   # embedded line break
    setv(rows[5], "Offshore Wind Round", "03/01/1900")               # number stored as date
    setv(rows[2], "Planning Application Reference", "NA")            # NA in text column
    return rows


def make_cleaned(off_rows):
    rows = [list(r) for r in off_rows]
    setv(rows[0], "Planning Application Submitted", "14/09/2026")
    setv(rows[1], "Operational", "")
    setv(rows[2], "Address", "Line one Line two")
    setv(rows[5], "Offshore Wind Round", "3")
    setv(rows[2], "Planning Application Reference", "")
    setv(rows[4], "Installed Capacity (MWelec)", "0.365")             # XLSX precision
    setv(rows[6], "Site Name", "Bat Seven")                           # NBSP + trailing space
    return rows


def write_csv(path, header, rows, enc="utf-8", term="\n"):
    buf = io.StringIO(newline="")
    w = csv.writer(buf, lineterminator=term)
    w.writerow(header)
    w.writerows(rows)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(buf.getvalue().encode(enc))


def write_xlsx(path, off_rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "REPD"
    ws.append(H)
    for i, r in enumerate(off_rows):
        vals = list(r)
        vals[IX["Ref ID"]] = int(r[IX["Ref ID"]])
        cap = BASE[i][4]
        vals[IX["Installed Capacity (MWelec)"]] = cap
        vals[IX["Record Last Updated (dd/mm/yyyy)"]] = dt.datetime(2026, 10, 1)
        vals[IX["Planning Application Submitted"]] = None
        vals[IX["Offshore Wind Round"]] = None
        vals = [None if v == "" else v for v in vals]
        ws.append(vals)
        rown = ws.max_row
        c = ws.cell(row=rown, column=IX["Record Last Updated (dd/mm/yyyy)"] + 1)
        c.number_format = "mm-dd-yy"
        if i == 0:
            c = ws.cell(row=rown, column=IX["Planning Application Submitted"] + 1, value=dt.datetime(2026, 9, 14))
            c.number_format = "m/d/yyyy"
        if i == 5:
            c = ws.cell(row=rown, column=IX["Offshore Wind Round"] + 1, value=dt.datetime(1900, 1, 3))
            c.number_format = "mm-dd-yy"
    wb.save(path)


def solar_op_rows(rows):
    sel = [IX[A.norm_header(h)] for h in A.SOLAR_OP_HEADER]
    return [[r[i] for i in sel] for r in rows]


def build(tmp_path, damage=None):
    """Write a complete, correct candidate; damage(dict of paths/rows) may alter it before writing."""
    off = make_official()
    cl = make_cleaned(off)
    d = {"off": off, "cleaned": cl, "full": [list(r) for r in cl]}
    g = lambda r, c: r[IX[c]]  # noqa: E731
    d["batteries"] = [list(r) for r in cl if g(r, "Technology Type") == "Battery"
                      and g(r, "Development Status (short)") in A.BATTERY_STATUSES]
    sol = [r for r in cl if g(r, "Technology Type") == A.SOLAR and g(r, "Development Status (short)") == "Operational"]
    d["solar_op"] = solar_op_rows([r for r in sol if (A.to_float(g(r, "Installed Capacity (MWelec)")) or 0) > 1
                                   and g(r, "Mounting Type for Solar") in ("Ground", "Roof")])
    d["over4"] = [list(r) for r in sol if (A.to_float(g(r, "Installed Capacity (MWelec)")) or 0) > 4]
    d["solar_op_header"] = list(A.SOLAR_OP_HEADER)
    d["full_enc"] = "utf-8"
    d["raw_patch"] = {}
    if damage:
        damage(d)
    p = {
        "official_csv": tmp_path / "official.csv", "official_xlsx": tmp_path / "official.xlsx",
        "cleaned": tmp_path / "cleaned.csv", "root": tmp_path / "root", "baseline": tmp_path / "baseline.json",
    }
    write_csv(p["official_csv"], H, d["off"], enc="cp1252", term="\r\n")
    write_xlsx(p["official_xlsx"], d["off"])
    write_csv(p["cleaned"], H, d["cleaned"])
    root = p["root"]
    write_csv(root / "repd-2026q3.csv", H, d["full"], enc=d["full_enc"])
    write_csv(root / "bat.csv", H, d["batteries"])
    write_csv(root / "solar.csv", d["solar_op_header"], d["solar_op"])
    write_csv(root / "over4.csv", H, d["over4"])
    for name, (old, new) in d["raw_patch"].items():
        f = root / name
        f.write_bytes(f.read_bytes().replace(old, new, 1))
    cleaned_file = A.read_csv(p["cleaned"])
    exp, _ = A.expected_master(cleaned_file)
    feats = [{"type": "Feature", "properties": {"repd_ref": k, "name": "x", "capacity": 0.0},
              "geometry": {"type": "Point", "coordinates": list(v)}} for k, v in exp.items()]
    if "master_patch" in d:
        feats = d["master_patch"](feats)
    (root / "dist").mkdir(parents=True, exist_ok=True)
    (root / "dist" / "m.json").write_text(json.dumps({"type": "FeatureCollection", "features": feats}))
    p["baseline"].write_text(json.dumps({"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"name": "a", "capacity": 1.0}, "geometry": {"type": "Point",
                                                                                     "coordinates": [0, 51]}}]}))
    return p


def cfg(p, **kw):
    base = dict(official_csv=p["official_csv"], official_xlsx=p["official_xlsx"], cleaned=p["cleaned"],
                root_dir=p["root"], full="repd-2026q3.csv", batteries="bat.csv", solar_op="solar.csv",
                over4="over4.csv", master="dist/m.json", baseline_master=p["baseline"], expect_month_first=1)
    base.update(kw)
    return A.Config(**base)


def failed(rep):
    return sorted(c.id for c in rep.failed)


# ------------------------------------------------------------------ good candidate

def test_correct_candidate_passes_everything(tmp_path):
    rep = A.run(cfg(build(tmp_path)))
    assert failed(rep) == [], rep.text()
    c = rep.checks["cleaned.cells_classified"].details["counts"]
    assert c == {"month_first_date": 1, "na_date": 1, "embedded_line_break": 1, "number_as_date": 1,
                 "na_text": 1, "xlsx_precision": 1, "whitespace_control": 1}
    assert rep.checks["master.features"].details["expected"] == 5  # refs 1,3,5,6,7 (2 refused, 4 no coords)
    assert not any(c.status == "SKIP" for c in rep.checks.values())
    assert set(rep.checks) == set(A.CHECK_IDS)


def test_without_xlsx_xlsx_classes_fail_closed(tmp_path):
    rep = A.run(cfg(build(tmp_path), official_xlsx=None))
    assert "cleaned.cells_classified" in failed(rep)
    un = rep.checks["cleaned.cells_classified"].details["unclassified"]
    assert {u[1] for u in un} == {"Planning Application Submitted", "Installed Capacity (MWelec)"}
    assert rep.checks["cleaned.month_first_corrected"].status == "SKIP"


def test_disallowed_class_fails(tmp_path):
    rep = A.run(cfg(build(tmp_path), allowed=A.DEFAULT_ALLOWED - {"na_text"}))
    assert failed(rep) == ["cleaned.cells_classified"]


# ------------------------------------------------------------------ damage that must be detected

def test_missing_and_duplicated_refs(tmp_path):
    def dmg(d):
        d["cleaned"] = d["cleaned"][1:] + [d["cleaned"][2]]
    rep = A.run(cfg(build(tmp_path, dmg)))
    det = rep.checks["cleaned.refs_exactly_once"].details
    assert det["missing"] == ["1"] and det["repeated"] == {"3": 2}


def test_unclassified_value_change(tmp_path):
    def dmg(d):
        setv(d["cleaned"][2], "Installed Capacity (MWelec)", "6.20")
        d["full"] = [list(r) for r in d["cleaned"]]
    rep = A.run(cfg(build(tmp_path, dmg)))
    assert "cleaned.cells_classified" in failed(rep)
    assert rep.checks["cleaned.cells_classified"].details["unclassified"][0][:2] == ("3", "Installed Capacity (MWelec)")


def test_month_first_left_or_blanked(tmp_path):
    def dmg(d):
        setv(d["cleaned"][0], "Planning Application Submitted", "")  # quarantined instead of corrected
        d["full"] = [list(r) for r in d["cleaned"]]
    rep = A.run(cfg(build(tmp_path, dmg)))
    assert {"cleaned.month_first_corrected", "cleaned.cells_classified"} <= set(failed(rep))


def test_mojibake_in_subset(tmp_path):
    def dmg(d):
        setv(d["batteries"][0], "Site Name", "Ørsted Battery".encode("utf-8").decode("latin-1"))
    rep = A.run(cfg(build(tmp_path, dmg)))
    assert set(failed(rep)) == {"batteries.no_mojibake", "batteries.filter"}
    named = rep.checks["batteries.no_mojibake"].details["named"]
    assert named and named[0][2] == "Ørsted Battery"


def test_non_utf8_full_file(tmp_path):
    def dmg(d):
        d["full_enc"] = "cp1252"
    rep = A.run(cfg(build(tmp_path, dmg)))
    assert failed(rep) == ["full.utf8"]


def test_bare_cr_and_broken_records(tmp_path):
    # a line-based tool split a multi-line address: the record is cut in two
    def dmg(d):
        d["batteries"][0][IX["Address"]] = "Road 1"
        d["raw_patch"]["bat.csv"] = (b"Road 1", b"Road\r1")
    rep = A.run(cfg(build(tmp_path, dmg)))
    f = set(failed(rep))
    assert {"batteries.no_bare_cr", "batteries.field_count", "batteries.filter"} <= f


def test_embedded_line_break_left_in_output(tmp_path):
    def dmg(d):
        setv(d["over4"][0], "Address", "Line one\nLine two")
    rep = A.run(cfg(build(tmp_path, dmg)))
    assert {"over4.no_embedded_breaks", "over4.filter"} <= set(failed(rep))


def test_subset_missing_row_and_reformatted_numbers(tmp_path):
    def dmg(d):
        d["batteries"] = d["batteries"][:-1]
        d["over4"][0][IX["Installed Capacity (MWelec)"]] = "5.2"  # pandas float re-serialisation of 5.20
    rep = A.run(cfg(build(tmp_path, dmg)))
    assert rep.checks["batteries.filter"].details["missing"] == ["7"]
    assert rep.checks["over4.filter"].details["numeric_reformatted"] == 1


def test_blank_capacity_never_passes_threshold(tmp_path):
    def dmg(d):
        r = list(d["cleaned"][3])
        setv(r, "Installed Capacity (MWelec)", "")
        d["cleaned"][3] = r
    p = build(tmp_path, dmg)
    exp = A.expected_subsets(A.read_csv(p["cleaned"]))
    assert "4" not in [r[IX["Ref ID"]] for r in exp["solar_op"]]


def test_solar_op_header_must_match_january(tmp_path):
    def dmg(d):
        d["solar_op_header"] = [A.norm_header(h) for h in A.SOLAR_OP_HEADER]
    rep = A.run(cfg(build(tmp_path, dmg)))
    assert failed(rep) == ["solar_op.header"]


def test_master_drift(tmp_path):
    def dmg(d):
        def patch(feats):
            feats = feats[1:]
            feats[0]["geometry"]["coordinates"][0] += 0.01
            del feats[1]["properties"]["capacity"]
            return feats
        d["master_patch"] = patch
    rep = A.run(cfg(build(tmp_path, dmg)))
    det = rep.checks["master.features"].details
    assert det["missing"] == ["1"] and len(det["moved"]) == 1
    assert rep.checks["master.keys_superset"].details["lacking"] == {"capacity": 1}


def test_master_unparseable(tmp_path):
    p = build(tmp_path)
    (p["root"] / "dist" / "m.json").write_text("{not json")
    rep = A.run(cfg(p))
    assert "master.parses" in failed(rep)


def test_pin_mismatch(tmp_path):
    p = build(tmp_path)
    rep = A.run(cfg(p, pins={str(p["official_csv"]): "0" * 64}))
    assert failed(rep) == ["inputs.unchanged"]


# ------------------------------------------------------------------ units and CLI

def test_units():
    assert A.month_first_format("m/d/yyyy") and not A.month_first_format("mm-dd-yy")
    assert not A.month_first_format("[$-10452]dd/mm/yyyy;@") and not A.month_first_format("General")
    assert A.demojibake("Ã\x98rsted") == "Ørsted" and A.demojibake("Ørsted") is None
    assert A.is_mojibake("CromerÂ\xa0") and not A.is_mojibake("Brân")
    assert A.classify_cell("Site Name", " A\xa0 B ", "A B", None) == "whitespace_control"
    assert A.classify_cell("Address", "a\r\nb", "a b", None) == "embedded_line_break"
    assert A.classify_cell("Operational", "NA", "", None) == "na_date"
    assert A.classify_cell("Installed Capacity (MWelec)", "0.37", "0.365", (0.365, "0.00")) == "xlsx_precision"
    assert A.classify_cell("Installed Capacity (MWelec)", "0.37", "0.38", (0.365, "0.00")) is None
    assert A.classify_cell("Offshore Wind Round", "02/01/1900", "2.5", (dt.datetime(1900, 1, 2, 12), "mm-dd-yy")) \
        == "number_as_date"
    assert A.classify_cell("Planning Application Submitted", "9/14/2026", "14/09/2026",
                           (dt.datetime(2026, 9, 14), "m/d/yyyy")) == "month_first_date"
    assert A.classify_cell("Planning Application Submitted", "9/14/2026", "14/09/2026",
                           (dt.datetime(2026, 9, 14), "mm-dd-yy")) is None


def test_cli_exit_codes_and_json(tmp_path):
    p = build(tmp_path)
    args = ["--official-csv", str(p["official_csv"]), "--official-xlsx", str(p["official_xlsx"]),
            "--cleaned", str(p["cleaned"]), "--root-dir", str(p["root"]), "--full", "repd-2026q3.csv",
            "--batteries", "bat.csv", "--solar-op", "solar.csv", "--over4", "over4.csv",
            "--master", "dist/m.json", "--baseline-master", str(p["baseline"]), "--json", str(tmp_path / "r.json")]
    assert A.main(args) == 0
    assert json.loads((tmp_path / "r.json").read_text())["failed"] == []
    assert A.main(args + ["--disallow-class", "xlsx_precision"]) == 1
    assert A.main(["--official-csv", str(tmp_path / "nope.csv"), "--cleaned", str(p["cleaned"])]) == 2


# ------------------------------------------------------------------ optional real data

JAN = os.environ.get("REPD_JAN_DIR")


@pytest.mark.skipif(not JAN, reason="set REPD_JAN_DIR to a globalgrid2050 checkout")
def test_january_root_files_are_detected_as_damaged():
    j = Path(JAN)
    rep = A.run(A.Config(official_csv=j / "repd.csv", cleaned=j / "repd.csv", root_dir=j,
                         baseline_master=j / "dist" / "repd_master.json"))
    f = set(failed(rep))
    assert {"batteries.no_mojibake", "solar_op.no_mojibake", "over4.no_mojibake",
            "batteries.field_count", "batteries.no_bare_cr", "batteries.filter",
            "full.utf8"} <= f
    assert rep.checks["batteries.field_count"].details["count"] == 33
    assert rep.checks["batteries.filter"].details["extra"] and not rep.checks["batteries.filter"].details["missing"]


def test_partial_whitespace_normalisation_is_whitespace_but_joined_words_are_not():
    assert A.classify_cell("Site Name", "Road\n -  Solar ", "Road -  Solar", None) == "embedded_line_break"
    assert A.classify_cell("Site Name", "Line\ntwo", "Linetwo", None) is None


def test_waived_cell_is_reported_not_failed(tmp_path):
    def dmg(d):
        setv(d["cleaned"][0], "Address", "Road ?")
        d["full"] = [list(r) for r in d["cleaned"]]
        d["batteries"][0][IX["Address"]] = "Road ?"
    p = build(tmp_path, dmg)
    rep = A.run(cfg(p))
    assert {"cleaned.cells_classified", "cleaned.text_matches_excel"} <= set(failed(rep))
    rep = A.run(cfg(p, waived=frozenset({("1", "Address")})))
    assert failed(rep) == []
    assert rep.checks["cleaned.cells_classified"].details["waived"]
