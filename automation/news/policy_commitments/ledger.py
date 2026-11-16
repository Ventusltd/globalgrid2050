"""COVENANT AGENT: deterministic source-led comparison, never legal compliance.

Public API: validate_ledger(mapping), evaluate(mapping, as_of=UTC),
dumps_report(report), csv_report(report). Quantities use the existing FIGURES
validate_claim contract unchanged. No network, inference of identities, or writes.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
import csv
from decimal import Decimal, localcontext
import io
import json
from pathlib import Path
import re

from automation.news.filings.contracts import (
    validate_claim, _identifier, _source_date, _text, _timestamp, _url,
)

SCHEMA = "globalgrid2050.policy-commitments.v1"
REPORT_SCHEMA = "globalgrid2050.policy-commitment-evaluation.v1"
STATES = {"UNKNOWN", "NOT_YET_DUE", "REPORTED_PROGRESS", "EVIDENCE_SUPPORTED_RESULT"}
MAX_BYTES = 4 * 1024 * 1024


def require(condition, message):
    if not condition:
        raise ValueError(message)


def fields(value, names, label):
    require(isinstance(value, dict) and set(value) == set(names.split()), label + ": unexpected fields")
    return value


def choice(value, choices, label):
    require(isinstance(value, str) and value in choices, label + ": unsupported state")


def strings(value, label, *, empty=True):
    require(isinstance(value, list) and len(value) <= 50 and (empty or bool(value)), label + ": bounded list required")
    for item in value:
        _text(item, label, 500)
    require(len(value) == len(set(value)), label + ": duplicate values")


def index(rows, label):
    require(isinstance(rows, list) and len(rows) <= 1000, label + ": bounded list required")
    result = {}
    for row in rows:
        require(isinstance(row, dict), label + ": object required")
        identity = _identifier(row.get("id"), label + ".id")
        require(identity not in result, label + ": duplicate identity")
        result[identity] = row
    return result


def reference(value, documents):
    fields(value, "document_id locator", "source reference")
    require(value["document_id"] in documents, "Unknown source document")
    document = documents[value["document_id"]]
    require(document["read_coverage"]["state"] != "UNREVIEWED"
            and value["locator"] in document["read_coverage"]["locators"], "Source locator was not inventoried as read")
    return document


def quantity(value, documents, scope):
    if value is None:
        return None
    claim = validate_claim(value)
    provenance = claim["provenance"]
    require(provenance["document_id"] in documents, "Quantity document missing")
    document = documents[provenance["document_id"]]
    require(document["content_sha256"] is not None, "Quantity needs original document byte receipt")
    require((provenance["document_url"], provenance["sha256"], provenance["published_date"], provenance["retrieved_at"])
            == (document["url"], document["content_sha256"], document["published_on"], document["retrieved_at"]),
            "Quantity provenance differs from document receipt")
    locator = provenance["section"] or ("page " + provenance["page"])
    reference({"document_id": document["id"], "locator": locator}, documents)
    require(scope["entity_id"] is not None and claim["entity"]["id"] == scope["entity_id"],
            "Quantity entity differs from commitment scope")
    require(claim["entity"]["scope"] == scope["figure_entity_scope"], "Quantity scope differs from commitment scope")
    return claim


def validate_ledger(payload):
    """Fail closed on malformed contracts; retain missing evidence as explicit nulls.

    Validation establishes internal consistency, not factual truth, legal force,
    audit validity or permission. Caller-supplied receipts require source review.
    """
    ledger = deepcopy(payload)
    fields(ledger, "schema coverage_note documents scopes commitments updates", "ledger")
    require(ledger["schema"] == SCHEMA, "Unsupported ledger schema")
    _text(ledger["coverage_note"], "coverage_note", 1000)
    documents = index(ledger["documents"], "documents")
    scopes = index(ledger["scopes"], "scopes")
    commitments = index(ledger["commitments"], "commitments")
    updates = index(ledger["updates"], "updates")
    require(documents and scopes and commitments, "Empty evidence coverage cannot pass")
    for document in documents.values():
        fields(document, "id title issuer url version published_on reviewed_at retrieved_at content_sha256 hash_limitation document_state source_kind read_coverage", "document")
        for key in ("title", "issuer", "version"):
            _text(document[key], "document." + key, 300)
        _url(document["url"], "document.url")
        reviewed = _timestamp(document["reviewed_at"], "reviewed_at")
        if document["published_on"] is not None:
            require(_source_date(document["published_on"], "published_on") <= reviewed.date(), "Document publication follows review")
        choice(document["document_state"], {"DRAFT", "PUBLISHED", "PUBLISHED_POLICY", "ADOPTED", "IN_PROGRESS", "UNKNOWN"}, "document_state")
        choice(document["source_kind"], {"PRIMARY_POLICY", "OFFICIAL_ANSWER", "CONFERENCE_INDEX", "OFFICIAL_MEASUREMENT", "AUDIT_REPORT", "FILING", "ATTRIBUTED_REPORT", "PRESS_RELEASE"}, "source_kind")
        coverage = fields(document["read_coverage"], "state locators note", "read_coverage")
        choice(coverage["state"], {"READ", "PARTIAL", "UNREVIEWED"}, "read_coverage.state")
        strings(coverage["locators"], "locators", empty=coverage["state"] == "UNREVIEWED")
        require(coverage["state"] != "UNREVIEWED" or not coverage["locators"], "Unread source cannot assert read locators")
        _text(coverage["note"], "coverage note", 500)
        if document["content_sha256"] is None:
            require(document["retrieved_at"] is None, "Missing original bytes cannot assert a retrieval receipt")
            _text(document["hash_limitation"], "hash_limitation", 500)
        else:
            require(isinstance(document["content_sha256"], str)
                    and re.fullmatch(r"[a-f0-9]{64}", document["content_sha256"]), "Invalid source SHA256")
            require(document["hash_limitation"] is None, "Byte receipt and missing-hash state conflict")
            retrieved = _timestamp(document["retrieved_at"], "retrieved_at")
            require(retrieved <= reviewed, "Original retrieval follows review")
            if document["published_on"] is not None:
                require(_source_date(document["published_on"], "published_on") <= retrieved.date(), "Publication follows retrieval")
    for scope in scopes.values():
        fields(scope, "id jurisdiction description entity_id figure_entity_scope", "scope")
        _text(scope["jurisdiction"], "jurisdiction")
        _text(scope["description"], "scope description", 500)
        if scope["entity_id"] is None:
            require(scope["figure_entity_scope"] is None, "Unlinked scope cannot acquire a figure entity scope")
        else:
            _identifier(scope["entity_id"], "entity_id")
            choice(scope["figure_entity_scope"], {"issuer", "consolidated_group", "project", "site", "campus", "phase", "public_institution"}, "figure_entity_scope")
    all_claim_ids = set()
    for row in commitments.values():
        fields(row, "id issuer source scope_id statement_type statement conditions metric target baseline baseline_state deadline reporting_obligation applicability revision", "commitment")
        document = reference(row["source"], documents)
        require(row["issuer"] == document["issuer"], "Commitment issuer differs from source")
        require(row["scope_id"] in scopes, "Unknown commitment scope")
        scope = scopes[row["scope_id"]]
        choice(row["statement_type"], {"EXPECTATION", "UNDERTAKING", "CONDITIONAL_REQUIREMENT", "CONDITIONAL_OFFER", "REQUIREMENT_STATED", "CONTEXT"}, "statement_type")
        _text(row["statement"], "statement", 500)
        strings(row["conditions"], "conditions", empty=not row["statement_type"].startswith("CONDITIONAL_"))
        metric = fields(row["metric"], "label numeric_support limitation", "metric")
        _text(metric["label"], "metric.label")
        choice(metric["numeric_support"], {"SUPPORTED", "UNSUPPORTED", "UNSTATED"}, "numeric_support")
        if metric["numeric_support"] != "SUPPORTED":
            _text(metric["limitation"], "metric limitation", 500)
            require(row["target"] is None and row["baseline"] is None, "Unsupported metric cannot carry a parallel quantity")
        else:
            require(metric["limitation"] is None and row["target"] is not None, "Supported metric requires a target claim")
        row["target"] = quantity(row["target"], documents, scope)
        row["baseline"] = quantity(row["baseline"], documents, scope)
        choice(row["baseline_state"], {"UNKNOWN", "NOT_REQUIRED", "STATED"}, "baseline_state")
        require((row["baseline"] is not None) == (row["baseline_state"] == "STATED"), "Baseline state differs from quantity")
        if row["target"]:
            require(row["target"]["metric"] == metric["label"], "Metric differs from target claim")
            provenance = row["target"]["provenance"]
            require(provenance["document_id"] == row["source"]["document_id"]
                    and (provenance["section"] or "page " + provenance["page"]) == row["source"]["locator"],
                    "Target claim differs from commitment source locator")
        deadline = fields(row["deadline"], "value wording", "deadline")
        if deadline["value"] is not None:
            _source_date(deadline["value"], "deadline.value")
            _text(deadline["wording"], "deadline.wording")
        else:
            require(deadline["wording"] is None, "Unknown deadline cannot assert date wording")
        if row["reporting_obligation"] is not None:
            _text(row["reporting_obligation"], "reporting_obligation", 500)
        applicability = fields(row["applicability"], "state reason evidence", "applicability")
        choice(applicability["state"], {"UNKNOWN", "ESTABLISHED"}, "applicability.state")
        _text(applicability["reason"], "applicability.reason", 500)
        require(isinstance(applicability["evidence"], list) and len(applicability["evidence"]) <= 20, "Applicability evidence list required")
        for item in applicability["evidence"]:
            reference(item, documents)
        if applicability["state"] == "ESTABLISHED":
            require(scope["entity_id"] is not None and applicability["evidence"], "Applicability requires stable entity and source evidence")
        revision = fields(row["revision"], "id supersedes_commitment_id baseline_changed", "revision")
        _identifier(revision["id"], "revision.id")
        require(type(revision["baseline_changed"]) is bool, "baseline_changed must be boolean")
        prior = revision["supersedes_commitment_id"]
        require(prior is None or (prior in commitments and prior != row["id"]), "Superseded commitment missing or self-referential")
        require(not revision["baseline_changed"] or prior is not None, "Changed baseline needs retained predecessor")
        for claim in (row["target"], row["baseline"]):
            if claim:
                require(claim["claim_id"] not in all_claim_ids, "Duplicate claim identity")
                all_claim_ids.add(claim["claim_id"])
    for row in commitments.values():
        seen, cursor = set(), row
        while cursor["revision"]["supersedes_commitment_id"] is not None:
            require(cursor["id"] not in seen, "Cyclic commitment revision")
            seen.add(cursor["id"])
            cursor = commitments[cursor["revision"]["supersedes_commitment_id"]]
    for update in updates.values():
        fields(update, "id commitment_id commitment_revision_id baseline_revision_id source reported_on statement kind claim measurement_state", "update")
        require(update["commitment_id"] in commitments, "Update commitment missing")
        row = commitments[update["commitment_id"]]
        document = reference(update["source"], documents)
        _source_date(update["reported_on"], "update.reported_on")
        require(_source_date(update["reported_on"], "reported_on") <= _timestamp(document["reviewed_at"], "reviewed_at").date(), "Future reported update")
        require(document["published_on"] is None or update["reported_on"] == document["published_on"],
                "Reported update date differs from source publication")
        _text(update["statement"], "update.statement", 500)
        for field in ("commitment_revision_id", "baseline_revision_id"):
            _identifier(update[field], field)
        choice(update["kind"], {"PROCESS_REPORT", "NUMERIC_REPORT", "CORRECTION", "CONTRADICTION"}, "update.kind")
        choice(update["measurement_state"], {"UNKNOWN", "REPORTED", "DOCUMENTED_MEASUREMENT"}, "measurement_state")
        update["claim"] = quantity(update["claim"], documents, scopes[row["scope_id"]])
        require((update["claim"] is not None) == (update["kind"] == "NUMERIC_REPORT"), "Numerical reports require exactly one FIGURES claim")
        if update["claim"]:
            require(update["claim"]["claim_id"] not in all_claim_ids, "Duplicate claim identity")
            all_claim_ids.add(update["claim"]["claim_id"])
            provenance = update["claim"]["provenance"]
            require(provenance["document_id"] == update["source"]["document_id"]
                    and (provenance["section"] or "page " + provenance["page"]) == update["source"]["locator"],
                    "Update claim source differs")
        if update["measurement_state"] == "DOCUMENTED_MEASUREMENT":
            require(update["claim"] is not None and update["claim"]["basis"] == "reported"
                    and document["source_kind"] in {"OFFICIAL_MEASUREMENT", "AUDIT_REPORT"}
                    and document["document_state"] in {"PUBLISHED", "ADOPTED"},
                    "Press releases and assertions cannot certify a measured outcome")
    return ledger


def incompatibilities(target, measured):
    """Exact compatibility only: no currency/unit conversion or scope aggregation."""
    mismatches = []
    for key in ("metric", "quantity_kind", "unit", "currency", "finance_stage", "reporting_period"):
        if target[key] != measured[key]:
            mismatches.append(key)
    for key in ("id", "scope", "consolidation_group_id"):
        if target["entity"][key] != measured["entity"][key]:
            mismatches.append("entity." + key)
    if target["reporting_period"] is None and target["as_of"] != measured["as_of"]:
        mismatches.append("as_of")
    return mismatches


def evaluate(payload, *, as_of):
    """Return evidence states and exact numerical relations; never compliance labels."""
    ledger = validate_ledger(payload)
    reference_time = _timestamp(as_of, "as_of")
    documents = {d["id"]: d for d in ledger["documents"]}
    scopes = {s["id"]: s for s in ledger["scopes"]}
    for document in documents.values():
        require(_timestamp(document["reviewed_at"], "reviewed_at") <= reference_time, "Source review follows evaluation clock")
    results = []
    for row in sorted(ledger["commitments"], key=lambda r: r["id"]):
        document = documents[row["source"]["document_id"]]
        updates = sorted((u for u in ledger["updates"] if u["commitment_id"] == row["id"]), key=lambda u: (u["reported_on"], u["id"]))
        superseded_by = sorted(c["id"] for c in ledger["commitments"] if c["revision"]["supersedes_commitment_id"] == row["id"])
        state, reasons, comparison = "UNKNOWN", [], None
        if superseded_by:
            reasons.append("Superseded version retained for historical review; no current result inferred")
        elif document["document_state"] in {"DRAFT", "IN_PROGRESS", "UNKNOWN"}:
            reasons.append("Instrument is draft, in progress or unclassified; no adopted outcome inferred")
        elif row["applicability"]["state"] != "ESTABLISHED":
            reasons.append("Applicability to a stable entity is unknown; conditions do not establish compliance")
        elif any(u["kind"] in {"CORRECTION", "CONTRADICTION"} for u in updates):
            reasons.append("Unresolved correction or contradiction retained; no automatic evidence reconciliation")
        elif any(u["commitment_revision_id"] != row["revision"]["id"] or u["baseline_revision_id"] != row["revision"]["id"] for u in updates):
            reasons.append("Update refers to a different commitment or baseline revision")
        elif any(u["claim"] and (u["claim"]["revision"]["restated"] or u["claim"]["revision"]["supersedes_claim_id"] is not None) for u in updates):
            reasons.append("Figure revision retained for explicit reconciliation; no automatic replacement")
        else:
            measured = [u for u in updates if u["measurement_state"] == "DOCUMENTED_MEASUREMENT"]
            if measured and row["target"] is not None and row["baseline_state"] != "UNKNOWN":
                mismatches = sorted({key for u in measured for key in incompatibilities(row["target"], u["claim"])})
                if mismatches:
                    reasons.append("Numerical comparison unavailable: incompatible " + ", ".join(mismatches))
                else:
                    with localcontext() as context:
                        context.prec = 256
                        target_value = Decimal(row["target"]["value"]) * Decimal(row["target"]["scale"])
                        values = {Decimal(u["claim"]["value"]) * Decimal(u["claim"]["scale"]) for u in measured}
                    if len(values) != 1:
                        reasons.append("Conflicting measurements retained without selecting a preferred result")
                    else:
                        value = next(iter(values))
                        state = "EVIDENCE_SUPPORTED_RESULT"
                        comparison = {"relation": "EQUAL" if value == target_value else "LESS_THAN" if value < target_value else "GREATER_THAN",
                                      "target_claim_id": row["target"]["claim_id"],
                                      "measurement_claim_ids": sorted(u["claim"]["claim_id"] for u in measured),
                                      "unit": row["target"]["unit"], "currency": row["target"]["currency"]}
                        reasons.append("Documented same-scope/metric/unit/stage/period comparison; numerical relation is not a legal compliance verdict")
            elif updates:
                state = "REPORTED_PROGRESS"
                reasons.append("Attributable update recorded; measurement, scope or baseline support is insufficient for a result")
            elif row["deadline"]["value"] is not None and reference_time.date() < _source_date(row["deadline"]["value"], "deadline"):
                state = "NOT_YET_DUE"
                reasons.append("Evaluation precedes the earliest day of the source-stated deadline; no delivery inferred")
            else:
                reasons.append("No comparable measurement supplied; missing evidence is not failure")
        results.append({"commitment_id": row["id"], "issuer": row["issuer"], "scope": scopes[row["scope_id"]],
                        "statement_type": row["statement_type"], "statement": row["statement"],
                        "document_state": document["document_state"], "applicability": row["applicability"],
                        "metric": row["metric"], "target": row["target"], "baseline": row["baseline"],
                        "baseline_state": row["baseline_state"], "revision": row["revision"], "superseded_by": superseded_by,
                        "deadline": row["deadline"], "conditions": row["conditions"],
                        "reporting_obligation": row["reporting_obligation"], "state": state,
                        "measurement_state": "EVIDENCE_SUPPORTED" if state == "EVIDENCE_SUPPORTED_RESULT" else "UNKNOWN",
                        "reasons": reasons, "comparison": comparison, "source": {**row["source"], "url": document["url"],
                            "published_on": document["published_on"], "reviewed_at": document["reviewed_at"],
                            "retrieved_at": document["retrieved_at"], "content_sha256": document["content_sha256"]},
                        "updates": updates, "status": "machine-provisional", "legal_compliance": "NOT_ASSESSED"})
    return {"schema": REPORT_SCHEMA, "as_of": as_of, "coverage_note": ledger["coverage_note"],
            "documents": sorted(ledger["documents"], key=lambda d: d["id"]), "results": results}


def dumps_report(report):
    return json.dumps(report, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n"


def csv_report(report):
    """One commitment per row; nested evidence stays attributable through JSON cells."""
    output = io.StringIO(newline="")
    names = ["commitment_id", "issuer", "state", "measurement_state", "statement_type", "document_state", "statement", "deadline", "metric",
             "scope", "conditions", "target", "baseline", "baseline_state", "revision", "superseded_by", "reporting_obligation", "applicability", "reasons", "comparison", "source", "updates", "status", "legal_compliance"]
    writer = csv.DictWriter(output, fieldnames=names, lineterminator="\n")
    writer.writeheader()
    for row in report["results"]:
        values = {}
        for name in names:
            value = row[name]
            if isinstance(value, (dict, list)):
                value = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)
            value = "" if value is None else str(value)
            values[name] = "'" + value if value.startswith(("=", "+", "-", "@", "\t", "\r")) else value
        writer.writerow(values)
    return output.getvalue()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ledger", type=Path, default=Path(__file__).with_name("sample_ledger.json"))
    parser.add_argument("--as-of", required=True)
    parser.add_argument("--format", choices=("json", "csv"), default="json")
    args = parser.parse_args(argv)
    try:
        with args.ledger.open("rb") as stream:
            raw = stream.read(MAX_BYTES + 1)
        require(len(raw) <= MAX_BYTES, "Input exceeds bounded size")
        result = evaluate(json.loads(raw), as_of=args.as_of)
    except (ValueError, TypeError, KeyError, OSError):
        parser.exit(2, "Policy ledger validation failed; no report emitted.\n")
    print(csv_report(result) if args.format == "csv" else dumps_report(result), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
