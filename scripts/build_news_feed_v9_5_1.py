#!/usr/bin/env python3
"""Build the V9.5.1 dual-layer newspaper without mutating source feeds.

ALL preserves every V9.4/V5 discovery headline and adds current V6 discoveries.
RELEVANT and project NEWS SIGNAL use only one canonical PRIMARY_MATCH per article.
"""
from __future__ import annotations

import copy
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import major_project_news_v6 as matcher  # noqa: E402

V5_PATH = ROOT / "dist" / "major_project_news_v5.json"
V6_PATH = ROOT / "dist" / "major_project_news_v6.json"
OUT_PATH = ROOT / "dist" / "major_project_news_v9_5_1.json"


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def published_datetime(value: object) -> datetime:
    parsed = datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
    return (parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)


def story_key(item: dict) -> tuple[str, str, str]:
    return (
        matcher.norm(item.get("headline")),
        matcher.norm(item.get("source_url") or item.get("source")),
        str(item.get("published") or "")[:10],
    )


def as_story(item: dict) -> dict:
    return {
        "title": str(item.get("headline") or ""),
        "description": "",
        "source": str(item.get("source") or ""),
        "source_url": str(item.get("source_url") or ""),
        "link": str(item.get("url") or ""),
        "published": published_datetime(item.get("published")),
    }


def canonical_v5_items(items: list[dict], projects: list[dict]) -> tuple[list[dict], Counter]:
    accepted: list[dict] = []
    rejected: Counter = Counter()
    for legacy in items:
        resolved, reason, _detail = matcher._resolve_story(as_story(legacy), projects)
        if resolved is None:
            rejected[reason] += 1
            continue
        resolved["discovery_origin"] = "V5_REVALIDATED"
        resolved["legacy_project_label"] = legacy.get("project")
        resolved["legacy_technology_label"] = legacy.get("technology")
        accepted.append(resolved)
    return accepted, rejected


def validate_v6_items(items: list[dict], known_refs: set[str]) -> list[dict]:
    accepted: list[dict] = []
    for index, source in enumerate(items):
        item = copy.deepcopy(source)
        if item.get("role") != "PRIMARY_MATCH" or item.get("eligible_for_news_signal") is not True:
            raise RuntimeError(f"V6 item {index} is not a signal-eligible PRIMARY_MATCH")
        repd_ref = str(item.get("repd_ref") or "")
        if repd_ref not in known_refs or item.get("gg_project_id") != f"GG2050-REPD-{repd_ref}":
            raise RuntimeError(f"V6 item {index} has invalid canonical identity")
        item["discovery_origin"] = "V6_CANONICAL"
        accepted.append(item)
    return accepted


def merge_canonical(v5_items: list[dict], v6_items: list[dict]) -> list[dict]:
    merged: dict[tuple[str, str, str], dict] = {}
    for item in (*v5_items, *v6_items):
        key = story_key(item)
        previous = merged.get(key)
        if previous is None or Number(item.get("confidence", 0)) > Number(previous.get("confidence", 0)):
            merged[key] = item
    return sorted(
        merged.values(),
        key=lambda item: (str(item.get("published") or ""), int(item.get("confidence") or 0), item.get("headline") or ""),
        reverse=True,
    )


def Number(value: object) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def discovery_item(source: dict, origin: str, canonical_by_key: dict[tuple[str, str, str], dict]) -> dict:
    item = copy.deepcopy(source)
    canonical = canonical_by_key.get(story_key(source))
    item["discovery_origin"] = origin
    item["canonical_relevant"] = canonical is not None
    if canonical:
        for field in (
            "gg_article_id", "repd_ref", "primary_repd_ref", "gg_project_id", "gg_development_id",
            "role", "eligible_for_news_signal", "confidence", "match_evidence",
        ):
            item[field] = copy.deepcopy(canonical.get(field))
        item["canonical_project"] = canonical.get("project")
        item["canonical_technology"] = canonical.get("technology")
        item["canonical_capacity_mw"] = canonical.get("capacity_mw")
    else:
        item["role"] = "DISCOVERY_ONLY"
        item["eligible_for_news_signal"] = False
    return item


