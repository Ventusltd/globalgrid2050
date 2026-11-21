"""Solar Power Portal public homepage link discovery, without RSS bypass."""
from pathlib import Path
import sys
import json
import pytest

PKG = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PKG))
import pipeline_headlines as P
import original_article_links as O

HOME = "https://www.solarpowerportal.co.uk/"
FEED = {"url": HOME, "source": "Solar Power Portal",
        "kind": "public_article_index", "uk_only": True}
NOW = "2026-11-21T21:00:00Z"


def html(*links):
    return ("<html><body>" + "".join(
        f'<a href="{href}">{title}</a>' for title, href in links) +
        "</body></html>").encode()


def test_only_public_direct_article_links_are_kept():
    links = [
        ("New UK solar farm approved for construction",
         "/solar-projects/new-uk-solar-farm-approved"),
        ("Solar Power Portal editorial",
         "https://evil.example/solar-projects/stolen"),
        ("Unknown misleading page",
         "/about"),
        ("Fake on different publisher",
         "https://solarpowerportal.co.uk.evil.example/battery-storage/fake"),
        ("Valid energy grid policy decision announced",
         "/energy-policy/grid-policy-decision"),
        ("New UK solar farm approved for construction",
         "/solar-projects/new-uk-solar-farm-approved"),
    ]
    entries = O.index_entries(html(*links), FEED)
    assert len(entries) == 2
    assert entries[0] == (links[0][0], HOME + "solar-projects/new-uk-solar-farm-approved", None, "")
    assert entries[1][1] == HOME + "energy-policy/grid-policy-decision"


@pytest.mark.parametrize("url", [
    "https://www.solarpowerportal.co.uk/rss.xml",
    "http://www.solarpowerportal.co.uk/",
    "https://www.solarpowerportal.co.uk/battery-storage/example",
    "https://other.solarpowerportal.co.uk/",
    "https://www.solarpowerportal.co.uk/?page=4",
])
def test_fallback_url_must_be_exact_public_home(url):
    with pytest.raises(ValueError):
        O.index_entries(html(("Solar project approved", "/solar-projects/one")),
                        {**FEED, "url": url})


def test_blocked_rss_remains_diagnostic_and_homepage_links_work():
    original_url = "https://www.solarpowerportal.co.uk/rss.xml?content_types=article"
    original = {"url": original_url, "source": "Solar Power Portal", "uk_only": True}
    observed = []
    def fetch(url):
        observed.append(url)
        if url == original_url:
            raise PermissionError("HTTP Error 403: Forbidden")
        assert url == HOME
        return html(("UK solar farm approved in Oxfordshire",
                     "/solar-projects/uk-solar-farm-approved"))
    items, health = P.collect([original, FEED], fetch, P.Repd([]), NOW)
    assert observed == [original_url, HOME]  # never a single article page
    assert len(items) == 1
    assert items[0]["source"] == "Solar Power Portal"
    assert items[0]["link"] == HOME + "solar-projects/uk-solar-farm-approved"
    assert items[0]["date"] is None and items[0]["possible_match"] is None
    assert health[0]["status"] == "failed" and "403" in health[0]["error"]
    assert health[1]["status"] == "ok" and health[1]["kept"] == 1


def test_homepage_without_public_article_links_fails_closed():
    items, health = P.collect([FEED], lambda url: html(
        ("Read about solar power", "/about"),
        ("Click external solar story", "https://news.google.com/rss/articles/xyz"),
    ), P.Repd([]), NOW)
    assert items == []
    assert health[0]["status"] == "failed"
    assert "No direct public article links" in health[0]["error"]


def test_legacy_relevance_filters_still_apply():
    body = html(
        ("New UK solar farm approved for construction", "/solar-projects/uk-solar-1"),
        ("Celebrity awards evening in London", "/solar-projects/irrelevant"),
        ("Sponsored feature: solar farm approved", "/solar-projects/sponsored")
    )
    items, health = P.collect([FEED], lambda u: body, P.Repd([]), NOW)
    assert len(items) == 1
    assert items[0]["category"] in P.CATEGORIES
    assert health[0]["entries"] == 3 and health[0]["kept"] == 1


def test_source_catalogue_keeps_original_rss_as_separate_health_entry():
    feeds = json.loads((PKG / "pipeline_feeds.json").read_text())["feeds"]
    orig = [f for f in feeds if f["source"] == "Solar Power Portal" and f.get("kind", "rss") == "rss"]
    home = [f for f in feeds if f.get("kind") == "public_article_index"]
    assert len(orig) == len(home) == 1
    assert home[0]["url"] == HOME
