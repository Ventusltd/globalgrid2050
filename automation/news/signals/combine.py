#!/usr/bin/env python3
"""Project signals: the combiner (contract version 2). Part files and the planning files become one file.

  python automation/news/signals/combine.py --official parts/official.json --trade parts/trade.json \
      --index parts/index.json --previous dist/project_signals.json --out dist/project_signals.json

Output: dist/project_signals.json, schema project-signals.v2, keyed by REPD Ref ID for each of the 200 largest solar
projects. Four tiers per project, never mixed in one list, one count or one label:

  recent_news    a publisher's item dated within 90 days of the run
  official       a dated planning decision or notice
  archive        older or undated items and developer pages, shown with their year or "undated"
  planning_file  always present; labelled as a verified link, an unverified link, a register search or a finder

Rules
- The tier comes from the item's date and family, never from how or when the item arrived. A reviewed item
  (reviewed_signals.json, found by hand) goes through the same rule; a fetched item with the same link replaces it.
- Order inside a list: dated before undated, newest first; confidence only breaks a tie on the same date.
- Confidence is earned: "confirmed" needs a collector's or reviewer's "confirmed", an alias whose standing is
  backed by recorded evidence in aliases.json, a second agreeing term for a one-word or everyday-word alias, and
  no exclusion rule (exclusions.json). Anything else is "possible" and never counted as fact.
- A link listed under several projects stays on each only when the title names that project or a reviewer tied
  it to that project; otherwise it stays on the best-evidenced one.
- Events (consent, refusal, appeal, ...) are read from the title; reports of one event for one project within
  14 days become one item with its "sources".
- Honest publishing: every part has its own status and collected_at. A part that failed or came back empty keeps
  the items published before, with their original collected_at, and is marked stale. generated_at is the time of
  the newest successful live collection and does not move otherwise. The file is not written (exit code 3) when
  it fails the schema check or the counts fall sharply against the file published before.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
NEWS = HERE.parent
for _path in (str(NEWS), str(HERE)):
    if _path not in sys.path:
        sys.path.insert(0, _path)

import dates as DATES  # noqa: E402  one date rule shared with the collectors
import gate as GATE  # noqa: E402  the title gate shared with the collectors
import datacentre_feed as D  # noqa: E402  canonical links and text cleaning (reused, not copied)

SCHEMA = "project-signals.v2"
SCHEMA_V1 = "project-signals.v1"
PART_SCHEMA = "project-signals-part.v1"
TRUTH_SCHEMA = "project-signals-ground-truth.v1"
SCOPE = "200 largest Solar Photovoltaics rows, REPD October 2026"
LIVE_TEAMS = ("official", "trade", "index")
TEAMS = LIVE_TEAMS + ("reviewed",)
PART_NAMES = TEAMS + ("planning",)
FAMILIES = ("official", "bbc", "trade", "national", "regional", "developer")
NEWS_FAMILIES = ("bbc", "trade", "national", "regional")
TIERS = ("recent_news", "official", "archive")
PROJECT_TIERS = ("recent_news", "official", "archive_only", "planning_file_only", "nothing")
EVENTS = ("consent", "refusal", "appeal", "legal_challenge", "financial_close", "construction_start",
          "energisation", "grid_connection", "sale")
RECENT_DAYS = 90
CLUSTER_DAYS = 14
MAX_PER_TIER = 5
PART_MAX_HOURS = 48           # a part file older than this was not collected by this run
DROP_LIMIT = 1 / 3            # the writer refuses a file whose counts fall by more than this
HEADLINE = "projects with recent verified news"
REVIEWED = "reviewed"         # basis of an item found by hand: "reviewed <date>"
# A developer's or a campaign's own page is something to click, not news: family "developer", always archive.
DEVELOPER_HOSTS = (
    "baywa-re.co.uk", "ecotricity.co.uk", "infinis.com", "lightsourcebp.com", "lowcarbon.com", "ensoenergy.co.uk",
    "sonnedix.com", "statkraft.co.uk", "scottishpowerrenewables.com", "rwe.com", "qair.energy", "uniper.energy",
    "nationalgrid.com", "azurewebsites.net", "edf-re.uk", "edfenergy.com", "islandgp.com", "pvdp.co.uk",
    "change.org", "scotlandagainstspin.org", "oxfordpreservation.org.uk", "gwentwildlife.org", "cambridgeppf.org",
    "whitewatervalley.org.uk")
AGGREGATOR_HOSTS = ("aol.com", "inkl.com")       # a copy of another publisher's story: never family "bbc"
KINDS = ("pins_project", "ecu_case", "pedw_case", "application", "search_page")
PLANNING_LABELS = ("planning file (verified link)", "planning file (unverified link)", "planning register search",
                   "planning register finder")
EXCLUDED_DOMAINS = ("google.com", "google.co.uk", "reuters.com", "ft.com", "thetimes.co.uk", "thetimes.com",
                    "telegraph.co.uk", "bloomberg.com", "wsj.com", "economist.com", "msn.com", "yahoo.com",
                    "facebook.com", "x.com", "twitter.com", "linkedin.com", "youtube.com")
PINS_PROJECT = "https://national-infrastructure-consenting.planninginspectorate.gov.uk/projects/%s"
ECU_SEARCH = "https://www.energyconsents.scot/ApplicationSearch.aspx"
PEDW_SEARCH = "https://planningcasework.service.gov.wales/"
REGISTER_FINDER = "https://www.gov.uk/search-register-planning-decisions"

# Words that say nothing about which project: removed to find the distinctive part of an alias.
GENERIC_WORDS = frozenset(
    "solar farm park project energy pv photovoltaic battery storage extension the and of scheme plant array bess "
    "power station renewable renewables hub centre limited ltd".split())
# Everyday words: an alias made only of these (or of one word) needs a second agreeing term in the title.
EVERYDAY_WORDS = frozenset(
    "bypass mill manor grange hall field fields hill bridge church lodge home wood woods green north south east west "
    "new old long high low upper lower great little big top bottom airfield lane road street house cottage barn "
    "warren breach wick spring springs meadow meadows common heath moor marsh valley view land lands oak oaks "
    "white black red blue stone water lake river brook ford gate way cross corner end side hills".split())
SOLAR_NOUN_RE = re.compile(r"\bsolar (?:farm|park|project|scheme|plant|array|development)s?\b|\benergy (?:park|farm)\b", re.I)
PLURAL_RE = re.compile(r"\b(?:two|three|four|both|several) |\bsolar (?:farms|parks|projects|schemes)\b", re.I)
EVENT_RULES = (
    ("legal_challenge", r"judicial review|legal challenge|high court|court of appeal|court challenge|court battle|"
                        r"(?:launch\w*|lodg\w+|mounts?|brings?|files?) (?:a |legal )?challenge"),
    ("appeal", r"\bappeals?\b|\bappealed\b|planning inquiry|public inquiry"),
    ("refusal", r"\brefus\w+|\breject\w+|turned down|thrown out|\bblocked\b|\bdenied\b"),
    ("consent", r"\bapproved\b|\bapproves\b(?! its\b)|\bapproval (?:of|for|granted|given)\b|green ?lights?|greenlights?|go[- ]ahead|\bconsent(?:ed|s)\b|\bgrant(?:s|ed)\b|"
                r"(?:wins?|secures?|gains?|receives?|gets?|given|awarded) (?:planning |development |section 36 )?"
                r"(?:consent|permission|approval|permit|DCO)\b"),
    ("financial_close", r"financial close|final investment decision|\bFID\b|financing (?:secured|closed|agreed)|"
                        r"(?:secures?|closes?|raises?|lands?) [^.]{0,40}(?:financing|funding|loan|debt facility)"),
    ("energisation", r"\benergis\w+|\benergiz\w+|goes live|switched on|(?:begins?|starts?) generating|first power|"
                     r"comes? online|\bcommissioned\b|(?:becomes?|now|fully) operational"),
    ("construction_start", r"construction (?:starts?|begins?|under ?way|commences?|has started|to start|kicks off)|"
                           r"breaks? ground|ground-?breaking|work (?:starts?|begins?)|(?:starts?|begins?) "
                           r"(?:construction|building|work)"),
    ("grid_connection", r"grid connection|connection agreement|connect(?:ed|s) to the (?:national )?grid"),
    ("sale", r"\bacquir\w+|\bacquisition\b|\bsold\b|\bsells?\b|\bsale of\b|\bbuys?\b|\bbought\b|"
             r"takes? (?:a )?(?:\d+% )?stake|\bdivest\w+"),
)
EVENT_RULES = tuple((name, re.compile(pattern, re.I)) for name, pattern in EVENT_RULES)


def now_utc():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_json(path):
    if not path:
        return None, "absent"
    if not Path(path).exists():
        return None, "missing"
    try:
        return json.loads(Path(path).read_text(encoding="utf-8")), "ok"
    except (ValueError, OSError):
        return None, "unreadable"


def _host_in(link, hosts):
    host = (urllib.parse.urlsplit(link).hostname or "").lower()
    return any(host == d or host.endswith("." + d) for d in hosts)


def _excluded(link):
    host = (urllib.parse.urlsplit(link).hostname or "").lower()
    return _host_in(link, EXCLUDED_DOMAINS) or ".google." in "." + host + "."


def _norm(text):
    text = (text or "").lower().replace("&", " and ").replace("’", "'").replace("‘", "'")
    return " ".join(re.sub(r"[^a-z0-9à-ÿ]+", " ", text).split())


def phrase_in(phrase, text):
    p, t = _norm(phrase), _norm(text)
    return bool(p) and re.search(r"(?<![a-z0-9])%s(?![a-z0-9])" % re.escape(p), t) is not None


def title_key(title):
    return _norm(title)


def is_reviewed(item):
    return item.get("obtained") == "reviewed"


# ---------------------------------------------------------------- dates, freshness, tier, event

def parse_date(value, today):
    """A real calendar date, not later than the day after `today`, as YYYY-MM-DD; otherwise None (dates.day)."""
    return DATES.day(value, today)


def freshness(date, today):
    if not date:
        return "undated"
    return "recent" if (today - dt.date.fromisoformat(date)).days <= RECENT_DAYS else "older"


def tier_of(family, date, today):
    if not date or family == "developer":
        return "archive"
    if family == "official":
        return "official"
    return "recent_news" if freshness(date, today) == "recent" else "archive"


def event_of(title):
    for name, pattern in EVENT_RULES:
        if pattern.search(title):
            return name
    return None


def order_key(item):
    """Dated before undated, newest first; confidence only on the same date; then family, then link."""
    date = int(item["date"].replace("-", "")) if item["date"] else 0
    return (item["date"] is None, -date, item["confidence"] != "confirmed", FAMILIES.index(item["family"]), item["link"])


# ---------------------------------------------------------------- confidence: alias standing and exclusions

def alias_standing(entry, recommended=None):
    """"confirmed" only with a confirmed status and recorded evidence (a URL or text) in aliases.json and, where
    alias_standings.json has reviewed the project, a "confirmed" standing there; otherwise "possible"."""
    entry = entry or {}
    if isinstance(recommended, dict) and recommended.get("standing"):
        return "confirmed" if recommended["standing"] == "confirmed" else "possible"
    evidence = str(entry.get("alias_evidence_url") or "").strip() or str(entry.get("alias_evidence") or "").strip()
    return "confirmed" if entry.get("alias_status") == "confirmed" and evidence else "possible"


def alias_words(alias):
    return [w for w in _norm(alias).split() if w not in GENERIC_WORDS]


def needs_second_term(alias):
    words = alias_words(alias)
    return len(words) <= 1 or all(w in EVERYDAY_WORDS for w in words)


def agreeing_terms(row, entry):
    """Facts that can stand beside a weak alias: place, county, authority, operator words, planning reference."""
    terms = []
    site = (row.get("site_name") or entry.get("site_name") or "")
    for piece in re.split(r"\s+-\s+|,", site)[:-1]:               # "Botley West, Botley - Botley West Solar Project"
        terms.append(piece)
    for key in ("county", "planning_authority", "planning_ref"):
        terms.append(row.get(key) or entry.get(key) or "")
    for word in re.findall(r"[A-Za-z][A-Za-z']{3,}", row.get("operator") or entry.get("operator") or ""):
        if word.lower() not in GENERIC_WORDS | {"development", "developments", "partners", "holdings", "group", "green"}:
            terms.append(word)
    terms.extend(entry.get("places") or [])
    return [t.strip() for t in terms if isinstance(t, str) and len(t.strip()) >= 4]


def names_project(title, entry, row):
    """True when the title carries one of the project's aliases, its distinctive part or its planning reference."""
    ref = (row.get("planning_ref") or "").strip()
    if len(ref) >= 6 and ref.lower() in title.lower():
        return True
    for alias in (entry or {}).get("aliases") or [(row.get("site_name") or "")]:
        if not isinstance(alias, str):
            continue
        core = " ".join(alias_words(alias))
        if phrase_in(alias, title) or (len(core) >= 4 and phrase_in(core, title)):
            return True
    return False


