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
from datetime import date, datetime, timedelta, timezone

import major_project_news_v6 as base

TARGETED_SOLAR_BATCH_LIMIT = 48
TARGETED_STATS: dict[str, object] = {}
_PREVIOUS_NEWS_PAYLOAD: dict | None = None
_PREVIOUS_NEWS_STATUS = "not_checked"


def _load_previous_news_payload() -> dict | None:
    """Read the last published V6 edition before base.main() replaces it."""
    try:
        payload = json.loads(base.NEWS_OUT.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return None
    if payload.get("schema") != "globalgrid2050.major-project-news.v6":
        return None
    if not isinstance(payload.get("items"), list):
        return None
    return payload


def _accept_previous_news_payload(previous: dict | None, projects_sha256: str) -> tuple[dict | None, str]:
    """Bind cursor and story retention to the same canonical project universe."""
    if previous is None:
        return None, "not_available_or_invalid"
    prior_snapshot = previous.get("project_snapshot") or {}
    if prior_snapshot.get("declared_projects_sha256") != projects_sha256:
        return None, "project_snapshot_mismatch"
    return previous, "accepted_same_project_snapshot"


def _persisted_solar_cursor(total: int, previous: dict | None) -> tuple[int, str]:
    """Return the validated next cursor from the preceding published edition."""
    if total <= 0:
        return 0, "empty_universe"
    plan = ((previous or {}).get("telemetry") or {}).get("query_plan") or {}
    cursor = plan.get("solar_rotation_cursor_next", plan.get("solar_targeted_cursor_next"))
    if isinstance(cursor, int) and not isinstance(cursor, bool) and 0 <= cursor < total:
        return cursor, "previous_v6_news_telemetry"
    return 0, "initial_zero"


def _rotation_window(total: int, limit: int, start: int) -> tuple[list[int], int]:
    """Select one consecutive circular window and its persisted successor."""
    if total <= 0 or limit <= 0:
        return [], 0
    count = min(limit, total)
    start %= total
    indexes = [(start + offset) % total for offset in range(count)]
    return indexes, (start + count) % total


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
    # universe; use the cursor committed in the preceding V6 news artefact to
    # rotate a consecutive name-batch backstop. This makes coverage exhaustive
    # and independent of GitHub Actions cron drift while retaining the 122s
    # internal deadline and workflow's 170s last-resort timeout.
    solar_names = [project["name"] for project in projects if project["technology"] == "solar"]
    solar_groups = base.chunk_names(solar_names)
    selected: list[list[str]] = []
    selected_indexes: list[int] = []
    cursor_start = cursor_next = 0
    cursor_source = "empty_universe"
    if solar_groups:
        limit = min(TARGETED_SOLAR_BATCH_LIMIT, len(solar_groups))
        cursor_start, cursor_source = _persisted_solar_cursor(len(solar_groups), _PREVIOUS_NEWS_PAYLOAD)
        selected_indexes, cursor_next = _rotation_window(len(solar_groups), limit, cursor_start)
        selected = [solar_groups[index] for index in selected_indexes]
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
            "solar_targeted_cursor_start": cursor_start,
            "solar_targeted_cursor_next": cursor_next,
            "solar_targeted_cursor_source": cursor_source,
            "solar_rotation_cursor_start": cursor_start,
            "solar_rotation_cursor_next": cursor_next,
            "solar_rotation_cursor_source": cursor_source,
            "solar_targeted_batch_indexes": selected_indexes,
            "solar_targeted_full_coverage_runs_max": (
                (len(solar_groups) + TARGETED_SOLAR_BATCH_LIMIT - 1) // TARGETED_SOLAR_BATCH_LIMIT
                if solar_groups else 0
            ),
            "solar_rotation_full_sweep_runs": (
                (len(solar_groups) + TARGETED_SOLAR_BATCH_LIMIT - 1) // TARGETED_SOLAR_BATCH_LIMIT
                if solar_groups else 0
            ),
            "solar_targeted_coverage_policy": "persisted consecutive circular cursor",
        }
    )
    base.QUERY_PLAN_META.clear()
    base.QUERY_PLAN_META.update(TARGETED_STATS)
    return list(dict.fromkeys(planned))


def _published_datetime(value) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return (parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)


def _item_story_key(item: dict) -> tuple[str, str, str]:
    """Use the same public headline/source/date identity across fresh and carried items."""
    return (
        base.norm(item.get("headline")),
        base.norm(item.get("source_url") or item.get("source")),
        str(item.get("published") or "")[:10],
    )


