"""Unit tests for automation/repd/build_news.py (synthetic fixtures, no network, no real data)."""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("build_news", HERE.parent / "build_news.py")
build_news = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_news)

CONTRACT = """{
  "source": {
    "dataset": "Q2",
    "workbook_sha256": "aa"
  },
  "scope": {"technologies": ["solar", "bess"], "capacity_mw_inclusive_minimum": 1.0},
  "expected": {
    "project_count": 7680,
    "capacity_mw": 356474.09,
    "largest_mw": 4100.0
  },
  "other": {"project_count": 1}
}
"""


def test_set_json_scalar_keeps_layout_and_scopes_to_block():
    out = build_news.set_json_scalar(CONTRACT, "expected", "project_count", 7775, "c")
    out = build_news.set_json_scalar(out, "expected", "capacity_mw", 365474.49, "c")
    out = build_news.set_json_scalar(out, "source", "dataset", "Q3", "c")
    data = json.loads(out)
    assert data["expected"]["project_count"] == 7775
    assert data["expected"]["capacity_mw"] == 365474.49
    assert data["other"]["project_count"] == 1          # same key elsewhere untouched
    assert data["source"]["dataset"] == "Q3"
    assert '"technologies": ["solar", "bess"]' in out   # inline layout preserved
    assert len(out.splitlines()) == len(CONTRACT.splitlines())


def test_set_json_scalar_fails_closed_on_missing_key():
    with pytest.raises(SystemExit):
        build_news.set_json_scalar(CONTRACT, "expected", "no_such_key", 1, "c")
    with pytest.raises(SystemExit):
        build_news.set_json_scalar(CONTRACT, "no_such_block", "project_count", 1, "c")


def test_replace_once_requires_exactly_one_match():
    assert build_news.replace_once("a b c", "b", "x", "t") == "a x c"
    with pytest.raises(SystemExit):
        build_news.replace_once("b b", "b", "x", "t")
    with pytest.raises(SystemExit):
        build_news.replace_once("a", "b", "x", "t")


def test_spine_line_matches_the_shipped_builder_line():
    # the exact text the driver replaces in build_v9_1_spine.py:12
    assert build_news.SPINE_LINE_OLD == 'V9 = ROOT / "uk_renewables_pipeline/v9"\n'
    assert "parents[2]" in build_news.SPINE_LINE_NEW


def test_hash_tree_excludes_release_and_git_but_keeps_pycache(tmp_path):
    (tmp_path / "uk_renewables_pipeline/old").mkdir(parents=True)
    (tmp_path / "uk_renewables_pipeline/old/a.json").write_text("1")
    (tmp_path / "uk_renewables_pipeline/new").mkdir()
    (tmp_path / "uk_renewables_pipeline/new/b.json").write_text("2")
    (tmp_path / "scripts/__pycache__").mkdir(parents=True)
    (tmp_path / "scripts/__pycache__/x.pyc").write_bytes(b"tracked")
    (tmp_path / ".git").mkdir()
    (tmp_path / ".git/index").write_bytes(b"i")
    hashes = build_news.hash_tree(tmp_path, ["."], exclude=tmp_path / "uk_renewables_pipeline/new")
    assert set(hashes) == {"uk_renewables_pipeline/old/a.json", "scripts/__pycache__/x.pyc"}


def test_refuses_existing_release_and_scratch_inside_repo(tmp_path, monkeypatch):
    repo = tmp_path / "repo"
    (repo / "uk_renewables_pipeline/202609082224").mkdir(parents=True)
    (repo / "uk_renewables_pipeline/202611132345").mkdir()
    base = ["build_news.py", "--repo", str(repo), "--release", "202611132345", "--quarter", "2026q3",
            "--dataset", "Q3", "--canonical-csv", "x.csv", "--xlsx", "x.xlsx", "--source-manifest", "m.json",
            "--hash-report", str(tmp_path / "r.json")]
    monkeypatch.setattr(sys, "argv", base + ["--scratch", str(tmp_path / "s")])
    with pytest.raises(SystemExit, match="already exists"):
        build_news.main()
    (repo / "uk_renewables_pipeline/202611132345").rmdir()
    monkeypatch.setattr(sys, "argv", base + ["--scratch", str(repo / "s")])
    with pytest.raises(SystemExit, match="outside"):
        build_news.main()