def second_term_ok(title, entry, row, weak=None):
    """For a one-word, everyday-word or shared alias: the title must also carry an agreeing fact (place, county,
    authority, operator, planning reference) or, unless the alias is shared with another row, a solar noun phrase.
    A fact that is itself part of the alias does not count."""
    aliases = [a for a in (entry or {}).get("aliases") or [] if isinstance(a, str)]
    if not weak:
        if any(len(_norm(a).split()) >= 3 and phrase_in(a, title) for a in aliases):
            return True                                     # the whole name, three words or more, is in the title
        matched = [a for a in aliases if phrase_in(a, title) or phrase_in(" ".join(alias_words(a)), title)]
        if not all(needs_second_term(a) for a in (matched or aliases)) or not aliases:
            return True
    if weak != "shared" and SOLAR_NOUN_RE.search(title):
        return True
    try:                                                    # a capacity within a fifth of the REPD figure agrees
        mw = float(row.get("mw") or (entry or {}).get("mw") or 0)
    except (TypeError, ValueError):
        mw = 0
    if mw and weak != "shared":
        for found in re.findall(r"(\d+(?:\.\d+)?)\s?(MW|GW)", title, re.I):
            value = float(found[0]) * (1000 if found[1].lower() == "gw" else 1)
            if abs(value - mw) <= 0.2 * mw:
                return True
    inside = " ".join(_norm(a) for a in aliases)
    return any(phrase_in(term, title) for term in agreeing_terms(row, entry or {}) if not phrase_in(term, inside))