def main() -> dict:
    v5, v6 = read_json(V5_PATH), read_json(V6_PATH)
    if v5.get("schema") != "globalgrid2050.major-project-news.v5" or len(v5.get("items") or []) != 125:
        raise RuntimeError("V9.4/V5 125-headline baseline is unavailable")
    if v6.get("schema") != "globalgrid2050.major-project-news.v6":
        raise RuntimeError("Canonical V6 feed is unavailable")

    snapshot, projects = matcher.load_project_snapshot()
    known_refs = {project["repd_ref"] for project in projects}
    revalidated_v5, rejections = canonical_v5_items(v5["items"], projects)
    canonical_v6 = validate_v6_items(v6.get("items") or [], known_refs)
    canonical = merge_canonical(revalidated_v5, canonical_v6)
    matcher._build_links(canonical, projects)
    canonical_by_key = {story_key(item): item for item in canonical}

    all_by_key: dict[tuple[str, str, str], dict] = {}
    for item in v5["items"]:
        all_by_key[story_key(item)] = discovery_item(item, "V5_BASELINE", canonical_by_key)
    for item in v6.get("items") or []:
        all_by_key[story_key(item)] = discovery_item(item, "V6_CANONICAL", canonical_by_key)
    all_items = sorted(
        all_by_key.values(),
        key=lambda item: (str(item.get("published") or ""), item.get("headline") or ""),
        reverse=True,
    )

    beacon = [item for item in canonical if item.get("repd_ref") == "13599" and "Beacon Fen" in item.get("headline", "")]
    if len(beacon) != 1 or beacon[0].get("capacity_mw") != 400.0 or beacon[0].get("operator") != "Low Carbon Limited":
        raise RuntimeError("Beacon Fen must resolve once to Low Carbon REPD 13599 at 400 MW")
    if len(revalidated_v5) != 37 or len(canonical_v6) != 8 or len(canonical) != 45 or len(all_items) != 133:
        raise RuntimeError("V9.5.1 newspaper cardinality regression")

    updated = max(str(v5.get("updated") or ""), str(v6.get("updated") or ""))
    payload = {
        "schema": "globalgrid2050.major-project-news.v9.5.1",
        "release": "9.5.1",
        "updated": updated,
        "all_headline_count": len(all_items),
        "relevant_headline_count": len(canonical),
        "v9_4_baseline_headline_count": len(v5["items"]),
        "v6_canonical_headline_count": len(canonical_v6),
        "v5_revalidated_primary_count": len(revalidated_v5),
        "rules": {
            "all_preserves_complete_v9_4_newspaper": True,
            "relevant_requires_canonical_primary_match": True,
            "project_signal_requires_exact_repd_ref": True,
            "discovery_only_drives_project_signal": False,
            "official_repd_facts_overwritten": False,
        },
        "project_snapshot": {
            "schema": snapshot.get("schema"),
            "project_count": len(projects),
            "projects_sha256": snapshot.get("projects_sha256"),
        },
        "beacon_fen_contract": {
            "headline": beacon[0]["headline"],
            "repd_ref": "13599",
            "gg_project_id": "GG2050-REPD-13599",
            "operator": "Low Carbon Limited",
            "official_capacity_mw": 400.0,
            "related_bess_repd_ref": "13600",
            "related_bess_drives_signal": False,
        },
        "telemetry": {
            "v5_items_considered": len(v5["items"]),
            "v5_items_revalidated": len(revalidated_v5),
            "v5_rejection_reasons": dict(sorted(rejections.items())),
            "v6_items_preserved": len(canonical_v6),
            "canonical_union_items": len(canonical),
            "discovery_union_items": len(all_items),
        },
        "canonical_items": canonical,
        "all_items": all_items,
    }
    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        f"V9.5.1 feed built: {len(all_items)} ALL, {len(canonical)} RELEVANT, "
        "Beacon Fen -> REPD 13599 (400 MW)"
    )
    return payload


if __name__ == "__main__":
    main()
