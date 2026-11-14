"""Hardening tests from the independent QA of PR #57 (Team 1, NL-013, 14 Nov 2026).

Each test pins one defect found by crafted input or by the end-to-end offline run; every one of
them failed on f9ccd703 and passes with the NL-013 patches. Synthetic fixtures only, except the
optional October regression at the end (set REPD_Q3_DIR to the folder holding the official
REPD_Publication_Q3_2026.csv/.xlsx).
"""
from __future__ import annotations

import datetime
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
PKG = HERE.parent
REPO = PKG.parents[1]
for p in (str(REPO), str(PKG), str(HERE)):
    if p not in sys.path:
        sys.path.insert(0, p)

from automation.repd import run, build_root  # noqa: E402
import hashguard as HG  # noqa: E402
import test_validate as TV  # noqa: E402


# ---------------------------------------------------------------- run.py
@pytest.fixture
def fake_repo(tmp_path):
    repo = tmp_path / "repo"
    (repo / "dist").mkdir(parents=True)
    TV.write_csv  # noqa: B018 (import check)
    (repo / "repd.csv").write_text("Ref ID\n1\n", encoding="utf-8")
    return repo


def _ctx(repo, tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "in.csv").write_text("Ref ID\n1\n", encoding="utf-8")
    (src / "in.xlsx").write_bytes(b"PK fake")
    d = {"label": "2026q3", "release_folder": "202611132345", "row_floor": 1, "previous_baseline_path": "repd.csv"}
    return run.RunContext(repo_root=repo, out_dir=tmp_path / "out", descriptor=d, offline=True,
                          local_csv=src / "in.csv", local_xlsx=src / "in.xlsx", check_pins=False,
                          protected_globs=["repd.csv"])


def test_stage_raising_system_exit_is_reported_and_hash_guard_still_runs(fake_repo, tmp_path, monkeypatch):
    """scripts/repd_updater.py raises SystemExit when config/registry.yaml is missing; on f9ccd703 that
    killed run.py with no run report and no post-run hash guard."""
    def exiting_clean(csv_path, out_dir):
        raise SystemExit("ERROR: config/registry.yaml not found.")
    monkeypatch.setattr(run, "load_module", lambda name: None)
    monkeypatch.setattr(run, "find_component",
                        lambda s: (exiting_clean, "fake.clean") if s == "clean" else (None, "absent"))
    report = run.run_pipeline(_ctx(fake_repo, tmp_path))
    stages = {s["stage"]: s for s in report["stages"]}
    assert stages["clean"]["status"] == "failed" and "registry.yaml" in stages["clean"]["error"]
    assert report["stages"][-1]["stage"] == "hash_guard" and report["overall"] == "failed"
    assert (tmp_path / "out" / "run_report.json").is_file()


def test_acceptance_waivers_come_only_from_the_known_anomalies_file(tmp_path):
    assert run.acceptance_waivers("2026q3") == ["15915:Address"]
    assert run.acceptance_waivers("2099q1", base=tmp_path) == []
    (tmp_path / "2099q1_known_anomalies.json").write_text(json.dumps({"acceptance_waive_cells": ["no-colon"]}))
    with pytest.raises(run.StageError):
        run.acceptance_waivers("2099q1", base=tmp_path)


# ---------------------------------------------------------------- build_root.py
STUB_UPDATER = '''
import os
class REPDUpdater:
    def __init__(self, registry_path="config/registry.yaml"):
        if not os.path.isfile(registry_path):
            raise SystemExit("ERROR: " + registry_path + " not found.")
        os.makedirs("dist", exist_ok=True)
        os.makedirs("data", exist_ok=True)
        self.cwd = os.getcwd()
    def refine_dataset(self, csv_path):
        assert os.path.isfile(csv_path), csv_path
        return {"type": "FeatureCollection", "features": [], "cwd": self.cwd}
'''


