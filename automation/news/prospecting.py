"""Offline V9.26 research triage proposal; never a collector or event generator.

Run with ``python -m automation.news.prospecting --as-of UTC --out FILE``.
Optional input files require their exact SHA256. See PROSPECTING.md for the
contract, rights boundary, score semantics and intentionally unsupported inputs.
"""
from __future__ import annotations

import argparse
from datetime import date
import hashlib
import ipaddress
import json
import math
import os
from pathlib import Path
import re
import tempfile
from urllib.parse import urlsplit

from automation.news import relevance
from automation.news.acquisition import research_queue as queue
from automation.news.acquisition.evidence_store import _moment, _url, validate_snapshot

SCHEMA = "globalgrid2050.prospecting.research-triage.v1"
MAX_BYTES = 16 * 1024 * 1024
PROFILE = {
    "id": "research-triage.v1", "relevance_profile_sha256": relevance.profile_sha256(),
    "official_components": ["capacity", "technology", "national_route", "evidence_tier"],
    "fresh_provisional_evidence_points": 5, "data_centre_topic_points": 15,
    "record_stale_days": 90, "article_stale_days": 30, "retrieval_stale_days": 14,
    "tie_break": "source-qualified ID ascending", "maximum_output_records": 1000,
}
# Scope: qualifying project-evidence inputs only. Separate News-owner Bloomberg
# DISCOVERY_ONLY headline/link display is permitted by NL42/6923484114; it cannot
# supply follow-up/heat points or substantiate figures through this adapter.
SOURCE_POLICY = {
    "paywalled_channels": "EXCLUDED", "unknown_access": "DISABLED",
    "preferred_authorities": ["government", "regulator", "institutional_funding", "official_filings"],
    "corporate_enrichment": "LISTED_PARENT_GROUP_ONLY_WITH_IDENTITY_AND_MEMBERSHIP_EVIDENCE",
    "sme_targeting": False, "directors_officers_residential_addresses": False,
    "government_hosting_implies_reuse_permission": False,
}
BASE_URL = "https://ventusltd.github.io/globalgrid2050/uk_renewables_pipeline/" + queue.RELEASE_ID + "/"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def public_url(value):
    """Offline link syntax check only; this module never resolves or fetches URLs."""
    _url(value)
    host = urlsplit(value).hostname.lower()
    require(host.isascii() and "%" not in host, "Canonical public source hostname required")
    require(not any(c.isspace() or ord(c) < 32 for c in value) and "\\" not in value,
            "Invalid public source URL")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        address = None
    if address is not None:
        require(address.is_global and not any((address.is_multicast, address.is_reserved,
                address.is_private, address.is_loopback, address.is_link_local, address.is_unspecified)),
                "Non-public source address")
    else:
        dns_host = host.removesuffix(".")
        # Browsers interpret numeric final labels as IPv4, including short,
        # octal and hex forms that ipaddress deliberately rejects. Do not let
        # those forms fall through as DNS; do not decode escaped/Unicode hosts.
        require(not re.fullmatch(r"(?:[0-9]+|0x[0-9a-f]*)", dns_host.rsplit(".", 1)[-1]),
                "Canonical public IP address required")
        label = r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"
        require(len(dns_host) <= 253 and re.fullmatch(label + r"(?:\." + label + r")+", dns_host)
                and not dns_host.endswith((".local", ".internal", ".localhost", ".test")),
                "Public source hostname required")
    return value


def text(value, label):
    require(isinstance(value, str) and bool(value.strip()) and len(value) <= 1000,
            label + " must be bounded text")
    return value


def digest(value):
    require(isinstance(value, str) and re.fullmatch(r"[a-f0-9]{64}", value), "SHA256 required")
    return value


def pinned(spec):
    path, expected = spec
    digest(expected)
    try:
        with Path(path).open("rb") as stream:
            raw = stream.read(MAX_BYTES + 1)
        require(len(raw) <= MAX_BYTES, "Input exceeds bounded file size")
        require(hashlib.sha256(raw).hexdigest() == expected, "Input SHA256 mismatch")
        return json.loads(raw)
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError("Pinned input unavailable or invalid JSON") from exc


