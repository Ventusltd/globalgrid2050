"""International research lane regression checks: no weakening of UK/REPD controls."""
from pathlib import Path
import sys
import pytest

PKG = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PKG))
import pipeline_headlines as P
import research_indexes as R

NOW = "2026-11-21T16:00:00Z"

@pytest.mark.parametrize("title,category", [
    ("A study on data centres shows that the real bottleneck lies in the grid", "datacentre"),
    ("DNV Energy Transition Outlook 2026: grid and storage investment", "grid"),
    ("Swissgrid announces electricity transmission grid capacity improvements", "grid"),
    ("Federal Reserve says interest rates will stay unchanged", "finance"),
    ("Bank of England monetary policy statement and Bank Rate", "finance"),
    ("HM Treasury announces infrastructure financing review", "finance"),
    ("Powering the AI revolution: data centre grid connections", "datacentre"),
    ("The Swiss electricity grid faces new power demand constraints", "grid"),
])
def test_global_context_keep(title, category):
    assert P.lane_label(title, "global_context") == (category, None, None)

@pytest.mark.parametrize("title", [
    "Markets rally as chipmakers announce a share buyback",
    "Deloitte appoints new chief executive in Zurich",
    "KPMG wins national audit firm of the year",
    "Swiss tourism industry reports summer growth",
    "Federal Reserve publishes staff survey response",
    "Sponsored feature: data centre grid investments",
])
def test_global_context_reject(title):
    assert P.lane_label(title, "global_context") is None

def test_uk_standard_lane_still_rejects_swiss_non_uk_context():
    repd = P.Repd([])
    title = "Swiss electricity grid constraints hit data centre developers"
    assert not P.is_uk(title, repd)
    body = ('<rss><channel><item><title>' + title + '</title>'
            '<link>https://example.org/swiss</link></item></channel></rss>').encode()
    items, _ = P.collect([{"url":"https://x.example/feed", "source":"X", "uk_only":False}],
                         lambda url: body, repd, NOW)
    assert not items

def test_curated_deloitte_is_attributed_without_fabricated_date_or_repd():
    url = "https://www.deloitte.com/ch/en/about/press-room/studie-zu-rechenzentren-zeigt-der-eigentliche-engpass-liegt-im-netz.html"
    feed = {"url": url, "source": "Deloitte Switzerland", "kind": "curated", "lane": "global_context",
            "title": "A study on data centres shows that the real bottleneck lies in the grid"}
    def must_not_fetch(url):
        raise AssertionError("curated link must not be falsely described as fetched")
    items, health = P.collect([feed], must_not_fetch, P.Repd([]), NOW)
    assert len(items) == 1
    assert items[0]["link"] == url
    assert items[0]["source"] == "Deloitte Switzerland"
    assert items[0]["date"] is None and items[0]["possible_match"] is None
    assert health[0]["kept"] == 1

def test_bounded_html_index_keeps_english_same_host_only():
    feed = {"url":"https://www.deloitte.com/ch/en/about/press-room.html",
            "article_prefixes":["/ch/en/about/press-room/"],"english_only":True}
    body = b"""<html><body>
    <a href="/ch/en/about/press-room/data-centres-grid.html">Data centres: electricity grid bottleneck research</a>
    <a href="/ch/de/about/press-room/studie.html">Data centres on Swiss grid study</a>
    <a href="https://evil.example/ch/en/about/press-room/fraud.html">Data centres fake offsite study</a>
    <a href="/ch/en/about/press-room.html">Press room landing page</a>
    <a href="/ch/en/about/press-room/data-centres-grid.html">Data centres: electricity grid bottleneck research</a>
    </body></html>"""
    got = R.index_entries(body, feed)
    assert len(got) == 1
    assert got[0][1] == "https://www.deloitte.com/ch/en/about/press-room/data-centres-grid.html"
    assert got[0][2] is None

def test_html_discovery_passes_through_context_classification():
    feed = {"url":"https://www.dnv.com/news/", "source":"DNV", "lane":"global_context",
            "kind":"html_index","article_prefixes":["/news/"]}
    body = b"""<html><a href="/news/2026/critical-grid-update/">
      DNV grid capacity and energy infrastructure study
    </a><a href="/news/2026/irrelevant/">DNV announces new colleague in Oslo</a></html>"""
    items, _ = P.collect([feed], lambda u: body, P.Repd([]), NOW)
    assert len(items) == 1
    assert items[0]["date"] is None and items[0]["possible_match"] is None

def test_research_is_lane_capped_without_crowding_original_world_lanes():
    assert P.WORLD_LANE_CAPS["global_context"] >= 25
    assert P.WORLD_LANE_CAPS["china_solar"] == 10
    assert P.WORLD_LANE_CAPS["datacentre_money"] == 10
