"""Deterministic headline selection; no collection, project binding or publication.

Publisher credit survives ranking. Primary-source preference, topic, freshness,
reviewed original reporting and display diversity are separate explanations.
The caller supplies the clock and any source/originality review receipts.
"""
from __future__ import annotations

import copy
import datetime as dt
import hashlib
import ipaddress
import json
import re
from urllib.parse import urlsplit

from automation.news import pipeline_headlines as P

SCHEMA = "globalgrid2050.news.editorial-priority.v1"
PROFILE = {
    "id": "uk-transition-global-context-cop31.v2",
    "topic": {"solar": 20, "storage": 20, "grid": 20, "datacentre": 20,
              "wind": 10, "renewables": 10},
    "authority": {"government": 18, "regulator": 18, "institution": 16,
                  "listed_parent": 14, "reporting": 8, "discovery": 2},
    "actionability": 8, "original_reporting": 6, "freshness": 10, "uk_context": 5,
    "freshness_half_life_days": 14, "current_days": 120,
    "publisher_diversity_penalty": 8, "cop31_policy_priority": 75, "other_cop_policy_priority": 24,
}
PROFILE_SHA256 = hashlib.sha256(json.dumps(PROFILE, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
_GOV_SUFFIXES = ("gov.uk", "gov.scot", "gov.wales", "gov")
_DISCOVERY = ("bloomberg.com", "ft.com")
_DNS_LABEL = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\Z")
_GENRE = re.compile(r"(?:^|/)(?:whitepapers?|webinars?|sponsored)(?:/|$)", re.I)
_UK_CONTEXT = re.compile(r"\b(?:UK|U\.K\.|Britain|British|England|Scotland|Scottish|(?<!New South )Wales|Welsh|Northern Ireland|London|Ofgem|NESO)\b", re.I)


def _under(host, suffix):
    return host == suffix or host.endswith("." + suffix)


def public_url(value):
    """Public DNS HTTPS article URL, without resolving or fetching anything."""
    if not isinstance(value, str) or any(ord(c) < 33 for c in value) or "\\" in value:
        raise ValueError("invalid article URL")
    try:
        raw = urlsplit(value)
        host = (raw.hostname or "").lower().rstrip(".")
        if raw.scheme not in ("http", "https") or raw.username or raw.password or raw.port not in (None, 80, 443):
            raise ValueError("unsafe article URL")
        labels = host.split(".")
        if len(labels) < 2 or any(not _DNS_LABEL.fullmatch(label) for label in labels):
            raise ValueError("public DNS hostname required")
        # Browser numeric aliases (127.1, 2130706433, 0x7f000001) are not DNS names.
        if labels[-1].isdigit() or labels[-1].startswith("0x") or host.endswith((".localhost", ".local", ".internal")):
            raise ValueError("numeric or local hostname")
        try:
            ipaddress.ip_address(host)
        except ValueError:
            pass
        else:
            raise ValueError("IP literal is not an article publisher")
        url = P.D.canonical_link(value)
        if not url:
            raise ValueError("invalid article URL")
        parsed = urlsplit(url)
        return parsed._replace(netloc=host).geturl()
    except (TypeError, ValueError) as exc:
        raise ValueError("invalid public article URL") from exc


def _clock(value):
    try:
        when = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (AttributeError, TypeError, ValueError) as exc:
        raise ValueError("as_of must be an explicit timezone-aware timestamp") from exc
    if when.tzinfo is None:
        raise ValueError("as_of must be timezone-aware")
    return when.astimezone(dt.timezone.utc)


def _publication(raw, as_of):
    if raw is None or raw == "":
        return {"precision": "unknown", "age_days": None, "state": "unknown", "points": 0}
    if not isinstance(raw, str):
        raise ValueError("publication date must be text or null")
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
        try:
            day = dt.date.fromisoformat(raw)
        except ValueError as exc:
            raise ValueError("invalid publication day") from exc
        age, precision = (as_of.date() - day).days, "day"
    else:
        parsed = P.D.parse_date(raw)
        if not parsed:
            return {"precision": "unknown", "age_days": None, "state": "unknown", "points": 0}
        age, precision = (as_of - _clock(parsed)).total_seconds() / 86400, "second"
    if age < 0:
        return {"precision": precision, "age_days": round(age, 4), "state": "future", "points": 0}
    points = round(10 / (1 + age / PROFILE["freshness_half_life_days"]), 2)
    return {"precision": precision, "age_days": round(age, 4),
            "state": "current" if age <= PROFILE["current_days"] else "stale", "points": points}


def _policies(policies):
    by_host = {}
    for policy in policies:
        kind = policy.get("kind")
        if kind not in PROFILE["authority"]:
            raise ValueError("unknown source policy kind")
        if policy.get("access", "unknown") not in ("open", "paywalled", "unknown"):
            raise ValueError("unknown source access policy")
        public_url(policy.get("review_url"))
        hosts = policy.get("hosts")
        if not isinstance(hosts, list) or not hosts or not policy.get("source_id"):
            raise ValueError("source policy requires hosts and source_id")
        if kind == "listed_parent":
            if not policy.get("listed_parent_id"):
                raise ValueError("listed-parent identity required")
            public_url(policy.get("listing_evidence_url"))
        for host in hosts:
            if not isinstance(host, str) or host != urlsplit(public_url("https://" + host + "/")).hostname:
                raise ValueError("source policy hosts must be canonical DNS names")
            if host in by_host:
                raise ValueError("duplicate source policy host")
            by_host[host] = copy.deepcopy(policy)
    return by_host


def _originality(reviews):
    by_url = {}
    for review in reviews:
        url = public_url(review.get("article_url"))
        if review.get("kind") != "original_reporting" or review.get("reviewed") is not True:
            raise ValueError("original reporting requires an explicit reviewed receipt")
        if not isinstance(review.get("basis"), str) or not review["basis"].strip() or len(review["basis"]) > 500:
            raise ValueError("originality receipt needs a bounded review basis")
        public_url(review.get("review_url"))
        if url in by_url:
            raise ValueError("duplicate originality review")
        by_url[url] = copy.deepcopy(review)
    return by_url


def _source(host, policy):
    discovery = next((name for name in _DISCOVERY if _under(host, name)), None)
    if policy:
        kind = policy["kind"]
        group = policy.get("publisher_group") or policy["source_id"]
        basis = {"type": "supplied_source_policy", "review_url": policy["review_url"]}
    else:
        kind = "government" if any(_under(host, suffix) for suffix in _GOV_SUFFIXES) else "reporting"
        if discovery:
            kind = "discovery"
        group = discovery or ("bbc" if any(_under(host, s) for s in ("bbc.co.uk", "bbc.com", "bbci.co.uk")) else host.removeprefix("www."))
        basis = {"type": "hostname_classification", "review_url": None}
    if not isinstance(group, str) or not group.strip():
        raise ValueError("publisher display group must be nonempty text")
    access = policy.get("access", "unknown") if policy else "unknown"
    return {"kind": kind, "display_group": group, "basis": basis, "access": access,
            "access_notice": "May require a subscription; use accessible primary follow-up" if discovery or access == "paywalled" else None,
            "rights_approval": "not_assessed_by_ranking"}


def rank_headlines(items, *, as_of, source_policies=(), originality=(), diversity_penalty=8):
    """Return credited headline metadata and a deterministic, explainable order.

    The soft publisher penalty is for display variety, never source independence.
    An original-reporting receipt is a caller review assertion, not verification.
    No title numbers, possible matches or source brands establish project facts.
    """
    now, policies, reviews = _clock(as_of), _policies(source_policies), _originality(originality)
    if type(diversity_penalty) not in (int, float) or not 0 <= diversity_penalty <= 30:
        raise ValueError("diversity_penalty must be between 0 and 30")
    if not isinstance(items, list) or len(items) > 10000:
        raise ValueError("bounded list of headline items required")
    candidates, urls = [], set()
    for item in items:
        if not isinstance(item, dict) or not isinstance(item.get("title"), str) or not item["title"].strip():
            raise ValueError("headline title required")
        url = public_url(item.get("link"))
        if url in urls:
            raise ValueError("duplicate canonical URL: merge article records before ranking")
        urls.add(url)
        host = urlsplit(url).hostname
        title = P.D.clean_text(item["title"], 300)
        topics = [] if P.EXCLUDE.search(title) else P.topics_of(title)
        climate_level = P.climate_policy_priority(title)
        topic_points = max((PROFILE["topic"][t] for t in topics), default=0)
        category = P.category_of(title) if topics or climate_level else None
        context_only = bool(_GENRE.search(urlsplit(url).path) or P.D.SPONSORED_RE.search(title) or P.BRANDED.search(title))
        source = _source(host, policies.get(host))
        freshness = _publication(item.get("date"), now)
        review = reviews.get(url)
        components = {
            "topic": topic_points,
            "cop31_climate_policy": (PROFILE["cop31_policy_priority"] if climate_level == 2 else
                                    PROFILE["other_cop_policy_priority"] if climate_level == 1 else 0),
            "primary_source_preference": PROFILE["authority"][source["kind"]],
            "headline_event_cue": PROFILE["actionability"] if category and not context_only else 0,
            "uk_headline_context": PROFILE["uk_context"] if _UK_CONTEXT.search(title) and topics else 0,
            "publication_freshness": freshness["points"],
            "reviewed_original_reporting": PROFILE["original_reporting"] if review else 0,
        }
        # Irrelevant, promotional and future-dated items stay available as
        # context; display diversity never pushes them ahead of current topics.
        bucket = 0 if (topics or climate_level) and not context_only and freshness["state"] not in ("stale", "future") else 1
        metadata = {field: copy.deepcopy(item.get(field)) for field in P.ITEM_FIELDS}
        metadata.update(title=title, link=url)
        metadata["editorial"] = {
            "role": "discovery_lead" if source["kind"] == "discovery" else "primary_context" if source["kind"] in ("government", "regulator", "institution", "listed_parent") else "attributed_reporting",
            "topics": topics, "category_hint": category, "source": source, "freshness": freshness,
            "originality_review": review, "components": components, "base_score": round(sum(components.values()), 2),
            "context_bucket": bucket, "project_fact_status": "NOT_ASSESSED", "verification_status": "NOT_VERIFIED",
            "requires_primary_followup": source["kind"] in ("discovery", "reporting"),
        }
        candidates.append(metadata)
    selected, count = [], {}
    while candidates:
        def key(item):
            e = item["editorial"]
            penalty = diversity_penalty * count.get(e["source"]["display_group"], 0)
            return (e["context_bucket"], -(e["base_score"] - penalty), item["link"])
        picked = min(candidates, key=key)
        candidates.remove(picked)
        e, group = picked["editorial"], picked["editorial"]["source"]["display_group"]
        e["publisher_repetition_penalty"] = diversity_penalty * count.get(group, 0)
        e["selection_score"] = round(e["base_score"] - e["publisher_repetition_penalty"], 2)
        e["rank"] = len(selected) + 1
        count[group] = count.get(group, 0) + 1
        selected.append(picked)
    return {"schema": SCHEMA, "profile_id": PROFILE["id"], "profile_sha256": PROFILE_SHA256,
            "as_of": now.isoformat().replace("+00:00", "Z"), "diversity_penalty": diversity_penalty,
            "input_count": len(items), "items": selected,
            "scope": "Editorial research order only; no source-rights grant, project binding, financial figure extraction or VERIFIED claim."}