def clock(value, as_of):
    moment = _moment(value)
    require(moment <= as_of, "Future observation/publication timestamp")
    return moment


def freshness(value, as_of, days, basis, calendar=False):
    if value is None:
        return {"state": "UNKNOWN", "basis": basis, "timestamp": None, "age_days": None}
    if calendar:
        require(isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value),
                "Calendar date required")
        age = (as_of.date() - date.fromisoformat(value)).days
        require(age >= 0, "Future official record date")
    else:
        age = (as_of - clock(value, as_of)).total_seconds() / 86400
    return {"state": "STALE" if age > days else "WITHIN_WINDOW", "basis": basis,
            "timestamp": value, "age_days": round(age, 4)}


def capacity(value):
    require(value is None or (type(value) in (int, float) and math.isfinite(value) and value >= 0),
            "Capacity must be finite nonnegative MW or null")
    return value


def open_access(receipt, reference):
    require(isinstance(receipt, dict) and set(receipt) == {"state", "review_url", "checked_at"}
            and receipt["state"] == "OPEN", "Paywalled or unknown access is excluded")
    public_url(receipt["review_url"])
    clock(receipt["checked_at"], reference)
    return dict(receipt)


def research_policy_fields(record):
    """Existing inputs cannot establish parent eligibility or independent momentum."""
    record.update(
        corporate_eligibility={"eligible": False, "state": "UNKNOWN", "listed_parent": None,
                               "identity_evidence": [], "membership_evidence": [],
                               "reason": "No reviewed listed-parent mapping; corporate enrichment disabled"},
        heat={"state": "UNKNOWN", "momentum_status": "UNKNOWN", "score": 0,
              "independent_signal_count": None, "components": [],
              "reason": "Existing inputs do not prove independent origins; repeated articles are not momentum"},
        event_at=None,
        research_note="Research note: review the linked source record; current status is not a newly occurring event.",
    )
    return record


def official(repo_root):
    # This shared loader validates every partition AND the immutable Solar-1000 selection.
    seeds = queue.load_seed_projects(repo_root)
    release = Path(repo_root or queue.ROOT) / "uk_renewables_pipeline" / queue.RELEASE_ID
    manifest = queue._read_pinned(release / "data/v9.1/build_manifest.json", queue.BUILD_MANIFEST_SHA256)
    rows = []
    for part in manifest["project_partitions"]:
        payload = queue._read_pinned(release / part["path"], part["sha256"])
        rows.extend((row, {"url": BASE_URL + part["path"], "sha256": part["sha256"]})
                    for row in payload["projects"])
    return rows, [p["id"] for p in seeds], {
        "id": "official_repd", "state": "OFFICIAL", "release": queue.RELEASE_ID,
        "manifest_sha256": queue.BUILD_MANIFEST_SHA256,
        "solar1000_manifest_sha256": queue.MANIFEST_SHA256,
        "source_workbook_sha256": manifest["source_workbook_sha256"],
        "source_dataset": manifest["source_dataset"], "observed_at": None,
        "freshness": "UNKNOWN", "population": len(rows), "solar1000_count": len(seeds),
    }


