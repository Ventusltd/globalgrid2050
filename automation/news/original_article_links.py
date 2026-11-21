"""Discover original public article links from a third-party news index.

We do not request an article page or the publisher's blocked RSS feed here.
Only metadata supplied by GDELT is considered; the public publisher's URL
must be an actual direct HTTPS Solar Power Portal link (no redirects/proxies).
RSS dates are deliberately not treated as publisher-supplied article dates.
"""
from __future__ import annotations

from urllib.parse import parse_qs, urlsplit

MAX_ARTICLES = 50
EXACT_PUBLISHER_HOSTS = frozenset(("solarpowerportal.co.uk", "www.solarpowerportal.co.uk"))
INDEX_HOST = "api.gdeltproject.org"
INDEX_PATH = "/api/v2/doc/doc"


def index_entries(body: bytes, feed: dict):
    """Parse a bounded GDELT RSS response into the existing collector tuple shape.

    All URL checks are repeated on individual results because GDELT is a
    discovery clue, not a trusted oracle or source of publisher-side facts.
    """
    location = urlsplit(feed.get("url", ""))
    params = parse_qs(location.query)
    if (location.scheme != "https" or location.hostname != INDEX_HOST
            or location.path != INDEX_PATH or location.username or location.password
            or location.port not in (None, 443)
            or params.get("format") != ["rss"]
            or params.get("mode") != ["artlist"]
            or not any("domain:solarpowerportal.co.uk" in q for q in params.get("query", []))):
        raise ValueError("Unapproved third-party index; direct publisher RSS is not a fallback")
    if feed.get("source") != "Solar Power Portal":
        raise ValueError("Publisher attribution must be retained")

    # Existing hardened RSS/Atom reader parses the third-party discovery feed.
    from datacentre_feed import parse_feed
    parsed = parse_feed(body)
    if not parsed:
        raise ValueError("GDELT returned zero RSS article entries for this publisher")
    kept, seen = [], set()
    for title, link, _index_date, _summary in parsed:
        target = urlsplit(link.strip())
        if (target.scheme != "https" or target.hostname not in EXACT_PUBLISHER_HOSTS
                or target.username or target.password or target.port not in (None, 443)
                or not target.path or target.path in ("/", "/about")
                or target.path.lower().endswith((".xml", ".rss", ".pdf", ".zip"))):
            continue
        # A stable canonical link deduplicates sites with campaign fragments.
        original = target._replace(fragment="").geturl()
        if original in seen:
            continue
        seen.add(original)
        kept.append((title, original, None, ""))
        if len(kept) >= MAX_ARTICLES:
            break
    if not kept:
        observed = sorted({urlsplit(link).hostname or "NO_HOST" for _, link, _, _ in parsed[:20]})
        raise ValueError("Index returned no eligible direct publisher links; "
                         f"index entries={len(parsed)}; hosts={','.join(observed)[:90]}")
    return kept
