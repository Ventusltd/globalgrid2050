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
from feature_contracts import check_features, NEWS_MIGRATION, RESEARCH_MIGRATIONS, KNOWN_MIGRATIONS, GLOBAL_DC_MIGRATION
from new_version import migration_records

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


@pytest.fixture
def internal_priorities(tmp_path):
    news_id, research_id, candidate_id = "202611161734", "202611161747", "202611162359"
    versions = [
        {"id": news_id, "parent": None, "features": [
            {"id": "news-editorial-priority", "file": "scripts/plugins/live-news.js",
             "contains": "globalgrid2050.news.headline-priority.v1"}]},
        {"id": research_id, "parent": news_id, "features": [
            {"id": "inline-research-priority", "file": "index.html", "contains": "research-priority-v927.js"},
            {"id": "source-bound-priority", "file": "index.html", "contains": "researchPriorityStatus"}]},
        {"id": candidate_id, "parent": research_id, "features": [],
         "feature_migrations": copy.deepcopy([NEWS_MIGRATION, *RESEARCH_MIGRATIONS])},
    ]
    research_paths = ("prospecting/manifest.json", "prospecting/priority.json", "prospecting/priority.csv",
                      "scripts/plugins/research-priority-v927.js", "scripts/plugins/prospecting/adapter.mjs",
                      "scripts/plugins/prospecting/bundle.mjs", "scripts/plugins/prospecting/view.mjs")
    for version in versions:
        folder = tmp_path / version["id"]
        (folder / "data").mkdir(parents=True)
        (folder / "data/official.json").write_text('[{"repd_ref":"1018"}]', encoding="utf-8")
        for path in ("scripts/plugins/live-news.js", "news/pipeline_headlines.snapshot.json"):
            destination = folder / path
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / "uk_renewables_pipeline" / news_id / path, destination)
        if version["id"] != news_id:
            for path in research_paths:
                destination = folder / path
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / "uk_renewables_pipeline" / research_id / path, destination)
        (folder / "index.html").write_text(
            '<script defer src="scripts/plugins/live-news.js?v=9.28"></script>', encoding="utf-8")
    by_id = {v["id"]: v for v in versions}
    return tmp_path, by_id, by_id[candidate_id]


def test_internal_migrations_preserve_algorithms_data_and_mandatory_browser_probes(internal_priorities):
    root, by_id, version = internal_priorities
    result, probes = check_features(version, by_id, root)
    assert result["pass"], result
    assert len(result["migrations"]) == 3
    assert result["withdrawn_on_purpose"] == []
    assert len(probes) == 2  # Research is one executable proof for its two inherited features.
    assert all(probe["js"].startswith("(async () =>") for probe in probes)
    assert "await p.validatePriority(doc,bytes,bad)" in probes[0]["js"]
    assert "Forged attribution" in probes[0]["js"]
    assert "dataset.order==='priority'" in probes[0]["js"]
    assert "items[i].source" in probes[0]["js"]
    assert "parsePriorityBundle" in probes[1]["js"]
    assert "bundle.members.size===7775" in probes[1]["js"]
    assert "bundle.byId.size===1000" in probes[1]["js"]


@pytest.mark.parametrize("change", ["research_json", "research_csv", "manifest", "parser", "public_script",
                                     "public_status", "validator", "schema", "news_wiring", "provenance", "official_data"])
