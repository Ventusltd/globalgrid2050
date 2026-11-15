"""Evidence ledger: structural checks are not article, publisher or legal verification."""
from __future__ import annotations

import copy
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import evidence_ledger as L  # noqa: E402


def record(ref="1001"):
    article = "https://publisher.example/projects/solar"
    return {
        "proposing_role": "Agent7",
        "ArticleReceipt": {
            "publisher": "Example Publisher",
            "requested_url": article, "final_url": article,
            "http_status": 200, "fetched_at": "2026-11-15T12:00:00Z",
            "response_sha256": "a" * 64, "retrieval_log_sha256": "b" * 64,
            "retrieval_log_url": "https://github.com/Ventusltd/evidence/blob/abc/receipt.json",
            "parser_identity": "html5-parser/1",
        },
        "ProjectBinding": {
            "repd_ref": ref, "project_name": "Example Solar Park",
            "contrary_evidence": [],
            "supporting_evidence": [
                {"repd_ref": ref, "article_url": article,
                 "extract": "Example Solar Park (REPD " + ref + ") was granted consent."}
            ],
            "independent_review": {
                "decision": "accepted", "evidence_url": "https://github.com/Ventusltd/reviews/issues/1",
                "reviewer_role": "Agent2", "reviewed_at": "2026-11-15T13:00:00Z",
            },
        },
        "EventAssertion": {
            "event_type": "consent", "actual_event_date": "2026-11-14",
            "event_evidence_url": article, "planning_reference": "P/2026/0001",
        },
        "RightsAssessment": {
            "publisher_owner": "Example Publisher",
            "basis": "headline_link_only",
            "basis_evidence_url": "https://publisher.example/terms",
            "display_scope": "headline_link", "stores_article_body": False,
            "independent_review": {
                "decision": "accepted", "evidence_url": "https://github.com/Ventusltd/reviews/issues/2",
                "reviewer_role": "Agent2", "reviewed_at": "2026-11-15T13:00:00Z",
            },
        },
    }


def test_completely_filled_synthetic_contract_is_still_not_accepted():
    item = record()
    assert L.check_proposal(item) == []
    result = L.assess(item)["PublicationEligibility"]
    assert result["status"] == "independent_external_acceptance_required"
    assert result["accepted_for_publication"] is False


def test_original_source_hash_and_http_response_required():
    item = record()
    item["ArticleReceipt"].update(response_sha256="", http_status=None)
    errs = L.check_proposal(item)
    assert "ArticleReceipt.response_sha256" in errs
    assert "ArticleReceipt.http_status" in errs
    assert L.assess(item)["PublicationEligibility"]["status"] == "withheld"


def test_redirected_article_identity_and_provenance_cannot_be_omitted():
    item = record()
    item["ArticleReceipt"]["final_url"] = "http://publisher.example/other"
    item["ArticleReceipt"]["retrieval_log_url"] = ""
    errs = L.check_proposal(item)
    assert "ArticleReceipt.final_url" in errs
    assert "ArticleReceipt.retrieval_log_url" in errs


def test_article_b_about_project_b_cannot_bind_project_a():
    item = record("1001")
    item["ProjectBinding"]["supporting_evidence"][0]["repd_ref"] = "2002"
    assert "ProjectBinding.supporting_evidence[0]" in L.check_proposal(item)


def test_one_article_about_two_projects_needs_two_separate_bindings():
    one = record("1001")
    two = record("2002")
    two["ArticleReceipt"] = copy.deepcopy(one["ArticleReceipt"])
    two["ProjectBinding"]["supporting_evidence"][0]["repd_ref"] = "1001"
    assert L.check_proposal(one) == []
    assert "ProjectBinding.supporting_evidence[0]" in L.check_proposal(two)


def test_reviewed_boolean_does_not_substitute_for_independent_review():
    item = record()
    item["ProjectBinding"]["independent_review"] = {"reviewed": True}
    assert "ProjectBinding.independent_review" in L.check_proposal(item)


def test_producer_cannot_structurally_self_review():
    item = record()
    item["ProjectBinding"]["independent_review"]["reviewer_role"] = "Agent7"
    item["RightsAssessment"]["independent_review"]["reviewer_role"] = "Agent7"
    errs = L.check_proposal(item)
    assert "ProjectBinding.independent_review" in errs
    assert "RightsAssessment.independent_review" in errs


def test_undocumented_rights_and_article_body_storage_withheld():
    item = record()
    item["RightsAssessment"]["basis"] = "AI confidence high"
    item["RightsAssessment"]["stores_article_body"] = True
    errs = L.check_proposal(item)
    assert "RightsAssessment.basis" in errs
    assert "RightsAssessment.stores_article_body" in errs


def test_event_requires_actual_date_and_planning_reference():
    item = record()
    item["EventAssertion"].update(actual_event_date="not known", planning_reference="")
    errs = L.check_proposal(item)
    assert "EventAssertion.actual_event_date" in errs
    assert "EventAssertion.planning_reference" in errs


def test_news_is_withheld_when_raw_record_unavailable():
    assert L.assess(None)["PublicationEligibility"]["status"] == "withheld"