def evidence_input(spec, seed_ids, as_of):
    if spec is None:
        return {}, {"id": "news_evidence", "state": "UNKNOWN", "reason": "Input not supplied"}
    payload = pinned(spec)
    validate_snapshot(payload, seed_ids)
    generated = clock(payload["generated_at"], as_of)
    run = clock(payload["source_run_at"], generated)
    require(len(payload["sources"]) <= 100 and payload["evidence_count"] <= 10000,
            "Evidence input exceeds bounded scope")
    receipts = {}
    access = {}
    for source in payload["sources"]:
        clock(source["fetched_at"], run)
        public_url(source["url"])
        public_url(source["rights_review_url"])
        receipts[source["id"]] = {
            key: source[key] for key in ("id", "url", "fetched_at", "response_sha256", "rights_review_url")}
        receipts[source["id"]]["channel_access"] = open_access(source.get("channel_access"), generated)
        require(isinstance(source.get("article_access"), dict), "Article access receipts required")
        access[source["id"]] = source["article_access"]
    records = {}
    for row in payload["projects"]:
        researched = clock(row["last_researched_at"], run)
        articles = []
        for article in row["evidence"]:
            last = clock(article["last_seen"], researched)
            clock(article["first_seen"], last)
            clock(article["pub_date"], last)
            public_url(article["url"])
            source = receipts[article["source_id"]]
            admission = open_access(access[article["source_id"]].get(article["url"]), generated)
            require(len(text(article["title"], "Headline")) <= 300, "Headline exceeds metadata display scope")
            entry = {key: article[key] for key in
                     ("id", "url", "title", "publisher", "pub_date", "first_seen", "last_seen", "match_method")}
            entry.update(state="PROVISIONAL", source=source, access=admission,
                         freshness=freshness(article["pub_date"], as_of, 30, "publication time"),
                         retrieval_freshness=freshness(article["last_seen"], as_of, 14, "article last observed time"))
            articles.append(entry)
        records[row["project_id"]] = {"last_researched_at": row["last_researched_at"],
                                      "articles": sorted(articles, key=lambda a: a["url"])}
    return records, {"id": "news_evidence", "state": "PROVISIONAL", "sha256": spec[1],
                     "generated_at": payload["generated_at"], "source_run_at": payload["source_run_at"],
                     "rights_state": "ACCEPTED_RECEIPTS_SUPPLIED",
                     "freshness": freshness(payload["source_run_at"], as_of, 14, "source run time")}


def component(name, points, maximum, basis):
    return {"name": name, "points": points, "max": maximum, "basis": basis}


def official_candidate(row, source, research, as_of):
    mw = capacity(row["capacity_mw"])
    require(type(row["capacity_known"]) is bool and row["capacity_known"] == (mw is not None),
            "Capacity known flag inconsistent")
    require(re.fullmatch(r"[1-9][0-9]*", row["repd_ref"]), "Invalid official identity")
    articles = research.get("articles", [])
    fresh = any(a["freshness"]["state"] == a["retrieval_freshness"]["state"] == "WITHIN_WINDOW"
                for a in articles)
    follow_up_basis = (
        "Recent provisional news match to review; not event verification" if fresh else
        "Supplied research has no qualifying fresh association; this is not evidence of inactivity" if research else
        "News coverage unknown or outside supplied research scope; no activity conclusion")
    reasons = [relevance.capacity_component(mw, label="official REPD installed capacity"),
               relevance.technology_component(row["repd_technology"]),
               relevance.national_route_component(row["planning_authority"]),
               relevance.evidence_component("official_record"),
               component("research_follow_up", 5 if fresh else 0, 5, follow_up_basis)]
    return research_policy_fields({
        "id": "REPD-" + row["repd_ref"], "record_type": "renewable_project",
        "name": text(row["name"], "Project name") if row["name"] else None, "country": row["country"] or None,
        "technology": row["technology"], "official_technology": row["repd_technology"],
        "record_state": "OFFICIAL", "official_status": row["status"],
        "research_state": "PROVISIONAL" if articles else "UNKNOWN",
        "capacities": {"repd_installed_mw": mw}, "source": source,
        "record_freshness": freshness(row["repd_record_updated"], as_of, 90, "official record update date", True),
        "last_researched_at": research.get("last_researched_at"), "evidence": articles,
        "score": round(sum(r["points"] for r in reasons), 2), "reasons": reasons,
    })


