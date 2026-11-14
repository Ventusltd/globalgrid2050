#!/usr/bin/env python3
"""Project signals, part "index": BBC News RSS, the Guardian's RSS by tag and the GDELT DOC 2.0 API.

For each of the 200 largest solar projects in the REPD (top200_solar.json) and its curated press name
(aliases.json) this script looks for dated headlines about that project and writes one part file in the shared
contract (schema project-signals-part.v1, team "index"). Headlines and links only: a feed summary is read in
memory to decide a match and is never written; no article page is ever requested.

  python automation/news/signals/index.py --out parts/index.json [--probe summary.md] [--limit N]

Sources
- BBC News RSS (the owner's first primary source): the national feeds and the regional feed of every county that
  appears in the top 200 (BBC_REGION below; each feed's health is recorded so a wrong address is visible).
- The Guardian's public RSS for a few tags.
- GDELT DOC 2.0 (no key): one query per project, the project's name as an exact phrase with the word solar,
  restricted to UK sources. One request every few seconds, back off on HTTP 429, answers cached by query, and the
  200 are rotated across runs (never asked first, then longest since asked).

Match rule (shared contract, section 3). An item is tied to a project when the headline carries the alias, or
the project's name directly followed by "solar", or the planning reference. BBC headlines rarely name the
project, so the feed's own summary is also read: the alias in the summary counts when one more fact agrees (the
feed is the project's own county feed, or the county or operator is named). A weaker match (the name and "solar"
apart in the headline; the name only in the summary of the county feed; a GDELT article whose text carries the
phrase but whose headline only says solar) is kept with confidence "uncertain". The basis line says which.
A bare place name is never enough. Google News links and excluded sources are dropped.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
NEWS = HERE.parent
for _path in (str(NEWS), str(HERE)):
    if _path not in sys.path:
        sys.path.insert(0, _path)

import dates as DATES  # noqa: E402  one date rule shared by the collectors and the combiner
import gate as GATE  # noqa: E402  the title gate shared with trade.py, official.py and combine.py
import datacentre_feed as D  # noqa: E402  fetch, parse, dates, canonical links (reused, not copied)

SCHEMA = "project-signals-part.v1"
TEAM = "index"
USER_AGENT = "GlobalGrid2050-ProjectSignals/1.0 (+https://globalgrid2050.com)"
TIMEOUT_S = 20
MAX_PER_PROJECT = 8
GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc"
GDELT_INTERVAL_S = 6.0
GDELT_MAXRECORDS = 75
GDELT_CACHE_DAYS = 7
GDELT_DEFAULT_CAP = 120
GDELT_MAX_REFUSALS = 6          # a query refused twice (HTTP 429) this many times running: stop for this run
# Widest first. GDELT answers a window it does not allow with a plain-text message; the script then steps down.
GDELT_WINDOWS = (("since 2017", {"startdatetime": "20170101000000"}),
                 ("last 12 months", {"timespan": "12m"}),
                 ("default (about three months)", {}))

BBC_BASE = "https://feeds.bbci.co.uk/news/"
BBC_NATIONAL = ("", "uk/", "business/", "science_and_environment/", "politics/", "england/", "scotland/", "wales/",
                "northern_ireland/")
# REPD county -> BBC regional feed slug(s). Every address is fetched in CI; a failure shows in the health table.
BBC_REGION = {
    "lincolnshire": ["england/lincolnshire", "england/humberside"],
    "nottinghamshire": ["england/nottingham"],
    "cambridgeshire": ["england/cambridgeshire"],
    "essex": ["england/essex"],
    "gloucestershire": ["england/gloucestershire"],
    "oxfordshire": ["england/oxford"],
    "north yorkshire": ["england/york_and_north_yorkshire"],
    "warwickshire": ["england/coventry_and_warwickshire"],
    "wiltshire": ["england/wiltshire"],
    "county durham": ["england/tees", "england/tyne_and_wear"],
    "south yorkshire": ["england/south_yorkshire"],
    "northamptonshire": ["england/northamptonshire"],
    "kent": ["england/kent"],
    "norfolk": ["england/norfolk"],
    "derbyshire": ["england/derbyshire"],
    "hampshire": ["england/hampshire"],
    "staffordshire": ["england/stoke_and_staffordshire"],
    "cleveland": ["england/tees"],
    "buckinghamshire": ["england/beds_bucks_and_herts"],
    "hertfordshire": ["england/beds_bucks_and_herts"],
    "east riding of yorkshire": ["england/humberside"],
    "humberside": ["england/humberside"],
    "cumbria": ["england/cumbria"],
    "leicestershire": ["england/leicester"],
    "northumberland": ["england/tyne_and_wear"],
    "devon": ["england/devon"],
    "suffolk": ["england/suffolk"],
    "somerset": ["england/somerset"],
    "west yorkshire": ["england/leeds_and_west_yorkshire"],
    "cheshire": ["england/merseyside", "england/manchester", "england/stoke_and_staffordshire"],
    "london": ["england/london"],
    "cornwall": ["england/cornwall"],
    "hereford and worcester": ["england/hereford_and_worcester"],
    "worcestershire": ["england/hereford_and_worcester"],
    "west midlands": ["england/birmingham_and_black_country", "england/coventry_and_warwickshire"],
    "berkshire": ["england/berkshire"],
    "shropshire": ["england/shropshire"],
    "dorset": ["england/dorset"],
    "tayside": ["scotland/tayside_and_central"], "perthshire": ["scotland/tayside_and_central"],
    "angus": ["scotland/tayside_and_central"],
    "lanarkshire": ["scotland/glasgow_and_west"], "strathclyde": ["scotland/glasgow_and_west"],
    "renfrewshire": ["scotland/glasgow_and_west"], "ayrshire": ["scotland/glasgow_and_west"],
    "aberdeenshire": ["scotland/north_east_orkney_and_shetland"],
    "grampian": ["scotland/north_east_orkney_and_shetland"],
    "moray": ["scotland/north_east_orkney_and_shetland", "scotland/highlands_and_islands"],
    "borders": ["scotland/south_scotland"],
    "fife": ["scotland/edinburgh_east_and_fife"], "east lothian": ["scotland/edinburgh_east_and_fife"],
    "gwent": ["wales/south_east_wales"], "south glamorgan": ["wales/south_east_wales"],
    "vale of glamorgan": ["wales/south_east_wales"], "west glamorgan": ["wales/south_west_wales"],
    "clwyd": ["wales/north_east_wales"], "flintshire": ["wales/north_east_wales"],
    "denbighshire": ["wales/north_east_wales"],
    "gwynedd": ["wales/north_west_wales"], "isle of anglesey": ["wales/north_west_wales"],
    "co. antrim": ["northern_ireland"],
}
GUARDIAN_FEEDS = ("https://www.theguardian.com/environment/solarpower/rss",
                  "https://www.theguardian.com/environment/renewableenergy/rss",
                  "https://www.theguardian.com/environment/energy/rss",
                  "https://www.theguardian.com/business/energy-industry/rss",
                  "https://www.theguardian.com/politics/planning/rss")

# Not allowed as sources (brief): Google, Reuters, anything behind a login or paywall; plus aggregators that
# re-host another publisher's story.
EXCLUDED_DOMAINS = ("google.com", "google.co.uk", "news.google.com", "reuters.com", "ft.com", "thetimes.co.uk",
                    "thetimes.com", "telegraph.co.uk", "bloomberg.com", "wsj.com", "economist.com", "msn.com",
                    "yahoo.com", "facebook.com", "x.com", "twitter.com", "linkedin.com", "youtube.com")
PUBLISHERS = {
    "bbc.co.uk": ("BBC News", "bbc"), "bbc.com": ("BBC News", "bbc"),
    "theguardian.com": ("The Guardian", "national"), "independent.co.uk": ("The Independent", "national"),
    "sky.com": ("Sky News", "national"), "lbc.co.uk": ("LBC", "national"), "itv.com": ("ITV News", "national"),
    "dailymail.co.uk": ("Daily Mail", "national"), "mirror.co.uk": ("Daily Mirror", "national"),
    "express.co.uk": ("Daily Express", "national"), "standard.co.uk": ("The Standard", "national"),
    "inews.co.uk": ("The i Paper", "national"), "thesun.co.uk": ("The Sun", "national"),
    "scotsman.com": ("The Scotsman", "national"), "heraldscotland.com": ("The Herald", "national"),
    "solarpowerportal.co.uk": ("Solar Power Portal", "trade"), "pv-tech.org": ("PV Tech", "trade"),
    "pv-magazine.com": ("pv magazine", "trade"), "energy-storage.news": ("Energy-Storage.news", "trade"),
    "current-news.co.uk": ("Current", "trade"), "renews.biz": ("reNEWS", "trade"),
    "planningresource.co.uk": ("Planning Resource", "trade"),
    "constructionenquirer.com": ("Construction Enquirer", "trade"),
    "businessgreen.com": ("BusinessGreen", "trade"), "energylivenews.com": ("Energy Live News", "trade"),
    "theenergyst.com": ("The Energyst", "trade"), "renewablesnow.com": ("Renewables Now", "trade"),
    "energyvoice.com": ("Energy Voice", "trade"), "theconstructionindex.co.uk": ("The Construction Index", "trade"),
    "farminguk.com": ("FarmingUK", "trade"), "fwi.co.uk": ("Farmers Weekly", "trade"),
    "edie.net": ("edie", "trade"), "insidermedia.com": ("Insider Media", "trade"),
    "gov.uk": ("GOV.UK", "official"), "gov.scot": ("Scottish Government", "official"),
    "gov.wales": ("Welsh Government", "official"), "parliament.uk": ("UK Parliament", "official"),
}
GDELT_DOMAINS = ("bbc.co.uk", "theguardian.com", "solarpowerportal.co.uk", "pv-tech.org", "pv-magazine.com",
                 "independent.co.uk", "lincolnshireworld.com", "lincolnshirelive.co.uk", "edp24.co.uk",
                 "oxfordmail.co.uk", "yorkshirepost.co.uk", "nottinghampost.com", "cambridge-news.co.uk")

GENERIC_WORDS = frozenset((
    "solar", "energy", "farm", "farms", "park", "parks", "project", "projects", "pv", "photovoltaic",
    "photovoltaics", "renewable", "renewables", "scheme", "array", "plant", "power", "station", "battery",
    "storage", "bess", "hub", "centre", "center", "green", "ltd", "limited", "and", "&", "site", "panels",
    "development", "extension", "co-located", "colocated"))
# A name that is only this is too common to match on without the full alias.
WEAK_CORES = frozenset((
    "north", "south", "east", "west", "the", "new", "great", "little", "upper", "lower", "manor", "grange", "hall",
    "home", "church", "mill", "park", "wood", "field", "green", "hill", "bridge", "lodge", "airfield", "aerodrome",
    "england", "scotland", "wales", "uk", "britain", "one", "two", "sunny", "light", "bright", "meadow", "valley",
    "common", "heath", "moor", "marsh", "fen", "fens", "marshes", "court", "castle", "abbey", "priory", "glebe",
    "rectory", "station", "high", "low", "long", "white", "black", "red", "oak", "ash", "elm", "stoke", "land",
    "airport", "port", "dock", "docks", "quarry", "colliery", "estate", "airbase", "base", "house", "farm",
    "yorkshire", "anglia", "midlands", "road", "middle", "lane", "street",
    # names shared with places or companies abroad: only the full alias is matched
    "houston", "springfield", "oaklands", "meridian", "helios"))
EMAIL = re.compile(r"\S+@\S+")


def scrub(text):
    """A source's own message, without any email address it carries."""
    return " ".join(EMAIL.sub("(address removed)", text or "").split())


