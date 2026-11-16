"""Offline positive/negative regression tests for the additive News Engine."""
import json
import subprocess
import sys

import pytest
from automation.news.engine import build_intelligence, canonical_url

S = {"id": "publisher_1", "publisher": "Independent Example", "kind": "reporting",
     "rights_status": "unknown", "enabled": False, "output_policy": "headline_link_only"}
P = [{"id": "1018", "name": "East Meadow Solar Farm", "technology": "solar"},
     {"id": "1019", "name": "Other Solar Farm", "technology": "solar"}]
A = {"url": "https://news.example.org/solar/1?utm_source=feed#fragment",
     "title": "East Meadow Solar Farm planning news", "publisher": "Independent Example",
     "source_id": "publisher_1", "pub_date": "2026-11-16T12:34:00Z",
     "first_seen": "2026-11-16T12:45:00Z", "source_receipt_sha256": "a" * 64,
     "content": "REPD 1019 (publisher body that must never be used or stored)"}


def test_name_only_provisional_and_publisher_rights_and_timestamps_preserved():
    out = build_intelligence([A], [S], P)
    assert out["schema"] == "globalgrid2050.ventus-news-intelligence.v1"
    assert out["counts"] == {"articles": 1, "provisional_project_edges": 1,
                             "verified_project_edges": 0, "rights_unresolved_articles": 1}
    row = out["articles"][0]
    assert row["publisher"] == A["publisher"]
    assert row["published_at"] == A["pub_date"]
    assert row["first_seen"] == A["first_seen"]
    assert row["source_receipt_sha256"] == "a" * 64
    assert row["usage_rights"]["status"] == "unknown"
    assert row["publication_eligibility"].startswith("WITHHELD")
    assert row["verification_status"] == "NOT_VERIFIED"
    assert row["project_candidates"] == [{"namespace": "repd", "id": "1018",
                                          "method": "exact_name", "status": "PROVISIONAL",
                                          "evidence_scope": "TITLE_ONLY", "independent_review": "REQUIRED"}]
    assert "publisher body" not in json.dumps(out)
    assert "1019" not in json.dumps(row)


def test_explicit_repd_id_is_not_verification_and_bare_digits_not_ids():
    out = build_intelligence([{**A, "title": "REPD reference 1019 changes"}], [S], P)
    assert out["articles"][0]["project_candidates"][0]["method"] == "repd_id"
    out2 = build_intelligence([{**A, "title": "Capacity 1019 MW changes"}], [S], P)
    assert out2["counts"]["provisional_project_edges"] == 0


def test_duplicate_full_name_veto_and_distinct_non_repd_namespaces():
    projects = P + [{"id": "2000", "name": P[0]["name"]},
                    {"namespace": "dcuk", "id": "dcuk-1", "name": P[0]["name"]}]
    out = build_intelligence([A], [S], projects)
    assert out["counts"]["provisional_project_edges"] == 0


def test_identity_not_inferred_from_geo_similarity_and_zero_is_honest():
    out = build_intelligence([{**A, "title": "A nearby developer starts construction"}], [S], P)
    assert out["counts"]["provisional_project_edges"] == 0
    assert out["counts"]["verified_project_edges"] == 0


def test_duplicates_normalise_tracking_without_dropping_original_article_url():
    rows = [A, {**A, "url": A["url"]}]
    out = build_intelligence(rows, [S], P)
    assert out["counts"]["articles"] == 1
    assert out["articles"][0]["original_article_url"] == A["url"]
    assert out["articles"][0]["canonical_article_url"] == "https://news.example.org/solar/1"


def test_tracking_variants_dedupe_preserve_both_original_urls():
    alternate = {**A, "url": "https://news.example.org/solar/1?utm_medium=email"}
    first = build_intelligence([A, alternate], [S], P)
    second = build_intelligence([alternate, A], [S], P)
    assert first == second
    assert first["counts"]["articles"] == 1
    assert first["articles"][0]["observed_article_urls"] == sorted([A["url"], alternate["url"]])


def test_deterministic_across_input_order():
    other = {**A, "url": "https://news.example.org/2", "title": "UK wind market news"}
    x = build_intelligence([A, other], [S], P)
    y = build_intelligence([other, A], [S], P)
    assert x == y
    assert x["counts"]["articles"] == 2


def test_existing_pipeline_headlines_shape_is_accepted_with_unique_source():
    out = build_intelligence({"items": [{"title": "Grid update", "link": A["url"],
                                          "source": S["publisher"], "date": "2026-11-16"}]}, [S])
    assert out["articles"][0]["published_at"] == "2026-11-16"
    assert out["articles"][0]["project_candidates"] == []


@pytest.mark.parametrize("bad", ["http://news.example.org/1", "https://127.0.0.1/a",
                                 "https://localhost/a", "https://person@news.example.org/a",
                                 "https://news.example.org:444/a", "https://news.example.org\\@evil.com/a",
                                 "https://news.example.org/a\nfoo"])
def test_reject_non_public_or_unsafe_article_urls(bad):
    with pytest.raises(ValueError):
        canonical_url(bad)


@pytest.mark.parametrize("source", [
    {**S, "enabled": True},
    {**S, "rights_status": "accepted"},
    {**S, "output_policy": "full_text"},
    {**S, "rights_status": "legal_unknown"},
])
def test_unapproved_or_unlicensed_sources_fail_closed(source):
    with pytest.raises(ValueError):
        build_intelligence([A], [source])


def test_rights_approved_does_not_grant_project_verification():
    approved = {**S, "rights_status": "accepted", "enabled": True,
                "rights_review_url": "https://publisher.example.org/licences/1"}
    out = build_intelligence([A], [approved], P)
    assert out["counts"]["verified_project_edges"] == 0
    assert out["articles"][0]["publication_eligibility"].startswith("WITHHELD")


def test_canonical_collision_different_publisher_metadata_fails_closed():
    with pytest.raises(ValueError, match="collision"):
        build_intelligence([A, {**A, "title": "Retitled story"}], [S], P)


def test_ambiguous_multiple_explicit_refs_not_verified():
    out = build_intelligence([{**A, "title": "REPD 1018 and REPD 1019"}], [S], P)
    edges = out["articles"][0]["project_candidates"]
    assert len(edges) == 2 and all(e["ambiguous_multi_project"] for e in edges)


def test_article_source_provenance_mismatch_rejected():
    with pytest.raises(ValueError, match="attribution"):
        build_intelligence([{**A, "publisher": "Other"}], [S], P)


def test_cli_no_overwrite_and_roundtrip(tmp_path):
    for name, data in [("articles", [A]), ("sources", [S]), ("projects", P)]:
        (tmp_path / (name + ".json")).write_text(json.dumps(data), encoding="utf-8")
    cmd = [sys.executable, "-m", "automation.news.engine", "--articles", str(tmp_path / "articles.json"),
           "--sources", str(tmp_path / "sources.json"), "--projects", str(tmp_path / "projects.json"),
           "--output", str(tmp_path / "out.json")]
    subprocess.run(cmd, check=True, capture_output=True, text=True)
    assert json.loads((tmp_path / "out.json").read_text())["counts"]["verified_project_edges"] == 0
    result = subprocess.run(cmd, capture_output=True, text=True)
    assert result.returncode != 0 and "FileExistsError" in result.stderr