def exclusion_reason(item, rules):
    """Why a per-project rule of exclusions.json removes the item, or ""."""
    if not rules:
        return ""
    title = item["title"]
    if item["link"] in {D.canonical_link(l) for l in rules.get("links") or [] if isinstance(l, str)}:
        return "link excluded"
    for phrase in rules.get("exclude") or []:
        if isinstance(phrase, str) and phrase.strip() and phrase_in(phrase, title):
            return "title has '%s'" % phrase
    required = [p for p in rules.get("require_any") or [] if isinstance(p, str) and p.strip()]
    if required and not any(phrase_in(p, title) for p in required):
        return "title lacks the required terms"
    return ""


# ---------------------------------------------------------------- items

def clean_item(raw, team, today=None, collected_at=None, as_of=None):
    """A part's item in the version 2 shape (without cluster), or (None, reason). `as_of` is accepted as another
    name for `today` (the date the 90 days and future dates are measured from)."""
    today = today or as_of or dt.datetime.now(dt.timezone.utc).date()
    if not isinstance(raw, dict):
        return None, "not an object"
    link = D.canonical_link(raw.get("link") if isinstance(raw.get("link"), str) else "")
    link = re.sub(r"\s", "%20", link.strip()) if link else link     # a link with a raw space is never published
    title = D.clean_text(raw.get("title") if isinstance(raw.get("title"), str) else "", 300)
    if not link or not title:
        return None, "no title or link"
    if _excluded(link):
        return None, "source not allowed"
    date = parse_date(raw.get("date"), today) or DATES.url_day(link, today)   # a full date in the link is the article's own
    year = int(date[:4]) if date else None
    if year is None:                                        # only the year is known: still an undated item, but labelled
        hint = raw.get("year")
        year = hint if isinstance(hint, int) and DATES.FIRST_YEAR <= hint <= today.year else DATES.url_year(link, today)
    family = raw.get("family") if raw.get("family") in FAMILIES else ("official" if team == "official" else
                                                                        "trade" if team == "trade" else "regional")
    if _host_in(link, DEVELOPER_HOSTS):
        family = "developer"
    elif family == "bbc" and _host_in(link, AGGREGATOR_HOSTS):
        family = "national"
    basis = D.clean_text(str(raw.get("basis") or ""), 240)
    reviewed = team == REVIEWED or raw.get("obtained") == "reviewed" or basis.startswith(REVIEWED)
    if reviewed and not basis.startswith(REVIEWED):
        basis = REVIEWED
    when = raw.get("collected_at") if isinstance(raw.get("collected_at"), str) and raw.get("collected_at") else collected_at
    return {"repd_ref": str(raw.get("repd_ref") or ""), "title": title, "link": link,
            "publisher": D.clean_text(str(raw.get("publisher") or ""), 80) or (urllib.parse.urlsplit(link).hostname or ""),
            "date": date, "year": year, "tier": tier_of(family, date, today),
            "event": event_of(title), "obtained": "reviewed" if reviewed else "fetched",
            "source": REVIEWED if reviewed else (raw.get("source") if raw.get("source") in LIVE_TEAMS else team),
            "family": family, "collected_at": when,
            "confidence": "confirmed" if raw.get("confidence") == "confirmed" else "possible",
            "freshness": freshness(date, today), "basis": basis}, ""


def link_key(link):
    """One key for the copies of one page: no www., m. or amp. host prefix, no trailing slash or /amp suffix, the
    path's spaces and %20 alike, http and https alike. Used to recognise duplicates; the link shown is unchanged."""
    parts = urllib.parse.urlsplit(link.strip())
    host = re.sub(r"^(?:www|m|amp|mobile)\.", "", (parts.hostname or "").lower())
    path = urllib.parse.quote(urllib.parse.unquote(parts.path), safe="/:@!$&'()*+,;=-._~")
    path = re.sub(r"/amp/?$", "", path).rstrip("/")
    query = sorted(p for p in parts.query.split("&") if p and not re.match(r"(?:lang|language|hl)=", p))
    return host + path + ("?" + "&".join(query) if query else "")


def dedupe(items):
    """No page twice (link_key). A fetched item takes the place of a reviewed one; the earliest collected_at is kept."""
    best = {}
    for item in sorted(items, key=lambda i: (is_reviewed(i), i["date"] is None, i["confidence"] != "confirmed")):
        kept = best.get(link_key(item["link"]))
        if kept is None:
            best[link_key(item["link"])] = item
        elif item["collected_at"] and (not kept["collected_at"] or item["collected_at"] < kept["collected_at"]) \
                and not is_reviewed(item):
            kept["collected_at"] = item["collected_at"]
    return list(best.values())


def _citation(item):
    return {"publisher": item["publisher"], "link": item["link"], "date": item["date"], "title": item["title"]}


def cluster(ref, items):
    """One story once. Items of one tier with the same headline, or the same event within 14 days, become the
    first of them in display order with the others as its "sources"."""
    items = sorted(items, key=order_key)
    groups, by_title = [], {}
    for item in items:                                      # same headline from another publisher: one story
        key = title_key(item["title"])
        if key in by_title:
            by_title[key].append(item)
        else:
            by_title[key] = [item]
            groups.append(by_title[key])
    merged = []
    for group in groups:                                    # same event within 14 days of the cluster's first date
        lead = group[0]
        home = None
        if lead["event"] and lead["date"]:
            day = dt.date.fromisoformat(lead["date"])
            for other in merged:
                first = other[0]
                if first["event"] == lead["event"] and first["date"] and \
                        abs((dt.date.fromisoformat(first["date"]) - day).days) <= CLUSTER_DAYS:
                    home = other
                    break
        if home is None:
            merged.append(list(group))
        else:
            home.extend(group)
    out = []
    for group in merged:
        first = next((i for i in group if i["confidence"] == "confirmed"), group[0])   # never lead with a possible match
        group = [first] + [i for i in group if i is not first]
        lead = dict(first)
        if len(group) > 1:
            dates = sorted(i["date"] for i in group if i["date"])
            lead["cluster"] = "%s:%s:%s" % (ref, lead["event"] or "story", dates[0] if dates else "undated")
            seen = {lead["link"]}
            lead["sources"] = []
            for other in group[1:]:
                if other["link"] not in seen:
                    seen.add(other["link"])
                    lead["sources"].append(_citation(other))
        out.append(lead)
    return sorted(out, key=order_key)


