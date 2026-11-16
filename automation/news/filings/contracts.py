"""Exact, provisional numerical claims for successor filings and project inputs.

Public API: ``validate_claim(mapping)`` returns an independent validated dict;
``dumps_claim(mapping)`` returns deterministic JSON. Invalid input raises
``ClaimValidationError`` (a ValueError). Standard library only; no I/O.

All keys below are required (nullable means an explicit JSON null). Unknown keys
are rejected at every level. The schema is ``globalgrid2050.filing-figure.v1``::

    {
      "schema": "globalgrid2050.filing-figure.v1",
      "claim_id": "sec:example-filing:capex:1",
      "status": "machine-provisional",
      "quantity_kind": "finance", "metric": "Capital expenditure",
      "value": "1.20", "scale": "1e9",
      "unit": "currency", "original_unit": "billion US dollars",
      "currency": "USD", "finance_stage": "announced",
      "entity": {"scope": "consolidated_group", "id": "group:example",
                 "consolidation_group_id": "group:example",
                 "identity_evidence_url": "https://www.sec.gov/example"},
      "reporting_period": {"start": "2026", "end": "2026"},
      "as_of": "2026-10-31", "basis": "forecast", "assurance": "unknown",
      "provenance": {"document_id": "sec:example-filing",
                     "document_url": "https://www.sec.gov/example",
                     "sha256": "<64 lowercase hex characters>",
                     "page": "12", "section": "Capital expenditure",
                     "published_date": "2026-11-01",
                     "retrieved_at": "2026-11-16T12:00:00Z"},
      "revision": {"id": "original", "supersedes_claim_id": null,
                   "restated": false}
    }

The example is synthetic documentation, not a claim about a real company.
Dates retain their source precision: YYYY, YYYY-MM or YYYY-MM-DD. Period ends
must have the same precision; absent period/as_of can be null, but not both.
Source publication may be null. Retrieval requires a timezone-aware timestamp.
Dates are not expanded in output. Forecast periods/as_of may be in the future;
source publication must still precede retrieval. ``metric`` retains the source's
measure label (for example capital expenditure versus revenue); no metric is
inferred from the number or its unit.
Calendar-only comparisons use the supplied retrieval offset. When a source
uses a different calendar timezone, callers must express the retrieval instant
in that evidenced source timezone. Unknown source timezone can produce a
conservative rejection at a day boundary; this validator does not infer it.

``value`` is an exact plain decimal string (signed financial values supported).
``scale`` is one of 1/1e3/1e6/1e9/1e12; source spelling is in original_unit.
No numerical transformation is performed: 1.20 billion is not rounded to 1.2.
Power kinds accept W/kW/MW/GW; storage_energy/generation_energy/
energy_procurement accept Wh/kWh/MWh/GWh/TWh. Finance requires unit=currency,
an explicit three-letter uppercase currency label, and finance_stage of
announced/committed/disbursed/reported. A label is not a currency-registry check.
Nonfinance claims require currency and finance_stage to be null. Source-reported
power/energy quantities cannot be negative. Unknown quantities are omitted by
the upstream adapter, never represented by fabricated zero or a null value.

Entity scopes: issuer, consolidated_group, project, site, campus, phase,
public_institution. Group totals stay at group scope; the explicit nullable
consolidation_group_id preserves known overlap with subsidiaries. No summation,
FX, inference, extraction, verified-state transition, or aggregation API exists.
In particular, two individually valid claims are NOT automatically additive.
Use a separate evidenced group/project association before displaying a figure
on a project; a shared name or nearby grid asset is insufficient.
Regional aggregate scopes are not supported by v1 and must not be relabelled as
projects or sites to pass validation.

This validator checks shape and internal semantics, not truth, identity,
publisher rights, audit validity, source accessibility, or DNS. Source-policy
and independent-review gates belong to the calling producer. HTTPS URLs get a
conservative syntax/public-literal check only; this module never fetches them.
Provenance hashes are required but must be matched to publisher bytes upstream.
The provenance document must support this particular number and scope; a
secondary discovery link alone is not numerical evidence. Discovery/reporting
links belong in the caller's separate metadata, not invented claim provenance.
Caller-provided assurance=audited remains a provisional *source assertion*.
The contract never certifies rights or allows publication by itself.
"""

from __future__ import annotations

from collections.abc import Mapping
from copy import deepcopy
from datetime import date, datetime
from decimal import Decimal
import ipaddress
import json
import re
from typing import Any
from urllib.parse import urlsplit