def _revalidate_previous_item(item: dict, projects: list[dict], today: date) -> tuple[dict | None, str]:
    """Replay a published item through the current global matcher and identity universe."""
    if (
        not isinstance(item, dict)
        or item.get("role") != "PRIMARY_MATCH"
        or item.get("eligible_for_news_signal") is not True
        or not item.get("gg_article_id")
        or not item.get("repd_ref")
    ):
        return None, "invalid_previous_primary"
    published = _published_datetime(item.get("published"))
    if published is None:
        return None, "invalid_publication_date"
    if published.date() < today - timedelta(days=base.LOOKBACK_DAYS) or published.date() > today:
        return None, "outside_news_horizon"
    story = {
        "title": str(item.get("headline") or ""),
        "description": "",
        "source": str(item.get("source") or ""),
        "source_url": str(item.get("source_url") or ""),
        "link": str(item.get("url") or ""),
        "published": published,
    }
    if not story["title"] or not story["link"]:
        return None, "invalid_previous_story"
    resolved, reason, _detail = base._resolve_story(story, projects)
    if resolved is None:
        return None, "current_gate_" + reason
    if resolved.get("repd_ref") != str(item.get("repd_ref")):
        return None, "canonical_primary_changed"

    # Preserve the canonical article identity and public article URL from the
    # prior edition; all project fields and gate evidence come from this run's
    # snapshot and matcher.
    resolved["gg_article_id"] = item["gg_article_id"]
    resolved["headline"] = item["headline"]
    resolved["url"] = item["url"]
    return resolved, "revalidated"


def _merge_previous_items(payload: dict, previous: dict | None, projects: list[dict]) -> dict:
    """Union fresh stories with still-valid prior stories, preferring fresh duplicates."""
    fresh = list(payload.get("items") or [])
    old_items = list((previous or {}).get("items") or [])
    today = datetime.now(timezone.utc).date()
    revalidated: list[dict] = []
    dropped = Counter()
    for item in old_items:
        carried, reason = _revalidate_previous_item(item, projects, today)
        if carried is None:
            dropped[reason] += 1
        else:
            revalidated.append(carried)

    combined: list[dict] = []
    seen_ids: set[str] = set()
    seen_story_keys: set[tuple[str, str, str]] = set()
    fresh_ids = {str(item.get("gg_article_id") or "") for item in fresh}
    fresh_story_keys = {_item_story_key(item) for item in fresh}
    carried_before_limit = 0
    duplicate_previous_fresh = 0
    duplicate_previous_internal = 0
    for origin, items in (("fresh", fresh), ("previous", revalidated)):
        for item in items:
            article_id = str(item.get("gg_article_id") or "")
            story_key = _item_story_key(item)
            if article_id in seen_ids or story_key in seen_story_keys:
                if origin == "previous":
                    if article_id in fresh_ids or story_key in fresh_story_keys:
                        duplicate_previous_fresh += 1
                    else:
                        duplicate_previous_internal += 1
                continue
            seen_ids.add(article_id)
            seen_story_keys.add(story_key)
            combined.append(item)
            if origin == "previous":
                carried_before_limit += 1
    combined.sort(key=lambda item: (item["published"], item["confidence"], item["headline"]), reverse=True)
    published = combined[:base.MAX_HEADLINES]
    published_fresh = sum(str(item.get("gg_article_id") or "") in fresh_ids for item in published)
    published_carried = len(published) - published_fresh

    payload["items"] = published
    payload["headline_count"] = len(published)
    payload["official_source_headlines"] = sum(
        bool(item.get("match_evidence", {}).get("official_source")) for item in published
    )
    payload["discovery_policy"] = (
        "source-first bounded crawl + persisted exhaustive project-name rotation + "
        "within-horizon revalidated story retention; no V5/private fallback"
    )
    telemetry = payload.setdefault("telemetry", {})
    current_crawl_published = int(telemetry.get("articles_published") or len(fresh))
    telemetry["articles_published_current_crawl"] = current_crawl_published
    telemetry["articles_published_fresh"] = published_fresh
    telemetry["articles_published"] = len(published)
    telemetry["previous_articles_considered"] = len(old_items)
    telemetry["previous_articles_revalidated"] = len(revalidated)
    telemetry["previous_articles_carried_forward"] = published_carried
    telemetry["previous_articles_dropped"] = len(old_items) - len(revalidated)
    telemetry["previous_article_drop_reasons"] = dict(sorted(dropped.items()))
    telemetry["fresh_articles_published"] = published_fresh
    telemetry["story_retention"] = {
        "policy": "revalidate previous PRIMARY_MATCH against current snapshot and matcher",
        "previous_artifact_available": previous is not None,
        "previous_artifact_status": _PREVIOUS_NEWS_STATUS,
        "previous_items_considered": len(old_items),
        "previous_items_revalidated": len(revalidated),
        "previous_items_carried_before_limit": carried_before_limit,
        "previous_items_carried": published_carried,
        "previous_items_deduplicated_by_fresh_result": duplicate_previous_fresh,
        "previous_items_deduplicated_within_previous": duplicate_previous_internal,
        "previous_items_dropped": len(old_items) - len(revalidated),
        "previous_items_dropped_reasons": dict(sorted(dropped.items())),
        "fresh_items": len(fresh),
        "union_items_before_limit": len(combined),
        "union_items_published": len(published),
        "union_items_dropped_by_headline_limit": max(0, len(combined) - len(published)),
    }
    return payload