# ---------------------------------------------------------------- planning file

def last_resort(row):
    """A planning file built from the REPD row alone. Never verified; a search page unless the reference is a
    Planning Inspectorate project number."""
    ref = (row.get("planning_ref") or "").strip()
    authority = (row.get("planning_authority") or "").strip()
    country = (row.get("country") or "").strip()
    if re.fullmatch(r"EN0\d{5}", ref, re.I):
        return {"authority": "The Planning Inspectorate", "reference": ref.upper(), "url": PINS_PROJECT % ref.upper(),
                "kind": "pins_project", "verified": False, "note": ""}
    shown = ref or "the project name"
    if re.match(r"ECU", ref, re.I) or (country == "Scotland" and re.search(r"scottish (?:government|ministers)|energy consents", authority, re.I)):
        return {"authority": "Scottish Government Energy Consents Unit", "reference": ref, "url": ECU_SEARCH,
                "kind": "search_page", "verified": False, "note": "search for %s" % shown}
    if re.match(r"DNS|CAS-", ref, re.I) or (country == "Wales" and re.search(r"welsh (?:government|ministers)|PEDW|planning and environment decisions", authority, re.I)):
        return {"authority": "Planning and Environment Decisions Wales", "reference": ref, "url": PEDW_SEARCH,
                "kind": "search_page", "verified": False, "note": "search for %s" % shown}
    return {"authority": authority or "Local planning authority", "reference": ref, "url": REGISTER_FINDER,
            "kind": "search_page", "verified": False,
            "note": "find the planning register of %s, then search for %s" % (authority or "the local planning authority", shown)}


def planning_label(kind, verified, url):
    """Exactly which kind of thing the link is: never "planning file" for a search page."""
    if kind == "search_page":
        return ("planning register finder" if url.rstrip("/") == REGISTER_FINDER else "planning register search"), "search"
    return ("planning file (verified link)" if verified else "planning file (unverified link)"), "direct"


def clean_planning_file(raw):
    if not isinstance(raw, dict):
        return None
    url = D.canonical_link(raw.get("url") if isinstance(raw.get("url"), str) else "")
    if not url:
        return None
    kind = raw.get("kind") if raw.get("kind") in KINDS else "search_page"
    reference = D.clean_text(str(raw.get("reference") or ""), 120)
    note = D.clean_text(str(raw.get("note") or ""), 200)
    if kind == "search_page" and not note and reference:
        note = "search for %s" % reference
    verified = raw.get("verified") is True and kind != "search_page"
    label, link_type = planning_label(kind, verified, url)
    return {"label": label, "link_type": link_type, "authority": D.clean_text(str(raw.get("authority") or ""), 120),
            "reference": reference, "url": url, "kind": kind, "verified": verified, "note": note}


def module_planning_file(row):
    """Lead 1's builder, only if its module is present. Any failure means "not available"."""
    try:
        import planning_file as PF  # noqa: PLC0415  optional module from another pull request
    except Exception:
        return None
    for name in ("planning_file_for", "build_planning_file", "planning_file"):
        fn = getattr(PF, name, None)
        if callable(fn):
            try:
                return clean_planning_file(fn(dict(row)))
            except Exception:
                return None
    return None


def planning_table(data):
    """{repd_ref: planning_file} from either accepted shape of a --planning file."""
    if not isinstance(data, dict):
        return {}
    projects = data.get("projects") if isinstance(data.get("projects"), dict) else data
    out = {}
    for ref, value in projects.items():
        if isinstance(value, dict):
            out[str(ref)] = value.get("planning_file") if isinstance(value.get("planning_file"), dict) else value
    return out


# ---------------------------------------------------------------- combine

def _part_good(part):
    """A part file collected something this run: right schema, at least one item, not every source failed."""
    if not isinstance(part, dict):
        return False, "no part file from this run" if part in ("missing", "absent", None) else "part file %s" % part
    if part.get("schema") != PART_SCHEMA or not isinstance(part.get("items"), list):
        return False, "part file has the wrong schema"
    stamp, now = part.get("generated_at"), part.get("_run_at")
    if isinstance(stamp, str) and isinstance(now, str) and part.get("team") != REVIEWED:
        try:
            age = dt.datetime.fromisoformat(now.replace("Z", "+00:00")) - dt.datetime.fromisoformat(stamp.replace("Z", "+00:00"))
            if age > dt.timedelta(hours=PART_MAX_HOURS):
                return False, "part file is older than %d hours" % PART_MAX_HOURS
        except ValueError:
            return False, "part file has no readable collection time"
    sources = [s for s in part.get("sources") or [] if isinstance(s, dict)]
    if sources and all(s.get("status") == "failed" for s in sources):
        return False, "every source failed"
    if not part["items"]:
        return False, "collection returned nothing"
    return True, ""


def previous_items(previous, today):
    """{team: [raw items]} and {team: collected_at} from the file published before (version 2, or version 1)."""
    items, when = {t: [] for t in LIVE_TEAMS}, {t: None for t in LIVE_TEAMS}
    if not isinstance(previous, dict) or previous.get("schema") not in (SCHEMA, SCHEMA_V1):
        return items, when, None
    old_parts = previous.get("parts") if isinstance(previous.get("parts"), dict) else {}
    v1 = previous.get("schema") == SCHEMA_V1
    for team in LIVE_TEAMS:
        state = old_parts.get(team) if isinstance(old_parts.get(team), dict) else {}
        stamp = state.get("generated_at") if v1 else state.get("collected_at")
        when[team] = stamp if isinstance(stamp, str) and stamp else None
    if v1:                       # version 1 stamped the write time; the newest part time is the honest one
        generated = max([w for w in when.values() if w] or [None], key=lambda w: w or "")
    else:
        generated = previous.get("generated_at") if isinstance(previous.get("generated_at"), str) else None
    for ref, project in (previous.get("projects") or {}).items():
        project = project if isinstance(project, dict) else {}
        listed = list(project.get("signals") or []) if v1 else [i for t in TIERS for i in project.get(t) or []]
        for raw in listed:
            if not isinstance(raw, dict):
                continue
            if raw.get("obtained") == "reviewed" or str(raw.get("basis") or "").startswith(REVIEWED):
                continue                                    # the committed reviewed file supplies these every run
            more = [raw] + [dict(raw, **s) for s in raw.get("sources") or [] if isinstance(s, dict)]
            for one in more:
                team = one.get("source") if one.get("source") in LIVE_TEAMS else (
                    "official" if one.get("family") == "official" else "trade" if one.get("family") == "trade" else "index")
                one = {k: v for k, v in one.items() if k not in ("sources", "cluster", "also_projects")}
                one.setdefault("collected_at", when[team] or generated)
                items[team].append(dict(one, repd_ref=str(ref), source=team))
    return items, when, generated


