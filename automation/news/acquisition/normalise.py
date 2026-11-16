"""Normalize RSS metadata without persisting publisher article bodies."""
from __future__ import annotations

from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import hashlib
import html
from html.parser import HTMLParser
from urllib.parse import urlsplit, urlunsplit


class _Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style"}:
            self.hidden += 1

    def handle_endtag(self, tag):
        if tag in {"script", "style"}:
            self.hidden = max(0, self.hidden - 1)

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def clean_text(value):
    parser = _Text()
    parser.feed(html.unescape(str(value or "")))
    return " ".join(" ".join(parser.parts).split())


def safe_publisher_url(value):
    """Only the explicitly approved HTTPS publisher host is accepted."""
    try:
        p = urlsplit(value)
        return (p.scheme == "https" and p.hostname in {"www.pv-magazine.com", "pv-magazine.com"}
                and p.port in {None, 443} and not p.username and not p.password)
    except (TypeError, ValueError):
        return False


def normalise_article(entry, source):
    url = str(entry.get("url") or entry.get("link") or "").strip()
    if not safe_publisher_url(url):
        raise ValueError("Article URL must use the approved HTTPS publisher")
    p = urlsplit(url)
    url = urlunsplit((p.scheme, p.netloc.lower(), p.path, p.query, ""))
    title = clean_text(entry.get("title"))
    raw_date = entry.get("pub_date") or entry.get("date") or entry.get("published")
    if not title or not isinstance(raw_date, str):
        raise ValueError("Article title and publisher date are required")
    try:
        date = parsedate_to_datetime(raw_date)
    except (TypeError, ValueError):
        date = datetime.fromisoformat(raw_date.replace("Z", "+00:00"))
    if date.tzinfo is None:
        raise ValueError("Publisher date must have a timezone")
    return {
        "id": hashlib.sha256(url.encode()).hexdigest(), "url": url, "title": title,
        "pub_date": date.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "source_id": source["id"], "publisher": source["publisher"],
        # Transient matching input: deliberately excluded from database/export.
        "content": clean_text(entry.get("content") or entry.get("description"))[:20000],
    }