SOLAR = re.compile(r"(?<!\w)(?:solar|photovoltaics?|pv)(?!\w)", re.I)
REF = re.compile(r"\b(?:EN0\d{5}|ECU\d{6,8}|DNS/\d{7}|DNS\s?CAS-\d+[-\w]*)\b", re.I)


# ---------------------------------------------------------------- projects and aliases

def clean_site_name(site_name):
    """REPD "Place, Village - Project Name & Battery Storage" -> "Project Name" (a derived alias)."""
    name = " ".join((site_name or "").split())
    if " - " in name:
        left, right = name.split(" - ", 1)
        name = right if re.search(r"solar|energy|park|farm", right, re.I) and len(right.split()) > 2 else left
    name = re.sub(r"\s*(?:&|and|with|\+)\s*(?:battery|bess|energy storage|storage|co-?located).*$", "", name, flags=re.I)
    name = re.sub(r"\s*\((?:resubmission|extension|phase[^)]*)\)\s*$", "", name, flags=re.I)
    return name.split(",")[0].strip(" -")


def core_name(alias):
    """The distinctive start of an alias: "The Botley West Solar Farm" -> "Botley West". "" when there is none."""
    words = re.sub(r"[^\w\s'&-]", " ", alias or "").split()
    if words and words[0].lower() == "the":
        words = words[1:]
    core = []
    for word in words:
        if word.lower() in GENERIC_WORDS:
            break
        core.append(word)
    return " ".join(core)


