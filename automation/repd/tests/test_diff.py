"""Tests for automation/repd/diff.py using small synthetic fixtures (no network, no real data)."""
import csv
import json
import os
from pathlib import Path

import pytest

from automation.repd import diff as D

COLS = ["Old Ref ID", "Ref ID", "Record Last Updated (dd/mm/yyyy)", "Operator (or Applicant)", "Site Name",
        "Technology Type", "Installed Capacity (MWelec)", "Development Status (short)", "County", "Region",
        "Country", "Planning Authority", "Planning Application Reference", "Planning Application Submitted",
        "Planning Application Withdrawn", "Planning Permission Refused", "Planning Permission Granted",
        "Planning Permission Expired", "Under Construction", "Operational", "Solar Site Area (sqm)"]


def row(ref, tech="Solar Photovoltaics", mw="10", status="Application Submitted", upd="01/01/2026",
        site=None, op="Op Ltd", granted="", country="England", **kw):
    r = {c: "" for c in COLS}
    r.update({"Ref ID": str(ref), "Record Last Updated (dd/mm/yyyy)": upd, "Operator (or Applicant)": op,
              "Site Name": site or f"Site {ref}", "Technology Type": tech, "Installed Capacity (MWelec)": mw,
              "Development Status (short)": status, "Country": country, "Region": "South East",
              "Planning Permission Granted": granted})
    r.update(kw)
    return r


def write_csv(path, rows, encoding="utf-8-sig", cols=COLS):
    with open(path, "w", encoding=encoding, newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c, "") for c in cols})
    return path


OLD_ROWS = [
    row(1, mw="10.00", status="Application Submitted"),                       # -> consented
    row(2, mw="20.00", status="Awaiting Construction"),                       # -> under construction
    row(3, mw="", status="Under Construction"),                               # -> operational, unknown MW
    row(4, tech="Battery", mw="200.00", status="Application Submitted"),      # -> refused
    row(5, mw="5.00", status="Operational"),                                  # removed
    row(6, mw="49.80", status="Awaiting Construction"),                       # capacity edit +5.2
    row(7, mw="12.35", status="Awaiting Construction"),                       # rounding only
    row(8, tech="Wind Onshore", mw="30.00", status="Application Submitted"),  # withdrawn
]
NEW_ROWS = [
    row(1, mw="10", status="Awaiting Construction", granted="01/09/2026", upd="02/09/2026"),
    row(2, mw="20", status="Under Construction"),
    row(3, mw="", status="Operational"),
    row(4, tech="Battery", mw="200", status="Application Refused"),
    row(6, mw="55", status="Awaiting Construction"),
    row(7, mw="12.3456", status="Awaiting Construction"),
    row(8, tech="Wind Onshore", mw="30", status="Application Withdrawn"),
    row(9, mw="100", status="Awaiting Construction"),                         # added, consented
    row(10, tech="Battery", mw="", status="Application Submitted"),           # added, unknown MW
]


@pytest.fixture
def files(tmp_path):
    old = write_csv(tmp_path / "old.csv", OLD_ROWS, encoding="cp1252")
    new = write_csv(tmp_path / "new.csv", NEW_ROWS)
    return old, new, tmp_path


