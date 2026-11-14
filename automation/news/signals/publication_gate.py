#!/usr/bin/env python3
"""Fail-closed publication gate for the *newly fetched* top-200 project signals.

A successful combiner is not a successful crawl: planning-search fallbacks, old
reviewed stories and recycled part files cannot authorise a fresh timestamp.
This gate runs AFTER combine and BEFORE the data-branch push. On a healthy but
unchanged crawl it returns publish=false (successful no-op); malformed output
fails the workflow. It never edits a released Pipeline News edition.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
from urllib.parse import urlsplit

import combine as C

FRESH_DAYS = 14
PART_MAX_HOURS = 24
CLOCK_SKEW_MINUTES = 5

# The index's GDELT URL is a search/index provider, not the publisher.
# Without per-item publisher provenance an index hit cannot authorise a live
# publication merely because an unrelated BBC feed answered successfully.
SOURCE_HOSTS = {
    "official": {
        "pins-register": ("planninginspectorate.gov.uk",),
        "govuk-search": ("gov.uk",),
        "ecu-case": ("energyconsents.scot",),
    },
    "trade": {
        "solar-power-portal": ("solarpowerportal.co.uk",),
        "pv-tech": ("pv-tech.org",),
        "pv-magazine": ("pv-magazine.com",),
        "energy-storage-news": ("energy-storage.news",),
        "current": ("current-news.co.uk",),
        "renews": ("renews.biz",),
        "planning-resource": ("planningresource.co.uk",),
        "construction-enquirer": ("constructionenquirer.com",),
        "solar-energy-uk": ("solarenergyuk.org",),
    },
    "index": {
        "bbc-rss": ("bbc.co.uk", "bbc.com"),
        "guardian-rss": ("theguardian.com",),
        # GDELT deliberately not a publisher identity.
    },
}


def canonical_refs():
    """Independent pinned-corpus membership, not the writer's self-asserted 200 count."""
    rows = json.loads((C.HERE / "top200_solar.json").read_text(encoding="utf-8"))
    refs = [str(row["repd_ref"]) for row in rows]
    if len(refs) != 200 or len(set(refs)) != 200:
        raise ValueError("invalid authoritative top-200 REPD corpus")
    return set(refs)


def source_host_matches(item, team, source, part_time):
    """Require *this run's exact URL* in the same publisher's observation ledger.

    A team success alone may not launder another failed/cached publisher's item.
    The producer's URL ledger is testable provenance, not independent legal or
    cryptographic verification of the remote article.
    """
    if not isinstance(source, dict) or source.get("status") not in ("ok", "partial"):
        return False
    if item.get("fetched_this_run") is not True or item.get("source_id") != source.get("id"):
        return False
    observed = timestamp(item.get("observed_at"))
    if (observed is None or observed > part_time + dt.timedelta(minutes=5)
            or part_time - observed > dt.timedelta(hours=PART_MAX_HOURS)):
        return False
    observed_urls = source.get("observed_urls")
    if not isinstance(observed_urls, list) or item.get("link") not in observed_urls:
        return False
    try:
        requests = int(source.get("requests") or 0)
        failures = int(source.get("failures") or 0)
        emitted = int(source.get("items") or 0)
    except (TypeError, ValueError):
        return False
    if requests <= failures or emitted <= 0:
        return False
    allowed = SOURCE_HOSTS.get(team, {}).get(source.get("id"))
    if not allowed:
        return False
    link = urlsplit(item.get("link") or "")
    source_url = urlsplit(source.get("url") or "")
    if (link.scheme != "https" or source_url.scheme != "https"
            or link.username or link.password or source_url.username or source_url.password):
        return False
    hostname = (link.hostname or "").lower()
    publisher = (source_url.hostname or "").lower()
    # BBC feeds use bbci.co.uk while stories are on bbc.co.uk/bbc.com;
    # all other sources should identify the publisher they claim to scan.
    source_matches = (team == "index" and source.get("id") == "bbc-rss"
                      and publisher == "feeds.bbci.co.uk") or any(
        publisher == host or publisher.endswith("." + host) for host in allowed
    )
    return source_matches and any(hostname == host or hostname.endswith("." + host) for host in allowed)


def timestamp(value):
    if not isinstance(value, str):
        return None
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return None
        return parsed.astimezone(dt.timezone.utc)
    except (ValueError, OverflowError):
        return None