def phrase_rx(phrase):
    parts = [re.escape(p) for p in re.split(r"[\s-]+", phrase.strip()) if p]
    return re.compile(r"(?<!\w)" + r"[\s-]+".join(parts) + r"(?!\w)", re.I) if parts else None


def load_projects(top200_path, aliases_path):
    """Top-200 rows joined to the alias table. Without a table every project gets a derived alias."""
    rows = json.loads(Path(top200_path).read_text(encoding="utf-8"))
    table = {}
    if aliases_path and Path(aliases_path).exists():
        try:
            table = json.loads(Path(aliases_path).read_text(encoding="utf-8")).get("projects", {})
        except (ValueError, AttributeError):
            table = {}
    counties = {(r.get("county") or "").strip().lower() for r in rows}
    projects = []
    for row in rows:
        ref = str(row["repd_ref"])
        entry = table.get(ref) or {}
        aliases = [a.strip() for a in entry.get("aliases") or [] if isinstance(a, str) and a.strip()]
        status = entry.get("alias_status") or "derived"
        if not aliases:
            aliases, status = [clean_site_name(row.get("site_name"))], "derived"
        county = (entry.get("county") or row.get("county") or "").strip()
        cores = []
        for alias in aliases:
            core = core_name(alias)
            low = core.lower()
            if (core and low not in cores and len(core) >= 5 and low not in counties
                    and not all(w.lower() in WEAK_CORES for w in core.split())):
                cores.append(low)
        ref_text = (entry.get("planning_ref") or row.get("planning_ref") or "").strip()
        operator = re.sub(r"\b(?:ltd|limited|plc|llp|uk)\b\.?", "", (entry.get("operator") or row.get("operator") or ""),
                          flags=re.I).strip(" &,")
        projects.append({
            "repd_ref": ref, "rank": row.get("rank"), "site_name": (row.get("site_name") or "").strip(),
            "county": county, "operator": operator, "aliases": aliases, "alias_status": status, "cores": cores,
            "planning_ref": ref_text if REF.fullmatch(ref_text) else "",
            "exclude": [e.lower() for e in entry.get("exclude") or [] if isinstance(e, str) and e.strip()],
            "_alias_rx": [phrase_rx(a) for a in aliases],
            "_core_rx": [(c, phrase_rx(c), re.compile(phrase_rx(c).pattern + r"[\s-]+(?:solar|pv|photovoltaic)", re.I))
                         for c in cores],
        })
    return projects


def match_item(project, title, summary="", county_feed=False):
    """The module's own rule (_match_item), then the shared title gate (gate.py). A match made in the title that
    the gate drops is no match; thin support is weak."""
    found = _match_item(project, title, summary, county_feed)
    if not found:
        return found
    verdict, reason = GATE.judge(project.get("repd_ref"), title, project=GATE.for_record(project))
    if verdict == "drop":
        return None
    if found[0] == "strong" and verdict == "possible":
        return "weak", "%s; kept as weak: %s" % (found[1], reason)
    return found


def _match_item(project, title, summary="", county_feed=False):
    """(strength, basis) or None. strength: "strong" | "weak". The summary is read here and never stored."""
    low_title = title.lower()
    if any(phrase in low_title for phrase in project["exclude"]):
        return None
    ref = project["planning_ref"]
    if ref and re.search(re.escape(ref), title, re.I):
        return "strong", "planning reference %s in title" % ref
    if GATE.inverted_solar_place(title, project):
        return "strong", "verified place alias in inverted solar-farm title"
    for alias, rx in zip(project["aliases"], project["_alias_rx"]):
        if rx and SOLAR.search(alias) and rx.search(title):
            return "strong", "alias '%s' in title" % alias
    for core, rx, adjacent in project["_core_rx"]:
        if adjacent.search(title):
            return "strong", "name '%s' followed by 'solar' in title" % core.title()
    for alias, rx in zip(project["aliases"], project["_alias_rx"]):
        if rx and not SOLAR.search(alias) and rx.search(title) and SOLAR.search(title + " " + summary):
            return "strong", "alias '%s' in title with 'solar'" % alias
    if summary:
        agree = None
        if county_feed:
            agree = "the feed is the project's county feed"
        elif project["county"] and re.search(r"(?<!\w)" + re.escape(project["county"]) + r"(?!\w)", title + " " + summary, re.I):
            agree = "county %s named" % project["county"]
        elif len(project["operator"]) >= 4 and project["operator"].lower() in (title + " " + summary).lower():
            agree = "operator named"
        if ref and re.search(re.escape(ref), summary, re.I):
            return "strong", "planning reference %s in feed summary" % ref
        named = None
        for alias, rx in zip(project["aliases"], project["_alias_rx"]):
            if rx and rx.search(summary) and SOLAR.search(alias + " " + title + " " + summary):
                named = "alias '%s'" % alias
                break
        if not named:
            for core, rx, adjacent in project["_core_rx"]:
                if adjacent.search(summary):
                    named = "name '%s' followed by 'solar'" % core.title()
                    break
        if named:
            if agree:
                return "strong", "%s in feed summary; %s" % (named, agree)
            return "weak", "%s in feed summary; no second agreeing fact" % named
    for core, rx, _adjacent in project["_core_rx"]:
        if rx.search(title) and SOLAR.search(title):
            return "weak", "name '%s' and 'solar' both in title, not adjacent" % core.title()
        if rx.search(title) and summary and SOLAR.search(summary) and county_feed:
            return "weak", "name '%s' in title, 'solar' in feed summary; county feed" % core.title()
        if summary and county_feed and rx.search(summary) and SOLAR.search(title):
            return "weak", "'solar' in title, name '%s' in feed summary; county feed" % core.title()
    return None


