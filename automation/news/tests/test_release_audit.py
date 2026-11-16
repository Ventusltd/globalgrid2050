"""Release tooling must preserve the frozen parent and candidate semantics."""
import importlib.util
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "automation/pipeline_release"))
import common
import new_version


def test_dry_run_reports_parent_and_writes_nothing(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(new_version, "PIPELINE", tmp_path)
    monkeypatch.setattr(new_version, "load_registry", lambda: {
        "versions": [{"id": "202611161244", "version": "V9.24"}]})
    new_version.create("202611161630", "V9.25", "Evidence", dry_run=True)
    assert "parent: 202611161244 (V9.24)" in capsys.readouterr().out
    assert list(tmp_path.iterdir()) == []


def test_release_text_is_utf8_lf(tmp_path):
    path = tmp_path / "release.txt"
    new_version.write_text(path, "Solar · provisional\n")
    assert path.read_bytes() == "Solar · provisional\n".encode()


def test_frozen_parent_tree_and_candidate_data():
    assert common.tree_hash("202611161244") == "2d109396cdef80302914045b5330e4f7007e5830"
    parent = ROOT / "uk_renewables_pipeline/202611161244"
    candidate = ROOT / "uk_renewables_pipeline/202611161630"
    assert common.data_digest(parent) == common.data_digest(candidate)
    assert (parent / "solar1000/manifest.json").read_bytes() == (candidate / "solar1000/manifest.json").read_bytes()
