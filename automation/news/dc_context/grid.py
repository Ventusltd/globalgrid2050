"""Offline, provisional grid/data-centre context; no network or inference.

The public ``build(bundle, *, as_of)`` API preserves dated source states and
uses the shared filings FIGURES validator for optional quantitative claims.
Context identifiers are local document-context keys, never official site IDs.
There is no geospatial matching, scoring, current-status or connection inference.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
from datetime import date, datetime
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

INPUT_SCHEMA = "globalgrid2050.grid-dc-context-input.v1"
SCHEMA = "globalgrid2050.grid-dc-context.v1"
_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}\Z")
_SHA = re.compile(r"[a-f0-9]{64}\Z")
_SOURCE_KEYS = {
    "id", "document_id", "url", "publisher", "authority", "title",
    "published_date", "retrieved_at", "http_status", "sha256", "bytes",
    "access_state", "output_policy",
}
_CONTEXT_KEYS = {
    "id", "name", "country", "entity_scope", "source_entity_reference",
    "source_id", "section", "page", "kind", "source_state",
    "numeric_claims", "figures_omitted_reason",
}
_PRIMARY_HOSTS = {"www.gov.uk": "GOVERNMENT", "www.ferc.gov": "REGULATOR"}
# Values are separate dimensions: source state, permitted numeric kind/basis,
# and a research action. No rule awards investment value or available power.
_RULES = {
    ("development_proposal", "PROPOSED"): (
        {"project_demand", "it_load"}, {"forecast"},
        "Seek a named development scheme, planning record and dated connection evidence."),
    ("connection_amendment_decision", "REJECTED"): (
        {"project_demand"}, {"forecast"},
        "Check later docket decisions; rejection of this amendment does not reject every existing arrangement."),
    ("connection_offer", "OFFER_REPORTED"): (
        {"secured_connection"}, {"reported"},
        "Check the offer's conditions, validity and subsequent delivery; an offer is not energisation."),
    ("energisation_report", "ENERGISED_REPORTED"): (
        {"energised_load"}, {"reported"},
        "Check the reported date and exact energised phase; do not extend it to an entire campus."),
    ("grid_upgrade", "PLANNED"): (
        {"grid_upgrade"}, {"forecast"},
        "Check the named upgrade, consent and delivery evidence; planned network work is not available capacity."),
    ("grid_upgrade", "COMMISSIONED_REPORTED"): (
        {"grid_upgrade"}, {"reported"},
        "Check the commissioned asset scope; its rating is not a data-centre connection allocation."),
    ("funding", "ANNOUNCED"): (
        {"finance"}, {"reported", "forecast"},
        "Check committed and disbursed funding separately; announced funding is not expenditure."),
    ("funding", "COMMITTED"): (
        {"finance"}, {"reported"},
        "Check funding conditions and disbursement; a commitment is not paid project CAPEX."),
    ("funding", "DISBURSED"): (
        {"finance"}, {"reported"},
        "Keep the disclosed payment scope; do not allocate portfolio totals to an individual site."),
}


def _require(condition, message):
    if not condition:
        raise ValueError(message)


def _object(value, keys, field):
    _require(isinstance(value, dict) and set(value) == keys, f"{field}: unexpected fields")


def _text(value, field, *, limit=250):
    _require(isinstance(value, str) and 0 < len(value) <= limit
             and value == value.strip()
             and not any(ord(c) < 32 or ord(c) == 127 or 0xD800 <= ord(c) <= 0xDFFF for c in value)
             and not any(c in value for c in "<>"), f"{field}: invalid plain text")


def _identifier(value, field):
    _require(isinstance(value, str) and bool(_ID.fullmatch(value)), f"{field}: invalid identifier")


def _day(value, field):
    _require(isinstance(value, str) and bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", value)),
             f"{field}: explicit calendar day required")
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"{field}: invalid day") from exc


def _time(value, field):
    _require(isinstance(value, str) and bool(re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z", value)),
        f"{field}: explicit UTC timestamp required")
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"{field}: invalid timestamp") from exc


def dumps(value):
    """Stable JSON bytes for hashing/replay; preserves exact decimal strings."""
    return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n"


def _source(source, as_of):
    _object(source, _SOURCE_KEYS, "source")
    for key in ("id", "document_id"):
        _identifier(source[key], f"source.{key}")
    for key in ("publisher", "title"):
        _text(source[key], f"source.{key}")
    url = source["url"]
    _text(url, "source.url", limit=2048)
    _require(url.isascii() and "\\" not in url and not any(c.isspace() for c in url), "source.url: unsafe syntax")
    parsed = urlsplit(url)
    _require(parsed.scheme == "https" and parsed.netloc in _PRIMARY_HOSTS
             and parsed.path.startswith("/") and not parsed.query and not parsed.fragment,
             "source.url: unsupported primary-source URL")
    _require(source["authority"] == _PRIMARY_HOSTS[parsed.netloc], "source.authority: host mismatch")
    _require(type(source["http_status"]) is int and source["http_status"] == 200,
             "source: successful source receipt required")
    _require(isinstance(source["sha256"], str) and bool(_SHA.fullmatch(source["sha256"])), "source: invalid digest")
    _require(type(source["bytes"]) is int and 0 < source["bytes"] <= 4 * 1024 * 1024,
             "source: invalid bounded response size")
    _require(source["access_state"] == "OPEN_OBSERVED" and source["output_policy"] == "FACT_METADATA_ONLY",
             "source: unsupported access/display policy")
    retrieved = _time(source["retrieved_at"], "source.retrieved_at")
    published = _day(source["published_date"], "source.published_date")
    _require(published <= retrieved.date() and retrieved <= as_of, "source: inconsistent or future clocks")


def _figures(context, source, kinds, bases):
    figures = context["numeric_claims"]
    _require(isinstance(figures, list) and len(figures) <= 20, "context: bounded numeric_claims required")
    if not figures:
        return []
    # The FIGURES producer owns this dependency; no duplicated numeric schema.
    from automation.news.filings.contracts import validate_claim
    result, seen = [], set()
    for raw in figures:
        claim = validate_claim(raw)
        _require(claim["claim_id"] not in seen, "context: duplicate numeric claim")
        seen.add(claim["claim_id"])
        _require(claim["quantity_kind"] in kinds and claim["basis"] in bases,
                 "context: numeric kind/basis contradicts source state")
        entity = claim["entity"]
        _require(entity["id"] == context["id"] and entity["scope"] == context["entity_scope"]
                 and entity["consolidation_group_id"] is None
                 and entity["identity_evidence_url"] == source["url"],
                 "context: numeric entity/scope mismatch")
        provenance = claim["provenance"]
        for claim_key, source_key in (("document_id", "document_id"), ("document_url", "url"),
                                      ("sha256", "sha256"), ("published_date", "published_date"),
                                      ("retrieved_at", "retrieved_at")):
            _require(provenance[claim_key] == source[source_key], "context: numeric provenance mismatch")
        _require(provenance["page"] == context["page"] and provenance["section"] == context["section"],
                 "context: numeric locator mismatch")
        if claim["quantity_kind"] == "finance":
            _require(claim["finance_stage"] == context["source_state"].lower(),
                     "context: finance stage mismatch")
        result.append(claim)
    return sorted(result, key=lambda c: c["claim_id"])


def build(bundle, *, as_of):
    """Validate the whole input and return deterministic, unlinked context.

    Every supplied source and context is checked before output. Source hashes
    are receipts, not independent verification of the source or extraction.
    The result never turns its internal context key into an official DC ID.
    """
    _object(bundle, {"schema", "sources", "contexts"}, "bundle")
    _require(bundle["schema"] == INPUT_SCHEMA, "bundle: unsupported schema")
    clock = _time(as_of, "as_of")
    sources, contexts = bundle["sources"], bundle["contexts"]
    _require(isinstance(sources, list) and 0 < len(sources) <= 100, "bundle: source bound")
    _require(isinstance(contexts, list) and 0 < len(contexts) <= 1000, "bundle: context bound")
    by_source, source_documents = {}, set()
    for source in sources:
        _source(source, clock)
        _require(source["id"] not in by_source and source["document_id"] not in source_documents,
                 "bundle: duplicate source/document")
        by_source[source["id"]] = source
        source_documents.add(source["document_id"])
    records, seen_ids, figure_ids = [], set(), set()
    for context in contexts:
        _object(context, _CONTEXT_KEYS, "context")
        _identifier(context["id"], "context.id")
        _identifier(context["source_id"], "context.source_id")
        _require(context["id"] not in seen_ids, "bundle: duplicate context")
        seen_ids.add(context["id"])
        _require(context["source_id"] in by_source, "context: unknown source")
        source = by_source[context["source_id"]]
        for key in ("name", "source_entity_reference"):
            _text(context[key], f"context.{key}")
        for key in ("section", "page", "figures_omitted_reason"):
            if context[key] is not None:
                _text(context[key], f"context.{key}", limit=400)
        _require(context["section"] is not None or context["page"] is not None, "context: locator required")
        _require(isinstance(context["country"], str) and context["country"] in {"GB", "US"},
                 "context: unsupported source country")
        _require(isinstance(context["entity_scope"], str)
                 and context["entity_scope"] in {"project", "site", "campus", "phase", "zone"},
                 "context: unsupported entity scope")
        _require(isinstance(context["kind"], str) and isinstance(context["source_state"], str),
                 "context: kind/state must be text")
        key = (context["kind"], context["source_state"])
        _require(key in _RULES, "context: unsupported kind/source-state combination")
        kinds, bases, action = _RULES[key]
        figures = _figures(context, source, kinds, bases)
        _require(not figures or context["figures_omitted_reason"] is None,
                 "context: figures and omission reason conflict")
        _require(not figure_ids.intersection(c["claim_id"] for c in figures), "bundle: repeated numeric claim")
        figure_ids.update(c["claim_id"] for c in figures)
        record = deepcopy(context)
        record["numeric_claims"] = figures
        record.update({
            "status": "PROVISIONAL", "current_project_state": "UNKNOWN",
            "canonical_project_id": None, "binding_basis": "DOCUMENT_CONTEXT_ONLY",
            "source": deepcopy(source),
            "source_document_age_days": (clock.date() - _day(source["published_date"], "source.published_date")).days,
            "retrieval_age_days": (clock - _time(source["retrieved_at"], "source.retrieved_at")).days,
            "research_action": action,
            "current_secured_connection": None, "current_energised_load": None,
            "available_grid_capacity": None, "site_capex": None,
        })
        records.append(record)
    normalized_input = {"schema": INPUT_SCHEMA,
                        "sources": sorted(deepcopy(sources), key=lambda s: s["id"]),
                        "contexts": sorted(deepcopy(contexts), key=lambda c: c["id"])}
    return {
        "schema": SCHEMA, "as_of": as_of,
        "input_sha256": hashlib.sha256(dumps(normalized_input).encode("utf-8")).hexdigest(),
        "context_count": len(records), "numeric_claim_count": len(figure_ids),
        "linked_project_count": 0, "records": sorted(records, key=lambda c: c["id"]),
        "limitations": ["Dated document context; current delivery and ownership are not established.",
                        "No site crosswalk, proximity inference, aggregation, ranking or publication approval.",
                        "Successful source retrieval is not independent factual or numerical verification."],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--as-of", required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    _require(args.input.stat().st_size <= 4 * 1024 * 1024, "input: maximum size exceeded")
    result = dumps(build(json.loads(args.input.read_text(encoding="utf-8")), as_of=args.as_of))
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        # A new artifact is required; no overwrite or pointer update.
        with args.output.open("x", encoding="utf-8", newline="\n") as handle:
            handle.write(result)
    else:
        print(result, end="")


if __name__ == "__main__":
    main()