def domain_of(link):
    host = (urllib.parse.urlsplit(link).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def _under(host, domain):
    return host == domain or host.endswith("." + domain)


def is_excluded(link):
    host = domain_of(link)
    return not host or any(_under(host, d) for d in EXCLUDED_DOMAINS) or ".google." in "." + host + "."


def publisher_of(link):
    """(display name, family). An unknown UK title is "regional" under its own host name."""
    host = domain_of(link)
    for domain, value in PUBLISHERS.items():
        if _under(host, domain):
            return value
    return host, "regional"


def make_item(project, title, link, date, publisher, family, strength, basis, where):
    confirmed = strength == "strong" and project["alias_status"] == "confirmed"
    note = "" if project["alias_status"] == "confirmed" else " (alias %s)" % project["alias_status"]
    return {"repd_ref": project["repd_ref"], "title": title[:300], "link": link, "publisher": publisher,
            "date": date[:10] if date else None, "family": family,
            "basis": ("%s: %s%s" % (where, basis, note))[:240],
            "confidence": "confirmed" if confirmed else "uncertain"}


# ---------------------------------------------------------------- RSS (BBC, Guardian)

def bbc_feeds(projects):
    """[(url, set of county names it is the regional feed for)], national feeds first. Derived from the top 200."""
    feeds = {BBC_BASE + slug + "rss.xml": set() for slug in BBC_NATIONAL}
    unmapped = set()
    for project in projects:
        county = project["county"].lower()
        slugs = BBC_REGION.get(county)
        if slugs is None:
            unmapped.add(project["county"])
            continue
        for slug in slugs:
            feeds.setdefault(BBC_BASE + slug + "/rss.xml", set()).add(county)
    return list(feeds.items()), sorted(unmapped)


class Throttle:
    """At most one request per `interval` seconds per host."""

    def __init__(self, interval=1.0, sleep=time.sleep, clock=time.monotonic):
        self.interval, self.sleep, self.clock, self.last = interval, sleep, clock, {}

    def wait(self, host, interval=None):
        gap = self.interval if interval is None else interval
        now = self.clock()
        due = self.last.get(host, -1e9) + gap
        if due > now:
            self.sleep(due - now)
        self.last[host] = self.clock()


def fetch_feed(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT,
                                               "Accept": "application/rss+xml, application/atom+xml, application/xml"})
    with urllib.request.urlopen(req, timeout=TIMEOUT_S) as response:  # noqa: S310 (fixed https list)
        return response.read(D.MAX_BYTES + 1)


def collect_rss(feeds, projects, fetch, publisher, family, where, throttle=None):
    """feeds: [(url, counties)]. Returns (items, per-feed health)."""
    items, health = [], []
    unmatched = collect_rss.unmatched
    for url, counties in feeds:
        if throttle:
            throttle.wait(urllib.parse.urlsplit(url).hostname)
        try:
            entries = D.parse_feed(fetch(url))
        except Exception as error:  # one feed failing never stops the run
            health.append({"url": url, "status": "failed", "entries": 0, "solar": 0, "kept": 0, "newest": None,
                           "error": scrub(type(error).__name__ + ": " + str(error))[:200]})
            continue
        kept, solar, newest = 0, 0, None
        for title, link, date, summary in entries:
            title, link, date = D.clean_text(title, 300), D.canonical_link(link), DATES.day(date)
            summary = D.clean_text(summary, 2000)                     # read for the match, never stored
            if date and (newest is None or date > newest):
                newest = date
            if not title or not link or is_excluded(link):
                continue
            if not SOLAR.search(title + " " + summary):
                continue
            solar += 1
            matched = False
            for project in projects:
                verdict = match_item(project, title, summary, project["county"].lower() in counties)
                if verdict:
                    items.append(make_item(project, title, link, date, publisher, family, verdict[0], verdict[1], where))
                    kept += 1
                    matched = True
            if not matched and link not in unmatched:
                unmatched[link] = (publisher, (date or "")[:10], title)
        health.append({"url": url, "status": "ok", "entries": len(entries), "solar": solar, "kept": kept,
                       "newest": newest, "error": ""})
    return items, health


collect_rss.unmatched = {}     # link -> (publisher, date, headline) of items that say solar and matched no project


def source_record(source_id, url, health):
    failures = sum(1 for h in health if h["status"] != "ok")
    status = "ok" if not failures else ("failed" if failures == len(health) else "partial")
    errors = "; ".join("%s %s" % (h["url"].replace(BBC_BASE, ""), h["error"]) for h in health if h["status"] != "ok")
    return {"id": source_id, "url": url, "status": status, "requests": len(health), "failures": failures,
            "items": sum(h["kept"] for h in health), "error": errors[:300]}


# ---------------------------------------------------------------- GDELT DOC 2.0

def gdelt_phrase(project, index=0):
    """The phrase asked of GDELT for this project: its distinctive name, or the full alias when the name is weak."""
    choices = []
    for alias in project["aliases"]:
        core = core_name(alias)
        text = core if core.lower() in project["cores"] else alias
        text = " ".join(re.sub(r"[^\w\s]", " ", text).split())
        if len(text) >= 5 and text.lower() not in [c.lower() for c in choices]:
            choices.append(text)
    return choices[index] if index < len(choices) else None


