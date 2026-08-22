#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
IDENTITY = DIST / "project_identity_v6.json"
PROJECTS = DIST / "major_projects_v6.json"
NEWS = DIST / "major_project_news_v6.json"
LINKS = DIST / "project_news_links_v6.json"


def clean(v):
    return str(v or "").strip()


def norm(v):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", clean(v).lower())).strip()


def article_id(item):
    # Stable across Google News redirect URL churn: headline/source/publication date are the anchor.
    key = "|".join((norm(item.get("headline")), norm(item.get("source")), clean(item.get("published"))))
    return "GG2050-NEWS-" + hashlib.sha256(key.encode("utf-8")).hexdigest()[:16].upper()


def load(path):
    if not path.exists():
        raise RuntimeError(f"Missing required V6 artifact: {path.relative_to(ROOT)}")
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    identity = load(IDENTITY)
    projects = load(PROJECTS)
    news = load(NEWS)

    records = identity.get("records") or []
    by_ref = {clean(r.get("repd_ref")): r for r in records if clean(r.get("repd_ref"))}
    eligible_refs = {clean(p.get("repd_ref")) for p in (projects.get("projects") or []) if clean(p.get("repd_ref"))}

    if not by_ref:
        raise RuntimeError("Identity registry has no REPD-bound records")

    for project in projects.get("projects") or []:
        ref = clean(project.get("repd_ref"))
        record = by_ref.get(ref)
        if not record:
            raise RuntimeError(f"Eligible V6 project has no canonical identity: REPD {ref} {project.get('name')}")
        project["gg_project_id"] = record["gg_project_id"]
        project["gg_development_id"] = record["gg_development_id"]
        project["identity_status"] = record["identity_status"]
        project["direct_related_repd_refs"] = record.get("direct_related_repd_refs") or []
        project["planning_sibling_repd_refs"] = record.get("planning_sibling_repd_refs") or []
        project["development_repd_refs"] = record.get("development_repd_refs") or [ref]

    projects["identity_schema"] = identity.get("schema")
    projects["globalgrid_id_required"] = True
    PROJECTS.write_text(json.dumps(projects, indent=2), encoding="utf-8")

    links = []
    seen_article_ids = set()
    for item in news.get("items") or []:
        ref = clean(item.get("repd_ref"))
        record = by_ref.get(ref)
        if not record:
            raise RuntimeError(f"Headline has no canonical REPD/GlobalGrid identity: {ref} {item.get('headline')}")

        aid = article_id(item)
        if aid in seen_article_ids:
            # The newspaper should already dedupe exact headlines. Treat a collision as a data defect.
            raise RuntimeError(f"Duplicate canonical article ID: {aid} {item.get('headline')}")
        seen_article_ids.add(aid)

        item["gg_article_id"] = aid
        item["gg_project_id"] = record["gg_project_id"]
        item["gg_development_id"] = record["gg_development_id"]
        item["identity_status"] = record["identity_status"]
        item["primary_repd_ref"] = ref
        item["development_related_repd_refs"] = [
            r for r in (record.get("development_repd_refs") or []) if r != ref and r in eligible_refs
        ]
        item["direct_related_repd_refs"] = [
            r for r in (record.get("direct_related_repd_refs") or []) if r != ref
        ]
        item["news_binding_rule"] = "PRIMARY_MATCH_ONLY; related development records are context, not REPD/news-status confirmation"

        links.append(
            {
                "gg_article_id": aid,
                "gg_project_id": record["gg_project_id"],
                "gg_development_id": record["gg_development_id"],
                "repd_ref": ref,
                "role": "PRIMARY_MATCH",
                "eligible_for_news_signal": True,
                "confidence": item.get("confidence"),
            }
        )
        for related_ref in item["development_related_repd_refs"]:
            related = by_ref[related_ref]
            links.append(
                {
                    "gg_article_id": aid,
                    "gg_project_id": related["gg_project_id"],
                    "gg_development_id": related["gg_development_id"],
                    "repd_ref": related_ref,
                    "role": "RELATED_DEVELOPMENT",
                    "eligible_for_news_signal": False,
                    "confidence": None,
                }
            )

    news["identity_schema"] = identity.get("schema")
    news["globalgrid_id_required"] = True
    news["news_signal_scope"] = "Only PRIMARY_MATCH links may drive NEWS SIGNAL; RELATED_DEVELOPMENT is context only"
    NEWS.write_text(json.dumps(news, indent=2), encoding="utf-8")

    LINKS.write_text(
        json.dumps(
            {
                "schema": "globalgrid2050.project-news-links.v6",
                "identity_schema": identity.get("schema"),
                "article_count": len(seen_article_ids),
                "link_count": len(links),
                "primary_link_count": sum(1 for x in links if x["role"] == "PRIMARY_MATCH"),
                "related_development_link_count": sum(1 for x in links if x["role"] == "RELATED_DEVELOPMENT"),
                "rules": {
                    "primary_match_drives_news_signal": True,
                    "related_development_never_confirms_repd_status": True,
                    "article_display_is_deduplicated": True,
                },
                "links": links,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print("identity enrichment", f"projects={len(projects.get('projects') or [])}", f"articles={len(seen_article_ids)}", f"links={len(links)}")


if __name__ == "__main__":
    main()
