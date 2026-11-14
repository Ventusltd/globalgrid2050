#!/usr/bin/env python3
"""Build an October 2026 (Q3) REPD-bound Pipeline News feed from cached articles.

Offline. Reads only committed files; writes only the --out file (a NEW name).
It never touches dist/major_project_news_v9_5_1.json or any Q2 V4/V5/V6 file.

Two binders:
  --binder legacy    the existing V9.5.1 algorithm (build_news_feed_v9_5_1.py):
                     V5 headlines re-resolved by major_project_news_v6._resolve_story,
                     V6 PRIMARY_MATCH items kept if their ref is in the universe,
                     against the October universe. Default out:
                     dist/major_project_news_2026q3.json
  --binder refaware  scripts/news_binder_refaware.py over V4+V5+V6 headlines, plus
                     REPD status-change candidates from automation/repd/diff.py
                     output. Default out: dist/major_project_news_2026q3_refaware.json

No article is fetched: the inputs are the August 2026 crawls committed in
dist/major_project_news_v4/v5/v6.json. A live crawl needs news.google.com
(major_project_news_v6.fetch_rss); see REPORT.md. Counts are derived from the
universe file, never pinned. Binding is scored at the crawl instant (the newest
input `updated`), so a rebuild is byte-identical; freshness against the edition
instant (the universe's validated_at) is reported per item, not used to score.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import major_project_news_v6 as matcher  # noqa: E402
import news_binder_refaware as refaware  # noqa: E402

NEWS_HORIZON_DAYS = matcher.LOOKBACK_DAYS
DEFAULT_UNIVERSE = "dist/major_projects_2026q3.json"
DEFAULT_DIFF = "docs/repd/2026q3/changes-jul-to-oct/diff.json"
PROTECTED = (
    "dist/major_project_news_v4.json", "dist/major_project_news_v5.json", "dist/major_project_news_v6.json",
    "dist/major_project_news_v9_5_1.json", "dist/major_projects_v6.json", "dist/project_news_links_v6.json",
)


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def parse_instant(value: object) -> datetime:
    parsed = datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
    return (parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)


def story_key(item: dict) -> tuple[str, str, str]:
    return (matcher.norm(item.get("headline")), matcher.norm(item.get("source_url") or item.get("source")),
            str(item.get("published") or "")[:10])


def as_story(item: dict) -> dict:
    return {"title": str(item.get("headline") or ""), "description": "", "source": str(item.get("source") or ""),
            "source_url": str(item.get("source_url") or ""), "link": str(item.get("url") or ""),
            "published": parse_instant(str(item.get("published"))[:10])}


def freshness(item: dict, edition: datetime) -> dict:
    age = (edition.date() - parse_instant(str(item["published"])[:10]).date()).days
    return {"age_days_at_edition": age, "within_news_horizon_at_edition": 0 <= age <= NEWS_HORIZON_DAYS}


LEGACY_PROJECT_FIELDS = ("project", "project_id", "technology", "capacity_mw", "operator", "county", "status")


def strip_unverified_label(item: dict) -> None:
    """V4/V5 headlines carry the project their name-token scorer picked (wrong for 70 of
    114 labelled V5 items). The V9.5.1 page prints that label beside DISCOVERY_ONLY
    stories; keep it only as legacy_* fields and derive technology from the text."""
    item["legacy_unverified_label"] = {field: item.pop(field) for field in LEGACY_PROJECT_FIELDS if field in item}
    context = refaware.story_context(as_story(item))
    item["technology"] = "solar" if context["solar_context"] else "bess" if context["bess_context"] else ""


def discovery_item(source: dict, origin: str, canonical_by_key: dict, strip_labels: bool = False) -> dict:
    item = copy.deepcopy(source)
    if strip_labels and origin in {"V4_BASELINE", "V5_BASELINE"}:
        strip_unverified_label(item)
    canonical = canonical_by_key.get(story_key(source))
    item["discovery_origin"] = origin
    item["canonical_relevant"] = canonical is not None
    if canonical:
        for field in ("gg_article_id", "repd_ref", "primary_repd_ref", "gg_project_id", "gg_development_id", "role",
                      "eligible_for_news_signal", "confidence", "match_evidence", "event"):
            item[field] = copy.deepcopy(canonical.get(field))
        item["canonical_project"] = canonical.get("project")
        item["canonical_technology"] = canonical.get("technology")
        item["canonical_capacity_mw"] = canonical.get("capacity_mw")
    else:
        item["role"] = "DISCOVERY_ONLY"
        item["eligible_for_news_signal"] = False
        for field in ("repd_ref", "primary_repd_ref", "gg_project_id", "gg_development_id", "match_evidence"):
            item.pop(field, None)
    return item


def merge(items: list[dict]) -> list[dict]:
    merged: dict = {}
    for item in items:
        key = story_key(item)
        if key not in merged or float(item.get("confidence") or 0) > float(merged[key].get("confidence") or 0):
            merged[key] = item
    return sorted(merged.values(), key=lambda i: (str(i.get("published")), int(i.get("confidence") or 0),
                                                 i.get("headline") or ""), reverse=True)


def build(args: argparse.Namespace) -> dict:
    root = Path(args.root)
    before = {p: sha256_file(root / p) for p in PROTECTED if (root / p).exists()}
    v4, v5, v6 = (read_json(root / f"dist/major_project_news_{v}.json") for v in ("v4", "v5", "v6"))
    universe_path = root / args.universe
    scoring_instant = max(str(v5["updated"]), str(v6["updated"]), str(v4["updated"]) if args.binder == "refaware" else "")
    matcher.pin_scoring_reference(scoring_instant)
    snapshot, projects = refaware.load_universe(universe_path)
    by_ref = {p["repd_ref"]: p for p in projects}
    edition = parse_instant(snapshot.get("validated_at"))

    origins = [("V5_BASELINE", v5["items"]), ("V6_CANONICAL", v6.get("items") or [])]
    if args.binder == "refaware":
        origins.insert(0, ("V4_BASELINE", v4["items"]))
    rejections: Counter = Counter()
    canonical: list[dict] = []
    v6_kept = v6_demoted = 0
    for origin, items in origins:
        for source in items:
            story = as_story(source)
            if args.binder == "legacy":
                if origin == "V6_CANONICAL":
                    ref = str(source.get("repd_ref") or "")
                    if source.get("role") != "PRIMARY_MATCH" or ref not in by_ref \
                            or source.get("gg_project_id") != f"GG2050-REPD-{ref}":
                        rejections["v6_ref_not_in_universe"] += 1
                        continue
                    item = copy.deepcopy(source)
                    v6_kept += 1
                else:
                    item, reason, _ = matcher._resolve_story(story, projects)
                    if item is None:
                        rejections[reason] += 1
                        continue
            else:
                item, reason, _ = refaware.resolve_story(story, projects, by_ref)
                if item is None and origin == "V6_CANONICAL":
                    # V6 bound with an RSS description that is not cached; keep the
                    # original ref unless the refaware rules reject that project.
                    ref = str(source.get("repd_ref") or "")
                    project = by_ref.get(ref)
                    context = refaware.story_context(story)
                    if project is None:
                        reason = "v6_ref_not_in_universe"
                    elif refaware._stale(project, story["published"].date(), context):
                        reason = "v6_stale_record_demoted"
                    else:
                        item = copy.deepcopy(source)
                        item["match_evidence"] = dict(item.get("match_evidence") or {},
                                                      binder="v6-description-bound (not reproducible headline-only)")
                        reason = "v6_retained"
                    if item is None:
                        v6_demoted += 1
                    else:
                        v6_kept += 1
                if item is None:
                    rejections[reason] += 1
                    continue
            item["discovery_origin"] = origin
            item["legacy_project_label"] = source.get("project")
            canonical.append(item)
    canonical = merge(canonical)
    matcher._build_links(canonical, projects)
    for item in canonical:
        item.update(freshness(item, edition))
    canonical_by_key = {story_key(i): i for i in canonical}

    all_by_key: dict = {}
    for origin, items in origins:
        for source in items:
            all_by_key[story_key(source)] = discovery_item(source, origin, canonical_by_key,
                                                           strip_labels=args.binder == "refaware")
    all_items = sorted(all_by_key.values(), key=lambda i: (str(i.get("published")), i.get("headline") or ""),
                       reverse=True)
    for item in all_items:
        item.update(freshness(item, edition))

    # Invariants (structural, no pinned counts)
    for item in canonical:
        assert item["role"] == "PRIMARY_MATCH" and item["eligible_for_news_signal"] is True
        assert item["repd_ref"] in by_ref and item["gg_project_id"] == f"GG2050-REPD-{item['repd_ref']}"
    keys = {story_key(i) for i in all_items}
    assert {story_key(i) for i in v5["items"]} <= keys, "V5 discovery truncated"
    assert sum(i["canonical_relevant"] for i in all_items) == len(canonical)

    payload = {
        "schema": "globalgrid2050.major-project-news.2026q3",
        "binder": "major_project_news_v6 (V9.5.1 algorithm)" if args.binder == "legacy" else refaware.BINDER_VERSION,
        "repd_edition": snapshot.get("source_dataset_title"),
        "edition_instant": snapshot.get("validated_at"),
        "scoring_reference": scoring_instant,
        "news_horizon_days": NEWS_HORIZON_DAYS,
        "all_headline_count": len(all_items),
        "relevant_headline_count": len(canonical),
        "relevant_within_horizon_count": sum(i["within_news_horizon_at_edition"] for i in canonical),
        "rules": {
            "relevant_requires_canonical_primary_match": True,
            "project_signal_requires_exact_repd_ref": True,
            "discovery_only_drives_project_signal": False,
            "official_repd_facts_overwritten": False,
            "repd_status_change_drives_news_signal": False,
        },
        "project_snapshot": {
            "path": args.universe, "sha256": sha256_file(universe_path), "schema": snapshot.get("schema"),
            "project_count": len(projects), "solar_count": sum(p["technology"] == "solar" for p in projects),
            "bess_count": sum(p["technology"] == "bess" for p in projects),
            "projects_sha256": snapshot.get("projects_sha256"),
        },
        "inputs": {p: before[p] for p in PROTECTED if p.startswith("dist/major_project_news_v") and p in before
                   and p != "dist/major_project_news_v9_5_1.json"},
        "network": {"articles_fetched": 0, "note": "cached August 2026 crawls only; live crawl needs news.google.com"},
        "telemetry": {
            "headlines_considered": sum(len(items) for _o, items in origins),
            "rejection_reasons": dict(sorted(rejections.items())),
            "v6_items_retained": v6_kept, "v6_items_demoted": v6_demoted,
            "by_origin": dict(sorted(Counter(i["discovery_origin"] for i in canonical).items())),
        },
        "canonical_items": canonical,
        "all_items": all_items,
    }
    if args.binder == "refaware" and args.diff:
        diff_path = root / args.diff
        diff = read_json(diff_path)
        changes = refaware.repd_status_change_candidates(diff, projects)
        linked = refaware.corroborate(changes, canonical)
        payload["repd_status_changes"] = {
            "source": {"path": args.diff, "sha256": sha256_file(diff_path), "schema": diff.get("schema"),
                       "from": (diff.get("previous") or {}).get("label"), "to": (diff.get("new") or {}).get("label")},
            "rule": "official REPD status transitions for universe projects; never a NEWS SIGNAL; never alters status",
            "count": len(changes),
            "by_event": dict(sorted(Counter(c["event"] for c in changes).items())),
            "corroborated_by_article_links": linked,
            "items": changes,
        }
    after = {p: sha256_file(root / p) for p in before}
    if after != before:
        raise RuntimeError("a protected Q2 news/project file changed during the build")
    return payload


def main(argv: list[str] | None = None) -> dict:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--binder", choices=("legacy", "refaware"), default="legacy")
    parser.add_argument("--universe", default=DEFAULT_UNIVERSE)
    parser.add_argument("--diff", default=DEFAULT_DIFF)
    parser.add_argument("--root", default=str(ROOT))
    parser.add_argument("--out", default=None)
    args = parser.parse_args(argv)
    out = Path(args.out or (Path(args.root) / ("dist/major_project_news_2026q3.json" if args.binder == "legacy"
                                               else "dist/major_project_news_2026q3_refaware.json")))
    resolved = out.resolve()
    if any(resolved == (Path(args.root) / p).resolve() for p in PROTECTED):
        raise SystemExit("refusing to overwrite a protected Q2 feed")
    payload = build(args)
    out.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    print(f"{out.name}: {payload['all_headline_count']} ALL, {payload['relevant_headline_count']} RELEVANT "
          f"({payload['relevant_within_horizon_count']} within {NEWS_HORIZON_DAYS} d of {payload['edition_instant']})"
          + (f", {payload['repd_status_changes']['count']} REPD status changes" if "repd_status_changes" in payload else ""))
    return payload


if __name__ == "__main__":
    main()