def gdelt_query(phrase, scope="uk"):
    term = '"%s"' % phrase if " " in phrase else phrase
    if scope == "domains":
        return "%s solar (%s)" % (term, " OR ".join("domainis:" + d for d in GDELT_DOMAINS))
    return "%s solar sourcecountry:UK" % term


def gdelt_url(query, window, now_iso):
    params = {"query": query, "mode": "artlist", "format": "json", "maxrecords": str(GDELT_MAXRECORDS),
              "sort": "datedesc"}
    params.update(window)
    if "startdatetime" in window:
        params["enddatetime"] = re.sub(r"\D", "", now_iso)[:14]
    return GDELT_URL + "?" + urllib.parse.urlencode(params)


def fetch_gdelt(url):
    """(HTTP status, text). HTTP errors are returned, not raised, so the caller can back off on 429."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:  # noqa: S310 (fixed https host)
            return response.status, response.read(D.MAX_BYTES + 1).decode("utf-8", "replace")
    except urllib.error.HTTPError as error:
        return error.code, error.read(2000).decode("utf-8", "replace")


def parse_gdelt(text):
    """[(title, url, domain, date, language)] or raises ValueError carrying GDELT's own plain-text message."""
    body = text.strip()
    if not body or body == "{}":
        return []
    if not body.startswith("{"):
        raise ValueError(scrub(body)[:160])
    try:
        data = json.loads(body, strict=False)
    except ValueError as error:
        raise ValueError("bad JSON: %s" % str(error)[:120]) from None
    out = []
    for art in data.get("articles") or []:
        # "seendate" is when GDELT crawled the page, not when it was published: a 2019 article crawled today must
        # not look recent. The date is the one written in the article's own link, when there is one; otherwise none.
        date = DATES.url_day(art.get("url") or "")
        out.append((art.get("title") or "", art.get("url") or "", art.get("domain") or "", date,
                    art.get("language") or ""))
    return out


class Gdelt:
    """One query per project, cached by query, polite, rotating. `fetch(url) -> (status, text)`."""

    def __init__(self, fetch, cache, now_iso, cap=GDELT_DEFAULT_CAP, sleep=time.sleep, scope="uk",
                 interval=GDELT_INTERVAL_S, cache_days=GDELT_CACHE_DAYS, seconds=None, clock=time.monotonic):
        self.fetch, self.cache, self.now, self.cap, self.sleep = fetch, cache, now_iso, cap, sleep
        self.clock, self.deadline = clock, (clock() + seconds) if seconds else None
        self.scope, self.interval, self.cache_days = scope, interval, cache_days
        self.window = 0
        self.stats = {"requests": 0, "answered": 0, "cache_hits": 0, "http_429": 0, "errors": 0, "empty": 0,
                      "articles": 0, "stopped": "", "window": "", "error_samples": [], "not_asked": 0,
                      "refused_queries": 0}
        self.refusals = 0
        self.throttle = Throttle(interval, sleep)

    def _fresh(self, key):
        entry = self.cache.get(key)
        if not entry or entry.get("error"):
            return None
        try:
            age = (dt.datetime.fromisoformat(self.now.replace("Z", "+00:00"))
                   - dt.datetime.fromisoformat(entry["fetched_at"].replace("Z", "+00:00"))).total_seconds()
        except (KeyError, ValueError):
            return None
        return entry if age < self.cache_days * 86400 else None

    def _error(self, message):
        self.stats["errors"] += 1
        if len(self.stats["error_samples"]) < 5 and message not in self.stats["error_samples"]:
            self.stats["error_samples"].append(message)

    def ask(self, query):
        """Articles for a query, from the cache or the API. None when it could not be asked this run."""
        fresh = self._fresh(query)
        if fresh is not None:
            self.stats["cache_hits"] += 1
            return fresh["articles"]
        if not self.stats["stopped"] and self.deadline is not None and self.clock() > self.deadline:
            self.stats["stopped"] = "time budget for GDELT reached; the rest are asked on later runs"
        if self.stats["stopped"] or self.stats["requests"] >= self.cap:
            self.stats["not_asked"] += 1
            return None
        while self.window < len(GDELT_WINDOWS):
            label, window = GDELT_WINDOWS[self.window]
            url = gdelt_url(query, window, self.now)
            status, text = self._get(url)
            if status == 429:
                self.stats["http_429"] += 1
                self.sleep(10)                                         # contract: wait ten seconds, retry once
                status, text = self._get(url)
                if status == 429:
                    self.stats["http_429"] += 1
                    self.stats["refused_queries"] += 1
                    self.refusals += 1
                    note = "HTTP 429: " + scrub(text)[:120]
                    if note not in self.stats["error_samples"] and len(self.stats["error_samples"]) < 5:
                        self.stats["error_samples"].append(note)
                    if self.refusals >= GDELT_MAX_REFUSALS:
                        self.stats["stopped"] = ("HTTP 429 on %d queries running, each retried once; GDELT left alone "
                                                 "for the rest of this run" % self.refusals)
                    else:
                        self.sleep(20)                                 # slow down further before the next query
                    return None
            self.refusals = 0
            if status != 200:
                self._error("HTTP %s" % status)
                self.cache[query] = {"fetched_at": self.now, "articles": [], "error": "HTTP %s" % status}
                return None
            try:
                arts = parse_gdelt(text)
            except ValueError as error:
                message = str(error)
                if re.search(r"timespan|date|too (?:far|old)|start", message, re.I) and self.window + 1 < len(GDELT_WINDOWS):
                    self.window += 1                                   # this window is not allowed: step down
                    continue
                self._error(message)
                self.cache[query] = {"fetched_at": self.now, "articles": [], "error": message}
                return None
            self.stats["answered"] += 1
            self.stats["window"] = label
            self.stats["articles"] += len(arts)
            if not arts:
                self.stats["empty"] += 1
            articles = [{"title": D.clean_text(t, 300), "url": u, "domain": d, "date": date, "language": lang}
                        for t, u, d, date, lang in arts]
            self.cache[query] = {"fetched_at": self.now, "articles": articles, "window": label}
            return articles
        return None

    def _get(self, url):
        if self.stats["requests"] >= self.cap + 10:
            return 0, ""
        self.throttle.wait("gdelt")
        self.stats["requests"] += 1
        if self.stats["requests"] % 20 == 0:
            print("gdelt: %(requests)d requests, %(answered)d answered, %(http_429)d HTTP 429, %(articles)d articles"
                  % self.stats, file=sys.stderr, flush=True)
        try:
            return self.fetch(url)
        except Exception as error:  # network failure: recorded, the run carries on
            return 0, type(error).__name__ + ": " + scrub(str(error))[:100]


