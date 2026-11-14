"""Tests for automation/repd/monthly.py (the monthly workflow's helper). No network: content API
fixtures in fixtures/monthly/, synthetic official-style CSV/XLSX from conftest, a temporary
releases directory and a temporary repo root. The real October files are used if present."""
import json
import shutil
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from automation.repd import config, monthly  # noqa: E402
from conftest import base_rows, make_csv, make_xlsx  # noqa: E402

FIX = Path(__file__).resolve().parent / "fixtures" / "monthly"
PKG = Path(__file__).resolve().parents[1]
REPO = PKG.parents[1]
REAL = Path("/home/claude/repd-report/q3")
Q3_CSV = "48e76c49f33a1090e78108d1ea9bfe689b35963ea3be1bb4f6516d038a5ff862"


@pytest.fixture()
def world(tmp_path):
    """A repo root with scripts/ (for the V6 counters), an allow-list, and automation dirs."""
    root = tmp_path / "repo"
    (root / ".github").mkdir(parents=True)
    (root / ".github" / "large-files-allowlist.txt").write_text("# allow-list\nglobal_ports.geojson\n")
    (root / "scripts").symlink_to(REPO / "scripts")
    auto = root / "automation" / "repd"
    for sub in ("releases", "releases_v6", "baselines"):
        (auto / sub).mkdir(parents=True)
    shutil.copy(PKG / "releases" / "2026q2.json", auto / "releases")
    files = tmp_path / "files"
    files.mkdir()
    return {"root": root, "auto": auto, "files": files, "out": tmp_path / "out"}


def put(world, name, data):
    (world["files"] / name).write_bytes(data)


def synthetic(world, stem):
    rows = base_rows(6)
    put(world, f"{stem}.csv", make_csv(rows))
    put(world, f"{stem}.xlsx", make_xlsx(rows))


def run(world, api, *extra):
    argv = ["--out", str(world["out"]), "--repo-root", str(world["root"]), "--api-file", str(FIX / api),
            "--files-dir", str(world["files"]), "--release-folder", "202705060517", *extra]
    code = monthly.main(argv)
    return code, json.loads((world["out"] / "result.json").read_text())


def test_quarter_from_date():
    assert monthly.quarter_from_date("2026-11-13") == (2026, 3)
    assert monthly.quarter_from_date("2027-02-04") == (2026, 4)
    assert monthly.quarter_from_date("2027-05-06T09:30:00+01:00") == (2027, 1)
    assert monthly.quarter_from_date("2026-07-31") == (2026, 2)
    assert monthly.release_name((2026, 4)) == "January 2027"
    assert monthly.release_name((2027, 1)) == "April 2027"


def test_new_release_writes_descriptors_allowlist_and_counts(world):
    synthetic(world, "REPD_Publication_Q1_2027")
    code, res = run(world, "content_api_2027q1.json")
    assert code == 0 and res["status"] == "new" and res["release_id"] == "2027q1"
    assert res["published"]["label"] == "April 2027"
    assert res["counts"] == {"csv_rows": 6, "unique_refs": 6, "duplicate_refs": [],
                             "solar_gt_1mw": 3, "bess_gt_100mw": 3}
    d = config.load(world["auto"] / "releases" / "2027q1.json")      # validates the schema
    assert d.previous_release_id == "2026q2" and d.quarter == "Q1 2027"
    assert d.dataset_title == "Renewable Energy Planning Database (REPD): April 2027 (Q1 2027)"
    assert d.expected.csv_sha256 == res["files"]["csv"]["sha256"]
    v6 = json.loads((world["auto"] / "releases_v6" / "v6_2027q1.json").read_text())
    for key in ("release_id", "quarter_label", "output_suffix", "csv_url", "xlsx_url", "publication_date",
                "dataset_title", "expected_rows", "expected_unique_refs", "expected_solar_gt1",
                "expected_bess_gt100", "expected_csv_sha256", "expected_xlsx_sha256"):
        assert v6.get(key) not in (None, ""), key          # every key scripts/repd_sources_v6.py requires
    assert v6["output_suffix"] == "2027q1" and v6["expected_solar_gt1"] == 3
    allow = (world["root"] / ".github" / "large-files-allowlist.txt").read_text()
    for line in monthly.allowlist_lines("2027q1", "202705060517"):
        assert f"\n{line}\n" in allow
    assert (world["out"] / "raw" / "REPD_Publication_Q1_2027.csv").is_file()
    assert "New REPD release 2027q1" in (world["out"] / "summary.md").read_text()


def test_unchanged_when_hashes_are_pinned(world):
    synthetic(world, "REPD_Publication_Q1_2027")
    run(world, "content_api_2027q1.json")
    before = sorted(p.name for p in (world["auto"] / "releases").iterdir())
    allow = (world["root"] / ".github" / "large-files-allowlist.txt").read_text()
    shutil.rmtree(world["out"])
    code, res = run(world, "content_api_2027q1.json")
    assert code == 0 and res["status"] == "unchanged" and res["release_id"] == "2027q1"
    assert sorted(p.name for p in (world["auto"] / "releases").iterdir()) == before
    assert (world["root"] / ".github" / "large-files-allowlist.txt").read_text() == allow
    assert "No new REPD release" in (world["out"] / "summary.md").read_text()


