"""Regression checks: owner-excluded publisher is not fetched or displayed."""
import json
from pathlib import Path
import sys

import pytest

PKG = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PKG))
import pipeline_headlines as P

NOW = "2026-11-21T22:30:00Z"
BLOCK = "https://www.solarpowerportal.co.uk/solar-projects/uk-solar-farm-approved"
OTHER = "https://www.gov.uk/government/news/uk-solar-farm-approved"


def item(source, link, title="UK solar farm approved in Oxfordshire"):
    return {"title": title, "link": link, "source": source,
            "date": None, "first_seen": NOW, "category": "consent",
            "technology": "solar", "possible_match": None}


def test_config_omits_all_blocked_publisher_feeds():
    config = json.loads((PKG / "pipeline_feeds.json").read_text(encoding="utf-8"))
    assert config["excluded_sources"] == ["Solar Power Portal"]
    assert config["source_patch_id"] == "20261121-exclude-solar-power-portal-v1"
    assert len(config["feeds"]) == 69  # 68 unchanged + independent BBC COP31 link
    assert all(not P.excluded_publisher(f.get("source"), f.get("url")) for f in config["feeds"])
    assert not any(f["url"].startswith("https://www.solarpowerportal.co.uk/") for f in config["feeds"])


@pytest.mark.parametrize("source,url,blocked", [
    ("Solar Power Portal", BLOCK, True),
    ("solar power portal", OTHER, True),
    ("BBC News", BLOCK, True),
    ("BBC News", "https://sub.solarpowerportal.co.uk/solar", True),
    ("BBC News", "https://www.solarpowerportal.co.uk.evil.example/solar", False),
    ("BBC News", OTHER, False),
    ("Swissgrid", "https://www.swissgrid.ch/en/home", False),
])
def test_source_or_original_publisher_url_exclusion(source, url, blocked):
    assert P.excluded_publisher(source, url) is blocked


def test_manual_feed_input_does_not_trigger_publisher_network_request():
    feeds = [
        {"url": "https://www.solarpowerportal.co.uk/rss.xml?content_types=article",
         "source": "Solar Power Portal", "primary": True},
        {"url": "https://www.solarpowerportal.co.uk/solar-finance/a",
         "source": "Solar Power Portal", "kind": "curated",
         "title": "UK solar finance announced"},
        {"url": "https://www.gov.uk/feed.xml", "source": "Government", "uk_only": True},
    ]
    requested = []
    def fetch(url):
        requested.append(url)
        return (b"<rss><channel><item><title>UK solar farm approved in Oxfordshire</title>"
                b"<link>https://www.gov.uk/government/news/uk-solar-farm-approved</link>"
                b"</item></channel></rss>")
    items, health = P.collect(feeds, fetch, P.Repd([]), NOW)
    assert requested == ["https://www.gov.uk/feed.xml"]
    assert len(items) == len(health) == 1
    assert items[0]["source"] == "Government"
    assert all("Solar Power Portal" not in str(h) for h in health)


def test_retained_old_headlines_and_syndicated_links_are_purged():
    past = [
        item("Solar Power Portal", BLOCK),
        item("BBC News", BLOCK),
        item("GOV.UK", OTHER),
    ]
    current = [
        item("Solar Power Portal", BLOCK),
        item("BBC News", BLOCK),
        item("GOV.UK", OTHER),
    ]
    merged = P.merge(past, current, P.Repd([]), NOW)
    assert [x["link"] for x in merged] == [OTHER]
    assert not any(P.excluded_publisher(x["source"], x["link"]) for x in merged)


def test_build_drops_publisher_even_when_previous_snapshot_contains_it():
    prior = {"schema": P.SCHEMA, "items": [
        item("Solar Power Portal", BLOCK), item("GOV.UK", OTHER),
    ]}
    fresh, health = [], [{"source": "GOV.UK", "url": "https://www.gov.uk/feed.xml",
                         "status": "ok", "entries": 0, "kept": 0, "newest": None}]
    out = P.build(prior, fresh, health, P.Repd([]), NOW)
    assert out["counts"]["items"] == 1
    assert out["items"][0]["link"] == OTHER
    assert out["counts"]["feeds_failed"] == 0


def test_load_feeds_filters_disabled_source_from_older_fixture(tmp_path):
    config = {"feeds": [
        {"url": "https://www.solarpowerportal.co.uk/rss.xml", "source": "Solar Power Portal"},
        {"url": "https://www.gov.uk/feed.xml", "source": "GOV.UK"},
    ]}
    p = tmp_path / "feeds.json"
    p.write_text(json.dumps(config), encoding="utf-8")
    assert [f["source"] for f in P.load_feeds(p)] == ["GOV.UK"]