def combine(rows, aliases=None, parts=None, planning=None, previous=None, now_iso=None, use_module=True,
            exclusions=None, standings=None):
    """rows: the top-200 list. parts: {team: part dict, or "absent" / "missing" / "unreadable"}.
    Returns the combined file (version 2) as a dict. Nothing here touches the network or the disk."""
    aliases = (aliases or {}).get("projects", {}) if isinstance(aliases, dict) else {}
    exclusions = (exclusions or {}).get("projects", {}) if isinstance(exclusions, dict) else {}
    standings = (standings or {}).get("projects", {}) if isinstance(standings, dict) else {}
    standing = lambda ref: alias_standing(aliases.get(ref), standings.get(ref))  # noqa: E731
    parts = parts or {}
    run_at = now_iso or now_utc()
    today = dt.date.fromisoformat(run_at[:10])
    plan_data = planning if isinstance(planning, dict) else None
    planning = planning_table(planning)
    rows_by_ref = {str(r["repd_ref"]): r for r in rows}
    refs = list(rows_by_ref)
    gathered = {ref: [] for ref in refs}
    dropped = {"outside the 200": 0, "no title or link": 0, "source not allowed": 0, "exclusion rule": 0,
               "not an object": 0, "link on several projects": 0, "title gate": 0}
    downgraded = {"alias without recorded evidence": 0, "weak alias without a second term": 0, "title gate": 0,
                  "shared link that names no project": 0}
    gate_cache = {}

    def gate_project(ref):
        if ref not in gate_cache:
            gate_cache[ref] = GATE.project_of(rows_by_ref[ref], aliases.get(ref), exclusions.get(ref))
        return gate_cache[ref]
    sources, part_state = [], {}
    old_items, old_when, old_generated = previous_items(previous, today)

    def rules_for(ref):
        entry = aliases.get(ref) or {}
        rules = dict(exclusions.get(ref) or {})
        legacy = [e for e in entry.get("exclude") or [] if isinstance(e, str) and e.strip()]
        if legacy:
            rules["exclude"] = list(rules.get("exclude") or []) + legacy
        return rules

    def take(raw, team, collected_at):
        item, reason = clean_item(raw, team, today, collected_at)
        if item is None:
            dropped[reason] += 1
            return False
        ref = item["repd_ref"]
        if ref not in rows_by_ref:
            dropped["outside the 200"] += 1
            return False
        if exclusion_reason(item, rules_for(ref)):
            dropped["exclusion rule"] += 1
            return False
        entry = aliases.get(ref) or {}
        if not is_reviewed(item) and "reference" not in item["basis"]:
            verdict, why = GATE.judge(ref, item["title"], project=gate_project(ref), official=item["family"] == "official")
            if verdict == "drop":                          # also purges a carried-forward copy of a match now rejected
                dropped["title gate"] += 1
                return False
            if verdict == "possible" and item["confidence"] == "confirmed":
                item["confidence"] = "possible"
                item["basis"] = D.clean_text("%s; possible only: %s" % (item["basis"], why), 240)
                downgraded["title gate"] += 1
        if item["confidence"] == "confirmed" and aliases:
            if standing(ref) != "confirmed":
                item["confidence"] = "possible"
                downgraded["alias without recorded evidence"] += 1
            elif not is_reviewed(item) and "reference" not in item["basis"] and \
                    not second_term_ok(item["title"], entry, rows_by_ref[ref], (exclusions.get(ref) or {}).get("weak_alias")):
                item["confidence"] = "possible"
                downgraded["weak alias without a second term"] += 1
        gathered[ref].append(item)
        return True

    for team in TEAMS:
        part = parts.get(team, "absent")
        if part == "absent" and not (team in LIVE_TEAMS and old_items[team]):
            part_state[team] = {"status": "absent", "collected_at": None, "items": 0, "note": "not part of this run"}
            continue
        good, why = _part_good(dict(part, _run_at=run_at) if isinstance(part, dict) and team != REVIEWED else part)
        if isinstance(part, dict):
            for source in part.get("sources") or []:
                if isinstance(source, dict):
                    sources.append({"team": team, "id": str(source.get("id") or ""), "url": str(source.get("url") or ""),
                                    "status": source.get("status") if source.get("status") in ("ok", "partial", "failed") else "failed",
                                    "requests": source.get("requests") or 0, "failures": source.get("failures") or 0,
                                    "items": source.get("items") or 0,
                                    "error": re.sub(r"\S+@\S+", "(address removed)", D.clean_text(str(source.get("error") or ""), 300))})
        if team == REVIEWED:
            if good:
                stamp = part.get("generated_at") if isinstance(part.get("generated_at"), str) else None
                kept = sum(1 for raw in part["items"] if take(raw, team, stamp))
                part_state[team] = {"status": "ok", "collected_at": stamp, "items": kept,
                                    "note": "committed file, reviewed by hand"}
            else:
                part_state[team] = {"status": "failed", "collected_at": None, "items": 0, "note": why}
            continue
        kept = 0
        if good:                                            # this run's items first: on a shared link they win
            stamp = part.get("generated_at") if isinstance(part.get("generated_at"), str) else run_at
            kept = sum(1 for raw in part["items"] if take(dict(raw, collected_at=None, source=team), team, stamp))
        kept_old = sum(1 for raw in old_items[team] if take(raw, team, old_when[team]))
        if good:
            part_state[team] = {"status": "ok", "collected_at": stamp, "items": kept, "note": ""}
        elif kept_old:
            part_state[team] = {"status": "stale", "collected_at": old_when[team], "items": kept_old,
                                "note": why + "; items published before are kept with their own dates"}
        else:
            part_state[team] = {"status": "failed", "collected_at": None, "items": 0,
                                "note": why + "; nothing published before to keep"}

    # one link, one project, unless the title names each or a reviewer tied it to each
    homes = {}
    for ref in refs:
        gathered[ref] = dedupe(gathered[ref])
        for item in gathered[ref]:
            homes.setdefault(link_key(item["link"]), []).append(ref)
    for link, on in homes.items():
        if len(on) < 2:
            continue
        found = {ref: next(i for i in gathered[ref] if link_key(i["link"]) == link) for ref in on}
        named = {ref: names_project(found[ref]["title"], aliases.get(ref) or {}, rows_by_ref[ref]) for ref in on}
        keep = [ref for ref in on if named[ref] or is_reviewed(found[ref])]
        if not keep:
            keep = [min(on, key=lambda ref: (found[ref]["confidence"] != "confirmed",
                                              standing(ref) != "confirmed",
                                              rows_by_ref[ref].get("rank") or 10 ** 6))]
        for ref in on:
            if ref not in keep:
                gathered[ref] = [i for i in gathered[ref] if link_key(i["link"]) != link]
                dropped["link on several projects"] += 1
            elif len(keep) > 1:
                found[ref]["also_projects"] = sorted((r for r in keep if r != ref), key=lambda r: (len(r), r))
                if not named[ref] and not PLURAL_RE.search(found[ref]["title"]) and found[ref]["confidence"] == "confirmed":
                    found[ref]["confidence"] = "possible"   # tied by hand to several projects, the title names none
                    downgraded["shared link that names no project"] += 1

    # planning files
    plan_origin = {}
    files = {}
    for row in rows:
        ref = str(row["repd_ref"])
        entry = aliases.get(ref) or {}
        file, origin = clean_planning_file(planning.get(ref)), "planning"
        if not file and use_module:
            file, origin = module_planning_file(dict(row, planning_file=entry.get("planning_file"))), "module"
        if not file:
            file, origin = clean_planning_file(entry.get("planning_file")), "aliases"
        if not file:
            file, origin = clean_planning_file(last_resort(row)), "last_resort"
        files[ref], plan_origin[ref] = file, origin
    from_file = sum(1 for o in plan_origin.values() if o == "planning")
    if from_file:
        stamp = plan_data.get("generated_at") if plan_data and isinstance(plan_data.get("generated_at"), str) else run_at
        part_state["planning"] = {"status": "ok", "collected_at": stamp, "items": sum(1 for f in files.values() if f),
                                  "note": "" if from_file == len(refs) else "%d from the planning run, the rest from the alias table" % from_file}
    else:
        part_state["planning"] = {"status": "absent", "collected_at": None, "items": sum(1 for f in files.values() if f),
                                  "note": "no planning run; links built from the alias table and the REPD row"}

    projects = {}
    counts = {"projects": len(refs), "headline": {"label": HEADLINE, "value": 0},
              "by_tier": {t: 0 for t in PROJECT_TIERS}, "possible_only": 0,
              "with_recent_news": 0, "with_official": 0, "with_archive": 0, "with_possible_recent_news": 0,
              "items": {t: 0 for t in TIERS},
              "planning_file": {"verified_direct": 0, "unverified_direct": 0, "register_search": 0, "register_finder": 0}}
    label_count = dict(zip(PLANNING_LABELS, ("verified_direct", "unverified_direct", "register_search", "register_finder")))
    for row in rows:
        ref = str(row["repd_ref"])
        entry = aliases.get(ref) or {}
        lists = {}
        for tier in TIERS:
            shown = cluster(ref, [i for i in gathered[ref] if i["tier"] == tier])[:MAX_PER_TIER]
            lists[tier] = [{k: v for k, v in i.items() if k != "repd_ref"} for i in shown]
            counts["items"][tier] += len(lists[tier])
        confirmed = {t: any(i["confidence"] == "confirmed" for i in lists[t]) for t in TIERS}
        any_item = any(lists[t] for t in TIERS)
        file = files[ref]
        if confirmed["recent_news"]:
            tier = "recent_news"
        elif confirmed["official"]:
            tier = "official"
        elif any_item:
            tier = "archive_only"
            counts["possible_only"] += not confirmed["archive"]
        elif file:
            tier = "planning_file_only"
        else:
            tier = "nothing"
        counts["by_tier"][tier] += 1
        counts["with_recent_news"] += confirmed["recent_news"]
        counts["with_official"] += confirmed["official"]
        counts["with_archive"] += bool(lists["archive"])
        counts["with_possible_recent_news"] += bool(lists["recent_news"]) and not confirmed["recent_news"]
        if file:
            counts["planning_file"][label_count[file["label"]]] += 1
        names = entry.get("aliases") or []
        projects[ref] = {"repd_ref": ref, "rank": row.get("rank"), "site_name": (row.get("site_name") or "").strip(),
                         "alias": names[0] if names and isinstance(names[0], str) else (row.get("site_name") or "").strip(),
                         "alias_standing": standing(ref), "tier": tier,
                         "recent_news": lists["recent_news"], "official": lists["official"], "archive": lists["archive"],
                         "planning_file": file}
    counts["headline"]["value"] = counts["by_tier"]["recent_news"]
    collected = [part_state[t]["collected_at"] for t in LIVE_TEAMS if part_state[t]["status"] == "ok" and part_state[t]["collected_at"]]
    generated = max(collected) if collected else old_generated
    stale = any(part_state[t]["status"] in ("stale", "failed") for t in LIVE_TEAMS)
    return {"schema": SCHEMA, "generated_at": generated, "run_at": run_at, "stale": stale, "scope": SCOPE,
            "recent_days": RECENT_DAYS, "parts": {name: part_state[name] for name in PART_NAMES}, "counts": counts,
            "dropped": dropped, "downgraded": downgraded, "sources": sources, "projects": projects}


