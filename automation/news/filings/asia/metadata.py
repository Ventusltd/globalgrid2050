"""Validate supplied official disclosure metadata without extracting claims.

Transport receipts and identity assertions remain supplied evidence, not an
independent authentication. No network request, body persistence or publication
is performed. All registered collection interfaces remain disabled.
"""
from __future__ import annotations

from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

MAX_DOCUMENT_BYTES = 4 * 1024 * 1024
_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:/&-]{0,159}\Z")
_SHA = re.compile(r"[0-9a-f]{64}\Z")
_TIME = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})\Z")


def source_registry() -> dict:
    """Return a detached registry; reachability never grants collection rights."""
    return json.loads(Path(__file__).with_name("sources.json").read_text(encoding="utf-8"))


def _object(value, keys, name):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise ValueError(f"{name} requires exactly: {', '.join(sorted(keys))}")
    return value


def _identifier(value, name):
    if not isinstance(value, str) or not _ID.fullmatch(value):
        raise ValueError(f"Invalid {name}")
    return value


def _url(value, source):
    if (not isinstance(value, str) or len(value) > 2048
            or any(ord(c) <= 32 for c in value) or "\\" in value):
        raise ValueError("Invalid official source URL")
    try:
        parsed = urlsplit(value)
        if (parsed.scheme != "https" or parsed.hostname not in source["allowed_hosts"]
                or parsed.port not in {None, 443} or parsed.username is not None
                or parsed.password is not None or parsed.fragment):
            raise ValueError("URL must use a registered official HTTPS host")
    except (TypeError, ValueError) as exc:
        raise ValueError("URL must use a registered official HTTPS host") from exc
    return value


def _instant(value):
    if not isinstance(value, str) or not _TIME.fullmatch(value):
        raise ValueError("Timestamp requires seconds and explicit timezone")
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError as exc:
        raise ValueError("Invalid timestamp") from exc


def normalize_disclosure(metadata: dict, *, document_bytes: bytes) -> dict:
    """Produce a quarantined, deterministic metadata record from supplied bytes.

    Strict keys exclude bodies, quotations, person profiles and numerical
    claims. Values in identity_evidence are review assertions supplied by a
    caller; this validator never independently grants identity or rights.
    A matching content hash proves byte consistency only. Publication is false
    regardless of supplied evidence because no registered source is approved.
    """
    _object(metadata, {"source_id", "issuer_code", "document_id", "document_url",
                       "published", "identity_evidence", "receipt"}, "metadata")
    registry = source_registry()
    source_id = _identifier(metadata["source_id"], "source_id")
    if source_id not in registry["sources"]:
        raise ValueError("Unknown disclosure source")
    source = registry["sources"][source_id]
    code = metadata["issuer_code"]
    if not isinstance(code, str) or not re.fullmatch(source["issuer_code_pattern"], code):
        raise ValueError("Issuer code must use the source-specific syntax")
    document_id = _identifier(metadata["document_id"], "document_id")
    document_url = _url(metadata["document_url"], source)
    identity = _object(metadata["identity_evidence"], {
        "issuer_id", "listed_parent_id", "relation", "eligibility",
        "listing_evidence_url", "group_evidence_url", "eligibility_evidence_url",
        "reviewed_at"}, "identity_evidence")
    issuer_id = f"{source_id}:{code}"
    if identity["issuer_id"] != issuer_id:
        raise ValueError("Identity evidence must bind the exact source and issuer code")
    parent = _identifier(identity["listed_parent_id"], "listed_parent_id")
    if identity["relation"] not in {"self", "subsidiary"}:
        raise ValueError("Explicit group relationship evidence required")
    if (identity["relation"] == "self") != (parent == issuer_id):
        raise ValueError("Group relationship contradicts the issuer/parent IDs")
    if identity["eligibility"] != "eligible_listed_parent_group":
        raise ValueError("Unresolved, SME or personal enrichment is excluded")
    for key in ("listing_evidence_url", "group_evidence_url", "eligibility_evidence_url"):
        _url(identity[key], source)
    _instant(identity["reviewed_at"])
    receipt = _object(metadata["receipt"], {
        "requested_url", "final_url", "http_status", "retrieved_at", "sha256"}, "receipt")
    for key in ("requested_url", "final_url"):
        _url(receipt[key], source)
    if receipt["final_url"] != document_url:
        raise ValueError("Receipt final URL must bind the supplied document URL")
    if type(receipt["http_status"]) is not int or receipt["http_status"] != 200:
        raise ValueError("Receipt must describe successful document retrieval")
    retrieved_at = _instant(receipt["retrieved_at"])
    if not isinstance(document_bytes, bytes) or not 0 < len(document_bytes) <= MAX_DOCUMENT_BYTES:
        raise ValueError("Document bytes missing or exceed the bounded input size")
    digest = hashlib.sha256(document_bytes).hexdigest()
    if not isinstance(receipt["sha256"], str) or not _SHA.fullmatch(receipt["sha256"]) or receipt["sha256"] != digest:
        raise ValueError("Document bytes do not match the supplied receipt")
    published = _object(metadata["published"], {"value", "precision"}, "published")
    if published["precision"] == "second":
        if _instant(published["value"]) > retrieved_at:
            raise ValueError("Publication postdates retrieval")
    elif published["precision"] == "day":
        value = published["value"]
        if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError("Day precision requires YYYY-MM-DD")
        local_day = retrieved_at.astimezone(timezone(timedelta(minutes=source["utc_offset_minutes"]))).date()
        if date.fromisoformat(value) > local_day:
            raise ValueError("Publication day postdates retrieval in source timezone")
    else:
        raise ValueError("Only observed day or second precision is supported")
    # Never derive issuer/group identity from a name, title, URL substring or hash.
    return {
        "schema": "globalgrid2050.asia-filing-metadata.v1",
        "id": f"{source_id}:{code}:{document_id}",
        "source_id": source_id, "market": source["market"],
        "issuer_id": issuer_id, "listed_parent_id": parent,
        "document_id": document_id, "document_url": document_url,
        "published": deepcopy(published), "receipt": deepcopy(receipt),
        "identity_evidence": deepcopy(identity), "document_byte_count": len(document_bytes),
        "document_bytes_checked": True,
        "status": "PROVISIONAL", "independently_verified": False,
        "publishable": False, "collection_enabled": False,
        "rights_status": source["rights_status"],
        "hold_reasons": ["source_collection_disabled", "rights_not_approved", "independent_review_required"],
    }