def test_redirected_old_url_is_judged_by_hash_not_url(world, tmp_path):
    """GOV.UK serves the replaced July URL's file name with new bytes: hashes decide."""
    synthetic(world, "REPD_Publication_Q1_2027")
    run(world, "content_api_2027q1.json")              # pins the synthetic bytes as 2027q1
    shutil.rmtree(world["out"])
    for ext in ("csv", "xlsx"):                         # old July URL names now carry those bytes
        shutil.copy(world["files"] / f"REPD_Publication_Q1_2027.{ext}",
                    world["files"] / f"REPD_Publication_Q2_2026.{ext}")
    code, res = run(world, "content_api_2026q2_old_urls.json")
    assert code == 0 and res["status"] == "unchanged" and res["release_id"] == "2027q1"


def test_same_quarter_with_new_bytes_needs_a_person(world):
    synthetic(world, "REPD_Publication_Q1_2027")
    run(world, "content_api_2027q1.json")
    shutil.rmtree(world["out"])
    rows = base_rows(7)                                 # a correction: one more row, same quarter
    put(world, "REPD_Publication_Q1_2027.csv", make_csv(rows))
    put(world, "REPD_Publication_Q1_2027.xlsx", make_xlsx(rows))
    before = (world["auto"] / "releases" / "2027q1.json").read_text()
    code, res = run(world, "content_api_2027q1.json")
    assert code == 1 and res["status"] == "needs_person" and "2027q1" in res["reason"]
    assert (world["auto"] / "releases" / "2027q1.json").read_text() == before
    assert "needs a person" in (world["out"] / "summary.md").read_text()


def test_unnamed_files_get_a_date_derived_id(world):
    synthetic(world, "repd-extract")
    code, res = run(world, "content_api_unnamed.json")
    assert code == 0 and res["status"] == "new"
    assert res["release_id"] == "2026q4" and res["published"]["label"] == "January 2027"
    assert res["published"]["id_from"].startswith("publication date 2027-02-04")
    config.load(world["auto"] / "releases" / "2026q4.json")


def test_acceptance_waivers_carry_forward(world):
    (world["auto"] / "baselines" / "2026q2_known_anomalies.json").write_text(json.dumps(
        {"known": {"1": "x"}, "acceptance_waive_cells": ["15915:Address"]}))
    synthetic(world, "REPD_Publication_Q1_2027")
    code, res = run(world, "content_api_2027q1.json")
    known = json.loads((world["auto"] / "baselines" / "2027q1_known_anomalies.json").read_text())
    assert known["acceptance_waive_cells"] == ["15915:Address"] and known["known"] == {}


def test_allowlist_is_idempotent_and_optional(world):
    root = world["root"]
    assert len(monthly.add_allowlist(root, "2027q1", "202705060517")) == 3
    assert monthly.add_allowlist(root, "2027q1", "202705060517") == []
    synthetic(world, "REPD_Publication_Q1_2027")
    allow = (root / ".github" / "large-files-allowlist.txt").read_text()
    (root / ".github" / "large-files-allowlist.txt").write_text("x\n")
    run(world, "content_api_2027q1.json", "--no-allowlist")
    assert (root / ".github" / "large-files-allowlist.txt").read_text() == "x\n"
    assert allow.count("dist/repd_master_2027q1.json") == 1


def test_unreadable_publication_is_an_error_not_green(world, tmp_path):
    bad = tmp_path / "bad.json"
    bad.write_text('{"details": {"attachments": []}}')
    code = monthly.main(["--out", str(world["out"]), "--repo-root", str(world["root"]),
                         "--api-file", str(bad), "--files-dir", str(world["files"])])
    res = json.loads((world["out"] / "result.json").read_text())
    assert code == 2 and res["status"] == "error"


def test_github_output(world, monkeypatch, tmp_path):
    out = tmp_path / "gh_output"
    monkeypatch.setenv("GITHUB_OUTPUT", str(out))
    synthetic(world, "REPD_Publication_Q1_2027")
    run(world, "content_api_2027q1.json")
    lines = dict(line.split("=", 1) for line in out.read_text().splitlines())
    assert lines["status"] == "new" and lines["release_id"] == "2027q1"
    assert lines["release_folder"] == "202705060517" and lines["csv"].endswith("REPD_Publication_Q1_2027.csv")


@pytest.mark.skipif(not (REAL / "REPD_Publication_Q3_2026.csv").is_file(), reason="real October files absent")
def test_real_october_files_are_unchanged_against_main(tmp_path):
    out = tmp_path / "out"
    code = monthly.main(["--out", str(out), "--repo-root", str(REPO), "--api-file",
                         str(Path(__file__).resolve().parent / "fixtures" / "detect_fetch" / "content_api_2026q3.json"),
                         "--files-dir", str(REAL)])
    res = json.loads((out / "result.json").read_text())
    assert code == 0 and res["status"] == "unchanged" and res["release_id"] == "2026q3"
    assert res["files"]["csv"]["sha256"] == Q3_CSV
