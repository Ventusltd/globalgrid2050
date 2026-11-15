"""Fail-closed, review-required evidence contracts for project-specific Pipeline News.

This module performs *structural* validation of proposed article-to-REPD
associations. It does not fetch original bytes, prove licence rights, verify a
human identity, certify a claim or give permission to publish. A syntactically
complete record always requires an independent external acceptance decision.

Separate article receipts, per-project bindings, event assertions and rights
assessments. A URL linked to multiple projects needs one binding PER REPD Ref.
No AI score, headline match or reviewed boolean substitutes for evidence.
"""
from __future__ import annotations

import datetime as dt
import re
from urllib.parse import urlsplit

SHA256 = re.compile(r"^[a-f0-9]{64}$")
REF = re.compile(r"^[1-9][0-9]*$")
EVENTS = frozenset({
    "planning_submission", "consent", "refusal", "appeal", "construction",
    "energisation", "financial_close", "acquisition", "cancellation",
    "grid_connection", "other_project_development",
})
RIGHTS = frozenset({"publisher_permission", "open_licence", "headline_link_only"})


def _https(value):
    if not isinstance(value, str) or not value.startswith("https://"):
        return False
    try:
        parts = urlsplit(value)
        return bool(parts.hostname) and not parts.username and not parts.password
    except ValueError:
        return False


def _date(value, *, moment=False):
    if not isinstance(value, str) or not value:
        return False
    try:
        if moment:
            if not value.endswith("Z"):
                return False
            d = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
            return d.utcoffset() == dt.timedelta(0)
        return bool(re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value)
                    and dt.date.fromisoformat(value))
    except ValueError:
        return False


def check_proposal(record):
    """Return recorded structural problems; never certify source truth or rights."""
    errors = []
    if not isinstance(record, dict):
        return ["record.not_object"]

    def object_named(key):
        value = record.get(key)
        if not isinstance(value, dict):
            errors.append(key + ".missing")
            return {}
        return value

    article = object_named("ArticleReceipt")
    binding = object_named("ProjectBinding")
    event = object_named("EventAssertion")
    rights = object_named("RightsAssessment")

    if not str(article.get("publisher") or "").strip():
        errors.append("ArticleReceipt.publisher")
    for field in ("requested_url", "final_url", "retrieval_log_url"):
        if not _https(article.get(field)):
            errors.append("ArticleReceipt." + field)
    if article.get("http_status") != 200:
        errors.append("ArticleReceipt.http_status")
    if not _date(article.get("fetched_at"), moment=True):
        errors.append("ArticleReceipt.fetched_at")
    for field in ("response_sha256", "retrieval_log_sha256"):
        if not isinstance(article.get(field), str) or not SHA256.fullmatch(article[field]):
            errors.append("ArticleReceipt." + field)
    if not str(article.get("parser_identity") or "").strip():
        errors.append("ArticleReceipt.parser_identity")

    ref = str(binding.get("repd_ref") or "")
    if not REF.fullmatch(ref):
        errors.append("ProjectBinding.repd_ref")
    if not str(binding.get("project_name") or "").strip():
        errors.append("ProjectBinding.project_name")
    if "contrary_evidence" not in binding or not isinstance(binding["contrary_evidence"], list):
        errors.append("ProjectBinding.contrary_evidence")
    support = binding.get("supporting_evidence")
    if not isinstance(support, list) or not support:
        errors.append("ProjectBinding.supporting_evidence")
    else:
        for i, edge in enumerate(support):
            if not isinstance(edge, dict) or edge.get("repd_ref") != ref \
                    or edge.get("article_url") != article.get("final_url") \
                    or not str(edge.get("extract") or "").strip():
                errors.append("ProjectBinding.supporting_evidence[" + str(i) + "]")
    decision = binding.get("independent_review")
    if not isinstance(decision, dict) or decision.get("decision") != "accepted" \
            or not _https(decision.get("evidence_url")) \
            or not _date(decision.get("reviewed_at"), moment=True) \
            or not str(decision.get("reviewer_role") or "").strip() \
            or decision.get("reviewer_role") == record.get("proposing_role"):
        errors.append("ProjectBinding.independent_review")

    if event.get("event_type") not in EVENTS:
        errors.append("EventAssertion.event_type")
    if not _date(event.get("actual_event_date")):
        errors.append("EventAssertion.actual_event_date")
    if not _https(event.get("event_evidence_url")):
        errors.append("EventAssertion.event_evidence_url")
    if event.get("event_type") in {"planning_submission", "consent", "refusal", "appeal"}:
        if not str(event.get("planning_reference") or "").strip():
            errors.append("EventAssertion.planning_reference")

    if not str(rights.get("publisher_owner") or "").strip():
        errors.append("RightsAssessment.publisher_owner")
    if rights.get("basis") not in RIGHTS:
        errors.append("RightsAssessment.basis")
    if not _https(rights.get("basis_evidence_url")):
        errors.append("RightsAssessment.basis_evidence_url")
    if rights.get("display_scope") != "headline_link":
        errors.append("RightsAssessment.display_scope")
    if rights.get("stores_article_body") is not False:
        errors.append("RightsAssessment.stores_article_body")
    rreview = rights.get("independent_review")
    if not isinstance(rreview, dict) or rreview.get("decision") != "accepted" \
            or not _https(rreview.get("evidence_url")) \
            or not _date(rreview.get("reviewed_at"), moment=True) \
            or not str(rreview.get("reviewer_role") or "").strip() \
            or rreview.get("reviewer_role") == record.get("proposing_role"):
        errors.append("RightsAssessment.independent_review")

    # Rights for the final redirected source and all display contexts require
    # independent legal adjudication: these fields are claims, not proofs.
    return sorted(set(errors))


def assess(record):
    """Generate an explicit PublicationEligibility, never self-authorise release."""
    errors = check_proposal(record)
    return {
        "PublicationEligibility": {
            "status": "withheld" if errors else "independent_external_acceptance_required",
            "structural_errors": errors,
            "accepted_for_publication": False,
            "reason": (
                "Evidence fields incomplete or contradictory."
                if errors else
                "Structural completeness alone cannot authenticate original HTTP "
                "bytes, publisher rights, review identity or a REPD relationship."
            ),
        }
    }
