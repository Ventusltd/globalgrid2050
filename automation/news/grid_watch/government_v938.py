"""V9.38 additive government-fact extension of the immutable operator adapter.

Offline, deterministic and dependency-free. Does not fetch, grant reuse rights,
certify a grid connection, or declare any scheme commissioned.
"""
from __future__ import annotations

from datetime import date
from hashlib import sha256
import re

from .adapter import (STAGES, OPERATOR_ROLES, FIELDS as OPERATOR_FIELDS,
                      METRIC_UNITS, METRIC_KINDS as OPERATOR_METRIC_KINDS,
                      canonical, _timestamp, _text, _source_url,
                      normalise as normalise_operator)

SOURCE_ROLES = OPERATOR_ROLES | {"government_authority"}
FIELDS = OPERATOR_FIELDS | {"published_date", "event_date", "milestones", "source_receipt"}
METRIC_KINDS = OPERATOR_METRIC_KINDS | {"planned_transmission_upper_bound"}
GOVERNMENT_URLS = frozenset({
    "https://www.gov.uk/government/news/sea-link-development-consent-decision-announced",
    "https://www.gov.uk/government/publications/sea-link-development-consent-order-planning-act-2008",
})
GOVERNMENT_PUBLISHERS = {
    "https://www.gov.uk/government/news/sea-link-development-consent-decision-announced": "Planning Inspectorate",
    "https://www.gov.uk/government/publications/sea-link-development-consent-order-planning-act-2008": "Department for Energy Security and Net Zero",
}
FACTS_RIGHTS_SCOPE = "government_html_facts_only_no_images_or_third_party_material"


def _day(value, label):
    if value is None:
        return None
    if (not isinstance(value, dict) or set(value) != {"value", "precision"}
            or value["precision"] != "DAY" or not isinstance(value["value"], str)
            or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value["value"])):
        raise ValueError(f"{label} must be an explicit DAY, not a fabricated midnight instant")
    try:
        date.fromisoformat(value["value"])
    except ValueError as exc:
        raise ValueError(f"invalid {label}") from exc
    return dict(value)


def _government_receipt(record, source, url, retrieved):
    receipt = record.get("source_receipt")
    expected = source.get("document_receipt")
    if (url not in GOVERNMENT_URLS or source.get("allowed_urls") != [url]
            or source.get("publisher") != GOVERNMENT_PUBLISHERS.get(url)
            or source.get("reported_operators") != ["NGET"]
            or not isinstance(receipt, dict) or receipt != expected
            or receipt.get("source_url") != url or receipt.get("http_status") != 200
            or not str(receipt.get("content_type", "")).startswith("text/html")
            or type(receipt.get("bytes")) is not int or not 0 < receipt["bytes"] <= 1000000
            or receipt.get("sha256") != record.get("source_sha256")
            or receipt.get("retrieved_at") != retrieved
            or receipt.get("licence_url") != "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
            or not isinstance(receipt.get("licence_evidence"), str)
            or "images" not in receipt["licence_evidence"].lower()):
        raise ValueError("government fact needs its exact pinned HTML and narrow rights receipt")
    return dict(receipt)


