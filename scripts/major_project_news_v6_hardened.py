#!/usr/bin/env python3
from __future__ import annotations

import json
import math
from collections import Counter
from datetime import datetime, timezone

import major_project_news_v6 as base

TARGETED_SOLAR_BATCH_LIMIT = 48
TARGETED_STATS = {}
EXTRA_FOREIGN = {
    "new south wales",
    "queensland",
    "victoria australia",
    "alberta",
    "ontario canada",
    "massachusetts",
    "pennsylvania",
    "colorado",
}


def load_projects():
    data = json.loads(base.REPD_PATH.read_text(encoding="utf-8"))
    raw = []
    seen_refs = set()

    for feature in data.get("features", []):
        p = feature.get("properties", {})
        tech = base.clean(p.get("tech"))
        capacity_known = p.get("capacity_known")
        try:
            mw = float(p.get("capacity"))
        except Exception:
            continue
        if not math.isfinite(mw):
            continue
        if capacity_known is False:
            # Unknown source capacity is not genuine zero and cannot pass a threshold.
            continue

        solar = tech in {"solar", "solar_roof"} and mw > base.SOLAR_MIN_EXCLUSIVE
        bess = tech == "bess" and mw > base.BESS_MIN_EXCLUSIVE
        if not (solar or bess):
            continue

        repd_ref = base.clean(p.get("repd_ref"))
        if not repd_ref:
            raise RuntimeError(f"Eligible REPD project missing official Ref ID: {p.get('name')}")
        if repd_ref in seen_refs:
            raise RuntimeError(f"Duplicate eligible REPD Ref ID: {repd_ref}")
        seen_refs.add(repd_ref)

        name = base.clean(p.get("name")) or "Unknown Site"
        category = "solar" if solar else "bess"
        operator = base.clean(p.get("operator"))
        county = base.clean(p.get("county") or p.get("local_planning_authority") or p.get("region"))
        planning_ref = base.clean(p.get("planning_application_reference"))
        updated = base.clean(p.get("repd_record_updated")) or None

        raw.append(
            {
                "id": repd_ref,
                "repd_ref": repd_ref,
                "repd_record_updated": updated,
                "repd_record_updated_supplied": bool(updated),
                "name": name,
                "operator": operator,
                "county": county,
                "status": base.clean(p.get("status")),
                "technology": category,
                "capacity_mw": round(mw, 3),
                "planning_authority": base.clean(p.get("planning_authority") or p.get("local_planning_authority")),
                "planning_application_reference": planning_ref,
                "_name_norm": base.norm(name),
                "_name_tokens": sorted(base.toks(name)),
                "_operator_tokens": sorted(base.toks(operator)),
                "_county_tokens": sorted(base.toks(county)),
                "_planning_ref_norm": base.norm(planning_ref),
            }
        )

    name_counts = Counter(p["_name_norm"] for p in raw if p["_name_norm"])
    for project in raw:
        project["_name_duplicate"] = name_counts[project["_name_norm"]] > 1
        project["_name_duplicate_count"] = name_counts[project["_name_norm"]]

    return sorted(raw, key=lambda x: (-x["capacity_mw"], x["name"], x["repd_ref"]))


def gate(project, story):
    if not base._original_gate(project, story):
        return False

    text = base.norm(story["title"] + " " + story["description"] + " " + story["source"])
    title_text = base.norm(story["title"])
    tt = set(text.split())

    # Stronger explicit foreign veto before any score can rescue the candidate.
    foreign = any(base.norm(place) in text and base.norm(place) not in project["_name_norm"] for place in EXTRA_FOREIGN)
    if foreign:
        return False

    # Duplicate REPD names need an independent anchor. Exact name alone cannot decide
    # which official record a story belongs to.
    if project.get("_name_duplicate"):
        exact = bool(project["_name_norm"] and project["_name_norm"] in text)
        title_exact = bool(project["_name_norm"] and project["_name_norm"] in title_text)
        planning_ref_hit = bool(project["_planning_ref_norm"] and project["_planning_ref_norm"] in text)
        op_hit = bool(set(project["_operator_tokens"]) & tt)
        county_hit = bool(set(project["_county_tokens"]) & tt)
        cap_hit = base.capacity_match(project, text)
        if not planning_ref_hit and not ((exact or title_exact) and (op_hit or county_hit or cap_hit)):
            return False

    return True


def queries(projects):
    qs = list(base.BROAD_QUERIES) + list(base.SOURCE_QUERIES)

    # BESS universe is small enough to keep the full targeted backstop every run.
    bess_names = [p["name"] for p in projects if p["technology"] == "bess"]
    bess_groups = base.chunk_names(bess_names)
    for group in bess_groups:
        ors = " OR ".join('"' + x + '"' for x in group)
        qs.append("(" + ors + ') "battery storage" UK')

    # Solar >1 MW is much larger. Broad/source discovery still covers the whole universe;
    # targeted name batches are a rotating completeness backstop so the crawl stays bounded.
    solar_names = [p["name"] for p in projects if p["technology"] == "solar"]
    solar_groups = base.chunk_names(solar_names)
    selected = []
    if solar_groups:
        limit = min(TARGETED_SOLAR_BATCH_LIMIT, len(solar_groups))
        slot = int(datetime.now(timezone.utc).timestamp() // 300)
        start = (slot * limit) % len(solar_groups)
        selected = [solar_groups[(start + i) % len(solar_groups)] for i in range(limit)]
        for group in selected:
            ors = " OR ".join('"' + x + '"' for x in group)
            qs.append("(" + ors + ") solar UK")

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
    return list(dict.fromkeys(qs))


def postprocess():
    projects = json.loads(base.PROJECTS_OUT.read_text(encoding="utf-8"))
    rows = projects.get("projects") or []
    supplied = sum(1 for p in rows if p.get("repd_record_updated"))
    projects["repd_record_update_coverage"] = round(supplied / len(rows), 8) if rows else 1.0
    projects["repd_record_update_policy"] = "official value when supplied; null preserved and never inferred"
    projects["duplicate_name_project_count"] = sum(1 for p in rows if p.get("_name_duplicate"))
    # private matching fields are stripped by the base writer, so calculate duplicates again publicly.
    public_counts = Counter(base.norm(p.get("name")) for p in rows if base.norm(p.get("name")))
    projects["duplicate_name_project_count"] = sum(public_counts[base.norm(p.get("name"))] > 1 for p in rows)
    projects["matching_policy"] = "planning reference strongest; duplicate names require corroboration; capacity never establishes identity"
    base.PROJECTS_OUT.write_text(json.dumps(projects, indent=2), encoding="utf-8")

    news = json.loads(base.NEWS_OUT.read_text(encoding="utf-8"))
    news["repd_record_update_coverage"] = projects["repd_record_update_coverage"]
    news["repd_record_update_policy"] = projects["repd_record_update_policy"]
    news["quality_gate"] = (
        "official REPD Ref ID + project identity + planning/name corroboration + duplicate-name gate + "
        "UK/location veto + technology context; REPD update date preserved when supplied and never invented"
    )
    news["discovery_policy"] = "source-first whole-universe discovery + rotating batched project-name completeness backstop"
    news["targeted_search"] = TARGETED_STATS
    base.NEWS_OUT.write_text(json.dumps(news, indent=2), encoding="utf-8")


if __name__ == "__main__":
    base._original_gate = base.gate
    base.load_projects = load_projects
    base.gate = gate
    base.queries = queries
    base.main()
    postprocess()