SCHEMA = "globalgrid2050.filing-figure.v1"
STATUS = "machine-provisional"
POWER_KINDS = frozenset({
    "generation_power", "storage_power", "it_load", "project_demand",
    "secured_connection", "energised_load", "grid_upgrade",
})
ENERGY_KINDS = frozenset({"storage_energy", "generation_energy", "energy_procurement"})
QUANTITY_KINDS = POWER_KINDS | ENERGY_KINDS | {"finance"}
ENTITY_SCOPES = frozenset({
    "issuer", "consolidated_group", "project", "site", "campus", "phase",
    "public_institution",
})
_TOP_KEYS = frozenset({
    "schema", "claim_id", "status", "quantity_kind", "metric", "value", "scale", "unit",
    "original_unit", "currency", "finance_stage", "entity", "reporting_period",
    "as_of", "basis", "assurance", "provenance", "revision",
})
_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}\Z")
_DECIMAL = re.compile(r"-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?\Z")
_DATE = re.compile(r"[0-9]{4}(?:-[0-9]{2}(?:-[0-9]{2})?)?\Z")
_TIME = re.compile(
    r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}"
    r"(?:\.[0-9]{1,6})?(?:Z|[+-][0-9]{2}:[0-9]{2})\Z"
)
_HOST_LABEL = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\Z")


class ClaimValidationError(ValueError):
    """A claim is malformed or has incompatible numerical semantics."""


def _fail(field: str, reason: str) -> None:
    # Do not echo an untrusted value, document body or URL into logs.
    raise ClaimValidationError(f"{field}: {reason}")


def _object(value: Any, keys: frozenset[str] | set[str], field: str) -> dict:
    if not isinstance(value, Mapping) or set(value) != keys:
        _fail(field, "expected exactly the documented fields")
    return dict(value)


def _text(value: Any, field: str, max_length: int = 200) -> str:
    if (not isinstance(value, str) or not value or len(value) > max_length
            or value != value.strip() or any(ord(c) < 32 or ord(c) == 127
                                            or 0xD800 <= ord(c) <= 0xDFFF for c in value)):
        _fail(field, "expected bounded nonempty text without control characters")
    return value


def _identifier(value: Any, field: str) -> str:
    if not isinstance(value, str) or not _ID.fullmatch(value):
        _fail(field, "expected a bounded source-namespaced identifier")
    return value


def _choice(value: Any, choices: set[str] | frozenset[str], field: str) -> str:
    if not isinstance(value, str) or value not in choices:
        _fail(field, "unsupported value")
    return value


def _source_date(value: Any, field: str) -> date:
    """Return earliest possible day for comparison, never for serialization."""
    if not isinstance(value, str) or not _DATE.fullmatch(value):
        _fail(field, "expected YYYY, YYYY-MM or YYYY-MM-DD")
    parts = [int(p) for p in value.split("-")]
    try:
        return date(*parts, *([1] * (3 - len(parts))))
    except ValueError:
        _fail(field, "invalid calendar date")


def _timestamp(value: Any, field: str) -> datetime:
    if not isinstance(value, str) or not _TIME.fullmatch(value):
        _fail(field, "expected a timestamp with explicit UTC offset")
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        _fail(field, "invalid timestamp")


def _url(value: Any, field: str) -> str:
    _text(value, field, 2048)
    if any(c.isspace() for c in value) or "\\" in value or not value.isascii():
        _fail(field, "expected an ASCII HTTPS URL without whitespace or backslashes")
    try:
        parsed = urlsplit(value)
        host = parsed.hostname
        port = parsed.port
    except ValueError:
        _fail(field, "invalid URL")
    if (parsed.scheme != "https" or not host or parsed.username is not None
            or parsed.password is not None or port not in (None, 443)):
        _fail(field, "expected public HTTPS URL without credentials/custom port")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        labels = host.split(".")
        # Numeric last labels include browser IPv4 aliases: 127.1, octal/hex,
        # one-number IPv4 and dotted variants. No IDNA or DNS is performed.
        if (len(labels) < 2 or not all(_HOST_LABEL.fullmatch(p) for p in labels)
                or not re.fullmatch(r"[a-z]{2,63}", labels[-1])
                or labels[-1] in {"localhost", "local", "internal", "test", "invalid"}):
            _fail(field, "expected a public DNS-form hostname")
    else:
        if not address.is_global or address.is_multicast:
            _fail(field, "nonpublic IP literal")
    return value