def dc_input(spec, as_of):
    if spec is None:
        return [], {"id": "global_data_centres", "state": "UNKNOWN", "reason": "Input not supplied"}
    data = pinned(spec)
    require(isinstance(data, dict) and data.get("schema") == "globalgrid2050.global-datacentres.projects.v1",
            "Unsupported data-centre schema")
    retrieved = clock(data["generated_from_retrieval"], as_of)
    digest(data["source_facts_sha256"])
    records = data["records"]
    require(isinstance(records, list) and 0 < len(records) <= 1000
            and type(data["record_count"]) is int and data["record_count"] == len(records),
            "Invalid data-centre count")
    require(data["scope"] == "global", "Unsupported data-centre scope")
    text(data["coverage"], "Data-centre coverage")
    result, ids, countries = [], set(), set()
    for record in records:
        identity = record["id"]
        require(isinstance(identity, str) and re.fullmatch(r"DC-WD-Q[1-9][0-9]*", identity)
                and identity not in ids, "Duplicate or invalid data-centre identity")
        ids.add(identity)
        require(record["record_type"] == "data_centre" and record["verification_status"] == "SOURCE_INDEXED"
                and record["operating_status"] == "not_assessed", "Unsupported data-centre claim state")
        country = record["country"]
        text(country["name"], "Country")
        require(re.fullmatch(r"Q[1-9][0-9]*", country["wikidata_id"]), "Invalid country identity")
        require(country["code"] is None or re.fullmatch(r"[A-Z]{2}", country["code"]), "Invalid country code")
        countries.add(country["wikidata_id"])
        expected_capacity = {"it_load_mw": None, "site_demand_mw": None, "grid_connection_mw": None}
        require(record["capacity"] == record["capacity_sources"] == expected_capacity,
                "Current DC adapter supports unknown capacity only; reviewed adapter required for populated values")
        source = record["source"]
        entity = identity.removeprefix("DC-WD-")
        require(source["publisher"] == "Wikidata" and source["licence"] == "CC0-1.0"
                and source["licence_url"] == "https://www.wikidata.org/wiki/Wikidata:Copyright"
                and source["url"] == "https://www.wikidata.org/wiki/" + entity,
                "Unsupported data-centre source/rights")
        require(type(source["revision"]) is int and source["revision"] > 0 and source["revision_url"] ==
                f"https://www.wikidata.org/w/index.php?title={entity}&oldid={source['revision']}",
                "Pinned entity revision required")
        require(clock(source["retrieved_at"], retrieved) == retrieved, "Inconsistent data-centre retrieval")
        for field in ("name", "country"):
            url = public_url(record["field_sources"][field])
            revision = re.fullmatch(r"https://www\.wikidata\.org/w/index\.php\?title=(Q[1-9][0-9]*)&oldid=[1-9][0-9]*", url)
            require(revision, "Pinned field revision required")
            require(field != "country" or revision.group(1) == country["wikidata_id"],
                    "Country revision identity differs")
        require(record["field_sources"]["name"] == source["revision_url"], "Name revision differs")
        reasons = [component("data_centre_topic", 15, 15, "Data-centre source record selected for research; status and demand unknown")]
        result.append(research_policy_fields({
            "id": identity, "record_type": "data_centre", "name": text(record["name"], "Data-centre name"),
            "country": country["name"], "country_code": country["code"], "technology": "data_centre",
            "record_state": "PROVISIONAL", "official_status": None, "research_state": "UNKNOWN",
            "capacities": expected_capacity, "source": {**{key: source[key] for key in
                ("publisher", "url", "revision_url", "revision", "retrieved_at", "licence", "licence_url")}, "sha256": spec[1],
                "source_facts_sha256": data["source_facts_sha256"],
                "field_sources": {k: record["field_sources"][k] for k in ("name", "country")}},
            "record_freshness": freshness(None, as_of, 90, "official record date unavailable"),
            "retrieval_freshness": freshness(source["retrieved_at"], as_of, 14, "Wikidata retrieval time"),
            "last_researched_at": None, "evidence": [], "score": 15, "reasons": reasons,
        }))
    require(type(data["country_count"]) is int and data["country_count"] == len(countries), "Country count mismatch")
    return result, {"id": "global_data_centres", "state": "PROVISIONAL", "sha256": spec[1],
                    "source_facts_sha256": data["source_facts_sha256"], "coverage": data["coverage"],
                    "freshness": freshness(data["generated_from_retrieval"], as_of, 14, "Wikidata retrieval time")}


