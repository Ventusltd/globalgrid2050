"""Offline, bounded SEC submission metadata adapter. No network or publication.

Caller supplies exact downloaded bytes and a separately reviewed issuer scope.
Receipt consistency is checked; this does not authenticate a caller's attestation.
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import date, datetime
from pathlib import Path

MAX_BYTES = 4_000_000
MAX_ROWS = 10_000
FORMS = frozenset(f + suffix for f in ("10-K", "10-Q", "20-F", "40-F", "8-K", "6-K") for suffix in ("", "/A"))
COLUMNS = ("accessionNumber", "filingDate", "reportDate", "acceptanceDateTime", "form", "primaryDocument")


class FilingError(ValueError):
    """Unusable source bytes, provenance or issuer scope; no partial output."""


def _text(value, label, maximum=250):
    if not isinstance(value, str) or not value.strip() or len(value) > maximum or any(ord(c) < 32 for c in value):
        raise FilingError(f"Invalid {label}")
    return value


def _cik(value):
    if type(value) not in (str, int) or not re.fullmatch(r"[0-9]{1,10}", str(value)) or int(value) == 0:
        raise FilingError("Invalid CIK")
    return str(value).zfill(10)


def _time(value, label):
    _text(value, label, 40)
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})", value):
        raise FilingError(f"Invalid {label}")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise FilingError(f"Invalid {label}") from exc
    return parsed


def _date(value, label):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise FilingError(f"Invalid {label}")
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise FilingError(f"Invalid {label}") from exc


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise FilingError("Duplicate JSON key")
        result[key] = value
    return result


def _reject_constant(value):
    raise FilingError(f"Invalid JSON constant: {value}")


def normalize_submissions(raw: bytes, *, receipt: dict, issuer_scope: dict, limit: int = 20) -> dict:
    """Return provisional filing metadata; never figures, group links or acceptance.

    issuer_scope is an explicit external allowlist decision for a listed corporate
    group, bound to these exact source bytes. Unknown/non-group/SME scopes fail.
    SEC operating type, listing arrays and non-small-reporting category provide
    additional gates; they do not independently establish a parent relationship.
    """
    if not isinstance(raw, bytes) or not 0 < len(raw) <= MAX_BYTES:
        raise FilingError("Source byte limit")
    if type(limit) is not int or not 1 <= limit <= 100:
        raise FilingError("Invalid limit")
    if not isinstance(receipt, dict) or not isinstance(issuer_scope, dict):
        raise FilingError("Receipt and issuer scope required")
    digest = hashlib.sha256(raw).hexdigest()
    cik = _cik(issuer_scope.get("cik"))
    source_url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    if (receipt.get("source_id") != "us-sec-edgar" or receipt.get("requested_url") != source_url
            or receipt.get("final_url") != source_url or type(receipt.get("http_status")) is not int
            or receipt["http_status"] != 200 or receipt.get("payload_sha256") != digest
            or type(receipt.get("bytes")) is not int or receipt["bytes"] != len(raw)
            or receipt.get("eligible_for_publication") is not False
            or str(receipt.get("content_type", "")).split(";", 1)[0].strip().lower() != "application/json"):
        raise FilingError("Source receipt mismatch or ineligible HTTP content")
    retrieved = _time(receipt.get("retrieved_at"), "retrieved_at")
    if (issuer_scope.get("entity_kind") != "listed_corporate_group"
            or issuer_scope.get("decision") != "ALLOW_METADATA_RESEARCH"
            or issuer_scope.get("payload_sha256") != digest
            or issuer_scope.get("includes_personal_or_sme_enrichment") is not False):
        raise FilingError("Explicit listed-group research scope required")
    review_url = _text(issuer_scope.get("review_url"), "scope review URL", 500)
    if not re.fullmatch(r"https://github\.com/Ventusltd/neural-link-between-agents/issues/[1-9][0-9]*#issuecomment-[1-9][0-9]*", review_url):
        raise FilingError("Scope review must identify a public Neural Link decision")
    reviewed = _time(issuer_scope.get("reviewed_at"), "reviewed_at")
    if reviewed < retrieved:
        raise FilingError("Scope review predates source receipt")
    try:
        payload = json.loads(raw, object_pairs_hook=_pairs, parse_constant=_reject_constant)
    except (ValueError, UnicodeError, RecursionError) as exc:
        raise FilingError("Invalid JSON source") from exc
    if not isinstance(payload, dict) or _cik(payload.get("cik")) != cik:
        raise FilingError("Issuer CIK mismatch")
    name = _text(payload.get("name"), "issuer name")
    if payload.get("entityType") != "operating":
        raise FilingError("Only operating corporate issuers")
    category = _text(payload.get("category"), "issuer category")
    if category.lower() not in {"large accelerated filer", "accelerated filer"}:
        raise FilingError("Small/unknown reporting category excluded")
    tickers, exchanges = payload.get("tickers"), payload.get("exchanges")
    if (not isinstance(tickers, list) or not isinstance(exchanges, list)
            or not 0 < len(tickers) <= 100 or not 0 < len(exchanges) <= 100):
        raise FilingError("Listing metadata required")
    for value in tickers + exchanges:
        _text(value, "listing value", 100)
    if issuer_scope.get("ticker") not in tickers or issuer_scope.get("exchange") not in exchanges:
        raise FilingError("Scoped listing not in source")
    filings = payload.get("filings")
    recent = filings.get("recent") if isinstance(filings, dict) else None
    if not isinstance(recent, dict) or any(not isinstance(recent.get(key), list) for key in COLUMNS):
        raise FilingError("Required recent column arrays missing")
    count = len(recent["accessionNumber"])
    if count > MAX_ROWS or any(len(recent[key]) != count for key in COLUMNS):
        raise FilingError("Unaligned or oversized column arrays")
    records, seen = [], set()
    for index in range(count):
        accession = recent["accessionNumber"][index]
        if not isinstance(accession, str) or not re.fullmatch(r"[0-9]{10}-[0-9]{2}-[0-9]{6}", accession) or accession in seen:
            raise FilingError("Invalid or duplicate accession")
        seen.add(accession)
        form = _text(recent["form"][index], "form", 30)
        if form not in FORMS:
            continue  # Explicitly excludes insider/person forms; copies none of their fields.
        filed = _date(recent["filingDate"][index], "filing date")
        accepted_text = recent["acceptanceDateTime"][index]
        accepted = _time(accepted_text, "acceptance time")
        if accepted > retrieved or filed > retrieved.date():
            raise FilingError("Filing after retrieval")
        report = recent["reportDate"][index]
        if report in ("", None):
            report = None
        elif _date(report, "report date") > filed:
            raise FilingError("Report date after filing")
        document = recent["primaryDocument"][index]
        if not isinstance(document, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,254}", document) or ".." in document:
            raise FilingError("Unsafe primary document")
        document_url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession.replace('-', '')}/{document}"
        records.append({
            "filing_id": f"sec:{accession}", "issuer_id": f"sec-cik:{cik}",
            "form": form, "filing_date": filed.isoformat(), "report_date": report,
            "accepted_at": accepted_text, "document_url": document_url,
            "source_row": index, "is_amendment": form.endswith("/A"),
            "restatement_status": "UNKNOWN", "supersedes": None,
            "document_sha256": None, "status": "PROVISIONAL", "figures": [],
        })
    return {
        "schema": "globalgrid2050.filing-metadata.sec.v1", "source_id": "us-sec-edgar",
        "issuer": {"id": f"sec-cik:{cik}", "name": name, "category": category,
                   "tickers": list(tickers), "exchanges": list(exchanges)},
        "receipt": {"source_url": source_url, "payload_sha256": digest,
                    "bytes": len(raw), "retrieved_at": receipt["retrieved_at"]},
        "scope_review": {"url": review_url, "reviewed_at": issuer_scope["reviewed_at"],
                         "authentication": "NOT_AUTHENTICATED_BY_OFFLINE_ADAPTER"},
        "input_rows": count, "supported_rows": len(records), "returned_rows": min(limit, len(records)),
        "selection_truncated": len(records) > limit, "coverage": "RECENT_ARRAY_ONLY",
        "filings": records[:limit], "status": "PROVISIONAL",
        "eligible_for_publication": False, "automatic_collection_enabled": False,
        "group_relationships": [], "financial_claims": [],
    }


def load_registry() -> dict:
    """Return a fresh disabled source inventory, never a collector configuration."""
    return json.loads(Path(__file__).with_name("sources.json").read_text(encoding="utf-8"))
