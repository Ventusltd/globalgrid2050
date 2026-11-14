#!/usr/bin/env python3
"""Acid check of a published dist/project_signals.json (the real file, or one a test built).

  python automation/news/tests/acid_live.py dist/project_signals.json [--now 2026-11-14T12:00:00Z] [--summary FILE]

Rules (each is reported by name; the exit code is 1 when any fails):
  schema            the file is project-signals.v2 with the keys and value sets of the contract
  nothing           no project is left with neither an item nor a planning file, and the count says 0
  repd-9050         no item on REPD 9050 whose title lacks "solar"
  undated-order     in every list an undated item is never above a dated one, and dates run newest first
  tier-counts       the counts by tier are what the items give when counted again, and sum to the 200
  tier-purity       recent_news holds only publisher items dated within the recent window; no list mixes tiers
  dates             every date is a real calendar date, not after the day following the run; a year agrees with
                    its date (an undated item may carry a plausible year alone, when only the year is known)
  generated-at      generated_at is not older than two days, unless the file and its parts say stale;
                    and it is never later than the newest successful collection it reports

A version 1 file is read too (its one "signals" list is checked for order, dates and REPD 9050), and fails the
rules it cannot meet by construction (schema, tier-counts, tier-purity). No network; standard library only.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

V2 = "project-signals.v2"
LISTS = ("recent_news", "official", "archive")
TIERS = ("recent_news", "official", "archive_only", "planning_file_only", "nothing")
NEWS_FAMILIES = ("bbc", "trade", "national", "regional")
FAMILIES = ("official",) + NEWS_FAMILIES + ("developer",)
EVENTS = ("consent", "refusal", "appeal", "legal_challenge", "financial_close", "construction_start", "energisation",
          "grid_connection", "sale", None)
LABELS = ("planning file (verified link)", "planning file (unverified link)", "planning register search",
          "planning register finder")
PART_STATUS = ("ok", "stale", "failed", "absent")
LIVE_PARTS = ("official", "trade", "index")
MAX_AGE_DAYS = 2
RULES = ("schema", "nothing", "repd-9050", "undated-order", "tier-counts", "tier-purity", "dates", "generated-at")


def parse_stamp(value):
    if not isinstance(value, str):
        return None
    try:
        stamp = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return stamp if stamp.tzinfo else stamp.replace(tzinfo=dt.timezone.utc)


def parse_day(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return None
    try:
        return dt.date.fromisoformat(value)
    except ValueError:
        return None


def is_v2(doc):
    return isinstance(doc, dict) and doc.get("schema") == V2


def lists_of(project, v2=None):
    """{list name: [items]} for either version: the three tier lists, or version 1's single "signals"."""
    if v2 is None:
        v2 = any(name in project for name in LISTS)
    names = LISTS if v2 else ("signals",)
    return {name: [i for i in (project.get(name) or []) if isinstance(i, dict)] for name in names}


def shown(project):
    """Every item in the order a reader meets it."""
    return [item for items in lists_of(project).values() for item in items]


def tier_of(project):
    """The exclusive bucket of the contract, counted from the items themselves."""
    lists = lists_of(project, True)
    if any(i.get("confidence") == "confirmed" for i in lists["recent_news"]):
        return "recent_news"
    if any(i.get("confidence") == "confirmed" for i in lists["official"]):
        return "official"
    if any(lists.values()):
        return "archive_only"
    file = project.get("planning_file")
    return "planning_file_only" if isinstance(file, dict) and file.get("url") else "nothing"