def test_csv_to_csv_core_numbers(files):
    old, new, tmp = files
    d = D.run(old, new, tmp / "out", "Old", "New")
    s = d["summary"]
    assert (s["added"], s["removed"], s["retained"]) == (2, 1, 7)
    assert s["added_mw"] == 100.0                     # unknown capacity is not zero
    assert d["records"]["added"]["total"]["n_unknown_mw"] == 1
    assert s["removed_mw"] == 5.0
    assert s["status_changes"] == 5
    m = s["milestones"]
    assert m["consented"] == {"n": 2, "mw": 110.0, "n_unknown_mw": 0}
    assert m["under_construction"]["n"] == 1
    assert m["operational"] == {"n": 1, "mw": 0.0, "n_unknown_mw": 1}
    assert m["refused"]["n"] == 1 and m["refused"]["mw"] == 200.0
    assert m["withdrawn"]["n"] == 1
    cat = d["milestones"]["categories"]["consented"]
    assert cat["transition"]["n"] == 1 and cat["new_record"]["n"] == 1
    assert cat["top"][0]["ref"] == "9"               # largest first
    assert cat["by_technology"]["Solar Photovoltaics"]["all"]["n"] == 2
    # capacity: one real edit, rounding ignored
    ce = d["capacity_edits"]
    assert ce["n"] == 1 and ce["edits_by_abs_delta"][0]["ref"] == "6"
    assert ce["net_mw"] == 5.2
    fc = {f["column"]: f["retained_changed"] for f in d["field_changes"]}
    assert fc["Installed Capacity (MWelec)"] == 1
    assert fc["Planning Permission Granted"] == 1


def test_outputs_written_and_deterministic(files):
    old, new, tmp = files
    D.run(old, new, tmp / "a", "Old", "New")
    D.run(old, new, tmp / "b", "Old", "New")
    for name in ("diff.json", "changelog.md"):
        a, b = (tmp / "a" / name).read_bytes(), (tmp / "b" / name).read_bytes()
        assert a == b
        assert str(tmp).encode() not in a            # no absolute paths
    md = (tmp / "a" / "changelog.md").read_text()
    import re
    assert "Generated by" in md
    assert not re.search(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}", md)   # no timestamps
    assert "Newly consented: 2" in md
    assert "## Solar: top 50 movements" in md
    j = json.loads((tmp / "a" / "diff.json").read_text())
    assert "generated" not in j and j["schema"] == D.SCHEMA


def test_identity_json_previous(tmp_path):
    recs = []
    for r in OLD_ROWS:
        cap = D.parse_num(r["Installed Capacity (MWelec)"])
        recs.append({"repd_ref": r["Ref ID"], "repd_old_ref": None, "repd_record_updated": "2026-01-01",
                     "operator": r["Operator (or Applicant)"], "site_name": r["Site Name"],
                     "technology": r["Technology Type"], "capacity_mw": cap, "capacity_known": cap is not None,
                     "status": r["Development Status (short)"], "county": None, "region": "South East",
                     "country": "England", "planning_permission_granted": None, "identity_status": "REPD_BOUND"})
    doc = {"schema": "globalgrid2050.project-identity.v6", "raw_record_count": len(recs), "records": recs,
           "source_hashes": {"csv_sha256": "abc"}}
    jp = tmp_path / "project_identity_v6.json"
    jp.write_text(json.dumps(doc))
    new = write_csv(tmp_path / "new.csv", NEW_ROWS)
    d = D.run(jp, new, tmp_path / "out", "July", "Oct")
    assert d["previous"]["kind"].startswith("derived JSON")
    assert d["summary"]["added"] == 2 and d["summary"]["status_changes"] == 5
    fc = {f["column"]: f["retained_changed"] for f in d["field_changes"]}
    # ISO date in JSON equals dd/mm/yyyy in CSV; only ref 1 changed Record Last Updated
    assert fc["Record Last Updated (dd/mm/yyyy)"] == 1
    assert "Solar Site Area (sqm)" not in fc         # column absent from derived file, not compared
    assert d["conventions"]["columns_only_in_new"] == ["Solar Site Area (sqm)"]


def test_identity_json_count_mismatch_fails(tmp_path):
    jp = tmp_path / "p.json"
    jp.write_text(json.dumps({"schema": "globalgrid2050.project-identity.v6", "raw_record_count": 5,
                              "records": [{"repd_ref": "1", "technology": "Battery", "status": "x"}]}))
    with pytest.raises(D.DiffError, match="raw_record_count"):
        D.load_identity_json(jp)


