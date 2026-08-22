#!/usr/bin/env python3
"""Bounded production wrapper for the V6 public news crawler.

The base crawler owns all matching and output semantics. This wrapper only
limits the targeted solar backstop, then verifies that news generation did not
mutate the validated project snapshot and that every published relationship
obeys the V6 one-primary / context-only-related contract.
"""
from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timezone

import major_project_news_v6 as base

TARGETED_SOLAR_BATCH_LIMIT = 48
TARGETED_STATS: dict[str, int] = {}


def queries(projects: list[dict]) -> list[str]:
    """Plan source-first discovery plus a bounded project-name backstop."""
    planned = list(base.BROAD_QUERIES) + list(base.SOURCE_QUERIES)

    # The BESS universe is small enough for its complete name backstop each run.
    bess_names = [project["name"] for project in projects if project["technology"] == "bess"]
    bess_groups = base.chunk_names(bess_names)
    for group in bess_groups:
        terms = " OR ".join('"' + name + '"' for name in group)
        planned.append("(" + terms + ') "battery storage" UK')

    # Solar >1 MW is much larger. Source-first discovery still covers the whole
    # universe; rotate a small deterministic time-slot of name batches as a
    # completeness backstop so all requests can finish inside the 122s internal
    # deadline and the workflow's 170s last-resort timeout.
    solar_names = [project["name"] for project in projects if project["technology"] == "solar"]
    solar_groups = base.chunk_names(solar_names)
    selected: list[list[str]] = []
    if solar_groups:
        limit = min(TARGETED_SOLAR_BATCH_LIMIT, len(solar_groups))
        slot = int(datetime.now(timezone.utc).timestamp() // 300)
        start = (slot * limit) % len(solar_groups)
        selected = [solar_groups[(start + offset) % len(solar_groups)] for offset in range(limit)]
        for group in selected:
            terms = " OR ".join('"' + name + '"' for name in group)
            planned.append("(" + terms + ") solar UK")

    TARGETED_STATS.clear()
    TARGETED_STATS.update(
        {
            "source_first_queries": len(base.BROAD_QUERIES) + len(base.SOURCE_QUERIES),
            "bess_targeted_batches": len(bess_groups),
            "solar_targeted_batches_selected": len(selected),
            "solar_targeted_batches_total": len(solar_groups),
            "solar_targeted_rotation_minutes": 5,
        }
    )
    base.QUERY_PLAN_META.clear()
    base.QUERY_PLAN_META.update(TARGETED_STATS)
    return list(dict.fromkeys(planned))


def validate_outputs(payload: dict) -> None:
    """Fail if emitted public news/link data violates canonical binding rules."""
    items = payload.get("items")
    if not isinstance(items, list) or payload.get("headline_count") != len(items):
        raise RuntimeError("V6 news headline_count does not match its items array")

    article_ids: list[str] = []
    for index, item in enumerate(items):
        article_id = item.get("gg_article_id")
        evidence = item.get("match_evidence") or {}
        if not article_id or item.get("role") != "PRIMARY_MATCH":
            raise RuntimeError(f"V6 news item {index} has no canonical PRIMARY_MATCH")
        if item.get("eligible_for_news_signal") is not True:
            raise RuntimeError(f"V6 news item {article_id} cannot drive NEWS SIGNAL")
        if not item.get("repd_ref") or not item.get("gg_project_id") or not item.get("gg_development_id"):
            raise RuntimeError(f"V6 news item {article_id} lacks canonical project identity")
        if not all(
            evidence.get(flag) is True
            for flag in (
                "identity_gate_passed",
                "technology_gate_passed",
                "foreign_location_gate_passed",
                "foreign_veto_passed",
                "duplicate_name_gate_passed",
            )
        ):
            raise RuntimeError(f"V6 news item {article_id} lacks audited gate evidence")
        if evidence.get("capacity_only") is not False:
            raise RuntimeError(f"V6 news item {article_id} passed on capacity alone")
        if evidence.get("capacity_is_corroboration_only") is not True:
            raise RuntimeError(f"V6 news item {article_id} treats capacity as identity")
        article_ids.append(article_id)
    if len(article_ids) != len(set(article_ids)):
        raise RuntimeError("V6 news contains duplicate canonical article IDs")
    article_id_set = set(article_ids)

    link_payload = json.loads(base.LINKS_OUT.read_text(encoding="utf-8"))
    if link_payload.get("schema") != "globalgrid2050.project-news-links.v6":
        raise RuntimeError("Unexpected V6 project-news relationship schema")
    links = link_payload.get("links")
    if not isinstance(links, list) or link_payload.get("link_count") != len(links):
        raise RuntimeError("V6 project-news link_count does not match its links array")

    primary_counts: Counter[str] = Counter()
    for link in links:
        article_id, role = link.get("gg_article_id"), link.get("role")
        if article_id not in article_id_set:
            raise RuntimeError("V6 project-news link references an unpublished article")
        if role == "PRIMARY_MATCH":
            primary_counts[article_id] += 1
            if link.get("eligible_for_news_signal") is not True:
                raise RuntimeError(f"PRIMARY_MATCH {article_id} is not NEWS SIGNAL eligible")
        elif role == "RELATED_DEVELOPMENT":
            if link.get("eligible_for_news_signal") is not False:
                raise RuntimeError(f"RELATED_DEVELOPMENT {article_id} can drive NEWS SIGNAL")
        else:
            raise RuntimeError(f"Unsupported V6 project-news role: {role!r}")
    if any(primary_counts[article_id] != 1 for article_id in article_ids):
        raise RuntimeError("Every published V6 article must have exactly one PRIMARY_MATCH")
    if link_payload.get("article_count") != len(items):
        raise RuntimeError("V6 project-news article_count does not match news items")
    if link_payload.get("primary_link_count") != len(items):
        raise RuntimeError("V6 project-news primary_link_count is not exactly one per article")
    if link_payload.get("related_development_link_count") != sum(
        link.get("role") == "RELATED_DEVELOPMENT" for link in links
    ):
        raise RuntimeError("V6 project-news related link metadata is inconsistent")
    # Empty items/links is intentionally valid for a quiet or unavailable crawl.


def main() -> dict:
    snapshot_hash_before = base.file_sha256(base.PROJECTS_PATH)
    base.queries = queries
    payload = base.main()
    if base.file_sha256(base.PROJECTS_PATH) != snapshot_hash_before:
        raise RuntimeError("Hardened news crawler modified immutable dist/major_projects_v6.json")
    validate_outputs(payload)
    return payload


if __name__ == "__main__":
    main()
