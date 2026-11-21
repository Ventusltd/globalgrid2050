"""Discover direct public Solar Power Portal article links from its home index.

This does not fetch any article body, paywalled URL or restricted RSS endpoint.
It reads only the openly presented homepage and selects same-origin article
anchors; if the server denies homepage access, the caller records failure.
"""
from __future__ import annotations

from urllib.parse import urlsplit
from research_indexes import index_entries as parse_public_index

MAX_ARTICLES = 50
PUBLIC_HOME = "https://www.solarpowerportal.co.uk/"
ARTICLE_PREFIXES = (
    "/battery-storage/", "/solar-finance/", "/solar-investment/",
    "/energy-policy/", "/solar-pv/", "/solar-projects/",
    "/colocation/", "/solar-planning/", "/news/",
)


def index_entries(body: bytes, feed: dict):
    """Only allowlisted direct article anchors on the public homepage."""
    location = urlsplit(feed.get("url", ""))
    if (location.scheme != "https" or location.hostname != "www.solarpowerportal.co.uk"
            or location.path not in ("", "/") or location.query or location.fragment
            or location.username or location.password or location.port not in (None, 443)
            or feed.get("source") != "Solar Power Portal"):
        raise ValueError("Only the public publisher homepage is an approved index")
    # Reuse existing bounded/HTML-aware parsing; do not follow any extracted link.
    out = parse_public_index(body, {
        "url": PUBLIC_HOME,
        "article_prefixes": ARTICLE_PREFIXES,
        "english_only": False,
    })[:MAX_ARTICLES]
    if not out:
        raise ValueError("No direct public article links found on homepage")
    return out
