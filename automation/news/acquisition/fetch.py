"""Bounded, fail-closed HTTP acquisition for the one approved solar RSS source."""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
from pathlib import Path
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

import requests
import yaml

from .normalise import normalise_article, safe_publisher_url

MAX_BYTES = 4 * 1024 * 1024
MAX_ENTRIES = 200


class FetchError(RuntimeError):
    """Critical fetch/parse failure: retain previous snapshot, require review."""


def _rights_accepted(source):
    try:
        review = urlsplit(source.get("rights_review_url") or "")
        return (source.get("rights_status") == "accepted" and review.scheme == "https"
                and bool(review.hostname) and not review.username and not review.password)
    except ValueError:
        return False


def load_sources(path=None, *, include_disabled=False):
    sources = yaml.safe_load(Path(path or Path(__file__).with_name("sources.yaml")).read_text(encoding="utf-8"))
    if not isinstance(sources, list) or not sources:
        raise ValueError("sources must be a nonempty list")
    seen = set()
    for source in sources:
        if not isinstance(source, dict) or source.get("id") != "pv_magazine_global":
            raise ValueError("Only approved pv_magazine_global is enabled in this sprint")
        if source["id"] in seen:
            raise ValueError("Duplicate source ID")
        seen.add(source["id"])
        if (not safe_publisher_url(source.get("url")) or source.get("kind") != "rss"
                or source.get("technology") != ["solar"] or type(source.get("enabled")) is not bool
                or source.get("rights_status") not in {"unknown", "accepted"}
                or source.get("output_policy") != "headline_link_only"
                or type(source.get("interval_hours")) is not int or source["interval_hours"] != 168
                or not isinstance(source.get("publisher"), str) or not source["publisher"].strip()):
            raise ValueError("Invalid solar source configuration")
        if source["enabled"] and not _rights_accepted(source):
            raise ValueError("Source requires attributable rights acceptance before enabling")
    return sources if include_disabled else [s for s in sources if s["enabled"]]


def parse_feed(raw, source):
    if len(raw) > MAX_BYTES or b"<!DOCTYPE" in raw.upper() or b"<!ENTITY" in raw.upper():
        raise FetchError("Oversized or unsafe XML")
    try:
        root = ET.fromstring(raw)
        if root.tag != "rss":
            raise ValueError("Expected RSS document")
        entries = root.findall("./channel/item")
        if not entries or len(entries) > MAX_ENTRIES:
            raise ValueError("Empty or excessive feed")
        articles = []
        for item in entries:
            articles.append(normalise_article({
                "title": item.findtext("title"), "link": item.findtext("link"),
                "pub_date": item.findtext("pubDate"),
                "content": item.findtext("{http://purl.org/rss/1.0/modules/content/}encoded") or item.findtext("description"),
            }, source))
        return list({a["url"]: a for a in articles}.values())
    except (ValueError, TypeError, ET.ParseError) as exc:
        raise FetchError(f"Invalid RSS: {exc}") from exc


def fetch_source(source, cache=None, *, session=None, now=None, probe=False):
    """Return articles, a source receipt, and raw in-memory conditional cache.

    Cached XML is intentionally caller-owned and must not be included in public
    artifacts. A 304 without a byte-verified cached body fails closed.
    """
    if not probe and (source.get("enabled") is not True or not _rights_accepted(source)):
        raise FetchError("Source disabled or rights unaccepted; explicit health probe only")
    if not safe_publisher_url(source.get("url")):
        raise FetchError("Unapproved source URL")
    client = session or requests.Session()
    headers = {"User-Agent": "GlobalGrid2050-Evidence/9.25 (+https://globalgrid2050.com)", "Accept": "application/rss+xml, application/xml"}
    if cache and cache.get("url") == source["url"] and cache.get("etag"):
        headers["If-None-Match"] = cache["etag"]
    try:
        url = source["url"]
        for redirect in range(4):
            with client.get(url, headers=headers, timeout=(10, 25), stream=True, allow_redirects=False) as response:
                if response.status_code in {301, 302, 303, 307, 308}:
                    from urllib.parse import urljoin
                    url = urljoin(url, response.headers.get("Location", ""))
                    if not safe_publisher_url(url) or redirect == 3:
                        raise FetchError("Unapproved or excessive redirect")
                    continue
                if response.status_code == 304:
                    if (not cache or cache.get("url") != source["url"] or not isinstance(cache.get("body"), bytes)
                            or hashlib.sha256(cache["body"]).hexdigest() != cache.get("response_sha256")):
                        raise FetchError("304 without a valid cached feed")
                    raw = cache["body"]
                elif response.status_code == 200:
                    raw = b""
                    for chunk in response.iter_content(65536):
                        raw += chunk
                        if len(raw) > MAX_BYTES:
                            raise FetchError("RSS exceeds size limit")
                else:
                    raise FetchError(f"Critical source HTTP {response.status_code}: {source['id']}")
                digest = hashlib.sha256(raw).hexdigest()
                articles = parse_feed(raw, source)
                fetched_at = (now or datetime.now(timezone.utc)).isoformat(timespec="seconds").replace("+00:00", "Z")
                etag = response.headers.get("ETag") or (cache or {}).get("etag")
                return {"articles": articles, "source": {
                    "id": source["id"], "status": "ok", "url": source["url"], "final_url": url,
                    "publisher": source["publisher"], "fetched_at": fetched_at,
                    "http_status": response.status_code, "response_sha256": digest, "etag": etag,
                    "article_count": len(articles), "output_policy": "headline_link_only",
                    "probe_only": probe, "eligible_for_publication": not probe and _rights_accepted(source),
                    "rights_status": source.get("rights_status", "unknown"),
                    "rights_review_url": source.get("rights_review_url"),
                }, "cache": {"url": source["url"], "etag": etag, "body": raw, "response_sha256": digest}}
    except requests.RequestException as exc:
        raise FetchError(f"Critical source transport failure: {source['id']}: {exc}") from exc
    finally:
        if session is None:
            client.close()
    raise FetchError("No successful source response")