# ---------------------------------------------------------------- the writer's checks (fail closed)

def schema_errors(result, expected_refs=None):
    """Every way the file breaks the version 2 contract (an empty list means it may be published)."""
    errors = []

    def need(ok, message):
        if not ok and len(errors) < 40:
            errors.append(message)

    if not isinstance(result, dict):
        return ["not an object"]
    need(result.get("schema") == SCHEMA, "schema is not %s" % SCHEMA)
    stamp = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$")
    need(result.get("generated_at") is None or (isinstance(result.get("generated_at"), str) and stamp.match(result["generated_at"])),
         "generated_at is not a timestamp or null")
    need(isinstance(result.get("run_at"), str) and stamp.match(result.get("run_at") or ""), "run_at is not a timestamp")
    parts = result.get("parts") if isinstance(result.get("parts"), dict) else {}
    for name in PART_NAMES:
        state = parts.get(name)
        need(isinstance(state, dict) and state.get("status") in ("ok", "stale", "failed", "absent")
             and "collected_at" in state, "parts.%s lacks status or collected_at" % name)
    live_ok = [parts[t]["collected_at"] for t in LIVE_TEAMS
               if isinstance(parts.get(t), dict) and parts[t].get("status") == "ok" and parts[t].get("collected_at")]
    if live_ok:
        need(result.get("generated_at") == max(live_ok), "generated_at is not the newest successful collection")
    projects = result.get("projects") if isinstance(result.get("projects"), dict) else {}
    counts = result.get("counts") if isinstance(result.get("counts"), dict) else {}
    by_tier = counts.get("by_tier") if isinstance(counts.get("by_tier"), dict) else {}
    need(set(by_tier) == set(PROJECT_TIERS), "counts.by_tier keys are wrong")
    need(sum(v for v in by_tier.values() if isinstance(v, int)) == len(projects) == counts.get("projects"),
         "counts.by_tier does not sum to the number of projects")
    need(isinstance(counts.get("headline"), dict) and counts["headline"].get("value") == by_tier.get("recent_news"),
         "headline is not the count of projects with recent verified news")
    if expected_refs is not None:
        need(set(projects) == {str(r) for r in expected_refs}, "the projects are not the expected set")
    need(by_tier.get("nothing") == 0, "%s project(s) have neither an item nor a planning file" % by_tier.get("nothing"))
    today = dt.date.fromisoformat(result["run_at"][:10]) if isinstance(result.get("run_at"), str) and stamp.match(result["run_at"]) else None
    for ref, project in projects.items():
        if not isinstance(project, dict):
            need(False, "%s is not an object" % ref)
            continue
        file = project.get("planning_file")
        need(isinstance(file, dict) and file.get("label") in PLANNING_LABELS and str(file.get("url") or "").startswith("https://"),
             "%s: planning_file missing or mislabelled" % ref)
        need(project.get("tier") in PROJECT_TIERS, "%s: tier" % ref)
        links = []
        for tier in TIERS:
            items = project.get(tier)
            if not isinstance(items, list):
                need(False, "%s: %s is not a list" % (ref, tier))
                continue
            keys = []
            for item in items:
                where = "%s %s" % (ref, tier)
                if not isinstance(item, dict):
                    need(False, where + ": item is not an object")
                    continue
                links.append(item.get("link"))
                need(isinstance(item.get("title"), str) and item["title"] and str(item.get("link") or "").startswith("https://"),
                     where + ": title or link")
                need(item.get("tier") == tier, where + ": item tier differs from its list")
                need(item.get("confidence") in ("confirmed", "possible"), where + ": confidence")
                need(item.get("obtained") in ("fetched", "reviewed"), where + ": obtained")
                need(item.get("event") is None or item.get("event") in EVENTS, where + ": event")
                need(isinstance(item.get("collected_at"), str) and item["collected_at"], where + ": collected_at")
                date = item.get("date")
                if date is None:
                    need(item.get("freshness") == "undated" and tier == "archive"
                         and (item.get("year") is None or isinstance(item.get("year"), int)),
                         where + ": undated item outside the archive or mislabelled")
                elif today is not None:
                    need(parse_date(date, today) == date, where + ": date %r is not a past calendar date" % (date,))
                    if parse_date(date, today) == date:
                        need(item.get("freshness") == freshness(date, today) and item.get("year") == int(date[:4]),
                             where + ": freshness or year does not follow from the date")
                        need(tier != "recent_news" or item.get("freshness") == "recent", where + ": old item in recent_news")
                if isinstance(item.get("link"), str) and item.get("confidence") in ("confirmed", "possible") and item.get("family") in FAMILIES:
                    keys.append(order_key(item))
            need(keys == sorted(keys), "%s %s: not in order (newest dated first)" % (ref, tier))
        need(len(links) == len(set(links)), "%s: a link appears twice" % ref)
    return errors