def validate_claim(claim: Mapping[str, Any]) -> dict[str, Any]:
    """Validate one claim, retaining source precision and returning a deep copy.

    Does not fetch, verify, aggregate, convert, or mutate its input. Unknown keys
    fail closed instead of passing through personal fields or hidden extras.
    """
    c = _object(claim, _TOP_KEYS, "claim")
    _choice(c["schema"], {SCHEMA}, "schema")
    _choice(c["status"], {STATUS}, "status")
    _identifier(c["claim_id"], "claim_id")
    kind = _choice(c["quantity_kind"], QUANTITY_KINDS, "quantity_kind")
    _text(c["metric"], "metric", 200)
    value = c["value"]
    if not isinstance(value, str) or len(value) > 100 or not _DECIMAL.fullmatch(value):
        _fail("value", "expected an exact plain decimal string of at most 100 characters")
    if kind != "finance" and Decimal(value) < 0:
        _fail("value", "power/energy quantities cannot be negative")
    _choice(c["scale"], {"1", "1e3", "1e6", "1e9", "1e12"}, "scale")
    _text(c["original_unit"], "original_unit", 100)
    if kind == "finance":
        _choice(c["unit"], {"currency"}, "unit")
        if not isinstance(c["currency"], str) or not re.fullmatch(r"[A-Z]{3}", c["currency"]):
            _fail("currency", "finance requires the source's three-letter currency label")
        _choice(c["finance_stage"], {"announced", "committed", "disbursed", "reported"},
                "finance_stage")
    else:
        units = {"W", "kW", "MW", "GW"} if kind in POWER_KINDS else {"Wh", "kWh", "MWh", "GWh", "TWh"}
        _choice(c["unit"], units, "unit")
        if c["currency"] is not None or c["finance_stage"] is not None:
            _fail("currency/finance_stage", "must be null for power/energy claims")
    entity = _object(c["entity"], {"scope", "id", "consolidation_group_id", "identity_evidence_url"}, "entity")
    scope = _choice(entity["scope"], ENTITY_SCOPES, "entity.scope")
    _identifier(entity["id"], "entity.id")
    _url(entity["identity_evidence_url"], "entity.identity_evidence_url")
    group_id = entity["consolidation_group_id"]
    if group_id is not None:
        _identifier(group_id, "entity.consolidation_group_id")
    if scope == "consolidated_group" and group_id != entity["id"]:
        _fail("entity.consolidation_group_id", "group totals must retain their own group identity")
    _choice(c["basis"], {"reported", "forecast"}, "basis")
    _choice(c["assurance"], {"audited", "unaudited", "unknown"}, "assurance")
    if c["basis"] == "forecast" and c["assurance"] == "audited":
        _fail("assurance", "forecast must not be represented as an audited actual")
    provenance = _object(c["provenance"], {
        "document_id", "document_url", "sha256", "page", "section", "published_date", "retrieved_at",
    }, "provenance")
    _identifier(provenance["document_id"], "provenance.document_id")
    _url(provenance["document_url"], "provenance.document_url")
    digest = provenance["sha256"]
    if not isinstance(digest, str) or not re.fullmatch(r"[a-f0-9]{64}", digest):
        _fail("provenance.sha256", "expected lowercase SHA256 of source bytes")
    for locator in ("page", "section"):
        if provenance[locator] is not None:
            _text(provenance[locator], f"provenance.{locator}")
    if provenance["page"] is None and provenance["section"] is None:
        _fail("provenance", "a page or section locator is required")
    retrieved = _timestamp(provenance["retrieved_at"], "provenance.retrieved_at").date()
    if provenance["published_date"] is not None:
        if _source_date(provenance["published_date"], "provenance.published_date") > retrieved:
            _fail("provenance.published_date", "publication cannot follow retrieval")
    if c["as_of"] is not None:
        if _source_date(c["as_of"], "as_of") > retrieved and c["basis"] != "forecast":
            _fail("as_of", "future observation/target date requires explicit forecast basis")
    period = c["reporting_period"]
    if period is not None:
        period = _object(period, {"start", "end"}, "reporting_period")
        start = _source_date(period["start"], "reporting_period.start")
        end = _source_date(period["end"], "reporting_period.end")
        if len(period["start"]) != len(period["end"]) or end < start:
            _fail("reporting_period", "ordered bounds with equal source precision required")
        if c["basis"] == "reported" and end > retrieved:
            _fail("reporting_period", "future period requires explicit forecast basis")
    elif c["as_of"] is None:
        _fail("reporting_period/as_of", "at least one source-stated temporal basis is required")
    revision = _object(c["revision"], {"id", "supersedes_claim_id", "restated"}, "revision")
    _identifier(revision["id"], "revision.id")
    previous = revision["supersedes_claim_id"]
    if previous is not None:
        _identifier(previous, "revision.supersedes_claim_id")
        if previous == c["claim_id"]:
            _fail("revision.supersedes_claim_id", "a new claim cannot supersede itself")
    if not isinstance(revision["restated"], bool):
        _fail("revision.restated", "expected a boolean")
    if revision["restated"] and previous is None:
        _fail("revision.supersedes_claim_id", "restatement requires an explicit earlier claim")
    # Normalize Mapping containers, not numerical/date/source lexemes.
    c["entity"], c["provenance"], c["revision"], c["reporting_period"] = entity, provenance, revision, period
    return deepcopy(c)


def dumps_claim(claim: Mapping[str, Any]) -> str:
    """Canonical UTF-8-compatible JSON; decimal values remain strings."""
    return json.dumps(validate_claim(claim), ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), allow_nan=False)
