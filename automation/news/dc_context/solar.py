"""Offline solar/storage/procurement context, preserving source scope and bounds.

No fetch, extraction, site matching, financial aggregation or verification claim.
The shared FIGURES contract owns numerical validation; this adapter binds those
claims to source receipts and explicit context. See SOLAR.md for the interface.
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

from automation.news.filings.contracts import validate_claim

INPUT_SCHEMA = "globalgrid2050.solar-dc-context-input.v1"
SCHEMA = "globalgrid2050.solar-dc-context.v1"
_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}\Z")
_HOSTS = {
    "www.epa.gov": "ISSUER_PRESENTATION_GOVERNMENT_HOSTED",
    "www.googlecloudpresscorner.com": "ISSUER_RELEASE",
    "www.sma-uk.com": "SUPPLIER_CASE_STUDY",
}
_SOURCE_KEYS = {"id", "document_id", "url", "publisher", "title", "authority",
                "published_date", "retrieved_at", "http_status", "bytes", "sha256",
                "access_state", "output_policy"}
_CONTEXT_KEYS = {"id", "name", "country", "entity", "source_id", "section", "page",
                 "relationship", "source_state", "source_as_of", "numeric_claims",
                 "figures_omitted_reason", "scope_note"}
_ENTITY_KEYS = {"id", "scope", "consolidation_group_id", "identity_evidence_url"}
_KINDS = {
    "solar_procurement": {"generation_power", "generation_energy", "energy_procurement"},
    "storage_procurement": {"storage_power", "storage_energy"},
    "portfolio_storage_access": {"storage_power", "storage_energy"},
    "onsite_solar_ppa": {"generation_power", "generation_energy", "energy_procurement"},
    "procurement_finance": {"finance"},
}
_ACTIONS = {
    "solar_procurement": "Check delivery, named supply assets and allocation; contracted generation is not data-centre demand.",
    "storage_procurement": "Check delivery, shared rights and duration separately; MW does not establish MWh or site allocation.",
    "portfolio_storage_access": "Identify contracted storage assets and allocations; portfolio access does not establish onsite batteries.",
    "onsite_solar_ppa": "Check current operation and reconcile source capacity labels before using a numeric site rating.",
    "procurement_finance": "Retain funding stage and entity scope; do not allocate group funding to individual sites.",
}


def _require(ok, message):
    if not ok:
        raise ValueError(message)


def _object(value, keys, field):
    _require(isinstance(value, dict) and set(value) == keys, field + ": unexpected fields")


def _text(value, field, limit=500):
    _require(isinstance(value, str) and 0 < len(value) <= limit and value == value.strip()
             and not any(ord(c) < 32 or ord(c) == 127 or 0xD800 <= ord(c) <= 0xDFFF or c in "<>"
                         for c in value), field + ": invalid plain text")


def _id(value, field):
    _require(isinstance(value, str) and bool(_ID.fullmatch(value)), field + ": invalid identifier")


def _time(value):
    _require(isinstance(value, str) and bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", value)),
             "Explicit UTC timestamp required")
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _day(value):
    _require(isinstance(value, str) and bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", value)), "Exact source day required")
    return date.fromisoformat(value)


def dumps(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, indent=2, allow_nan=False) + "\n"


def verify_source_bytes(source, raw):
    """Verify an explicitly supplied response; never fetch or retain its body."""
    _require(isinstance(raw, bytes) and 0 < len(raw) <= 4 * 1024 * 1024, "Bounded source bytes required")
    _require(len(raw) == source["bytes"] and hashlib.sha256(raw).hexdigest() == source["sha256"],
             "Source bytes do not match receipt")


def _source(source, clock):
    _object(source, _SOURCE_KEYS, "source")
    for key in ("id", "document_id"):
        _id(source[key], key)
    for key in ("publisher", "title"):
        _text(source[key], key)
    url = source["url"]
    _text(url, "url", 2048)
    parsed = urlsplit(url)
    _require(url.isascii() and "\\" not in url and not any(c.isspace() for c in url)
             and parsed.scheme == "https" and parsed.netloc in _HOSTS
             and parsed.path.startswith("/") and not parsed.query and not parsed.fragment,
             "Unsupported primary source URL")
    _require(source["authority"] == _HOSTS[parsed.netloc], "Source authority/host mismatch")
    _require(type(source["http_status"]) is int and source["http_status"] == 200, "Successful source receipt required")
    _require(type(source["bytes"]) is int and 0 < source["bytes"] <= 4 * 1024 * 1024, "Invalid source byte count")
    _require(isinstance(source["sha256"], str) and bool(re.fullmatch(r"[a-f0-9]{64}", source["sha256"])), "Invalid source digest")
    _require(source["access_state"] == "OPEN_OBSERVED" and source["output_policy"] == "FACT_METADATA_ONLY",
             "Unsupported source output policy")
    retrieved = _time(source["retrieved_at"])
    _require(retrieved <= clock, "Future source retrieval")
    if source["published_date"] is not None:
        _require(_day(source["published_date"]) <= retrieved.date(), "Future source publication")


def _context(context, source, clock):
    _object(context, _CONTEXT_KEYS, "context")
    for key in ("id", "source_id"):
        _id(context[key], key)
    for key in ("name", "scope_note"):
        _text(context[key], key)
    for key in ("page", "section", "figures_omitted_reason"):
        if context[key] is not None:
            _text(context[key], key)
    _require(context["page"] is not None or context["section"] is not None, "Source locator required")
    _require(context["country"] in ("GB", "US"), "Unsupported source geography")
    relation = context["relationship"]
    _require(isinstance(relation, str) and relation in _KINDS, "Unsupported relationship; proximity is not procurement")
    state = context["source_state"]
    _require(state in ("ANNOUNCED", "AGREEMENT_REPORTED", "COMMISSIONED_REPORTED", "COMMITTED", "DISBURSED"),
             "Unsupported source state")
    _require(relation == "procurement_finance" or state not in ("COMMITTED", "DISBURSED"), "Funding stage on electrical context")
    _require(relation != "procurement_finance" or state in ("ANNOUNCED", "COMMITTED", "DISBURSED"), "Unsupported funding stage")
    _text(context["source_as_of"], "source_as_of", 10)
    _require(bool(re.fullmatch(r"\d{4}(?:-\d{2}(?:-\d{2})?)?", context["source_as_of"])), "Source date precision required")
    parts = [int(x) for x in context["source_as_of"].split("-")]
    source_day = date(*parts, *([1] * (3 - len(parts))))
    _require(source_day <= _time(source["retrieved_at"]).date(), "Source context cannot be a future observation")
    entity = context["entity"]
    _object(entity, _ENTITY_KEYS, "entity")
    _id(entity["id"], "entity.id")
    _require(entity["scope"] in ("issuer", "consolidated_group", "project", "site", "campus", "phase"), "Unsupported entity scope")
    _require(entity["identity_evidence_url"] == source["url"], "Entity identity must retain supporting source")
    _require(entity["consolidation_group_id"] is None or entity["consolidation_group_id"] == entity["id"],
             "No inferred corporate association")
    _require((entity["scope"] == "consolidated_group") == (entity["consolidation_group_id"] == entity["id"]),
             "Group identity mismatch")
    if relation == "portfolio_storage_access":
        _require(entity["scope"] in ("issuer", "consolidated_group", "project"), "Portfolio storage cannot become site storage")
    if relation == "onsite_solar_ppa":
        _require(entity["scope"] in ("site", "campus", "phase"), "Onsite relationship requires named site scope")
    if relation == "procurement_finance":
        _require(entity["scope"] == "consolidated_group", "Corporate finance must remain at evidenced parent-group scope")
    figures = context["numeric_claims"]
    _require(isinstance(figures, list) and len(figures) <= 20, "Bounded figures required")
    _require(bool(figures) == (context["figures_omitted_reason"] is None), "Explain omitted figures; do not invent zero")
    result = []
    for wrapped in figures:
        _object(wrapped, {"claim", "qualifier"}, "numeric claim")
        _require(wrapped["qualifier"] in ("stated", "upper_bound", "approximate"), "Explicit numerical qualifier required")
        claim = validate_claim(wrapped["claim"])
        _require(claim["entity"] == entity, "Figure entity/scope mismatch")
        _require(claim["quantity_kind"] in _KINDS[relation], "Figure kind does not match context")
        _require(claim["assurance"] != "audited", "Current primary sources do not establish audited numerical assurance")
        if state == "COMMISSIONED_REPORTED":
            _require(claim["basis"] == "reported", "Commissioned context cannot use forecast figure")
        if relation == "procurement_finance":
            _require(claim["finance_stage"] == state.lower(), "Funding stage mismatch")
        if claim["basis"] == "reported":
            # Fresh retrieval must not turn a historical target into an actual.
            for observed in (claim["as_of"], (claim["reporting_period"] or {}).get("end")):
                if observed is not None:
                    components = [int(x) for x in observed.split("-")]
                    observed_day = date(*components, *([1] * (3 - len(components))))
                    _require(observed_day <= source_day, "Reported figure postdates source observation")
        provenance = claim["provenance"]
        for a, b in (("document_id", "document_id"), ("document_url", "url"), ("sha256", "sha256"),
                     ("published_date", "published_date"), ("retrieved_at", "retrieved_at")):
            _require(provenance[a] == source[b], "Figure/source receipt mismatch")
        _require(provenance["page"] == context["page"] and provenance["section"] == context["section"], "Figure locator mismatch")
        result.append({"claim": claim, "qualifier": wrapped["qualifier"]})
    return sorted(result, key=lambda f: f["claim"]["claim_id"])


def build(bundle, *, as_of, source_bytes=None):
    """Produce provisional rows; optional response bytes verify hashes, not facts."""
    _object(bundle, {"schema", "sources", "contexts"}, "bundle")
    _require(bundle["schema"] == INPUT_SCHEMA, "Unsupported input schema")
    clock = _time(as_of)
    _require(isinstance(bundle["sources"], list) and 0 < len(bundle["sources"]) <= 100, "Bounded nonempty sources required")
    _require(isinstance(bundle["contexts"], list) and 0 < len(bundle["contexts"]) <= 1000, "Bounded nonempty contexts required")
    sources, documents = {}, set()
    for source in bundle["sources"]:
        _source(source, clock)
        _require(source["id"] not in sources and source["document_id"] not in documents, "Duplicate source identity")
        sources[source["id"]] = source
        documents.add(source["document_id"])
    if source_bytes is not None:
        _require(isinstance(source_bytes, dict) and set(source_bytes) == set(sources), "Source byte coverage must be complete")
        for key, source in sources.items():
            verify_source_bytes(source, source_bytes[key])
    records, ids, claims = [], set(), set()
    for context in bundle["contexts"]:
        _object(context, _CONTEXT_KEYS, "context")
        _require(isinstance(context["source_id"], str) and context["source_id"] in sources, "Missing context source")
        source = sources[context["source_id"]]
        figures = _context(context, source, clock)
        _require(context["id"] not in ids, "Duplicate context identity")
        ids.add(context["id"])
        for figure in figures:
            claim_id = figure["claim"]["claim_id"]
            _require(claim_id not in claims, "Duplicate numerical claim")
            claims.add(claim_id)
        record = deepcopy(context)
        record.update(numeric_claims=figures, status="PROVISIONAL", source=deepcopy(source),
                      canonical_project_id=None, canonical_binding="UNLINKED",
                      current_delivery="UNKNOWN", current_site_supply_mw=None,
                      current_storage_energy_mwh=None, research_action=_ACTIONS[context["relationship"]],
                      source_document_age_days=None if source["published_date"] is None else
                      (clock.date() - _day(source["published_date"])).days)
        records.append(record)
    normalized = {"schema": INPUT_SCHEMA, "sources": sorted(deepcopy(bundle["sources"]), key=lambda s: s["id"]),
                  "contexts": sorted(deepcopy(bundle["contexts"]), key=lambda c: c["id"])}
    return {"schema": SCHEMA, "as_of": as_of, "context_count": len(records), "numeric_claim_count": len(claims),
            "input_sha256": hashlib.sha256(dumps(normalized).encode()).hexdigest(),
            "source_byte_validation": "MATCHED_SUPPLIED_BYTES" if source_bytes is not None else "RECEIPTS_ONLY",
            "coverage": "BOUNDED_PRIMARY_SOURCE_SLICE", "linked_project_count": 0,
            "records": sorted(records, key=lambda r: r["id"]),
            "limitations": ["Dated source claims are provisional; present delivery is unknown.",
                            "No canonical site crosswalk, proximity inference, quantity allocation or aggregation.",
                            "Receipt hashes identify observed bytes, not source truth or publication rights."]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--as-of", required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    _require(args.input.stat().st_size <= 4 * 1024 * 1024, "Input exceeds bound")
    result = dumps(build(json.loads(args.input.read_text(encoding="utf-8")), as_of=args.as_of))
    if args.output:
        with args.output.open("x", encoding="utf-8", newline="\n") as handle:
            handle.write(result)
    else:
        print(result, end="")


if __name__ == "__main__":
    main()
