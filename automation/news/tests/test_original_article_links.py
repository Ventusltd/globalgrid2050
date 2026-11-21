"""Solar Power Portal public-link discovery: offline, no publisher page fetch."""
import sys
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import pipeline_headlines as P
import original_article_links as A

INDEX = ("https://api.gdeltproject.org/api/v2/doc/doc?"
         "query=domain%3Asolarpowerportal.co.uk&mode=artlist&format=rss"
         "&maxrecords=50&timespan=1month&sort=datedesc")
FEED = {"url": INDEX, "source": "Solar Power Portal",
        "kind": "public_article_index", "uk_only": True}
NOW = "2026-11-21T21:00:00Z"


def rss(items):
    parts = []
    for title, url in items:
        parts.append(f"<item><title>{title}</title><link>{url}</link>"
                     "<pubDate>Sat, 21 Nov 2026 12:00:00 GMT</pubDate></item>")
    return ('<rss version="2.0"><channel>'+"".join(parts)+'</channel></rss>').encode()


def test_reject_redirect_other_hosts_and_non_public_links():
    cases = [
        ("Valid UK solar farm approved for construction",
         "https://www.solarpowerportal.co.uk/uk-solar-farm-approved"),
        ("Untrusted fake", "https://solarpowerportal.co.uk.evil.example/solar"),
        ("Untrusted fake", "https://evil.solarpowerportal.co.uk/solar"),
        ("Untrusted redirect", "https://news.google.com/rss/articles/abc"),
        ("Untrusted insecure", "http://www.solarpowerportal.co.uk/solar"),
        ("Untrusted script", "https://www.solarpowerportal.co.uk/rss.xml"),
        ("Untrusted document", "https://www.solarpowerportal.co.uk/report.pdf"),
        ("Valid UK solar farm approved for construction",
         "https://www.solarpowerportal.co.uk/uk-solar-farm-approved"),
    ]
    discovered = A.index_entries(rss(cases), FEED)
    assert len(discovered) == 1
    assert discovered[0] == (cases[0][0], cases[0][1], None, "")


@pytest.mark.parametrize("bad", [
    {**FEED, "url": "https://www.solarpowerportal.co.uk/rss.xml"},
    {**FEED, "url": INDEX.replace("api.gdeltproject.org", "evil.example")},
    {**FEED, "url": INDEX.replace("domain%3Asolarpowerportal", "domain%3Aexample")},
    {**FEED, "source": "GDELT"},
])
def test_fail_closed_on_unapproved_index(bad):
    with pytest.raises(ValueError):
        A.index_entries(rss([]), bad)


def test_source_index_failure_is_diagnostic_but_existing_feed_can_fail():
    original_url = "https://www.solarpowerportal.co.uk/rss.xml?content_types=article"
    original = {"url": original_url, "source": "Solar Power Portal", "uk_only": True}
    observed = []
    def fetch(url):
        observed.append(url)
        if url == original_url:
            raise PermissionError("HTTP Error 403: Forbidden")
        assert url == INDEX
        return rss([("UK solar farm approved in Oxfordshire",
                     "https://www.solarpowerportal.co.uk/uk-solar-farm-approved")])
    items, health = P.collect([original, FEED], fetch, P.Repd([]), NOW)
    assert observed == [original_url, INDEX]
    assert len(items) == 1
    assert items[0]["source"] == "Solar Power Portal"
    assert items[0]["link"] == "https://www.solarpowerportal.co.uk/uk-solar-farm-approved"
    assert items[0]["date"] is None  # Index's timestamp is NOT the publisher date
    assert items[0]["possible_match"] is None
    assert health[0]["status"] == "failed"
    assert "403" in health[0]["error"]
    assert health[1]["status"] == "ok"
    assert "publisher not fetched" in health[1]["source"]


def test_no_direct_links_is_reported_as_failed_not_success():
    items, health = P.collect([FEED], lambda url: rss([
        ("UK solar farm construction", "https://news.google.com/redirect/abc")
    ]), P.Repd([]), NOW)
    assert items == []
    assert health[0]["status"] == "failed"
    assert "no eligible direct publisher links" in health[0]["error"]


def test_legacy_news_category_filters_still_apply():
    body = rss([
        ("New UK solar farm approved for construction", "https://www.solarpowerportal.co.uk/solar-1"),
        ("Celebrity awards evening in London", "https://www.solarpowerportal.co.uk/irrelevant"),
        ("Sponsored content: UK solar farm approved", "https://www.solarpowerportal.co.uk/sponsored"),
    ])
    items, health = P.collect([FEED], lambda url: body, P.Repd([]), NOW)
    assert len(items) == 1
    assert items[0]["category"] in P.CATEGORIES
    assert health[0]["entries"] == 3 and health[0]["kept"] == 1


def test_real_feed_config_preserves_direct_source_and_adds_index():
    import json
    feeds = json.loads((ROOT / "pipeline_feeds.json").read_text())["feeds"]
    direct = [x for x in feeds if x["source"] == "Solar Power Portal" and x.get("kind", "rss") == "rss"]
    indexed = [x for x in feeds if x.get("kind") == "public_article_index"]
    assert len(direct) == len(indexed) == 1
    assert indexed[0]["url"] == INDEX
