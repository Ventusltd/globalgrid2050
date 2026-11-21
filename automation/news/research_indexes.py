"""Bounded English-language institutional research index discovery.

Only headline/link metadata; no article bodies, no inferred publication dates, no
source verification, no REPD project links. Index health is reported by caller.
"""
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

MAX_HTML_BYTES = 2_000_000
MAX_LINKS = 2000
MAX_KEPT = 45


class _Anchors(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.href = None
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "a" and self.href is None:
            self.href = dict(attrs).get("href", "")
            self.parts = []

    def handle_data(self, data):
        if self.href is not None and len(self.parts) < 24:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self.href is not None:
            if len(self.links) < MAX_LINKS:
                self.links.append((self.href, " ".join(" ".join(self.parts).split())))
            self.href, self.parts = None, []


def index_entries(body, feed):
    """Convert an allowed public HTML index into RSS-shaped headline tuples.

    Does not crawl individual articles; date unknown rather than invented.
    Rejects cross-host, cross-language and non-article links.
    """
    if not isinstance(body, bytes) or len(body) > MAX_HTML_BYTES:
        raise ValueError("HTML index missing or oversized")
    root = urlsplit(feed["url"])
    if root.scheme != "https" or not root.hostname:
        raise ValueError("invalid source index")
    prefixes = tuple(feed.get("article_prefixes") or ())
    if not prefixes or any(not x.startswith("/") for x in prefixes):
        raise ValueError("approved article prefixes required")
    parser = _Anchors()
    parser.feed(body.decode("utf-8", errors="replace"))
    out, seen = [], set()
    for href, title in parser.links:
        if not 18 <= len(title) <= 300:
            continue
        url = urljoin(feed["url"], href)
        loc = urlsplit(url)
        if loc.scheme != "https" or loc.hostname != root.hostname or loc.username or loc.password:
            continue
        if not any(loc.path.startswith(prefix) for prefix in prefixes):
            continue
        if loc.path.rstrip("/") == root.path.rstrip("/"):
            continue
        if loc.path.lower().endswith((".pdf", ".jpg", ".png", ".zip")):
            continue
        # Swiss and audit-firm URLs must retain the English-language section.
        if feed.get("english_only") and not any(key in loc.path.lower()
                for key in ("/en/", "/en_", "/eng/", "/en-", "/english/")):
            continue
        url = url.split("#", 1)[0]
        if url not in seen:
            seen.add(url)
            out.append((title, url, None, ""))
            if len(out) >= MAX_KEPT:
                break
    return out