def test_internal_migrations_reject_lost_data_or_reintroduced_public_scores(internal_priorities, change):
    root, by_id, version = internal_priorities
    folder = root / version["id"]
    if change in {"research_json", "research_csv", "manifest", "parser"}:
        path = folder / {"research_json": "prospecting/priority.json", "research_csv": "prospecting/priority.csv",
                         "manifest": "prospecting/manifest.json", "parser": "scripts/plugins/prospecting/bundle.mjs"}[change]
        path.write_bytes(path.read_bytes() + b" ")
    elif change in {"public_script", "public_status", "news_wiring"}:
        path = folder / "index.html"
        text = path.read_text(encoding="utf-8")
        if change == "public_script":
            text += "<script src='scripts/plugins/research-priority-v927.js?v=9.27'></script>"
        elif change == "public_status":
            text += "<span id='researchPriorityStatus'>Research #1</span>"
        else:
            text = "<p>No headline renderer</p>"
        path.write_text(text, encoding="utf-8")
    elif change in {"validator", "schema"}:
        path = folder / "scripts/plugins/live-news.js"
        before = "crypto.subtle.digest" if change == "validator" else "globalgrid2050.news.headline-priority.v1"
        path.write_text(path.read_text(encoding="utf-8").replace(before, "removed"), encoding="utf-8")
    elif change == "provenance":
        path = folder / "news/pipeline_headlines.snapshot.json"
        doc = json.loads(path.read_text(encoding="utf-8"))
        doc["items"] = [{"title": "Synthetic missing publisher", "source": "", "link": "https://example.org/fixture"}]
        path.write_text(json.dumps(doc), encoding="utf-8")
    else:
        (folder / "data/official.json").write_text("[]", encoding="utf-8")
    result, _ = check_features(version, by_id, root)
    assert not result["pass"], change


@pytest.mark.parametrize("feature", ["inline-research-priority", "source-bound-priority", "news-editorial-priority"])
def test_internal_features_cannot_be_bypassed_by_removed_features(internal_priorities, feature):
    root, by_id, version = internal_priorities
    version["removed_features"] = [feature]
    result, _ = check_features(version, by_id, root)
    assert not result["pass"]
    assert "internal priority features require an audited migration, not removal" in result["errors"]


def test_descendant_may_restate_exact_inherited_contract_but_not_duplicate_locally(internal_priorities):
    root, by_id, version = internal_priorities
    parent = by_id[version["parent"]]
    parent["feature_migrations"] = copy.deepcopy(RESEARCH_MIGRATIONS)
    result, _ = check_features(version, by_id, root)
    assert result["pass"], result
    version["feature_migrations"].append(copy.deepcopy(NEWS_MIGRATION))
    result, _ = check_features(version, by_id, root)
    assert not result["pass"] and "duplicate feature migration" in result["errors"]


def test_release_flags_expand_only_explicit_reviewed_contracts():
    result = migration_records(["solar1000-inline-v1", "news-priority-internal-v1", "research-priority-internal-v1", "global-dc-ui-v928-v1"])
    assert result == KNOWN_MIGRATIONS
    assert migration_records(["solar1000-inline-v1"]) == [MIGRATION]
    result[0]["contract"] = "caller mutation"
    assert migration_records(["solar1000-inline-v1"]) == [MIGRATION]


@pytest.mark.parametrize("flags", [["unknown"], ["solar1000-inline-v1", "solar1000-inline-v1"],
                                   ["research-priority-internal-v1", "research-priority-internal-v1"]])
def test_release_flags_reject_unknown_or_duplicate_contracts(flags):
    with pytest.raises(ValueError, match="Unknown or duplicate"):
        migration_records(flags)


@pytest.mark.parametrize("document", [[], {"schema": "globalgrid2050.news.pipeline-headlines.v1", "items": [None]}])
def test_malformed_headline_provenance_returns_failed_verdict(internal_priorities, document):
    root, by_id, version = internal_priorities
    (root / version["id"] / "news/pipeline_headlines.snapshot.json").write_text(json.dumps(document), encoding="utf-8")
    result, _ = check_features(version, by_id, root)
    assert not result["pass"]


def test_migration_cannot_replace_original_sources_own_feature_check(internal_priorities):
    root, by_id, _ = internal_priorities
    source = by_id[NEWS_MIGRATION["from"]]
    source["feature_migrations"] = [copy.deepcopy(NEWS_MIGRATION)]
    result, _ = check_features(source, by_id, root)
    assert not result["pass"]