def with_any_item(result):
    return sum(1 for p in (result.get("projects") or {}).values() if any(p.get(t) for t in TIERS))


def publication_check(result, previous, expected_refs=None):
    """Reasons not to publish (empty: publish). Schema first, then a sharp drop against the published version 2 file."""
    reasons = ["schema: " + e for e in schema_errors(result, expected_refs)]
    if isinstance(previous, dict) and previous.get("schema") == SCHEMA and not reasons:
        pairs = (("projects with any item", with_any_item(previous), with_any_item(result)),
                 ("items", sum((previous.get("counts") or {}).get("items", {}).values() or [0]), sum(result["counts"]["items"].values())))
        for name, before, after in pairs:
            if before >= 6 and after < before * (1 - DROP_LIMIT):
                reasons.append("sharp drop: %s fell from %d to %d (more than a third)" % (name, before, after))
    return reasons


# ---------------------------------------------------------------- ground truth (the members' findings)

def load_truth(path):
    data, state = read_json(path)
    if state != "ok" or not isinstance(data, dict) or data.get("schema") != TRUTH_SCHEMA:
        return {}
    return data.get("projects") or {}


def truth_report(truth, signals_by_ref, label="all parts"):
    """Markdown: of the projects the members marked "found", how many the automated run finds, by family."""
    found = {ref: t for ref, t in truth.items() if t.get("status") == "found"}
    if not truth:
        return "### Ground truth\n\nNo ground-truth file.\n"
    hit = [ref for ref in found if signals_by_ref.get(ref)]
    lines = ["### Compared with the members' ground truth (%s)\n" % label,
             "Ground truth covers %d projects: %d found, %d uncertain, %d none, %d not searched." % (
                 len(truth), len(found), sum(1 for t in truth.values() if t.get("status") == "uncertain"),
                 sum(1 for t in truth.values() if t.get("status") == "none"),
                 sum(1 for t in truth.values() if t.get("status") not in ("found", "uncertain", "none"))),
             "Of the %d found by a member, the automated run has at least one signal for **%d**.\n" % (len(found), len(hit)),
             "| family in ground truth | projects | automated: any signal | automated: same family | same link |",
             "|---|---|---|---|---|"]
    for family in FAMILIES:
        refs = [ref for ref, t in found.items() if family in (t.get("families") or [])]
        any_signal = sum(1 for ref in refs if signals_by_ref.get(ref))
        same = sum(1 for ref in refs if any(s["family"] == family for s in signals_by_ref.get(ref) or []))
        links = sum(1 for ref in refs
                    if {D.canonical_link(l) for l in found[ref].get("links") or []} & {s["link"] for s in signals_by_ref.get(ref) or []})
        lines.append("| %s | %d | %d | %d | %d |" % (family, len(refs), any_signal, same, links))
    extra = [ref for ref, t in truth.items() if t.get("status") != "found" and signals_by_ref.get(ref)]
    lines.append("\nAutomated signals for projects a member did not mark found: %d%s." % (
        len(extra), (" (REPD " + ", ".join(sorted(extra, key=lambda r: (len(r), r))[:30]) + ")") if extra else ""))
    missed = sorted((ref for ref in found if not signals_by_ref.get(ref)), key=lambda r: (len(r), r))
    if missed:
        lines.append("Found by a member, not by the run: REPD " + ", ".join(missed[:80]) + ".")
    return "\n".join(lines) + "\n"


def _cell(text):
    return str(text if text is not None else "").replace("|", "/").replace("[", "(").replace("]", ")")


