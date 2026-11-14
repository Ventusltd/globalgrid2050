"""Agent 4 independent editorial ACID tests against the exact PR #100 v2 modules.

This file deliberately describes the DESIRED contract. An initial FAIL on the
frozen PR #100 head is evidence of a defect, not a green release gate.

No networking or publisher requests. All example headlines are synthetic.
"""
from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

import pytest

SIGNALS = Path(__file__).resolve().parents[1]
for module_dir in (SIGNALS, SIGNALS.parent):
    if str(module_dir) not in sys.path:
        sys.path.insert(0, str(module_dir))

import combine as C  # noqa: E402
import gate as G  # noqa: E402

CASES = json.loads((SIGNALS / "agent4" / "editorial_acid_cases.json").read_text(encoding="utf-8"))
ROWS = json.loads((SIGNALS / "top200_solar.json").read_text(encoding="utf-8"))
ALIASES = json.loads((SIGNALS / "aliases.json").read_text(encoding="utf-8"))
EXCLUSIONS = json.loads((SIGNALS / "exclusions.json").read_text(encoding="utf-8"))
STANDINGS = json.loads((SIGNALS / "alias_standings.json").read_text(encoding="utf-8"))
BY_REF = {str(row["repd_ref"]): row for row in ROWS}


@pytest.mark.parametrize("case", CASES["title_cases"], ids=lambda c: c["id"])
def test_title_gate_keeps_true_leads_and_rejects_collisions(case):
    assert case["ref"] in BY_REF
    verdict, reason = G.judge(case["ref"], case["headline"])
    assert verdict in case["allowed"], (
        f'{case["id"]} REPD {case["ref"]}: got {verdict!r} ({reason}); '
        f'allowed {case["allowed"]}; title={case["headline"]!r}'
    )


@pytest.mark.parametrize("case", CASES["dates"], ids=lambda c: c["id"])
def test_future_article_is_not_accepted_as_recent(case):
    clock = dt.datetime.fromisoformat(case["clock"].replace("Z", "+00:00"))
    raw = {
        "repd_ref": "9050", "title": "Synthetic planning decision for Bypass Solar Farm",
        "link": "https://example.org/agent4/synthetic-timestamp",
        "publisher": "Synthetic Test Publisher", "family": "regional",
        "confidence": "possible", "basis": "fixture only", "date": case["value"],
    }
    item, reason = C.clean_item(raw, "trade", today=clock.date(), collected_at=case["clock"])
    assert item is not None, reason
    assert item["date"] == case["allowed_date"], (
        f'{case["id"]}: a future article timestamp {case["value"]} '
        f'must not be presented as a dated recent item at {case["clock"]}; got {item["date"]}'
    )


def _reviewed_article(ref, title, link):
    return {
        "repd_ref": ref, "title": title, "link": link,
        "publisher": "Synthetic Test Publisher", "date": "2026-11-10",
        "family": "regional", "confidence": "confirmed",
        "obtained": "reviewed", "basis": "reviewed 2026-11-14",
    }


def _reviewed_run(title, link):
    refs = ("9050", "14096")
    part = {
        "schema": C.PART_SCHEMA, "team": "reviewed",
        "generated_at": "2026-11-14T11:00:00Z",
        "items": [_reviewed_article(ref, title, link) for ref in refs],
        "sources": [],
    }
    return C.combine(
        [BY_REF[ref] for ref in refs],
        ALIASES,
        {"reviewed": part},
        now_iso="2026-11-14T12:00:00Z",
        use_module=False,
        exclusions=EXCLUSIONS,
        standings=STANDINGS,
    )["projects"]


def _all_news(project):
    return [item for tier in C.TIERS for item in project[tier]]


@pytest.mark.parametrize("case", CASES["collisions"], ids=lambda c: c["id"])
def test_reviewed_shared_link_requires_evidence_for_each_project(case):
    projects = _reviewed_run(case["article"], case["link"])
    assert len(_all_news(projects[case["source_project"]])) == 1, "genuine referenced project must survive"
    assert _all_news(projects[case["wrong_project"]]) == [], (
        f'{case["id"]}: a manually reviewed URL must not be inherited by unrelated '
        f'REPD {case["wrong_project"]} without direct project identification'
    )


def test_genuine_explicit_multi_project_review_keeps_both_project_ids():
    """Positive: do not prohibit a genuinely multi-project article."""
    projects = _reviewed_run(
        "Bypass Solar Farm and Frodsham Solar Farm receive planning decisions",
        "https://example.org/agent4/synthetic-two-projects",
    )
    assert all(len(_all_news(projects[ref])) == 1 for ref in ("9050", "14096"))


def test_2019_article_remains_archival_even_when_collected_today():
    article, err = C.clean_item({
        "repd_ref": "9050", "title": "2019 context about Bypass Solar Farm",
        "link": "https://example.org/agent4/historical",
        "date": "2019-07-09", "publisher": "Synthetic Test Publisher",
        "family": "regional", "confidence": "possible", "basis": "fixture only",
    }, "trade", today=dt.date(2026, 11, 14), collected_at="2026-11-14T12:00:00Z")
    assert article is not None, err
    assert article["tier"] == "archive" and article["freshness"] == "older"
