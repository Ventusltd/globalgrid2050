#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FEED = ROOT / "dist" / "major_project_news_v9_5_1.json"
V5 = ROOT / "dist" / "major_project_news_v5.json"


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def key(item: dict) -> tuple[str, str, str]:
    return (
        str(item.get("headline") or "").casefold().strip(),
        str(item.get("source_url") or item.get("source") or "").casefold().strip(),
        str(item.get("published") or "")[:10],
    )


feed, v5 = load(FEED), load(V5)
assert feed["schema"] == "globalgrid2050.major-project-news.v9.5.1"
assert feed["release"] == "9.5.1"
assert feed["all_headline_count"] == len(feed["all_items"]) == 133
assert feed["relevant_headline_count"] == len(feed["canonical_items"]) == 45
assert feed["v9_4_baseline_headline_count"] == len(v5["items"]) == 125
assert feed["v5_revalidated_primary_count"] == 37
assert feed["v6_canonical_headline_count"] == 8

all_keys = {key(item) for item in feed["all_items"]}
assert {key(item) for item in v5["items"]} <= all_keys, "V9.4 newspaper was truncated"
assert sum(item["canonical_relevant"] for item in feed["all_items"]) == 45

for item in feed["canonical_items"]:
    assert item["role"] == "PRIMARY_MATCH"
    assert item["eligible_for_news_signal"] is True
    assert item["gg_project_id"] == f"GG2050-REPD-{item['repd_ref']}"
for item in feed["all_items"]:
    if not item["canonical_relevant"]:
        assert item["role"] == "DISCOVERY_ONLY"
        assert item["eligible_for_news_signal"] is False

beacon = [
    item for item in feed["canonical_items"]
    if item["headline"] == "Beacon Fen Energy Park development consent decision announced"
]
assert len(beacon) == 1
assert beacon[0]["repd_ref"] == "13599"
assert beacon[0]["gg_project_id"] == "GG2050-REPD-13599"
assert beacon[0]["operator"] == "Low Carbon Limited"
assert beacon[0]["capacity_mw"] == 400.0
assert beacon[0]["technology"] == "solar"
assert beacon[0]["confidence"] == 91
assert "13600" in beacon[0]["development_related_repd_refs"]

hostile_patterns = ("New Jersey Board", "South Australia", "Evolution Mining", "Forest Healthcare")
for pattern in hostile_patterns:
    matches = [item for item in feed["all_items"] if pattern.casefold() in item["headline"].casefold()]
    assert matches, f"hostile discovery fixture missing: {pattern}"
    assert all(item["canonical_relevant"] is False for item in matches), pattern

print("V9.5.1 feed: PASS (133 ALL, 45 RELEVANT, Beacon Fen -> REPD 13599, discovery-only blocked from signals)")