@pytest.fixture
def datacentre_migration(tmp_path):
    pipeline = tmp_path / "pipeline"
    source_id, candidate_id = GLOBAL_DC_MIGRATION["from"], "202611162359"
    versions = {
        source_id: {"id": source_id, "parent": None, "features": [
            {"id": "global-dc-tab", "file": "index.html", "contains": "global-datacentres-v925.js"}]},
        candidate_id: {"id": candidate_id, "parent": source_id, "features": [],
                       "feature_migrations": [copy.deepcopy(GLOBAL_DC_MIGRATION)]},
    }
    for vid in versions:
        folder = pipeline / vid
        (folder / "data").mkdir(parents=True)
        (folder / "data/official.json").write_text('[{"repd_ref":"1018"}]', encoding="utf-8")
        actual = ROOT / "uk_renewables_pipeline" / (source_id if vid == source_id else "202611161757")
        paths = ["global-datacentres/projects.json", "index.html"]
        if vid == candidate_id:
            paths += ["global-datacentres/official-projects.json", "global-datacentres/project-groups.json",
                      "global-datacentres/selection-audit.json", "scripts/plugins/preview-v928.js"]
        for rel in paths:
            target = folder / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(actual / rel, target)
    return pipeline, versions, versions[candidate_id]


def test_datacentre_migration_retains_100_leads_12_semantics_and_mandatory_real_host_probe(datacentre_migration):
    pipeline, versions, candidate = datacentre_migration
    result, probes = check_features(candidate, versions, pipeline)
    assert result["pass"], result
    assert len(probes) == 1
    assert "tab.click()" in probes[0]["js"]
    assert "GGDataCentreModel.validateBundle(forged)" in probes[0]["js"]
    assert "length!==54" in probes[0]["js"] and "length!==100" in probes[0]["js"]
    assert "querySelectorAll('main>section').length!==2" in probes[0]["js"]


@pytest.mark.parametrize("change", ["identity", "mw", "status", "malformed_capacity", "audit", "old_semantics", "host", "old_renderer", "lazy"])
def test_datacentre_migration_rejects_changed_evidence_or_lost_host(datacentre_migration, change):
    pipeline, versions, candidate = datacentre_migration
    folder = pipeline / candidate["id"]
    if change in {"identity", "mw", "status", "malformed_capacity"}:
        path = folder / "global-datacentres/projects.json"
        doc = json.loads(path.read_text(encoding="utf-8"))
        if change == "identity":
            doc["records"][0]["id"] = "DC-WD-Q999999999"
        elif change == "mw":
            doc["records"][0]["capacity"]["it_load_mw"] = 100
        elif change == "malformed_capacity":
            doc["records"][0]["capacity"] = None
        else:
            doc["records"][0]["operating_status"] = "operational"
        path.write_text(json.dumps(doc), encoding="utf-8")
    elif change == "audit":
        path = folder / "global-datacentres/selection-audit.json"
        path.write_bytes(path.read_bytes() + b" ")
    elif change == "old_semantics":
        path = pipeline / GLOBAL_DC_MIGRATION["from"] / "global-datacentres/projects.json"
        doc = json.loads(path.read_text(encoding="utf-8"))
        doc["records"][0]["name"] = "Different original identity"
        path.write_text(json.dumps(doc), encoding="utf-8")
    elif change == "lazy":
        path = folder / "scripts/plugins/preview-v928.js"
        path.write_text(path.read_text(encoding="utf-8").replace("!dcStarted", "true"), encoding="utf-8")
    else:
        path = folder / "index.html"
        text = path.read_text(encoding="utf-8")
        text = text.replace('id="datacentreHost"', 'id="removed"') if change == "host" else text + '<script src="scripts/plugins/global-datacentres-v925.js"></script>'
        path.write_text(text, encoding="utf-8")
    result, _ = check_features(candidate, versions, pipeline)
    assert not result["pass"], change