def rotation(projects, cache, scope="uk"):
    """Order in which projects are asked: never asked first, then longest since asked, then rank."""
    def key(project):
        phrase = gdelt_phrase(project)
        entry = cache.get(gdelt_query(phrase, scope)) if phrase else None
        return ((entry or {}).get("fetched_at") or "", project.get("rank") or 0)
    return sorted((p for p in projects if gdelt_phrase(p)), key=key)


def gdelt_title(title):
    """GDELT stores a tokenised headline ("solar , storage"; "Headline | Paper"): close the gaps, drop the paper."""
    title = re.sub(r"\s+([,.;:!?])", r"\1", title or "")
    return re.sub(r"\s+\|\s+[^|]{2,60}$", "", title).strip()


def gdelt_items(project, articles, phrase, dropped, others=()):
    out = []
    for art in articles:
        title, link = gdelt_title(art.get("title")), D.canonical_link(art.get("url"))
        if not title or not link:
            dropped["no title or link"] += 1
            continue
        if is_excluded(link):
            dropped["excluded source"] += 1
            continue
        verdict = match_item(project, title)
        if verdict is None:
            if any(p in title.lower() for p in project["exclude"]):
                dropped["exclude phrase"] += 1
                continue
            if not SOLAR.search(title):
                dropped["headline has neither the name nor solar"] += 1
                continue
            county = project["county"]
            if not county or not re.search(r"(?<!\w)" + re.escape(county) + r"(?!\w)", title, re.I):
                dropped["headline says solar but neither the name nor the county"] += 1
                continue
            if any((match_item(other, title) or ("", ""))[0] == "strong" for other in others if other is not project):
                dropped["headline names another of the 200"] += 1
                continue
            verdict = ("weak", "phrase '%s' and 'solar' in the article text per GDELT; headline says solar and %s "
                               "but not the name" % (phrase, county))
        publisher, family = publisher_of(link)
        out.append(make_item(project, title, link, art.get("date"), publisher, family, verdict[0], verdict[1],
                             "GDELT index, UK sources"))
    return out


def collect_gdelt(projects, client, limit=None):
    items, per_project = [], {}
    dropped = {"no title or link": 0, "excluded source": 0, "exclude phrase": 0,
               "headline has neither the name nor solar": 0,
               "headline says solar but neither the name nor the county": 0, "headline names another of the 200": 0}
    order = rotation(projects, client.cache, client.scope)
    if limit:
        order = order[:limit]
    for project in order:
        phrase = gdelt_phrase(project)
        articles = client.ask(gdelt_query(phrase, client.scope))
        if articles is None:
            continue
        found = gdelt_items(project, articles, phrase, dropped, projects)
        second = gdelt_phrase(project, 1)
        if not found and second:                       # a second press name, only when the first gave nothing
            more = client.ask(gdelt_query(second, client.scope))
            if more:
                articles = articles + more
                found = gdelt_items(project, more, second, dropped, projects)
        per_project[project["repd_ref"]] = {"phrase": phrase, "returned": len(articles), "kept": len(found),
                                            "strong": sum(1 for i in found if " per GDELT" not in i["basis"])}
        items.extend(found)
    return items, per_project, dropped


def gdelt_experiment(projects, client, count):
    """Ask the first `count` projects again in other ways, to report what GDELT really returns. Not cached."""
    rows = []
    for project in [p for p in projects if gdelt_phrase(p)][:count]:
        phrase = gdelt_phrase(project)
        row = {"repd_ref": project["repd_ref"], "phrase": phrase}
        variants = [("uk, " + label, gdelt_url(gdelt_query(phrase, "uk"), window, client.now))
                    for label, window in GDELT_WINDOWS]
        variants.append(("named domains, since 2017", gdelt_url(gdelt_query(phrase, "domains"), GDELT_WINDOWS[0][1], client.now)))
        variants.append(("no country filter, since 2017",
                         gdelt_url(gdelt_query(phrase, "uk").replace(" sourcecountry:UK", ""), GDELT_WINDOWS[0][1], client.now)))
        for label, url in variants:
            status, text = client._get(url)
            if status != 200:
                row[label] = "HTTP %s" % status
                if status == 429:
                    client.sleep(10)
                continue
            try:
                arts = parse_gdelt(text)
                dates = sorted(a[3] for a in arts if a[3])
                row[label] = "%d articles%s" % (len(arts), (", %s to %s" % (dates[0], dates[-1])) if dates else "")
            except ValueError as error:
                row[label] = "message: " + str(error)[:90]
        rows.append(row)
    return rows


# ---------------------------------------------------------------- assemble

FAMILY_ORDER = {"official": 0, "bbc": 1, "trade": 2, "national": 3, "regional": 4}


