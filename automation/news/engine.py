"""Ventus News Engine: read-only, deterministic intelligence adapter.

Consumes existing collector output; never fetches, schedules, approves rights,
verifies identities, or publishes. Uses acquisition.match.match_articles.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from .acquisition.match import match_articles

SCHEMA = "globalgrid2050.ventus-news-intelligence.v1"
VERTICALS = frozenset(("solar", "bess", "wind", "grid", "datacentre"))
_SHA = re.compile(r"[0-9a-f]{64}\Z")
_DNS = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\Z")
_TRACKING = frozenset(("fbclid", "gclid", "mc_cid", "mc_eid"))


def _required(value, field):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(field + " must be nonempty text")
    return value


def canonical_url(value):
    """Validate public HTTPS metadata, strip fragment/known tracking; never fetch."""
    _required(value, "article URL")
    if any(ord(c) < 33 for c in value) or "\\" in value:
        raise ValueError("unsafe article URL")
    try:
        p = urlsplit(value)
        host = (p.hostname or "").lower().rstrip(".")
        labels = host.split(".")
        if (p.scheme != "https" or p.username or p.password or p.port not in (None, 443)
                or len(labels) < 2 or any(not _DNS.fullmatch(label) for label in labels)
                or labels[-1].isdigit() or labels[-1].startswith("0x")
                or host.endswith((".localhost", ".local", ".internal"))):
            raise ValueError("unsafe public HTTPS URL")
    except ValueError as exc:
        raise ValueError("unsafe public HTTPS URL") from exc
    query = urlencode([(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True)
                       if not (k.lower().startswith("utm_") or k.lower() in _TRACKING)])
    return urlunsplit(("https", host, p.path or "/", query, ""))


def _sources(rows):
    if not isinstance(rows, list):
        raise ValueError("sources must be an array")
    result = {}
    for raw in rows:
        if not isinstance(raw, dict):
            raise ValueError("invalid source")
        sid = _required(raw.get("id"), "source.id")
        if sid in result:
            raise ValueError("duplicate source id")
        publisher = _required(raw.get("publisher"), "source.publisher")
        status = raw.get("rights_status", "unknown")
        if status not in ("unknown", "accepted", "rejected"):
            raise ValueError("unrecognised source rights_status")
        review = raw.get("rights_review_url")
        if review is not None:
            canonical_url(review)
        if status == "accepted" and not review:
            raise ValueError("accepted rights require a review URL")
        policy = raw.get("output_policy", "headline_link_only")
        if policy != "headline_link_only":
            raise ValueError("engine can only process headline_link_only sources")
        enabled = raw.get("enabled", False)
        if type(enabled) is not bool:
            raise ValueError("source.enabled must be boolean")
        if enabled and status != "accepted":
            raise ValueError("unreviewed source cannot be enabled")
        result[sid] = {"id": sid, "publisher": publisher,
                       "kind": raw.get("kind"), "enabled": enabled,
                       "rights_status": status, "rights_review_url": review,
                       "output_policy": policy}
    return result


def _projects(rows):
    if not isinstance(rows, list):
        raise ValueError("projects must be an array")
    projects, seen = [], set()
    for p in rows:
        if not isinstance(p, dict):
            raise ValueError("invalid project")
        namespace = p.get("namespace", "repd")
        pid = str(p.get("id", ""))
        if namespace != "repd":
            # Future DC/grid adapters must use their own stable identities.
            continue
        if not re.fullmatch(r"[1-9][0-9]*", pid) or pid in seen:
            raise ValueError("invalid or duplicate REPD identifier")
        seen.add(pid)
        projects.append({"id": pid, "name": _required(p.get("name"), "project.name"),
                         "name_ambiguous": p.get("name_ambiguous", False),
                         "technology": p.get("technology")})
    return projects


def build_intelligence(articles, sources, projects=()):
    """Return offline metadata candidates; zero VERIFIED matches by construction."""
    if isinstance(articles, dict):
        articles = articles.get("items")
    if not isinstance(articles, list):
        raise ValueError("articles must be an array or a document with items")
    policies = _sources(sources)
    repd = _projects(list(projects))
    by_publisher = {}
    for sid, source in policies.items():
        by_publisher.setdefault(source["publisher"], []).append(sid)
    by_url = {}
    for a in articles:
        if not isinstance(a, dict):
            raise ValueError("invalid article")
        original = _required(a.get("url") or a.get("link"), "article.url")
        url = canonical_url(original)
        title = _required(a.get("title"), "article.title")
        sid = a.get("source_id")
        if sid is None:
            labels = by_publisher.get(a.get("source"), [])
            if len(labels) != 1:
                raise ValueError("article needs unambiguous source_id")
            sid = labels[0]
        if sid not in policies:
            raise ValueError("article references missing source")
        src = policies[sid]
        if a.get("publisher", src["publisher"]) != src["publisher"]:
            raise ValueError("publisher attribution conflicts with source")
        published = a.get("pub_date", a.get("date"))
        if published is not None and not isinstance(published, str):
            raise ValueError("publication timestamp must be text or null")
        first_seen = a.get("first_seen")
        fetched = a.get("fetched_at")
        if any(x is not None and not isinstance(x, str) for x in (first_seen, fetched)):
            raise ValueError("observation timestamps must be text or null")
        receipt = a.get("source_receipt_sha256")
        if receipt is not None and (not isinstance(receipt, str) or not _SHA.fullmatch(receipt)):
            raise ValueError("invalid source receipt hash")
        vertical = a.get("vertical")
        if vertical is not None and vertical not in VERTICALS:
            raise ValueError("unknown vertical")
        row = {"article_id": hashlib.sha256(url.encode("utf-8")).hexdigest(),
               "original_article_url": original, "observed_article_urls": [original],
               "canonical_article_url": url,
               "title": title, "publisher": src["publisher"], "source_id": sid,
               "published_at": published, "first_seen": first_seen,
               "fetched_at": fetched, "source_receipt_sha256": receipt,
               "vertical": vertical, "source_kind": src["kind"],
               "usage_rights": {"status": src["rights_status"],
                                "review_url": src["rights_review_url"],
                                "source_enabled": src["enabled"]},
               "headline_link_scope_only": src["output_policy"] == "headline_link_only",
               "publisher_independence": "UNASSESSED",
               "verification_status": "NOT_VERIFIED",
               "publication_eligibility": "WITHHELD_INDEPENDENT_REVIEW_REQUIRED",
               "project_candidates": []}
        if url in by_url:
            previous = by_url[url]
            comparable = dict(row)
            comparable["original_article_url"] = previous["original_article_url"]
            comparable["observed_article_urls"] = previous["observed_article_urls"]
            if previous != comparable:
                raise ValueError("canonical URL collision requires attribution review")
            variants = sorted(set(previous["observed_article_urls"] + [original]))
            previous["observed_article_urls"] = variants
            previous["original_article_url"] = variants[0]
            continue
        by_url[url] = row
    match_input = [{"title": row["title"], "url": url} for url, row in by_url.items()]
    candidates = match_articles(match_input, repd)
    for edge in candidates:
        row = by_url[edge["article_url"]]
        row["project_candidates"].append({"namespace": "repd", "id": edge["project_id"],
                                          "method": edge["match_method"],
                                          "status": "PROVISIONAL", "evidence_scope": "TITLE_ONLY",
                                          "independent_review": "REQUIRED"})
    for row in by_url.values():
        edges = row["project_candidates"]
        edges.sort(key=lambda e: (int(e["id"]), e["method"]))
        if len(edges) > 1:
            for edge in edges:
                edge["ambiguous_multi_project"] = True
    return {"schema": SCHEMA,
            "scope": "offline headline/link metadata; no source fetch or inferred verified claims",
            "counts": {"articles": len(by_url),
                       "provisional_project_edges": len(candidates),
                       "verified_project_edges": 0,
                       "rights_unresolved_articles": sum(
                           r["usage_rights"]["status"] != "accepted" for r in by_url.values())},
            "articles": sorted(by_url.values(), key=lambda r: (
                r["canonical_article_url"], r["source_id"]))}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--articles", type=Path, required=True)
    parser.add_argument("--sources", type=Path, required=True)
    parser.add_argument("--projects", type=Path, help="optional exact REPD project JSON list")
    parser.add_argument("--output", type=Path, help="new JSON path; never overwrite")
    args = parser.parse_args(argv)

    def read(path):
        return json.loads(path.read_text(encoding="utf-8"))

    result = build_intelligence(read(args.articles), read(args.sources),
                                read(args.projects) if args.projects else ())
    encoded = json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    if args.output:
        with args.output.open("x", encoding="utf-8") as handle:
            handle.write(encoded)
    else:
        print(encoded, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