def test_build_master_writes_nothing_into_the_repo_and_needs_no_config(tmp_path, monkeypatch):
    repo = tmp_path / "repo"
    (repo / "scripts").mkdir(parents=True)
    (repo / "scripts" / "repd_updater.py").write_text(STUB_UPDATER, encoding="utf-8")
    canonical = tmp_path / "c.csv"
    canonical.write_text("Ref ID\n1\n", encoding="utf-8")
    monkeypatch.delitem(sys.modules, "repd_updater", raising=False)
    monkeypatch.syspath_prepend(str(repo / "scripts"))
    before = sorted(p.relative_to(repo).as_posix() for p in repo.rglob("*"))
    cwd = os.getcwd()
    result = build_root.build_master(canonical, repo)        # no config/ in this checkout
    assert result["type"] == "FeatureCollection"
    assert Path(result["cwd"]).resolve() != repo.resolve()
    assert sorted(p.relative_to(repo).as_posix() for p in repo.rglob("*")
                  if "__pycache__" not in p.parts) == [b for b in before if "__pycache__" not in b]
    assert os.getcwd() == cwd


def test_build_root_reads_hashes_from_the_committed_v1_descriptor():
    v1 = json.loads((PKG / "releases" / "2026q3.json").read_text(encoding="utf-8"))
    d = build_root.normalise_descriptor(v1)
    assert d["expected_csv_sha256"] == v1["expected"]["csv_sha256"]
    assert d["expected_xlsx_sha256"] == v1["expected"]["xlsx_sha256"]
    flat = build_root.normalise_descriptor({"published": "2026-11-13", "expected_csv_sha256": "a" * 64})
    assert flat["page_last_updated"] == "2026-11-13" and flat["expected_csv_sha256"] == "a" * 64


# ---------------------------------------------------------------- validate.py
def _gates(tmp_path, rows, **kw):
    tmp_path.mkdir(parents=True, exist_ok=True)
    code, rep, g = TV.run(tmp_path, rows, **kw)
    return code, g


def test_valid_csv_date_that_is_a_different_date_from_the_typed_xlsx_fails(tmp_path):
    rs = TV.rows_default(); rs[3]["Operational"] = "01/02/2022"          # not a swap of 5 Mar 2022
    code, g = _gates(tmp_path, rs, xlsx_dates={("4", "Operational"): datetime.datetime(2022, 3, 5)})
    assert code == 1 and g["C1_dates_valid"]["status"] == "fail"
    assert g["C1_dates_valid"]["detail"]["invalid"][0]["ref"] == "4"


def test_unparseable_csv_date_is_not_rescued_by_a_typed_xlsx_date(tmp_path):
    rs = TV.rows_default(); rs[3]["Operational"] = "early 2022"
    code, g = _gates(tmp_path, rs, xlsx_dates={("4", "Operational"): datetime.datetime(2022, 3, 5)})
    assert code == 1 and g["C1_dates_valid"]["status"] == "fail"


def test_month_first_and_unpadded_forms_of_the_typed_date_still_resolve(tmp_path):
    rs = TV.rows_default()
    rs[3]["Operational"] = "3/14/2022"     # impossible day-first, month-first = 14 Mar
    rs[4]["Operational"] = "5/3/2022"      # unpadded day-first = 5 Mar
    xd = {("4", "Operational"): datetime.datetime(2022, 3, 14), ("5", "Operational"): datetime.datetime(2022, 3, 5)}
    code, g = _gates(tmp_path, rs, xlsx_dates=xd)
    assert code == 0 and g["C1_dates_valid"]["status"] == "warn"


def test_a_ref_known_for_a_date_reason_does_not_waive_a_coordinate_failure(tmp_path):
    rs = TV.rows_default(); rs[1]["Y-coordinate"] = "9999999"
    tmp_path.mkdir(exist_ok=True)
    k = tmp_path / "k.json"
    k.write_text(json.dumps({"known": {"2": "Operational holds text NA"}, "known_coordinates": {}}))
    code, g = _gates(tmp_path / "a", rs, xlsx=False, extra=["--csv-only", "--known-anomalies", str(k)])
    assert code == 1 and g["C4_coordinates_numeric_and_in_bounds"]["status"] == "fail"
    k.write_text(json.dumps({"known": {"2": "x"}, "known_coordinates": {"2": "wrong in source"}}))
    code, g = _gates(tmp_path / "b", rs, xlsx=False, extra=["--csv-only", "--known-anomalies", str(k)])
    assert code == 0 and g["C4_coordinates_numeric_and_in_bounds"]["status"] == "warn"