def _schema(doc, fail):
    if not is_v2(doc):
        fail("schema is %r, not %r" % (doc.get("schema") if isinstance(doc, dict) else type(doc).__name__, V2))
        return
    for key, kind in (("generated_at", (str, type(None))), ("run_at", str), ("stale", bool), ("recent_days", int),
                      ("parts", dict), ("counts", dict), ("projects", dict)):
        if not isinstance(doc.get(key), kind):
            fail("top level %r missing or of the wrong type" % key)
    for name, part in (doc.get("parts") or {}).items():
        if not isinstance(part, dict) or part.get("status") not in PART_STATUS:
            fail("parts.%s.status is %r" % (name, part.get("status") if isinstance(part, dict) else part))
        elif part.get("collected_at") is not None and parse_stamp(part.get("collected_at")) is None:
            fail("parts.%s.collected_at is not a timestamp" % name)
    counts = doc.get("counts") if isinstance(doc.get("counts"), dict) else {}
    for key in ("with_signal", "with_confirmed_signal", "split", "with_signal_by_family"):
        if key in counts:
            fail("counts still has the mixed version 1 key %r" % key)
    if not isinstance(counts.get("by_tier"), dict) or set(counts.get("by_tier") or {}) != set(TIERS):
        fail("counts.by_tier must have exactly %s" % ", ".join(TIERS))
    headline = counts.get("headline")
    if not isinstance(headline, dict) or headline.get("label") != "projects with recent verified news":
        fail("counts.headline.label is not 'projects with recent verified news'")
    for ref, project in (doc.get("projects") or {}).items():
        if not isinstance(project, dict):
            fail("project %s is not an object" % ref)
            continue
        for name in LISTS:
            if not isinstance(project.get(name), list):
                fail("project %s has no list %r" % (ref, name))
        if project.get("tier") not in TIERS:
            fail("project %s tier is %r" % (ref, project.get("tier")))
        if project.get("alias_standing") not in ("confirmed", "possible"):
            fail("project %s alias_standing is %r" % (ref, project.get("alias_standing")))
        file = project.get("planning_file")
        if not isinstance(file, dict) or file.get("label") not in LABELS or file.get("link_type") not in ("direct", "search") \
                or not str(file.get("url") or "").startswith("https://"):
            fail("project %s planning_file is missing, unlabelled or without an https link" % ref)
        elif (file["link_type"] == "direct") != file["label"].startswith("planning file ("):
            fail("project %s planning_file label %r does not agree with link_type %r" % (ref, file["label"], file["link_type"]))
        elif (file["label"] == "planning file (verified link)") != (file.get("verified") is True):
            fail("project %s planning_file label and 'verified' disagree" % ref)
        for name, items in lists_of(project, True).items():
            for item in items:
                where = "project %s %s %r" % (ref, name, str(item.get("link"))[:80])
                if not item.get("title") or not str(item.get("link") or "").startswith("https://"):
                    fail(where + ": no title or https link")
                if item.get("tier") != name:
                    fail(where + ": tier %r in list %r" % (item.get("tier"), name))
                if item.get("confidence") not in ("confirmed", "possible"):
                    fail(where + ": confidence %r" % item.get("confidence"))
                if item.get("obtained") not in ("fetched", "reviewed"):
                    fail(where + ": obtained %r" % item.get("obtained"))
                if item.get("source") not in LIVE_PARTS + ("reviewed",):
                    fail(where + ": source %r" % item.get("source"))
                if item.get("family") not in FAMILIES:
                    fail(where + ": family %r" % item.get("family"))
                if item.get("freshness") not in ("recent", "older", "undated"):
                    fail(where + ": freshness %r" % item.get("freshness"))
                if item.get("event") not in EVENTS:
                    fail(where + ": event %r" % item.get("event"))
                if parse_stamp(item.get("collected_at")) is None:
                    fail(where + ": collected_at missing")
                if not item.get("basis"):
                    fail(where + ": no basis")
                if item.get("confidence") == "confirmed" and project.get("alias_standing") != "confirmed":
                    fail(where + ": confirmed item under an alias that is only possible")
            if len(items) > 5:
                fail("project %s %s has %d items (cap 5)" % (ref, name, len(items)))