def build(*, as_of, limit=200, evidence=None, datacentres=None, repo_root=None, record_type=None):
    """Validate the complete supplied input set before returning a ranked projection.

    Optional input specs are (path, full_file_sha256). Absence is UNKNOWN; a
    supplied invalid input is an error, never silently omitted or replaced.
    """
    reference = _moment(as_of)
    require(type(limit) is int and 1 <= limit <= 1000, "Limit must be 1..1000")
    require(record_type in (None, "renewable_project", "data_centre"), "Unsupported record type filter")
    try:
        rows, seed_ids, repd_receipt = official(repo_root)
        research, news_receipt = evidence_input(evidence, seed_ids, reference)
        candidates = [official_candidate(row, source, research.get(row["repd_ref"], {}), reference)
                      for row, source in rows]
        dc_rows, dc_receipt = dc_input(datacentres, reference)
        candidates.extend(dc_rows)
        require(len({r["id"] for r in candidates}) == len(candidates), "Duplicate candidate identity")
    except (KeyError, TypeError, AttributeError, OverflowError) as exc:
        raise ValueError("Input schema failed; no triage output produced") from exc
    eligible = [r for r in candidates if record_type is None or r["record_type"] == record_type]
    eligible.sort(key=lambda row: (-row["score"], row["id"]))
    selected = [dict(row, rank=i + 1) for i, row in enumerate(eligible[:limit])]
    return {"schema": SCHEMA, "as_of": as_of, "intended_increment": "V9.26 proposal",
            "purpose": "Research triage only; scores are priorities, not event verification or commercial value",
            "profile": PROFILE, "profile_sha256": relevance.profile_sha256(PROFILE),
            "source_policy": SOURCE_POLICY,
            "input_receipts": [repd_receipt, news_receipt, dc_receipt],
            "input_count": len(candidates), "eligible_count": len(eligible), "record_type_filter": record_type,
            "returned_count": len(selected), "limit": limit,
            "coverage": "Pinned 7775-record REPD scope; optional Solar-1000 evidence and curated DC sample. Not exhaustive prospects.",
            "unsupported_interfaces": [
                {"id": "bbc_raw_headlines", "enabled": False, "rights_state": "UNKNOWN",
                 "reason": "Existing RSS/headline interface lacks this adapter's accepted source receipt contract"},
                {"id": "public_linkedin", "enabled": False, "rights_state": "UNKNOWN",
                 "reason": "No supported ingestion interface or accepted rights receipt"}],
            "records": selected}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--as-of", required=True)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--limit", default=200, type=int)
    parser.add_argument("--record-type", choices=("renewable_project", "data_centre"))
    for name in ("evidence", "datacentres"):
        parser.add_argument("--" + name, type=Path)
        parser.add_argument("--" + name + "-sha256")
    args = parser.parse_args(argv)
    inputs = {}
    for name in ("evidence", "datacentres"):
        path, sha = getattr(args, name), getattr(args, name + "_sha256")
        if bool(path) != bool(sha):
            parser.error("Each optional input requires a file and SHA256")
        inputs[name] = (path, sha) if path else None
    temporary = None
    try:
        target = args.out.resolve()
        require(not target.is_relative_to(queue.ROOT / "uk_renewables_pipeline"),
                "Release trees are immutable; write a review artifact elsewhere")
        require(all(spec is None or target != Path(spec[0]).resolve() for spec in inputs.values()),
                "Output cannot replace an input")
        payload = build(as_of=args.as_of, limit=args.limit, record_type=args.record_type, **inputs)
        raw = (json.dumps(payload, sort_keys=True, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")
        # A failed gate never creates or replaces the previous output.
        args.out.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=args.out.parent, delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(raw)
        os.replace(temporary, args.out)
    except (ValueError, OSError):
        parser.exit(2, "Prospecting input/output gate failed; previous output retained.\n")
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
