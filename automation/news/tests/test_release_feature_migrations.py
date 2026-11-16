"""A moved presentation must retain its frozen data and executable access contract."""
import copy
import json
from pathlib import Path
import shutil
import sys

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "automation/pipeline_release"))
import common
from feature_contracts import check_features

SOURCE = "202611161244"
CANDIDATE = "202611161630"
MIGRATION = {"id": "solar1000-pilot", "from": SOURCE, "contract": "solar1000-inline-v1"}


@pytest.fixture
def releases(tmp_path):
    versions = [
        {"id": SOURCE, "parent": None, "features": [
            {"id": "solar1000-pilot", "file": "index.html", "contains": "SOLAR 1000 EVIDENCE PILOT"}]},
        {"id": CANDIDATE, "parent": SOURCE, "features": [], "feature_migrations": [copy.deepcopy(MIGRATION)]},
    ]
    for version in versions:
        folder = tmp_path / version["id"]
        folder.mkdir()
        actual = ROOT / "uk_renewables_pipeline" / version["id"]
        for rel in ("solar1000/manifest.json", "solar1000/candidates.json", "index.html",
                    "scripts/plugins/solar1000-v924.js"):
            target = folder / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(actual / rel, target)
        (folder / "data").mkdir()
        (folder / "data/official.json").write_text('[{"repd_ref":"1018"}]', encoding="utf-8")
    return tmp_path, {v["id"]: v for v in versions}


def check(releases):
    root, versions = releases
    return check_features(versions[CANDIDATE], versions, root)


def test_actual_candidate_keeps_feature_through_explicit_migration():
    registry = common.load_registry()
    versions = {v["id"]: v for v in registry["versions"]}
    versions[CANDIDATE]["feature_migrations"] = [copy.deepcopy(MIGRATION)]
    result, probes = check_features(versions[CANDIDATE], versions, common.PIPELINE)
    assert result["pass"], result
    assert "solar1000-pilot" in result["features"]
    assert "solar1000-pilot" not in result["withdrawn_on_purpose"]
    assert result["migrations"][0]["pass"]
    assert len(probes) == 3
    candidates = json.loads((common.PIPELINE / SOURCE / "solar1000/candidates.json").read_text(encoding="utf-8"))
    for candidate, probe in zip(candidates, probes[1:]):
        assert probe["search"] == candidate["repd_ref"]
        assert candidate["source_url"] in probe["js"]
        assert ".project-record" in probe["js"]


def test_migration_is_inherited_but_historical_feature_is_still_checked(releases):
    root, versions = releases
    result, _ = check_features(versions[SOURCE], versions, root)
    assert result["pass"]
    (root / SOURCE / "index.html").write_text("lost", encoding="utf-8")
    result, _ = check_features(versions[SOURCE], versions, root)
    assert not result["pass"] and result["missing"] == ["solar1000-pilot"]
    successor = {"id": "202611170001", "parent": CANDIDATE, "features": []}
    shutil.copytree(root / CANDIDATE, root / successor["id"])
    versions[successor["id"]] = successor
    result, probes = check_features(successor, versions, root)
    assert result["pass"] and len(probes) == 3


@pytest.mark.parametrize("change", ["unknown_contract", "unknown_feature", "wrong_source", "duplicate", "removed"])
def test_invalid_migration_fails_closed(releases, change):
    _, versions = releases
    version = versions[CANDIDATE]
    migration = version["feature_migrations"][0]
    if change == "unknown_contract":
        migration["contract"] = "trust-me"
    elif change == "unknown_feature":
        migration["id"] = "map-deep-link"
    elif change == "wrong_source":
        migration["from"] = CANDIDATE
    elif change == "duplicate":
        version["feature_migrations"].append(copy.deepcopy(migration))
    else:
        version["removed_features"] = ["solar1000-pilot"]
    result, _ = check(releases)
    assert not result["pass"]


@pytest.mark.parametrize("change", ["order", "membership", "missing", "candidate_url", "official_data", "inline_host", "plugin_wiring"])
def test_migration_rejects_lost_data_or_access(releases, change):
    root, _ = releases
    folder = root / CANDIDATE
    if change in {"order", "membership"}:
        path = folder / "solar1000/manifest.json"
        manifest = json.loads(path.read_text(encoding="utf-8"))
        if change == "order":
            manifest["ids"][0], manifest["ids"][1] = manifest["ids"][1], manifest["ids"][0]
        else:
            manifest["ids"][-1] = "999999"
        path.write_text(json.dumps(manifest), encoding="utf-8")
    elif change == "missing":
        (folder / "solar1000/manifest.json").unlink()
    elif change == "candidate_url":
        path = folder / "solar1000/candidates.json"
        path.write_text(path.read_text(encoding="utf-8").replace("https://stiveslocal.uk/", "https://example.org/"), encoding="utf-8")
    elif change == "official_data":
        (folder / "data/official.json").write_text("[]", encoding="utf-8")
    else:
        path = folder / "index.html"
        old = 'id="evidenceCoverage"' if change == "inline_host" else 'src="scripts/plugins/solar1000-v924.js'
        path.write_text(path.read_text(encoding="utf-8").replace(old, "removed"), encoding="utf-8")
    result, _ = check(releases)
    assert not result["pass"], change


def test_without_explicit_migration_old_marker_still_fails(releases):
    _, versions = releases
    del versions[CANDIDATE]["feature_migrations"]
    result, probes = check(releases)
    assert not result["pass"] and result["missing"] == ["solar1000-pilot"]
    assert probes == []