def check(doc, now=None):
    """[(rule, passed, [evidence lines])] in the order of RULES."""
    found = {rule: [] for rule in RULES}
    if not isinstance(doc, dict) or not isinstance(doc.get("projects"), dict):
        return [(rule, False, ["the file is not a project signals file"]) for rule in RULES]
    v2 = is_v2(doc)
    projects = {ref: p for ref, p in doc["projects"].items() if isinstance(p, dict)}
    counts = doc.get("counts") if isinstance(doc.get("counts"), dict) else {}
    run_at = parse_stamp(doc.get("run_at")) or parse_stamp(now) or dt.datetime.now(dt.timezone.utc)
    now_stamp = parse_stamp(now) or dt.datetime.now(dt.timezone.utc)
    recent_days = doc.get("recent_days") if isinstance(doc.get("recent_days"), int) else 90

    _schema(doc, found["schema"].append)

    # nothing
    for ref, project in projects.items():
        file = project.get("planning_file")
        if not shown(project) and not (isinstance(file, dict) and file.get("url")):
            found["nothing"].append("project %s has neither an item nor a planning file" % ref)
    said = (counts.get("by_tier") or {}).get("nothing") if v2 else counts.get("nothing")
    if said != 0:
        found["nothing"].append("the count of projects with nothing is %r, not 0" % said)
    if not projects:
        found["nothing"].append("the file has no project")
    elif counts.get("projects") != len(projects):
        found["nothing"].append("counts.projects is %r, the file has %d" % (counts.get("projects"), len(projects)))

    # REPD 9050
    for item in shown(projects.get("9050") or {}):
        if "solar" not in str(item.get("title") or "").lower():
            found["repd-9050"].append("REPD 9050: %r (%s)" % (item.get("title"), item.get("link")))

    # order and dates
    last_day = (run_at + dt.timedelta(days=1)).date()
    for ref, project in projects.items():
        for name, items in lists_of(project).items():
            seen_undated, previous = None, None
            for position, item in enumerate(items):
                raw = item.get("date")
                day = parse_day(raw)
                if raw is not None and day is None:
                    found["dates"].append("project %s %s: %r is not a calendar date" % (ref, name, raw))
                elif day and day > last_day:
                    found["dates"].append("project %s %s: %s is in the future" % (ref, name, raw))
                year = item.get("year")
                if v2 and "year" in item and day and year != day.year:
                    found["dates"].append("project %s %s: year %r does not belong to date %r" % (ref, name, year, raw))
                elif v2 and day is None and year is not None and not (isinstance(year, int) and 2000 <= year <= last_day.year):
                    found["dates"].append("project %s %s: undated item with the implausible year %r" % (ref, name, year))
                if day is None:
                    seen_undated = seen_undated if seen_undated is not None else position
                    continue
                if seen_undated is not None:
                    found["undated-order"].append("project %s %s: undated item at place %d is above %s at place %d" % (
                        ref, name, seen_undated + 1, raw, position + 1))
                    seen_undated = None            # one line per run of undated items is enough
                if previous and day > previous:
                    found["undated-order"].append("project %s %s: %s at place %d is below the older %s" % (
                        ref, name, raw, position + 1, previous.isoformat()))
                previous = day

    # tier counts, tier purity
    if not v2:
        found["tier-counts"].append("version 1 counts one mixed figure (with_signal %r, with_confirmed_signal %r): recent "
                                    "news, old articles, official notices and reviewed research are not separated"
                                    % (counts.get("with_signal"), counts.get("with_confirmed_signal")))
        found["tier-purity"].append("version 1 has one list per project; items carry no tier and no freshness")
    else:
        by_tier = {tier: 0 for tier in TIERS}
        with_ = {"with_recent_news": 0, "with_official": 0, "with_archive": 0, "with_possible_recent_news": 0}
        item_counts = {name: 0 for name in LISTS}
        possible_only = 0
        cutoff = run_at.date() - dt.timedelta(days=recent_days)
        for ref, project in projects.items():
            lists = lists_of(project, True)
            tier = tier_of(project)
            by_tier[tier] += 1
            if project.get("tier") != tier:
                found["tier-counts"].append("project %s says tier %r, its items give %r" % (ref, project.get("tier"), tier))
            confirmed_recent = any(i.get("confidence") == "confirmed" for i in lists["recent_news"])
            with_["with_recent_news"] += confirmed_recent
            with_["with_possible_recent_news"] += bool(lists["recent_news"]) and not confirmed_recent
            with_["with_official"] += any(i.get("confidence") == "confirmed" for i in lists["official"])
            with_["with_archive"] += bool(lists["archive"])
            every = [i for items in lists.values() for i in items]
            possible_only += tier == "archive_only" and all(i.get("confidence") == "possible" for i in every)
            for name, items in lists.items():
                item_counts[name] += len(items)
                for item in items:
                    day, family = parse_day(item.get("date")), item.get("family")
                    fresh = "undated" if day is None else "recent" if day >= cutoff else "older"
                    where = "project %s %s %r" % (ref, name, str(item.get("link"))[:80])
                    if item.get("freshness") != fresh:
                        found["tier-purity"].append("%s: freshness %r, its date %r gives %r" % (where, item.get("freshness"), item.get("date"), fresh))
                    if name == "recent_news" and (fresh != "recent" or family not in NEWS_FAMILIES):
                        found["tier-purity"].append("%s: in recent_news but %s, family %r" % (where, fresh, family))
                    if name == "official" and (family != "official" or day is None):
                        found["tier-purity"].append("%s: in official but family %r, date %r" % (where, family, item.get("date")))
                    if name == "archive" and family in NEWS_FAMILIES and fresh == "recent":
                        found["tier-purity"].append("%s: a recent publisher item filed as archive" % where)
                    if name == "archive" and family == "official" and day is not None:
                        found["tier-purity"].append("%s: a dated official item filed as archive" % where)
            links = [i.get("link") for i in every]
            if len(links) != len(set(links)):
                found["tier-purity"].append("project %s lists a link in more than one place" % ref)
        said_tiers = counts.get("by_tier") if isinstance(counts.get("by_tier"), dict) else {}
        for tier in TIERS:
            if said_tiers.get(tier) != by_tier[tier]:
                found["tier-counts"].append("counts.by_tier.%s is %r, the items give %d" % (tier, said_tiers.get(tier), by_tier[tier]))
        if sum(v for v in said_tiers.values() if isinstance(v, int)) != len(projects):
            found["tier-counts"].append("counts.by_tier does not sum to the %d projects" % len(projects))
        headline = counts.get("headline") if isinstance(counts.get("headline"), dict) else {}
        if headline.get("value") != by_tier["recent_news"]:
            found["tier-counts"].append("counts.headline.value is %r, projects with confirmed recent news: %d" % (
                headline.get("value"), by_tier["recent_news"]))
        for key, value in with_.items():
            if key in counts and counts.get(key) != value:
                found["tier-counts"].append("counts.%s is %r, the items give %d" % (key, counts.get(key), value))
        if "possible_only" in counts and counts.get("possible_only") != possible_only:
            found["tier-counts"].append("counts.possible_only is %r, the items give %d" % (counts.get("possible_only"), possible_only))
        said_items = counts.get("items") if isinstance(counts.get("items"), dict) else {}
        for name in LISTS:
            if name in said_items and said_items.get(name) != item_counts[name]:
                found["tier-counts"].append("counts.items.%s is %r, the lists hold %d" % (name, said_items.get(name), item_counts[name]))

    # generated_at
    parts = doc.get("parts") if isinstance(doc.get("parts"), dict) else {}
    generated = parse_stamp(doc.get("generated_at"))
    live = {name: parts.get(name) for name in LIVE_PARTS if isinstance(parts.get(name), dict)}
    says_stale = doc.get("stale") is True or any(p.get("status") in ("stale", "failed") for p in live.values())
    if generated is None:
        if not says_stale:
            found["generated-at"].append("generated_at is %r and nothing says stale" % doc.get("generated_at"))
    else:
        age = now_stamp - generated
        if age > dt.timedelta(days=MAX_AGE_DAYS) and not says_stale:
            found["generated-at"].append("generated_at %s is %.1f days old and neither 'stale' nor a part says so" % (
                doc.get("generated_at"), age.total_seconds() / 86400))
        if age < dt.timedelta(minutes=-10):
            found["generated-at"].append("generated_at %s is in the future" % doc.get("generated_at"))
        if v2:
            good = [parse_stamp(p.get("collected_at")) for p in live.values() if p.get("status") == "ok"]
            good = [g for g in good if g]
            if good and generated != max(good):
                found["generated-at"].append("generated_at %s is not the newest successful live collection (%s)" % (
                    doc.get("generated_at"), max(good).isoformat()))
            if doc.get("stale") is not True and any(p.get("status") != "ok" for p in live.values()):
                found["generated-at"].append("a live part is not ok but 'stale' is not true")
    return [(rule, not found[rule], found[rule]) for rule in RULES]


