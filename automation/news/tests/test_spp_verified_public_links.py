"""Verified original Solar Power Portal links: no bot bypass, no articles copied."""
from pathlib import Path
from urllib.parse import urlsplit
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import pipeline_headlines as P

NOW = "2026-11-21T22:00:00Z"


def test_curated_public_links_are_direct_and_fetchless():
    config = json.loads((ROOT / "pipeline_feeds.json").read_text())
    curated = [f for f in config["feeds"] if f.get("kind") == "curated"
               and f.get("source") == "Solar Power Portal"]
    assert config["source_patch_id"] == "20261121-spp-verified-links-v1"
    assert len(curated) == 4
    for feed in curated:
        url = urlsplit(feed["url"])
        assert url.scheme == "https" and url.hostname == "www.solarpowerportal.co.uk"
        assert url.path.startswith(("/battery-storage/", "/solar-finance/", "/energy-policy/", "/colocation/"))
        assert feed["uk_only"] is True
        assert not feed.get("date")  # no invented minute or timestamp
        assert "verified" in feed["reason"].lower() or "Verified" in feed["reason"]
    def network_forbidden(url):
        raise AssertionError("Curated public links must never request publisher RSS or article bodies")
    items, health = P.collect(curated, network_forbidden, P.Repd([]), NOW)
    assert len(health) == 4 and all(h["status"] == "ok" for h in health)
    assert len(items) == 4
    assert {i["link"] for i in items} == {f["url"] for f in curated}
    assert all(i["source"] == "Solar Power Portal" for i in items)
    assert all(i["date"] is None for i in items)
    assert all(i["possible_match"] is None for i in items)


def test_existing_feed_configuration_is_retained():
    feeds = json.loads((ROOT / "pipeline_feeds.json").read_text())["feeds"]
    original = [x for x in feeds if x.get("url") ==
        "https://www.solarpowerportal.co.uk/rss.xml?content_types=article"]
    assert len(original) == 1  # 403 remains explicitly diagnosed in existing source health
    assert original[0]["source"] == "Solar Power Portal"