def evaluate(combined, previous, parts, now=None, authoritative_refs=None, require_previous=False):
    now = now or dt.datetime.now(dt.timezone.utc)
    if now.tzinfo is None:
        raise ValueError("now must have timezone")
    now = now.astimezone(dt.timezone.utc)
    if combined.get("schema") != C.SCHEMA or not isinstance(combined.get("projects"), dict):
        raise ValueError("invalid combined schema")
    if len(combined["projects"]) != 200 or combined.get("counts", {}).get("projects") != 200:
        raise ValueError("expected exactly 200 REPD projects")
    expected = set(authoritative_refs) if authoritative_refs is not None else canonical_refs()
    if len(expected) != 200 or set(combined["projects"]) != expected:
        raise ValueError("combined REPD IDs differ from authoritative top-200 source")
    for ref, project in combined["projects"].items():
        if not isinstance(project, dict) or str(project.get("repd_ref")) != ref:
            raise ValueError("project REPD identity mismatch")
        for item in project.get("signals") or []:
            if not isinstance(item, dict) or str(item.get("repd_ref")) != ref:
                raise ValueError("signal REPD identity mismatch")
    if combined.get("counts", {}).get("nothing") != 0:
        raise ValueError("projects without evidence or labelled planning fallback")
    if require_previous and not isinstance(previous, dict):
        raise ValueError("existing published data branch requires previous snapshot")
    if previous is not None and (
        not isinstance(previous, dict) or previous.get("schema") != C.SCHEMA
        or not isinstance(previous.get("projects"), dict)
    ):
        raise ValueError("previous published snapshot invalid; refuse replay")
    old_links = set()
    if isinstance(previous, dict):
        for ref, project in (previous.get("projects") or {}).items():
            for signal in project.get("signals") or []:
                if isinstance(signal, dict):
                    old_links.add((str(ref), signal.get("link")))
    accepted = {(str(ref), s.get("link")) for ref, p in combined["projects"].items()
                for s in p.get("signals") or [] if isinstance(s, dict)}
    fresh = set()
    healthy = []
    state = {}
    for team in ("official", "trade", "index"):
        part = parts.get(team)
        if not isinstance(part, dict) or part.get("schema") != C.PART_SCHEMA:
            state[team] = "missing_or_invalid"
            continue
        at = timestamp(part.get("generated_at"))
        if at is None or not (-dt.timedelta(minutes=CLOCK_SKEW_MINUTES) <= now - at <= dt.timedelta(hours=PART_MAX_HOURS)):
            state[team] = "stale_or_future_part"
            continue
        sources = part.get("sources")
        if not isinstance(sources, list) or not any(
            source_host_matches(item, team, source, at)
            for source in sources
            for item in (part.get("items") or []) if isinstance(item, dict)
        ):
            state[team] = "no_eligible_publisher_source"
            continue
        healthy.append(team)
        state[team] = "publisher_source_present"
        for raw in part.get("items") or []:
            item, _ = C.clean_item(raw, team, as_of=now)
            if not item or item["confidence"] != "confirmed":
                continue
            if item["repd_ref"] not in expected:
                continue
            if item["family"] not in C.NEWS_FAMILIES + ("official",) or not item["date"]:
                continue
            # A healthy BBC feed cannot launder an unrelated regional/GDELT
            # article, nor may an available trade source mask a failed one.
            if not any(source_host_matches(raw, team, source, at) for source in sources):
                continue
            age = (now.date() - dt.date.fromisoformat(item["date"])).days
            key = (item["repd_ref"], item["link"])
            if 0 <= age <= FRESH_DAYS and key in accepted and key not in old_links:
                fresh.add(key)
    return {
        "schema": "project-signals-publication-gate.v1",
        "publish": bool(healthy and fresh),
        "healthy_current_parts": healthy,
        "part_health": state,
        "new_confirmed_recent_items": len(fresh),
        "reason": "new confirmed source-backed project signal" if healthy and fresh
                  else "no newly verified current source-backed project signal; preserve last published bytes",
        "policy": "14-day article window, 24-hour part freshness, canonical REPD membership, per-run item/source URL receipts, no replay; planning fallback is not news",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--combined", required=True)
    parser.add_argument("--previous")
    parser.add_argument("--require-previous", action="store_true", help="fail closed if a pre-existing data branch snapshot is missing")
    parser.add_argument("--parts", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--github-output")
    parser.add_argument("--now", help="ISO8601 UTC test clock")
    args = parser.parse_args()
    combined = json.loads(Path(args.combined).read_text())
    previous = json.loads(Path(args.previous).read_text()) if args.previous and Path(args.previous).is_file() else None
    parts = {}
    for team in ("official", "trade", "index"):
        path = Path(args.parts) / (team + ".json")
        if path.is_file():
            try:
                parts[team] = json.loads(path.read_text())
            except (OSError, ValueError):
                parts[team] = None
    now = timestamp(args.now) if args.now else None
    if args.now and now is None:
        parser.error("--now requires timezone-aware ISO8601")
    report = evaluate(combined, previous, parts, now, require_previous=args.require_previous)
    Path(args.report).write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps(report, sort_keys=True))
    if args.github_output:
        with Path(args.github_output).open("a") as handle:
            handle.write("publish=" + ("true" if report["publish"] else "false") + "\n")


if __name__ == "__main__":
    main()