def _finalize_rotation_cursor(payload: dict) -> None:
    """Advance only after every selected solar backstop query completes."""
    telemetry = payload.setdefault("telemetry", {})
    plan = telemetry.setdefault("query_plan", {})
    solar_execution = (telemetry.get("query_execution") or {}).get("solar_targeted_backstop") or {}
    configured = solar_execution.get("configured")
    completed = solar_execution.get("completed")
    failed = solar_execution.get("failed")
    crawl_complete = (
        isinstance(configured, int)
        and configured > 0
        and completed == configured
        and failed == 0
    )
    planned_next = plan.get("solar_rotation_cursor_next")
    cursor_start = plan.get("solar_rotation_cursor_start")
    plan["solar_rotation_cursor_planned_next"] = planned_next
    plan["solar_rotation_advance_applied"] = crawl_complete
    plan["solar_rotation_advance_reason"] = (
        "all_selected_solar_queries_completed" if crawl_complete else "incomplete_solar_query_execution_retry_window"
    )
    if not crawl_complete and isinstance(cursor_start, int):
        plan["solar_rotation_cursor_next"] = cursor_start
        plan["solar_targeted_cursor_next"] = cursor_start


def _write_merged_outputs(payload: dict, projects: list[dict]) -> None:
    links = base._build_links(payload["items"], projects)
    link_payload = {
        "schema": "globalgrid2050.project-news-links.v6",
        "generated_at": payload["updated"],
        "article_count": len(payload["items"]),
        "link_count": len(links),
        "primary_link_count": sum(link["role"] == "PRIMARY_MATCH" for link in links),
        "related_development_link_count": sum(link["role"] == "RELATED_DEVELOPMENT" for link in links),
        "rules": {
            "one_primary_match_per_article": True,
            "primary_match_drives_news_signal": True,
            "related_development_drives_news_signal": False,
            "related_development_never_confirms_repd_status": True,
        },
        "links": links,
    }
    base.write_json_atomic(base.NEWS_OUT, payload)
    base.write_json_atomic(base.LINKS_OUT, link_payload)


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
    global _PREVIOUS_NEWS_PAYLOAD, _PREVIOUS_NEWS_STATUS
    snapshot_hash_before = base.file_sha256(base.PROJECTS_PATH)
    candidate_previous = _load_previous_news_payload()
    snapshot, projects = base.load_project_snapshot()
    _PREVIOUS_NEWS_PAYLOAD, _PREVIOUS_NEWS_STATUS = _accept_previous_news_payload(
        candidate_previous, str(snapshot.get("projects_sha256") or "")
    )
    base.queries = queries
    payload = base.main()
    if base.file_sha256(base.PROJECTS_PATH) != snapshot_hash_before:
        raise RuntimeError("Hardened news crawler modified immutable dist/major_projects_v6.json")
    _finalize_rotation_cursor(payload)
    payload = _merge_previous_items(payload, _PREVIOUS_NEWS_PAYLOAD, projects)
    _write_merged_outputs(payload, projects)
    if base.file_sha256(base.PROJECTS_PATH) != snapshot_hash_before:
        raise RuntimeError("Hardened news retention modified immutable dist/major_projects_v6.json")
    validate_outputs(payload)
    return payload


if __name__ == "__main__":
    main()