def failures(doc, now=None):
    """{rule: [evidence]} of the rules that fail."""
    return {rule: evidence for rule, passed, evidence in check(doc, now) if not passed}


def report(results, doc, source=""):
    lines = ["## Project signals: live acid check\n",
             "File: %s. schema `%s`, generated_at `%s`%s.\n" % (
                 source or "dist/project_signals.json", doc.get("schema") if isinstance(doc, dict) else "?",
                 doc.get("generated_at") if isinstance(doc, dict) else "?",
                 ", stale" if isinstance(doc, dict) and doc.get("stale") is True else ""),
             "| rule | result | first evidence | more |", "|---|---|---|---|"]
    for rule, passed, evidence in results:
        lines.append("| %s | %s | %s | %s |" % (rule, "pass" if passed else "**FAIL**",
                                               (evidence[0] if evidence else "").replace("|", "/")[:260],
                                               ("%d more" % (len(evidence) - 1)) if len(evidence) > 1 else ""))
    failed = [rule for rule, passed, _ in results if not passed]
    lines.append("\n**%s**\n" % ("Failed: " + ", ".join(failed) if failed else "All rules pass."))
    return "\n".join(lines) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("file")
    ap.add_argument("--now", default=None)
    ap.add_argument("--summary", default=None)
    ap.add_argument("--source", default="")
    args = ap.parse_args(argv)
    try:
        doc = json.loads(Path(args.file).read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        doc = None
        text = "## Project signals: live acid check\n\n**Failed: schema** (the published file could not be read: %s)\n" % type(error).__name__
        results = [("schema", False, [])]
    else:
        results = check(doc, args.now)
        text = report(results, doc, args.source)
    print(text)
    if args.summary:
        with open(args.summary, "a", encoding="utf-8") as handle:
            handle.write(text + "\n")
    return 1 if any(not passed for _rule, passed, _e in results) else 0


if __name__ == "__main__":
    sys.exit(main())
