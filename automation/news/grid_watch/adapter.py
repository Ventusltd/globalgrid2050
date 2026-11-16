"""Conservative UK electricity-grid evidence adapter for Pipeline News.

Offline, deterministic and dependency-free. Does not fetch, grant reuse rights,
certify a grid connection, or declare any scheme commissioned.
"""
from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
import json
import re
from urllib.parse import urlsplit

STAGES = frozenset({"unknown", "proposed", "consented", "financed", "under_construction", "commissioned"})
OPERATOR_ROLES = frozenset({"system_operator", "transmission_owner", "distribution_operator", "regulator"})
FIELDS = frozenset({"source_id", "source_url", "source_record_id", "source_sha256", "published_at",
                   "retrieved_at", "scheme_id", "scheme_name", "network_operator", "network_type",
                   "region", "stage", "reported_metric", "etys_node_code"})
METRIC_UNITS = frozenset({"kV", "km", "MW", "MVA", "GBP"})
METRIC_KINDS = frozenset({"voltage", "route_length", "reported_power", "equipment_rating", "funding_allocation"})


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def _timestamp(value, *, required=False):
    if value is None and not required:
        return None
    if not isinstance(value, str) or not value.endswith("Z"):
        raise ValueError("timestamps must be explicit UTC ISO-8601 Z or null")
    try:
        date = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("invalid timestamp") from exc
    if date.utcoffset() != timezone.utc.utcoffset(date):
        raise ValueError("UTC required")
    return date.isoformat().replace("+00:00", "Z")


def _text(value, label, *, optional=False):
    if value is None and optional:
        return None
    if not isinstance(value, str) or not value.strip() or len(value) > 240:
        raise ValueError(f"invalid {label}")
    if any(ord(c) < 32 for c in value):
        raise ValueError(f"control character in {label}")
    return value.strip()


def _source_url(value, hostname):
    if not isinstance(value, str):
        raise ValueError("source URL required")
    p = urlsplit(value)
    if (p.scheme != "https" or p.hostname != hostname or p.username or p.password
            or p.port or p.fragment or not p.path.startswith("/")):
        raise ValueError("unapproved source URL")
    return value


def normalise(record, sources):
    """Accept one explicitly attributed operator notice; do not infer matches.

    sources maps registry source_id -> {publisher, operator, role, hostname}.
    Returned records are REVIEW_REQUIRED; publishing and rights approval are external gates.
    """
    if not isinstance(record, dict) or set(record) - FIELDS:
        raise ValueError("unexpected evidence fields")
    key = _text(record.get("source_id"), "source id")
    source = sources.get(key)
    if not isinstance(source, dict) or source.get("role") not in OPERATOR_ROLES:
        raise ValueError("unknown official source")
    url = _source_url(record.get("source_url"), source["hostname"])
    title = _text(record.get("scheme_name"), "scheme name")
    operator = _text(record.get("network_operator"), "operator")
    if operator != source["operator"]:
        raise ValueError("source/operator disagreement")
    network_type = record.get("network_type")
    if network_type not in ("transmission", "distribution", "system", "regulation"):
        raise ValueError("unknown network type")
    stage = record.get("stage", "unknown")
    if stage not in STAGES:
        raise ValueError("unrecognised project stage")
    scheme_id = _text(record.get("scheme_id"), "scheme id", optional=True)
    source_record_id = _text(record.get("source_record_id"), "record id", optional=True)
    region = _text(record.get("region"), "region", optional=True)
    source_hash = record.get("source_sha256")
    if source_hash is not None and (not isinstance(source_hash, str) or not re.fullmatch(r"[a-f0-9]{64}", source_hash)):
        raise ValueError("invalid source byte hash")
    published = _timestamp(record.get("published_at"))
    retrieved = _timestamp(record.get("retrieved_at"), required=True)
    if published and published > retrieved:
        raise ValueError("publication after retrieval")
    node = record.get("etys_node_code")
    if node is not None and (not isinstance(node, str) or not re.fullmatch(r"[A-Z0-9]{3,12}", node)):
        raise ValueError("ETYS reference must be an exact supplied code")
    metric = record.get("reported_metric")
    if metric is not None:
        if not isinstance(metric, dict) or set(metric) != {"value", "unit", "kind"}:
            raise ValueError("invalid reported metric structure")
        value = metric["value"]
        if type(value) not in (int, float) or not 0 <= value < 1e12:
            raise ValueError("invalid metric value")
        if metric["unit"] not in METRIC_UNITS or metric["kind"] not in METRIC_KINDS:
            raise ValueError("metric unit/kind not recognised")
        allowed = {"voltage": "kV", "route_length": "km", "reported_power": "MW",
                   "equipment_rating": "MVA", "funding_allocation": "GBP"}
        if allowed[metric["kind"]] != metric["unit"]:
            raise ValueError("metric kind/unit mismatch")
    fact = {"source_id": key, "url": url, "source_record_id": source_record_id,
            "source_sha256": source_hash, "published_at": published,
            "scheme_id": scheme_id, "scheme_name": title, "network_operator": operator,
            "network_type": network_type, "region": region, "stage": stage,
            "reported_metric": metric, "etys_node_code": node}
    event_id = sha256(canonical(fact)).hexdigest()
    return {
        "record_id": "grid:" + event_id[:24],
        "scheme": {"name": title, "scheme_id": scheme_id,
                   "scheme_key": f"{operator}:{scheme_id}" if scheme_id else None,
                   "operator": operator, "network_type": network_type, "region": region},
        "evidence": {"source_id": key, "publisher": source["publisher"], "role": source["role"],
                     "url": url, "source_record_id": source_record_id,
                     "source_sha256": source_hash, "published_at": published,
                     "retrieved_at": retrieved, "reported_stage": stage,
                     "licence_state": "UNASSESSED", "review_state": "REVIEW_REQUIRED"},
        "reported_metric": metric,
        "links": {"repd_ref": None, "grid_connection": None, "available_capacity_mw": None,
                  "etys_node_code_as_reported": node, "etys_node_link_verified": False},
        "publishable": False,
    }


def build_grid_rows(records, sources):
    """Small immutable consumer hook: input records -> sorted one-record-per-evidence rows.

    Repeated identical source observations collapse; conflicting reports do not.
    The host decides review and visibility. No map coordinates, connectivity or scores.
    """
    result = {}
    for record in records:
        row = normalise(record, sources)
        rid = row["record_id"]
        if rid not in result or row["evidence"]["retrieved_at"] > result[rid]["evidence"]["retrieved_at"]:
            result[rid] = row
    return sorted(result.values(), key=lambda r: (r["scheme"]["operator"], r["scheme"]["name"], r["record_id"]))