def summary(result, truth=None, reasons=None, published=True):
    c = result["counts"]
    t = c["by_tier"]
    lines = ["## Project signals: combined file (version 2)\n",
             "### Publication\n",
             ("**Published.**" if published else "**Not published: the file on the data branch stays as it was.**")
             + " Last successful live collection (generated_at): %s. This run: %s.%s\n" % (
                 result["generated_at"] or "never", result["run_at"],
                 " **Stale: at least one live part did not collect in this run.**" if result["stale"] else "")]
    for reason in reasons or []:
        lines.append("- refused because: %s" % reason)
    lines += ["\n### Counts by tier (%s; each of the %d projects is counted once)\n" % (result["scope"], c["projects"]),
              "**%s: %d of %d** (a publisher's item dated within %d days of this run, confirmed match).\n" % (
                  HEADLINE.capitalize(), c["headline"]["value"], c["projects"], result["recent_days"]),
              "| tier | projects |\n|---|---|",
              "| with recent news | %d |" % t["recent_news"],
              "| with an official item (and no recent news) | %d |" % t["official"],
              "| with archive only (older or undated items, shown with their year) | %d |" % t["archive_only"],
              "| with planning file only | %d |" % t["planning_file_only"],
              "| with nothing (zero) | %d |" % t["nothing"],
              "\nNot exclusive: %d projects have a confirmed official item, %d have an archive item, %d have only a possible "
              "match in recent news. Of the archive-only projects %d have possible matches only (shown as possible, never "
              "as fact)." % (c["with_official"], c["with_archive"], c["with_possible_recent_news"], c["possible_only"]),
              "Items listed: recent news %d, official %d, archive %d." % (c["items"]["recent_news"], c["items"]["official"], c["items"]["archive"]),
              "Planning files: %d verified direct links, %d unverified direct links, %d register searches, %d register "
              "finders." % tuple(c["planning_file"][k] for k in ("verified_direct", "unverified_direct", "register_search", "register_finder")),
              "\n### Parts\n", "| part | status | collected_at | items | note |\n|---|---|---|---|---|"]
    for name, state in result["parts"].items():
        lines.append("| %s | %s | %s | %d | %s |" % (name, state["status"], state["collected_at"] or "", state["items"], _cell(state["note"])))
    lines.append("\nDropped: %s. Downgraded to possible: %s.\n" % (
        ", ".join("%s %d" % kv for kv in result["dropped"].items() if kv[1]) or "none",
        ", ".join("%s %d" % kv for kv in result["downgraded"].items() if kv[1]) or "none"))
    lines.append("| team | source | status | requests | failures | items | error |\n|---|---|---|---|---|---|---|")
    for s in result["sources"]:
        lines.append("| %s | %s | %s | %s | %s | %s | %s |" % (s["team"], s["id"], s["status"], s["requests"], s["failures"],
                                                                s["items"], _cell(s["error"])))
    if truth is not None:
        lines.append("\n" + truth_report(truth, {ref: [i for tier in TIERS for i in p[tier]] for ref, p in result["projects"].items()}))
    lines.append("\n### The %d\n\n| rank | REPD | alias | tier | shown | date | publisher | title or reference |\n|---|---|---|---|---|---|---|---|" % c["projects"])
    for p in sorted(result["projects"].values(), key=lambda p: p["rank"] or 0):
        shown = next((p[tier][0] for tier in TIERS if p[tier] and p[tier][0]["confidence"] == "confirmed"), None) or \
            next((p[tier][0] for tier in TIERS if p[tier]), None)
        if shown:
            lines.append("| %s | %s | %s | %s | %s, %s%s%s | %s | %s | [%s](%s) |" % (
                p["rank"], p["repd_ref"], _cell(p["alias"]), p["tier"], shown["tier"], shown["obtained"],
                "" if shown["confidence"] == "confirmed" else ", possible match",
                (", " + shown["event"]) if shown["event"] else "", shown["date"] or "undated", _cell(shown["publisher"]),
                _cell(shown["title"]), shown["link"]))
        else:
            f = p["planning_file"] or {}
            lines.append("| %s | %s | %s | %s | %s | | %s | [%s](%s) |" % (
                p["rank"], p["repd_ref"], _cell(p["alias"]), p["tier"], f.get("label") or "none", _cell(f.get("authority")),
                _cell(f.get("reference") or f.get("kind") or "none"), f.get("url") or ""))
    return "\n".join(lines) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    for team in TEAMS:
        ap.add_argument("--" + team, default=None, help="part file of team %s (optional)" % team)
    ap.set_defaults(reviewed=str(HERE / "reviewed_signals.json"))
    ap.add_argument("--top200", default=str(HERE / "top200_solar.json"))
    ap.add_argument("--aliases", default=str(HERE / "aliases.json"))
    ap.add_argument("--exclusions", default=str(HERE / "exclusions.json"))
    ap.add_argument("--standings", default=str(HERE / "alias_standings.json"))
    ap.add_argument("--planning", default=None, help="optional {repd_ref: planning_file} file")
    ap.add_argument("--previous", default=None, help="the file published last time; its items are kept")
    ap.add_argument("--truth", default=str(HERE / "index_ground_truth.json"))
    ap.add_argument("--out", default="dist/project_signals.json")
    ap.add_argument("--summary", default=None, help="write a Markdown summary here")
    ap.add_argument("--now", default=None)
    ap.add_argument("--force", action="store_true", help="write even after a sharp drop (never after a schema failure)")
    args = ap.parse_args(argv)

    rows = json.loads(Path(args.top200).read_text(encoding="utf-8"))
    aliases, _ = read_json(args.aliases)
    exclusions, _ = read_json(args.exclusions)
    parts = {}
    for team in TEAMS:
        data, state = read_json(getattr(args, team))
        parts[team] = data if state == "ok" else state
    planning, _ = read_json(args.planning)
    previous, _ = read_json(args.previous)
    standings, _ = read_json(args.standings)
    result = combine(rows, aliases, parts, planning, previous, args.now, exclusions=exclusions, standings=standings)
    reasons = publication_check(result, previous, [r["repd_ref"] for r in rows])
    refuse = [r for r in reasons if r.startswith("schema") or not args.force]
    out = Path(args.out)
    same = lambda d: {k: v for k, v in d.items() if k != "run_at"}  # noqa: E731
    unchanged = not refuse and isinstance(previous, dict) and previous.get("schema") == SCHEMA and same(previous) == same(result)
    if unchanged and out.exists():
        reasons = ["nothing changed since the published file (only the run time differs): not rewritten"]
    elif not refuse:
        out.parent.mkdir(parents=True, exist_ok=True)
        tmp = out.with_suffix(".tmp")
        tmp.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        tmp.replace(out)
    if args.summary:
        truth = load_truth(args.truth) if args.truth and Path(args.truth).exists() else None
        Path(args.summary).write_text(summary(result, truth, reasons, published=not refuse), encoding="utf-8")
    print(json.dumps({"out": str(out) if not refuse else None, "generated_at": result["generated_at"], "stale": result["stale"],
                      "by_tier": result["counts"]["by_tier"], "headline": result["counts"]["headline"],
                      "parts": {t: s["status"] for t, s in result["parts"].items()}}))
    if refuse:
        for reason in refuse:
            print("NOT PUBLISHED: %s" % reason, file=sys.stderr)
        return 3
    return 0


if __name__ == "__main__":
    sys.exit(main())
