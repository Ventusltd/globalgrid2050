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

import combine as C

FRESH_DAYS = 14
PART_MAX_HOURS = 24
CLOCK_SKEW_MINUTES = 5


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


def evaluate(combined, previous, parts, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    if now.tzinfo is None:
        raise ValueError("now must have timezone")
    now = now.astimezone(dt.timezone.utc)
    if combined.get("schema") != C.SCHEMA or not isinstance(combined.get("projects"), dict):
        raise ValueError("invalid combined schema")
    if len(combined["projects"]) != 200 or combined.get("counts", {}).get("projects") != 200:
        raise ValueError("expected exactly 200 REPD projects")
    if combined.get("counts", {}).get("nothing") != 0:
        raise ValueError("projects without evidence or labelled planning fallback")
    old_links = set()
    if isinstance(previous, dict) and previous.get("schema") == C.SCHEMA:
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
            isinstance(s, dict) and s.get("status") in ("ok", "partial")
            and int(s.get("requests") or 0) > int(s.get("failures") or 0)
            for s in sources
        ):
            state[team] = "no_successful_source"
            continue
        healthy.append(team)
        state[team] = "healthy"
        for raw in part.get("items") or []:
            item, _ = C.clean_item(raw, team, as_of=now.date())
            if not item or item["confidence"] != "confirmed":
                continue
            if item["family"] not in C.NEWS_FAMILIES + ("official",) or not item["date"]:
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
        "policy": "14-day article window, 24-hour part freshness, source success, no replay; planning fallback is not news",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--combined", required=True)
    parser.add_argument("--previous")
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
    report = evaluate(combined, previous, parts, now)
    Path(args.report).write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps(report, sort_keys=True))
    if args.github_output:
        with Path(args.github_output).open("a") as handle:
            handle.write("publish=" + ("true" if report["publish"] else "false") + "\n")


if __name__ == "__main__":
    main()
