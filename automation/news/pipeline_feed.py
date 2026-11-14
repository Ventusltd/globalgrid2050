#!/usr/bin/env python3
"""Pipeline News headlines: renewables, storage and grid headlines from public feeds.

Writes ONE file, dist/pipeline_news.json (schema globalgrid2050.news.pipeline-headlines.v1), read by the
Pipeline News page from the data branch. Headlines and links only: the feed summary is read in memory to
decide whether an entry is in scope and is never stored; no article page is requested. Sponsored entries
are dropped. A headline is never tied to a REPD project here: a headline carries no REPD Ref ID, so any
tie would be a name match.

Fetching, parsing, link cleaning, date handling and the sponsored-entry rule are datacentre_feed.py's own
functions, used unchanged. The feeds are a subset of datacentre_feed.FEEDS: only addresses the scheduled
workflow already fetches successfully.

One feed failing is recorded under "feeds" and does not stop the run. The run fails only when every feed
failed and there is no earlier file. Two runs on the same input give the same bytes.

Usage: python automation/news/pipeline_feed.py [--out dist/pipeline_news.json] [--fixtures DIR] [--now ISO]
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import datacentre_feed as D  # noqa: E402

SCHEMA = "globalgrid2050.news.pipeline-headlines.v1"
MAX_ITEMS = 60

# Feeds: taken from datacentre_feed.FEEDS by address, so the two lists cannot drift apart.
FEED_URLS = [
    "https://feeds.bbci.co.uk/news/business/rss.xml",
    "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
    "https://feeds.bbci.co.uk/news/politics/rss.xml",
    "https://www.gov.uk/government/organisations/department-for-energy-security-and-net-zero.atom",
]
FEEDS = [f for f in D.FEEDS if f[0] in FEED_URLS]

# A headline (or its feed summary) is in scope when it names one of these.
TOPIC_TERMS = {
    "solar": r"solar (?:farms?|parks?|panels?|power|energy|projects?|pv)|solar|photovoltaics?",
    "storage": r"battery storage|energy storage|grid[- ]scale batter(?:y|ies)|battery (?:farms?|sites?|parks?)|bess|pumped hydro",
    "wind": r"wind ?farms?|offshore wind|onshore wind|wind (?:power|energy|turbines?|projects?)|floating wind",
    "grid": r"national grid|electricity (?:grid|network|networks|transmission)|grid connections?|connections? queue|"
            r"pylons?|interconnectors?|substations?|neso|ofgem|transmission (?:lines?|network)",
    "renewables": r"renewables?|renewable energy|clean (?:energy|power)|net zero|contracts? for difference|"
                  r"great british energy|gb energy|energy security",
}
TOPIC_RE = D._compile(TOPIC_TERMS)


def topics(title, summary):
    return D.matches(TOPIC_RE, title + " " + summary)


def collect(feeds, fetch, now_iso):
    items, health = [], []
    for url, source, _why in feeds:
        try:
            body = fetch(url)
            entries = D.parse_feed(body)
        except Exception as error:  # one feed failing never stops the run
            health.append({"url": url, "source": source, "status": "failed",
                           "error": (type(error).__name__ + ": " + str(error))[:200]})
            continue
        kept = 0
        for title, link, date, summary in entries:
            title = D.clean_text(title, 300)
            link = D.canonical_link(link)
            if not title or not link or D.SPONSORED_RE.search(title):
                continue
            found = topics(title, D.clean_text(summary, 2000))
            if not found:
                continue
            items.append({"title": title, "link": link, "source": source, "date": D.parse_date(date),
                          "first_seen": now_iso, "topics": found})
            kept += 1
        health.append({"url": url, "source": source, "status": "ok", "entries": len(entries), "kept": kept,
                       "sha256": hashlib.sha256(body).hexdigest()})
    return items, health


def merge(previous, incoming, cap=MAX_ITEMS):
    """Deduplicate by link; a fresh copy replaces an old one but keeps the earliest first_seen. Newest first."""
    by_link = {}
    for item in list(previous) + list(incoming):
        if D.SPONSORED_RE.search(item.get("title", "")):
            continue
        old = by_link.get(item["link"])
        if old is not None:
            item = dict(item, first_seen=min(old.get("first_seen") or item["first_seen"], item["first_seen"]))
        by_link[item["link"]] = item
    return sorted(by_link.values(), key=D.sort_key, reverse=True)[:cap]


def build(previous, items, health, now_iso, cap=MAX_ITEMS):
    merged = merge(previous.get("items", []), items, cap)
    ok = sum(h["status"] == "ok" for h in health)
    return {
        "schema": SCHEMA,
        "generated_at": now_iso,
        "status": "ok" if ok == len(health) else ("partial" if ok else "failed"),
        "counts": {"items": len(merged), "feeds_ok": ok, "feeds_failed": len(health) - ok},
        "limits": {"max_items": cap},
        "scope": ("Headlines and links from public RSS/Atom feeds only; no article text is stored or republished. "
                  "Kept when the headline or the feed summary names solar, storage, wind, the electricity grid or "
                  "renewables policy. Sponsored entries are dropped. No headline is tied to a REPD project."),
        "feeds": health,
        "items": merged,
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default="dist/pipeline_news.json")
    ap.add_argument("--fixtures", default=None,
                    help="offline: directory of <sha256(url)[:16]>.xml files used instead of the network")
    ap.add_argument("--now", default=None, help="fixed UTC timestamp (tests)")
    ap.add_argument("--max-items", type=int, default=MAX_ITEMS)
    args = ap.parse_args(argv)

    now_iso = args.now or dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    out = Path(args.out)
    previous = {}
    if out.exists():
        try:
            previous = json.loads(out.read_text(encoding="utf-8"))
            if previous.get("schema") != SCHEMA:
                previous = {}
        except ValueError:
            previous = {}
    if args.fixtures:
        fixture_dir = Path(args.fixtures)

        def fetch(url):
            path = fixture_dir / D.fixture_name(url)
            if not path.exists():
                raise OSError("no fixture for %s" % url)
            return path.read_bytes()
    else:
        fetch = D.fetch_url

    items, health = collect(FEEDS, fetch, now_iso)
    result = build(previous, items, health, now_iso, args.max_items)
    if result["status"] == "failed" and previous:
        # Every feed failed: keep the earlier headlines and their date, and say so.
        result["generated_at"] = previous.get("generated_at", now_iso)
        result["last_attempt_at"] = now_iso
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".tmp")
    tmp.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    tmp.replace(out)
    print(json.dumps({"status": result["status"], **result["counts"], "out": str(out)}))
    return 1 if result["status"] == "failed" and not previous else 0


if __name__ == "__main__":
    sys.exit(main())