def tidy(items, previous_items=(), valid_refs=None, cap=MAX_PER_PROJECT):
    """Dedupe by (project, link); a confirmed item beats an uncertain one; newest first; cap per project."""
    best = {}
    for item in list(items) + [i for i in previous_items if isinstance(i, dict)]:
        if valid_refs is not None and item.get("repd_ref") not in valid_refs:
            continue
        if not item.get("link") or not item.get("title") or is_excluded(item["link"]):
            continue
        key = (item["repd_ref"], item["link"])
        held = best.get(key)
        if held is None or (held["confidence"] != "confirmed" and item.get("confidence") == "confirmed"):
            best[key] = item
    by_project = {}
    for item in best.values():
        by_project.setdefault(item["repd_ref"], []).append(item)
    out = []
    for ref in sorted(by_project, key=lambda r: (len(r), r)):
        rows = sorted(by_project[ref], key=lambda i: (i["confidence"] != "confirmed", -int((i["date"] or "0000-00-00").replace("-", "")),
                                                      FAMILY_ORDER.get(i["family"], 9), i["link"]))
        seen, unique = set(), []
        for row in rows:                                   # one syndicated story, many local titles: keep one
            key = re.sub(r"[^a-z0-9]+", " ", row["title"].lower()).strip()
            if key not in seen:
                seen.add(key)
                unique.append(row)
        out.extend(unique[:cap])
    return out


def coverage(items, projects):
    refs = {p["repd_ref"] for p in projects}
    any_ref = {i["repd_ref"] for i in items} & refs
    confirmed = {i["repd_ref"] for i in items if i["confidence"] == "confirmed"} & refs
    by_family = {}
    for family in FAMILY_ORDER:
        by_family[family] = len({i["repd_ref"] for i in items if i["family"] == family} & refs)
    return {"projects": len(projects), "with_signal": len(any_ref), "with_confirmed_signal": len(confirmed),
            "with_signal_by_family": by_family, "items": len(items)}