# ---------------------------------------------------------------- hashguard.py
def _git(repo, *args):
    subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True)


@pytest.mark.parametrize("flag", ["--skip-worktree", "--assume-unchanged"])
def test_hashguard_sees_files_that_git_status_hides(tmp_path, flag):
    repo = tmp_path / "r"
    repo.mkdir()
    _git(repo, "init", "-q"); _git(repo, "config", "user.email", "t@example.invalid"); _git(repo, "config", "user.name", "t")
    (repo / "a.txt").write_text("original\n")
    _git(repo, "add", "."); _git(repo, "commit", "-qm", "init")
    before = HG.snapshot_git(str(repo))
    _git(repo, "update-index", flag, "a.txt")
    (repo / "a.txt").write_text("tampered\n")
    rep = HG.compare(before, HG.snapshot_worktree(str(repo)))
    assert rep["result"] == "FAIL" and rep["violations"][0]["path"] == "a.txt"


def test_hashguard_absent_sparse_path_is_not_a_violation(tmp_path):
    repo = tmp_path / "r"
    repo.mkdir()
    _git(repo, "init", "-q"); _git(repo, "config", "user.email", "t@example.invalid"); _git(repo, "config", "user.name", "t")
    (repo / "a.txt").write_text("original\n")
    _git(repo, "add", "."); _git(repo, "commit", "-qm", "init")
    before = HG.snapshot_git(str(repo))
    _git(repo, "update-index", "--skip-worktree", "a.txt")
    (repo / "a.txt").unlink()                     # what a sparse checkout looks like
    assert HG.compare(before, HG.snapshot_worktree(str(repo)))["result"] == "PASS"


# ---------------------------------------------------------------- October regression (optional)
Q3 = Path(os.environ.get("REPD_Q3_DIR", "/nonexistent"))


@pytest.mark.skipif(not (Q3 / "REPD_Publication_Q3_2026.csv").is_file(), reason="set REPD_Q3_DIR to the official October files")
def test_october_2026_cleaning_is_exactly_the_832_logged_changes():
    import clean as C
    csv_raw = (Q3 / "REPD_Publication_Q3_2026.csv").read_bytes()
    xlsx_raw = (Q3 / "REPD_Publication_Q3_2026.xlsx").read_bytes()
    res = C.clean(csv_raw, xlsx_raw, C.CleanOptions(as_of=datetime.date(2026, 11, 13)))
    assert hashlib.sha256(res.csv_bytes).hexdigest() == "d937ae16ad07f43caaaa25b4cee56399e1e9b9bb2ae5ecb7bc88cf9bc092e4b9"
    assert res.log["cells_changed_distinct"] == 832 and res.log["verification"]["unexplained_differences"] == 0
    assert (REPO / "repd-2026q3.csv").read_bytes() == res.csv_bytes if (REPO / "repd-2026q3.csv").is_file() else True


def test_descriptor_expectations_gate_fails_on_wrong_count_or_hash(tmp_path):
    """S6 had no failing-input test: an identical truncation of CSV and XLSX passes S1-S5 and is caught only here."""
    rs = TV.rows_default()
    code, g = _gates(tmp_path / "rows", rs, extra=["--expect-rows", "14", "--expect-unique-refs", "14"])
    assert code == 1 and g["S6_descriptor_expectations"]["status"] == "fail"
    code, g = _gates(tmp_path / "sha", rs, extra=["--expect-csv-sha256", "0" * 64])
    assert code == 1 and g["S6_descriptor_expectations"]["status"] == "fail"
    code, g = _gates(tmp_path / "ok", rs, extra=["--expect-rows", "12", "--expect-unique-refs", "12"])
    assert code == 0 and g["S6_descriptor_expectations"]["status"] == "pass"