def normalise(record, sources):
    """Accept one explicitly attributed operator notice; do not infer matches.

    sources maps registry source_id -> {publisher, operator, role, hostname}.
    Returned records are REVIEW_REQUIRED; publishing and rights approval are external gates.
    """
    if isinstance(record, dict):
        source = sources.get(record.get("source_id"))
        if isinstance(source, dict) and source.get("role") != "government_authority":
            return normalise_operator(record, sources)
    if not isinstance(record, dict) or set(record) - FIELDS:
        raise ValueError("unexpected evidence fields")
    key = _text(record.get("source_id"), "source id")
    source = sources.get(key)
    if not isinstance(source, dict) or source.get("role") not in SOURCE_ROLES:
        raise ValueError("unknown official source")
    url = _source_url(record.get("source_url"), source["hostname"])
    title = _text(record.get("scheme_name"), "scheme name")
    operator = _text(record.get("network_operator"), "operator")
    government = source["role"] == "government_authority"
    if (government and (source.get("operator") is not None or operator != "NGET" or operator not in source.get("reported_operators", []))
            or not government and operator != source["operator"]):
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
    licence_state = _text(source.get("licence_state", "UNASSESSED"), "source licence state")
    published = _timestamp(record.get("published_at"))
    retrieved = _timestamp(record.get("retrieved_at"), required=True)
    published_date, event_date = _day(record.get("published_date"), "publication date"), _day(record.get("event_date"), "event date")
    if published_date and published or government and (published or not published_date or not event_date):
        raise ValueError("government publication/event clocks require separately recorded DAY precision")
    for clock in (published_date, event_date):
        if clock and clock["value"] > retrieved[:10]:
            raise ValueError("source date after retrieval")
    milestones = record.get("milestones")
    if milestones is not None:
        if not isinstance(milestones, dict) or set(milestones) - {"application_submitted", "accepted_for_examination", "recommendation"}:
            raise ValueError("unrecognised milestone clocks")
        milestones = {key: _day(value, key) for key, value in milestones.items()}
        if any(value and value["value"] > retrieved[:10] for value in milestones.values()):
            raise ValueError("milestone after retrieval")
    receipt = _government_receipt(record, source, url, retrieved) if government else None
    if not government and record.get("source_receipt") is not None:
        raise ValueError("unreviewed operator notice cannot claim government fact rights")
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
                   "equipment_rating": "MVA", "funding_allocation": "GBP", "planned_transmission_upper_bound": "MW"}
        if allowed[metric["kind"]] != metric["unit"]:
            raise ValueError("metric kind/unit mismatch")
    fact = {"source_id": key, "url": url, "source_record_id": source_record_id,
            "source_sha256": source_hash, "published_at": published,
            "scheme_id": scheme_id, "scheme_name": title, "network_operator": operator,
            "network_type": network_type, "region": region, "stage": stage,
            "reported_metric": metric, "etys_node_code": node}
    if government:
        fact.update(published_date=published_date, event_date=event_date, milestones=milestones)
    event_id = sha256(canonical(fact)).hexdigest()
    return {
        "record_id": "grid:" + event_id[:24],
        "scheme": {"name": title, "scheme_id": scheme_id,
                   "scheme_key": f"{operator}:{scheme_id}" if scheme_id and not government else None,
                   "operator": operator, "network_type": network_type, "region": region},
        "evidence": {"source_id": key, "publisher": source["publisher"], "role": source["role"],
                     "url": url, "source_record_id": source_record_id,
                     "source_sha256": source_hash, "published_at": published,
                     "retrieved_at": retrieved, "reported_stage": stage,
                     "licence_state": licence_state, "review_state": "REVIEW_REQUIRED",
                     **({"published_date": published_date, "event_date": event_date,
                         "milestones": milestones, "source_receipt": receipt} if government else {})},
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


def reviewed_government_notice(rows, approval=None):
    """One tightly bounded factual notice, hidden until independent rights reviews.

    Review references are auditable workflow inputs, not authentication or a grant
    of rights by this function. Ordinary operator rows never become publishable.
    """
    if (not isinstance(rows, list) or len(rows) != 2
            or {r.get("evidence", {}).get("url") for r in rows} != GOVERNMENT_URLS):
        raise ValueError("Sea Link needs both exact government documents")
    for row in rows:
        evidence, scheme, links = row["evidence"], row["scheme"], row["links"]
        if (evidence["role"] != "government_authority" or evidence["publisher"] != GOVERNMENT_PUBLISHERS[evidence["url"]]
                or evidence["licence_state"] not in {"OGL_V3_FACTS_REVIEW_REQUIRED", "OGL_V3_FACTS_REVIEWED"}
                or scheme["operator"] != "NGET" or scheme["scheme_id"] != "EN020026" or scheme["scheme_key"] is not None
                or evidence["reported_stage"] != "consented" or evidence["event_date"] != {"value": "2026-10-30", "precision": "DAY"}
                or evidence["published_date"] != {"value": "2026-10-30", "precision": "DAY"}
                or evidence["published_at"] is not None or any(links[key] is not None for key in ("repd_ref", "grid_connection", "available_capacity_mw"))):
            raise ValueError("unreviewed identity, clock, attribution or connection claim")
    facts = {
        "notice_id": "government:EN020026:consented:2026-10-30", "scheme": "Sea Link", "application_ref": "EN020026",
        "reported_network_operator": "NGET", "reported_stage": "consented",
        "event_date": {"value": "2026-10-30", "precision": "DAY"},
        "description": "Proposed Suffolk-Kent high voltage direct current transmission link",
        "planned_metric": {"value": 2000, "unit": "MW", "kind": "planned_transmission_upper_bound"},
        "current_capacity_mw": None, "commissioned": None, "connection": None, "repd_ref": None, "coordinates": None,
        "documents": [{"record_id": row["record_id"], **row["evidence"]} for row in sorted(rows, key=lambda r: r["evidence"]["url"])],
    }
    metrics = [row["reported_metric"] for row in rows if row["reported_metric"] is not None]
    if metrics != [facts["planned_metric"]]:
        raise ValueError("planned upper bound must remain source-qualified, not current capacity")
    digest = sha256(canonical(facts)).hexdigest()
    accepted = False
    if approval is not None:
        reviews = approval.get("reviews") if isinstance(approval, dict) else None
        accepted = (isinstance(approval, dict) and set(approval) == {"state", "rights_scope", "facts_sha256", "reviews"}
                    and approval["state"] == "APPROVED_FACTS_ONLY" and approval["rights_scope"] == FACTS_RIGHTS_SCOPE
                    and approval["facts_sha256"] == digest and isinstance(reviews, list) and len(reviews) == 2
                    and {r.get("role") for r in reviews if isinstance(r, dict)} == {"AGENT_A", "AGENT_B"}
                    and all(isinstance(r, dict) and set(r) == {"role", "decision", "reference"} and r["decision"] == "PASS"
                            and isinstance(r["reference"], str)
                            and re.fullmatch(r"https://github\.com/Ventusltd/neural-link-between-agents/issues/42#issuecomment-\d+", r["reference"]) for r in reviews)
                    and len({r["reference"] for r in reviews}) == 2)
        if not accepted:
            raise ValueError("narrow two-review fact-rights approval missing or mismatched")
    return {"schema": "globalgrid2050.reviewed-grid-notice.v1", "facts_sha256": digest, "facts": facts,
            "approval": approval, "publishable": bool(accepted),
            "review_state": "NARROW_FACTS_REVIEWED" if accepted else "REVIEW_REQUIRED",
            "notice_count": 1 if accepted else None, "document_count": 2,
            "limitations": "Government facts only; no images or third-party content, no current capacity/commissioning/connection, no REPD/ETYS join or coordinates, no interconnector row or VERIFIED association"}