def test_thresholded_json_rejected(tmp_path):
    jp = tmp_path / "major_projects_v6.json"
    jp.write_text(json.dumps({"schema": "globalgrid2050.major-projects.v6", "records": []}))
    with pytest.raises(D.DiffError, match="not a project-identity"):
        D.load_identity_json(jp)


def test_duplicate_ref_first_kept(tmp_path):
    rows = NEW_ROWS + [NEW_ROWS[0]]
    new = write_csv(tmp_path / "new.csv", rows)
    snap = D.load_csv(new)
    assert snap["info"]["source_rows"] == len(rows)
    assert snap["info"]["unique_refs"] == len(NEW_ROWS)
    assert snap["info"]["duplicate_refs"][0]["kind"] == "identical"


def test_fail_closed_on_bad_inputs(tmp_path):
    bad = write_csv(tmp_path / "bad.csv", [row(1)], cols=[c for c in COLS if c != "Technology Type"])
    with pytest.raises(D.DiffError, match="required columns"):
        D.load_csv(bad)
    ragged = tmp_path / "ragged.csv"
    ragged.write_text(",".join(COLS) + "\n1,2,3\n", encoding="utf-8")
    with pytest.raises(D.DiffError, match="wrong number of fields"):
        D.load_csv(ragged)


def test_month_first_dates_are_not_silently_accepted():
    assert D.parse_date("13/02/2026").isoformat() == "2026-02-13"
    assert D.parse_date("02/13/2026") is None
    assert D.parse_num("") is None and D.parse_num("NA") is None and D.parse_num("1,234.5") == 1234.5


def test_hash_guard_refuses_out_inside_protected(files):
    old, new, tmp = files
    prot = tmp / "released"
    prot.mkdir()
    (prot / "keep.json").write_text("{}")
    with pytest.raises(D.DiffError, match="inside protected"):
        D.run(old, new, prot / "out", protect=[prot])


def test_hash_guard_detects_modification(files, monkeypatch):
    old, new, tmp = files
    prot = tmp / "released"
    prot.mkdir()
    target = prot / "keep.json"
    target.write_text("{}")
    real = D.build_diff

    def tampering(*a, **k):
        target.write_text('{"truncated": true}')
        return real(*a, **k)

    monkeypatch.setattr(D, "build_diff", tampering)
    with pytest.raises(D.DiffError, match="hash guard.*modified"):
        D.run(old, new, tmp / "out", protect=[prot])


def test_solar_movements_and_top50(files):
    old, new, tmp = files
    d = D.run(old, new, tmp / "out")
    so = d["solar"]
    refs = [m["ref"] for m in so["movements_by_mw"]]
    assert refs[0] == "9"                            # 100 MW added
    assert "7" not in refs                           # rounding is not a movement
    assert set(refs) == {"1", "2", "3", "5", "6", "9"}
    assert refs[-1] == "3"                           # unknown MW ranks last
    assert [x["ref"] for x in so["top50_left"]] == ["5"]
    assert so["top50_left"][0]["reason"] == "ref removed"


def test_cli(files, capsys):
    old, new, tmp = files
    rc = D.main(["--previous", str(old), "--new", str(new), "--out", str(tmp / "cli"),
                 "--previous-label", "A", "--new-label", "B", "--protect", str(old)])
    assert rc == 0
    assert (tmp / "cli" / "changelog.md").exists()
    assert "hash guard" in capsys.readouterr().out
    rc = D.main(["--previous", str(tmp / "missing.csv"), "--new", str(new), "--out", str(tmp / "x")])
    assert rc == 2


def test_descriptor_entry(files):
    old, new, tmp = files
    d = D.run_from_descriptor({"previous": str(old), "new": str(new), "out": str(tmp / "desc"),
                               "previous_label": "Q2", "label": "Q3"})
    assert d["new"]["label"] == "Q3"
    with pytest.raises(D.DiffError, match="lacks 'out'"):
        D.run_from_descriptor({"previous": "a", "new": "b"})
