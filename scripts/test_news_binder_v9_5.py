#!/usr/bin/env python3
"""Offline V9.5 news-binder recall and adversarial regression gate."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import major_project_news_v6 as matcher  # noqa: E402


def story(title: str, source: str = "Example News", source_url: str = "https://example.com") -> dict:
    return {
        "title": title,
        "description": "",
        "source": source,
        "source_url": source_url,
        "link": "https://example.test/v9-5-news-binder",
        "published": datetime.now(timezone.utc),
    }


snapshot, projects = matcher.load_project_snapshot()
by_ref = {project["repd_ref"]: project for project in projects}

expected_stems = {
    "West Burton Power Station, North Road - Battery Storage": "west burton",
    "Clifton Marsh Farm, Preston New Road - Solar Farm": "clifton marsh",
    "The Tween Bridge Solar Farm": "tween bridge",
    "Helios Renewable Energy Project": "helios",
    "Coalburn Energy - Battery Storage": "coalburn",
    "Dean Moor Solar Farm & Battery Storage": "dean moor",
    "Stonestreet Green - Solar Farm & Battery Storage": "stonestreet green",
}
for official_name, expected in expected_stems.items():
    actual = matcher.distinctive_name_stem(official_name)
    assert actual == expected, f"stem {official_name!r}: {actual!r} != {expected!r}"

assert by_ref["13599"]["_name_duplicate_count"] == 1
assert by_ref["13600"]["_name_duplicate_count"] == 1
assert by_ref["12926"]["_name_stem_duplicate_count"] == 1
assert by_ref["19574"]["_name_stem_duplicate_count"] == 1

positives = (
    ("DESNZ grants DCO for 150MW Dean Moor solar project in Cumbria", "Solar Power Portal", "https://solarpowerportal.co.uk", "14550"),
    ("Longhedge solar project begins construction in Nottinghamshire", "reNEWS", "https://renews.biz", "11063"),
    ("Beacon Fen Energy Park development consent decision announced", "GOV.UK", "https://www.gov.uk", "13599"),
    ("Helios Renewable Energy Project development consent decision announced", "GOV.UK", "https://www.gov.uk", "11476"),
    ("1GWh Coalburn 1 battery energy storage enters operations in Scotland", "Solar Power Portal", "https://solarpowerportal.co.uk", "11034"),
    ("Elements Green acquires 300 MW Newarthill BESS project", "Energy Global", "https://energyglobal.com", "14763"),
    ("Eccles battery storage system plan secures £245m finance deal", "BBC", "https://www.bbc.co.uk", "11867"),
    ("Miliband grants DCO for Stonestreet Green solar-plus-storage NSIP", "Solar Power Portal", "https://solarpowerportal.co.uk", "10085"),
    ("Consent awarded for Clifton Marsh Solar Farm", "Vattenfall", "https://group.vattenfall.com", "13763"),
    ("Proposed Sutton-on-the-Forest solar farm attracts local criticism", "BBC", "https://www.bbc.co.uk", "19658"),
    ("EDF to optimise BW ESS’s 350MW Hams Hall BESS project", "Solar Power Portal", "https://solarpowerportal.co.uk", "9427"),
    ("RWE submits planning application for £125m Tween Bridge Solar development project", "Doncaster Free Press", "https://doncasterfreepress.co.uk", "12926"),
    ("RES secures three-year O&M contract for Cleve Hill solar project", "Solar Power Portal", "https://solarpowerportal.co.uk", "6502"),
)

positive_results = []
for title, source_name, source_url, expected_ref in positives:
    item, resolution, detail = matcher._resolve_story(story(title, source_name, source_url), projects)
    actual_ref = item and item.get("repd_ref")
    positive_results.append({"title": title, "expected": expected_ref, "actual": actual_ref, "resolution": resolution})

positive_passes = sum(result["expected"] == result["actual"] for result in positive_results)
recall = positive_passes / len(positive_results)
assert recall >= 0.80, json.dumps(positive_results, indent=2)

brecks, brecks_resolution, _ = matcher._resolve_story(
    story(
        "Qair contracts INTEC to provide EPC and O&M services at 46.5MW Brecks solar farm",
        "Solar Power Portal",
        "https://solarpowerportal.co.uk",
    ),
    projects,
)
assert brecks is not None and brecks_resolution == "accepted"
assert brecks["repd_ref"] == "10087"
assert brecks["capacity_mw"] == 45.4
assert brecks["news_capacities_mw"] == [46.5]

negatives = (
    "New Jersey Board of Public Utilities releases 150MW BTM energy storage proposal",
    "Sol Systems reaches financial close on 123MW Illinois solar portfolio",
    "Fields record demand as 150MW solar output reaches a new high",
    "150MW battery project approved in the UK",
    "Stonestreet Green solar project approved in Australia",
    "California Farm solar project secures approval in California",
    "Canada Farm solar project expands into Ontario",
    "Cleve Hill offshore wind farm begins construction",
    "West Burton C BESS project reaches financial close",
)
negative_leaks = []
for title in negatives:
    item, resolution, _detail = matcher._resolve_story(
        story(title, "Energy-Storage.News", "https://energy-storage.news"), projects
    )
    if item is not None:
        negative_leaks.append({"title": title, "repd_ref": item.get("repd_ref"), "resolution": resolution})
assert not negative_leaks, json.dumps(negative_leaks, indent=2)

telemetry = (json.loads((ROOT / "dist" / "major_project_news_v6.json").read_text()).get("telemetry") or {})
assert isinstance(telemetry.get("pair_rejection_reasons"), dict)
assert isinstance(telemetry.get("rejected_article_samples"), list)
assert len(telemetry["rejected_article_samples"]) <= matcher.MAX_REJECTED_ARTICLE_SAMPLES

print(
    "V9.5 news binder: PASS "
    f"({positive_passes}/{len(positive_results)} focused positives, "
    f"{len(negatives)}/{len(negatives)} hostile negatives rejected, telemetry present)"
)
