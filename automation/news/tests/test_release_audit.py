"""Release tooling must preserve the frozen parent and candidate semantics."""
import json
from pathlib import Path
import sys
import pytest

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


def test_registry_round_trip_preserves_utf8_metadata(tmp_path, monkeypatch):
    path = tmp_path / "registry.json"
    monkeypatch.setattr(common, "REGISTRY", path)
    registry = {"versions": [{"added": "Solar · quoted \u201ccandidate\u201d · 東京"}]}
    common.save_registry(registry)
    assert common.load_registry() == registry


def test_published_record_cannot_be_refinalized(monkeypatch):
    monkeypatch.setattr(new_version, "load_registry", lambda: {
        "versions": [{"id": "202611161244", "version": "V9.24", "state": "published"}]})
    with pytest.raises(AssertionError, match="cannot be rewritten"):
        new_version.finalize("202611161244", "change", [], [], "release_candidate_blocked")


@pytest.mark.parametrize("old_state", ["published", "release_candidate_blocked"])
def test_older_registered_release_cannot_be_refinalized(tmp_path, monkeypatch, old_state):
    registry = {"versions": [
        {"id": "202611161244", "version": "V9.24", "state": old_state},
        {"id": "202611161630", "version": "V9.25", "state": "release_candidate_blocked"},
    ]}
    monkeypatch.setattr(new_version, "load_registry", lambda: registry)
    monkeypatch.setattr(new_version, "PIPELINE", tmp_path)
    monkeypatch.setattr(new_version, "walk", lambda _: pytest.fail("Historical filesystem was accessed"))
    with pytest.raises(AssertionError, match="cannot be rewritten"):
        new_version.finalize("202611161244", "change", [], [], "release_candidate_blocked")
    assert len(registry["versions"]) == 2
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize("migration", [False, True])
def test_unpublished_tail_can_be_refinalized(tmp_path, monkeypatch, migration):
    registry = {"versions": [
        {"id": "202611161244", "version": "V9.24", "state": "published"},
        {"id": "202611161630", "version": "V9.25", "state": "release_candidate_blocked"},
    ]}
    if migration:
        registry["versions"][-1]["feature_migrations"] = [dict(new_version.SOLAR_MIGRATION)]
    parent = tmp_path / "202611161244"
    candidate = tmp_path / "202611161630"
    parent.mkdir()
    (candidate / "tests").mkdir(parents=True)
    runner = candidate / "tests/run_v9_25.sh"
    runner.write_text("CHANGED_FROM_PARENT=(\n)\nREMOVED_FROM_PARENT=(\n)\n", encoding="utf-8")
    monkeypatch.setattr(new_version, "load_registry", lambda: registry)
    monkeypatch.setattr(new_version, "PIPELINE", tmp_path)
    monkeypatch.setattr(new_version, "tree_hash", lambda _: "synthetic-candidate-tree")
    saved = []
    monkeypatch.setattr(new_version, "save_registry", saved.append)
    new_version.finalize("202611161630", "candidate revision", [], [], "release_candidate_blocked")
    assert len(saved[0]["versions"]) == 2
    assert saved[0]["versions"][-1]["parent"] == "202611161244"
    assert saved[0]["versions"][-1]["trees"] == ["synthetic-candidate-tree"]
    assert saved[0]["versions"][-1].get("feature_migrations", []) == ([new_version.SOLAR_MIGRATION] if migration else [])
    assert list(parent.iterdir()) == []


def test_frozen_parent_tree_and_candidate_data():
    assert common.tree_hash("202611161244") == "2d109396cdef80302914045b5330e4f7007e5830"
    parent = ROOT / "uk_renewables_pipeline/202611161244"
    candidate = ROOT / "uk_renewables_pipeline/202611161630"
    assert common.data_digest(parent) == common.data_digest(candidate)
    assert (parent / "solar1000/manifest.json").read_bytes() == (candidate / "solar1000/manifest.json").read_bytes()


def test_candidate_provenance_sanitization_changes_no_facts():
    relative = "fixtures/v9.8/interconnector-endpoints.json"
    old = json.loads((ROOT / "uk_renewables_pipeline/202611161244" / relative).read_text())
    new = json.loads((ROOT / "uk_renewables_pipeline/202611161630" / relative).read_text())
    old["flow_data"]["source"] = new["flow_data"]["source"]
    assert old == new
    assert new["flow_data"]["source"].startswith("https://github.com/Ventusltd/")