def probe_report(part, projects, extra):
    cov, lines = part["coverage"], []
    lines.append("## Project signals, part \"index\" (BBC RSS, Guardian RSS, GDELT)\n")
    lines.append("Generated %s. Projects with at least one signal from these sources: **%d of %d** "
                 "(%d with a confirmed signal). Items kept: %d.\n" % (part["generated_at"], cov["with_signal"],
                                                                       cov["projects"], cov["with_confirmed_signal"], cov["items"]))
    lines.append("By family: " + ", ".join("%s %d" % kv for kv in cov["with_signal_by_family"].items()) + ".\n")
    lines.append("| source | status | requests | failures | items | error |\n|---|---|---|---|---|---|")
    for s in part["sources"]:
        lines.append("| %s | %s | %s | %s | %s | %s |" % (s["id"], s["status"], s["requests"], s["failures"], s["items"],
                                                          s["error"].replace("|", "/")))
    g = part.get("gdelt") or {}
    if g:
        lines.append("\n### GDELT DOC 2.0: what it returned\n")
        lines.append("- requests %(requests)s, answered %(answered)s, cache hits %(cache_hits)s, HTTP 429 %(http_429)s, "
                     "queries refused twice %(refused_queries)s, errors %(errors)s, queries with no article %(empty)s, articles returned %(articles)s, "
                     "projects not asked this run %(not_asked)s" % g)
        lines.append("- window in use: %s%s" % (g.get("window") or "none answered", ("; stopped: " + g["stopped"]) if g.get("stopped") else ""))
        if g.get("error_samples"):
            lines.append("- messages from GDELT: " + " / ".join(g["error_samples"]))
        lines.append("- projects asked %s; with any article returned %s; with a kept item %s; with a headline that names "
                     "the project %s" % (g.get("projects_asked"), g.get("projects_with_articles"),
                                         g.get("projects_with_kept"), g.get("projects_with_strong")))
        lines.append("- dropped: " + ", ".join("%s %d" % kv for kv in (g.get("dropped") or {}).items()))
        dates = sorted(i["date"] for i in part["items"] if i["basis"].startswith("GDELT") and i["date"])
        if dates:
            lines.append("- dates of kept GDELT items: %s to %s" % (dates[0], dates[-1]))
        if g.get("domains"):
            lines.append("- domains of kept items: " + ", ".join("%s %d" % kv for kv in g["domains"]))
    if extra.get("experiment"):
        lines.append("\n### GDELT windows and scopes compared (same phrase, first projects)\n")
        keys = [k for k in extra["experiment"][0] if k not in ("repd_ref", "phrase")]
        lines.append("| REPD | phrase | " + " | ".join(keys) + " |\n|---|---|" + "---|" * len(keys))
        for row in extra["experiment"]:
            lines.append("| %s | %s | %s |" % (row["repd_ref"], row["phrase"], " | ".join(str(row.get(k, "")) for k in keys)))
    lines.append("\n### Feeds\n")
    if extra.get("unmapped_counties"):
        lines.append("Counties with no BBC regional feed in the table: %s\n" % ", ".join(extra["unmapped_counties"]))
    lines.append("| feed | status | entries | mention solar | kept | newest | error |\n|---|---|---|---|---|---|---|")
    for h in part.get("feeds", []):
        lines.append("| %s | %s | %s | %s | %s | %s | %s |" % (h["url"].replace("https://", ""), h["status"], h["entries"],
                                                               h["solar"], h["kept"], (h["newest"] or "")[:10],
                                                               h["error"].replace("|", "/")))
    lines.append("\n### Items (first 60)\n\n| REPD | date | family | publisher | confidence | title | basis |\n|---|---|---|---|---|---|---|")
    for i in part["items"][:60]:
        lines.append("| %s | %s | %s | %s | %s | [%s](%s) | %s |" % (
            i["repd_ref"], i["date"] or "", i["family"], i["publisher"], i["confidence"],
            i["title"].replace("|", "/").replace("[", "(").replace("]", ")"), i["link"], i["basis"].replace("|", "/")))
    if extra.get("unmatched"):
        lines.append("\n### Feed items that say solar and matched none of the 200 (headlines only)\n")
        for link, (publisher, date, title) in list(extra["unmatched"].items())[:50]:
            lines.append("- %s %s: [%s](%s)" % (date, publisher, title.replace("[", "(").replace("]", ")"), link))
    if extra.get("truth"):
        lines.append("\n" + extra["truth"])
    return "\n".join(lines) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default="dist/project_signals_index.json")
    ap.add_argument("--top200", default=str(HERE / "top200_solar.json"))
    ap.add_argument("--aliases", default=str(HERE / "aliases.json"))
    ap.add_argument("--previous", default=None, help="an earlier part file; its items are kept (rolling feeds)")
    ap.add_argument("--cache", default=None, help="GDELT answers by query (JSON), read and rewritten")
    ap.add_argument("--probe", default=None, help="write a Markdown report here as well")
    ap.add_argument("--truth", default=str(HERE / "index_ground_truth.json"), help="ground truth for the probe report")
    ap.add_argument("--limit", type=int, default=None, help="only the first N projects by rank")
    ap.add_argument("--gdelt-max", type=int, default=GDELT_DEFAULT_CAP, help="GDELT requests this run (0 = skip)")
    ap.add_argument("--gdelt-seconds", type=int, default=1200, help="time budget for GDELT this run")
    ap.add_argument("--gdelt-scope", choices=("uk", "domains"), default="uk")
    ap.add_argument("--gdelt-experiment", type=int, default=0, help="compare windows and scopes for the first N")
    ap.add_argument("--skip-rss", action="store_true")
    ap.add_argument("--now", default=None)
    args = ap.parse_args(argv)

    now_iso = args.now or dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    projects = load_projects(args.top200, args.aliases)
    if args.limit:
        projects = projects[:args.limit]
    items, sources, feeds, extra = [], [], [], {}
    throttle = Throttle(1.0)

    if not args.skip_rss:
        collect_rss.unmatched.clear()
        extra["unmatched"] = collect_rss.unmatched
        bbc, extra["unmapped_counties"] = bbc_feeds(projects)
        found, health = collect_rss(bbc, projects, fetch_feed, "BBC News", "bbc", "BBC News RSS", throttle)
        items += found
        feeds += health
        sources.append(source_record("bbc-rss", BBC_BASE, health))
        found, health = collect_rss([(u, set()) for u in GUARDIAN_FEEDS], projects, fetch_feed, "The Guardian",
                                    "national", "Guardian RSS", throttle)
        items += found
        feeds += health
        sources.append(source_record("guardian-rss", "https://www.theguardian.com/", health))

    gdelt = {}
    if args.gdelt_max > 0:
        cache = {}
        if args.cache and Path(args.cache).exists():
            try:
                cache = json.loads(Path(args.cache).read_text(encoding="utf-8")).get("queries", {})
            except (ValueError, AttributeError):
                cache = {}
        client = Gdelt(fetch_gdelt, cache, now_iso, cap=args.gdelt_max, scope=args.gdelt_scope, seconds=args.gdelt_seconds)
        if args.gdelt_experiment:
            try:
                extra["experiment"] = gdelt_experiment(projects, client, args.gdelt_experiment)
            except Exception:  # an experiment only
                pass
        try:
            found, per_project, dropped = collect_gdelt(projects, client)
        except Exception as error:  # GDELT failing as a whole never stops the run
            found, per_project, dropped = [], {}, {}
            client.stats["stopped"] = (type(error).__name__ + ": " + str(error))[:160]
        items += found
        domains = {}
        for item in found:
            domains[domain_of(item["link"])] = domains.get(domain_of(item["link"]), 0) + 1
        gdelt = dict(client.stats, dropped=dropped, projects_asked=len(per_project),
                     projects_with_articles=sum(1 for v in per_project.values() if v["returned"]),
                     projects_with_kept=sum(1 for v in per_project.values() if v["kept"]),
                     projects_with_strong=sum(1 for v in per_project.values() if v["strong"]),
                     domains=sorted(domains.items(), key=lambda kv: (-kv[1], kv[0]))[:25], per_project=per_project)
        if args.cache:
            keep = {q: e for q, e in cache.items() if not e.get("error")}
            Path(args.cache).parent.mkdir(parents=True, exist_ok=True)
            Path(args.cache).write_text(json.dumps({"schema": "project-signals-gdelt-cache.v1", "queries": keep},
                                                   ensure_ascii=False) + "\n", encoding="utf-8")
        s = client.stats
        asked = s["requests"]
        status = "ok" if s["answered"] and not s["stopped"] and not s["errors"] else ("partial" if s["answered"] or s["cache_hits"] else "failed")
        sources.append({"id": "gdelt-doc", "url": GDELT_URL, "status": status, "requests": asked,
                        "failures": s["errors"] + s["http_429"], "items": len(found),
                        "error": scrub("; ".join(filter(None, [s["stopped"]] + s["error_samples"])))[:300]})

    previous_items = []
    if args.previous and Path(args.previous).exists():
        try:
            old = json.loads(Path(args.previous).read_text(encoding="utf-8"))
            if old.get("schema") == SCHEMA and old.get("team") == TEAM:
                previous_items = old.get("items") or []
        except (ValueError, AttributeError):
            previous_items = []
    items = tidy(items, previous_items, {p["repd_ref"] for p in projects})
    part = {"schema": SCHEMA, "team": TEAM, "generated_at": now_iso, "items": items, "sources": sources,
            "coverage": coverage(items, projects), "feeds": feeds, "gdelt": gdelt}
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(part, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    if args.probe:
        if args.truth and Path(args.truth).exists():
            try:
                import combine as C
                truth = C.load_truth(args.truth)
                by_ref = {}
                for item in items:
                    by_ref.setdefault(item["repd_ref"], []).append(item)
                extra["truth"] = C.truth_report(truth, by_ref, "this part alone")
            except Exception as error:  # the comparison is a report, never a reason to fail
                extra["truth"] = "Ground truth comparison unavailable: %s" % type(error).__name__
        report = probe_report(part, projects, extra)
        Path(args.probe).write_text(report, encoding="utf-8")
    print(json.dumps({"out": str(out), **part["coverage"], "sources": {s["id"]: s["status"] for s in sources}}))
    return 1 if sources and all(s["status"] == "failed" for s in sources) and not items else 0


if __name__ == "__main__":
    sys.exit(main())
