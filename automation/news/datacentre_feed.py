#!/usr/bin/env python3
"""Data-centre capex and politics headlines for Pipeline News (owner line 11, 14 Nov 2026).

Reads a short fixed list of public RSS/Atom feeds, keeps headlines about data centres that also talk about
money (lane "capex") or policy (lane "politics"), and writes dist/datacentre_news.json.

  python3 automation/news/datacentre_feed.py --out dist/datacentre_news.json

Rules
- Headlines and links only. The feed summary is read in memory to decide relevance and is never written out.
  No article page is ever requested.
- A feed that fails (network, HTTP, bad XML) is recorded in "feeds" and skipped; the run carries on. The exit
  code is non-zero only when every feed failed AND there is no earlier output to keep.
- Items from the previous output are kept (merged by canonical link), so a rolling feed does not make a story
  vanish; the file holds the newest MAX_ITEMS, ordered by date (newest first) then link.
- A data-centre site is attached only when the HEADLINE names a site or operator from the released UK
  data-centre register (the 226-record GridAtlas baseline, read through the convergence output). REPD context
  is the straight-line count and stated MW of live REPD projects within 10 km of that site, from
  dist/convergence/<release>/datacentre_proximity.json. It is screening context, never a connection claim.
"""
from __future__ import annotations

import argparse
import datetime as dt
import email.utils
import hashlib
import html
import json
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

SCHEMA = "globalgrid2050.news.datacentre-capex-politics.v1"
MAX_ITEMS = 200
MAX_BYTES = 2_000_000
TIMEOUT_S = 20
USER_AGENT = "GlobalGrid2050-DatacentreNews/1.0 (+https://globalgrid2050.com)"
REPD_RADIUS_KM = "10"
SITES_PER_ITEM = 5

# (url, source label, why it is on the list). Fixed and short on purpose.
FEEDS = [
    ("https://feeds.bbci.co.uk/news/technology/rss.xml", "BBC News",
     "BBC technology section: hyperscaler and AI infrastructure announcements; BBC RSS is already used by "
     "pipelinenews discovery/bbc_rss.py"),
    ("https://feeds.bbci.co.uk/news/business/rss.xml", "BBC News",
     "BBC business section: investment and capex headlines; already in bbc_rss.py SECTIONS"),
    ("https://feeds.bbci.co.uk/news/politics/rss.xml", "BBC News",
     "BBC politics section: ministers, bills and planning decisions on data centres and AI growth zones"),
    ("https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", "BBC News",
     "BBC science and environment: energy, water and grid stories; already in bbc_rss.py SECTIONS"),
    ("https://www.gov.uk/government/organisations/department-for-science-innovation-and-technology.atom",
     "GOV.UK DSIT", "DSIT owns AI growth zones, compute strategy and data-centre critical national "
     "infrastructure; GOV.UK organisation Atom feed"),
    ("https://www.gov.uk/government/organisations/department-for-energy-security-and-net-zero.atom",
     "GOV.UK DESNZ", "DESNZ owns grid connections reform and energy prices for large users; GOV.UK "
     "organisation Atom feed (also used by the energy24 candidate, PR #65)"),
    ("https://www.gov.uk/search/news-and-communications.atom?keywords=data+centre", "GOV.UK search",
     "Every GOV.UK department's news mentioning data centres (planning, MHCLG, devolved statements); GOV.UK "
     "finder Atom feed"),
    ("https://bills.parliament.uk/rss/allbills.rss", "UK Parliament Bills",
     "All public bills: catches bills on planning, AI, cyber resilience or energy that name data centres"),
    ("https://www.datacenterdynamics.com/rss/", "DatacenterDynamics",
     "Trade press for data-centre builds and capex (same URL as the energy24 candidate, PR #65)"),
]

# Word lists. Each is matched case-insensitively on word boundaries against title + feed summary.
DATACENTRE_TERMS = {
    "data centre": r"data[\s-]?cent(?:re|er)s?",
    "hyperscale": r"hyperscal(?:e|er|ers)",
    "AI infrastructure": r"AI infrastructure",
    "AI growth zone": r"AI growth zones?",
    "compute": r"compute|supercomputers?",
}
CAPEX_TERMS = {
    "investment": r"invest(?:s|ed|ing|ment|ments|or|ors)?",
    "capex": r"capex|capital expenditure|spend(?:s|ing)?",
    "billion": r"billions?|£\s?\d[\d.,]*\s?bn|\$\s?\d[\d.,]*\s?bn|\d[\d.,]*\s?bn",
    "million": r"millions?|£\s?\d[\d.,]*\s?m|\$\s?\d[\d.,]*\s?m",
    "funding": r"fund(?:s|ed|ing)?",
    "build": r"build(?:s|ing)?|construction",
    "expansion": r"expan(?:d|ds|ded|ding|sion)",
}
POLITICS_TERMS = {
    "planning": r"planning|planners?|council",
    "grid connection": r"grid connections?|connection queue|National Grid|NESO|Ofgem",
    "minister": r"ministers?|secretary of state|government|MPs?",
    "bill": r"bills?|legislation|parliament",
    "consultation": r"consultations?",
    "growth zone": r"growth zones?",
    "energy price": r"energy (?:prices?|costs?|bills?)|electricity (?:prices?|costs?)",
    "water": r"water",
}


def _compile(terms):
    return {k: re.compile(r"(?<![\w])(?:" + v + r")(?![\w])", re.I) for k, v in terms.items()}


DC_RE, CAPEX_RE, POLITICS_RE = _compile(DATACENTRE_TERMS), _compile(CAPEX_TERMS), _compile(POLITICS_TERMS)
TAG_RE = re.compile(r"<[^>]+>")
TRACKING_PARAMS = re.compile(r"^(utm_|at_|ito$|ns_|ocid$|cmpid$|fbclid$|gclid$)", re.I)
ATOM = "{http://www.w3.org/2005/Atom}"


def clean_text(value, limit):
    text = html.unescape(TAG_RE.sub(" ", value or ""))
    return " ".join(text.split())[:limit]


def canonical_link(value):
    """https only, host lower-cased, fragment and tracking parameters removed. None if unusable."""
    u = urllib.parse.urlsplit((value or "").strip())
    if u.scheme not in ("https", "http") or not u.hostname or u.username or u.password:
        return None
    query = [(k, v) for k, v in urllib.parse.parse_qsl(u.query, keep_blank_values=True)
             if not TRACKING_PARAMS.match(k)]
    return urllib.parse.urlunsplit(("https", u.hostname.lower(), u.path or "/",
                                    urllib.parse.urlencode(query), ""))


def parse_date(value):
    value = (value or "").strip()
    if not value:
        return None
    try:
        parsed = email.utils.parsedate_to_datetime(value)
    except (TypeError, ValueError, IndexError, OverflowError):
        try:
            parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_calendar_day(value):
    """A publisher's written calendar day, NOT an inferred UTC instant.

    A date-only or timezone-free timestamp may be shown as a publisher-local
    calendar day but may never authorise same-run freshness without a separately
    observed timezone-aware publication instant. `parse_date` remains the
    strict UTC feed timestamp parser and continues rejecting naive input.
    """
    from signals import dates as calendar_dates
    return calendar_dates.day(value)


def parse_feed(body):
    """Return [(title, link, date, summary)] from RSS 2.0 or Atom bytes. Raises ValueError on bad input."""
    if len(body) > MAX_BYTES:
        raise ValueError("feed exceeds %d bytes" % MAX_BYTES)
    upper = body[:4096].upper()
    if b"<!DOCTYPE" in upper or b"<!ENTITY" in body.upper():
        raise ValueError("DTD or entity declaration rejected")
    try:
        root = ET.fromstring(body)
    except ET.ParseError as error:
        raise ValueError("not XML: %s" % error) from None
    out = []
    if root.tag == "rss" or root.find("channel") is not None:
        for item in root.iter("item"):
            out.append((item.findtext("title"), item.findtext("link"),
                        item.findtext("pubDate") or item.findtext("{http://purl.org/dc/elements/1.1/}date"),
                        item.findtext("description")))
    elif root.tag == ATOM + "feed":
        for entry in root.iter(ATOM + "entry"):
            link = None
            for el in entry.findall(ATOM + "link"):
                if el.get("rel", "alternate") == "alternate":
                    link = el.get("href")
                    break
            out.append((entry.findtext(ATOM + "title"), link,
                        entry.findtext(ATOM + "published") or entry.findtext(ATOM + "updated"),
                        entry.findtext(ATOM + "summary") or entry.findtext(ATOM + "content")))
    else:
        raise ValueError("neither RSS nor Atom: root <%s>" % root.tag)
    return out


# Paid-for or advertorial entries are not news; a headline that says so is dropped.
SPONSORED_RE = re.compile(r"^\s*(?:sponsored|advertorial|partner content|promoted|paid post)\b|\bsponsored (?:content|post|by)\b", re.I)
# Capex terms that describe committed build spend, as opposed to funds, rounds and financing.
BUILD_TERMS = {"build", "expansion", "capex"}


def capex_basis(terms):
    """"build" when the headline speaks of building, expanding or capex; otherwise "financing" (funds,
    investment rounds, amounts), which is money raised or pledged and not verified project spend."""
    if not terms:
        return None
    return "build" if BUILD_TERMS & set(terms) else "financing"


def matches(regexes, text):
    return sorted(k for k, rx in regexes.items() if rx.search(text))


def classify(title, summary, register_named=False):
    """(datacentre terms, lanes, lane terms) or None when the headline is out of scope.

    register_named: the headline names a register site, or a data-centre operator from the register; that
    counts as the data-centre term "register site"."""
    text = title + " " + summary
    dc = matches(DC_RE, text) + (["register site"] if register_named else [])
    if not dc:
        return None
    capex, politics = matches(CAPEX_RE, text), matches(POLITICS_RE, text)
    lanes = (["capex"] if capex else []) + (["politics"] if politics else [])
    if not lanes:
        return None
    return dc, lanes, {"capex": capex, "politics": politics}


# ---------------------------------------------------------------- data-centre register join

GENERIC_NAMES = {"unnamed data centre", "data centre", "datacentre", "data center"}
OPERATOR_ALIASES = {"amazon web services": ["AWS", "Amazon"]}
MIN_NAME_LEN = 5
# Register operators whose main business is not data centres. Naming one of them attaches its register sites
# but does not by itself make a headline a data-centre story (a bank or a software launch is not one).
GENERAL_OPERATORS = {"microsoft", "amazon web services", "aws", "amazon", "google", "meta", "santander",
                     "morgan stanley", "goldman sachs", "nationwide building society", "vodafone", "verizon",
                     "telefonica", "experian", "nyse euronext", "tata communications", "lumen technologies", "scc",
                     "openai", "stargate uk"}


def _alternatives(record):
    """Yield (phrase, kind) pairs a headline may name for this register record."""
    name = (record.get("name") or "").strip()
    if len(name) >= MIN_NAME_LEN and name.lower() not in GENERIC_NAMES:
        yield name, "site_name"
    for alias in record.get("aliases") or []:
        alias = alias.strip() if isinstance(alias, str) else ""
        if len(alias) >= MIN_NAME_LEN and alias.lower() not in GENERIC_NAMES:
            yield alias, "site_name"
    for part in (record.get("operator") or "").split(";"):
        part = re.sub(r"\(.*?\)", "", part).strip()
        if part.lower().startswith("consortium"):
            continue
        if len(part) >= 3:
            yield part, "operator"
            for alias in OPERATOR_ALIASES.get(part.lower(), []):
                yield alias, "operator"


def repd_context(record):
    """Live REPD projects within REPD_RADIUS_KM of the site (all four technologies, four live status groups)."""
    if not record.get("proximity_reliable"):
        return None
    cells = (record.get("radii") or {}).get(REPD_RADIUS_KM)
    if not cells:
        return None
    out = {"radius_km": int(REPD_RADIUS_KM), "projects": 0, "mw_stated": 0.0, "projects_mw_unknown": 0,
           "mw_stated_by_technology": {}}
    for tech in sorted(cells):
        tech_mw = 0.0
        for status in sorted(cells[tech]):
            c = cells[tech][status]
            out["projects"] += c.get("count", 0)
            out["projects_mw_unknown"] += c.get("count_mw_unknown", 0)
            tech_mw += c.get("mw_stated", 0.0) or 0.0
        out["mw_stated_by_technology"][tech] = round(tech_mw, 2)
        out["mw_stated"] += tech_mw
    out["mw_stated"] = round(out["mw_stated"], 2)
    return out


class Register:
    def __init__(self, records):
        self.records = {r["id"]: r for r in records if r.get("id")}
        self.patterns = []
        for rid in sorted(self.records):
            for phrase, kind in _alternatives(self.records[rid]):
                flags = 0 if phrase.isupper() else re.I  # SCC, NTT, AWS: exact case only
                rx = re.compile(r"(?<![\w])" + re.escape(phrase) + r"(?![\w])", flags)
                self.patterns.append((rid, phrase, kind, rx))

    @classmethod
    def load(cls, proximity_path=None, geojson_path=None):
        """Records from the convergence proximity output, enriched with aliases from the register GeoJSON."""
        records = {}
        if proximity_path and Path(proximity_path).exists():
            for r in json.loads(Path(proximity_path).read_text(encoding="utf-8")).get("records", []):
                records[r["id"]] = dict(r)
        if geojson_path and Path(geojson_path).exists():
            for f in json.loads(Path(geojson_path).read_text(encoding="utf-8")).get("features", []):
                p = f.get("properties") or {}
                if not p.get("id"):
                    continue
                r = records.setdefault(p["id"], {"id": p["id"], "name": p.get("name"),
                                                 "operator": p.get("operator"), "status": p.get("status")})
                r["aliases"] = p.get("aliases") or []
        return cls(list(records.values()))

    def match(self, title):
        hits = {}
        for rid, phrase, kind, rx in self.patterns:
            if rx.search(title):
                prev = hits.get(rid)
                if prev is None or (kind == "site_name" and prev[1] == "operator"):
                    hits[rid] = (phrase, kind)
        ordered = sorted(hits.items(), key=lambda kv: (kv[1][1] != "site_name", kv[0]))
        sites, operator_sites = [], []
        for rid, (phrase, kind) in ordered:
            r = self.records[rid]
            if kind == "site_name" and len(sites) < SITES_PER_ITEM:
                # The headline names this site: the only association that carries REPD context.
                sites.append({"id": rid, "name": r.get("name"), "status": r.get("status"), "matched_on": kind,
                              "matched_text": phrase, "repd_nearby": repd_context(r)})
            elif kind != "site_name" and len(operator_sites) < SITES_PER_ITEM:
                # The headline names an operator only: its register sites are listed for review, with no
                # REPD context, because the story need not concern any one of them.
                operator_sites.append({"id": rid, "name": r.get("name"), "status": r.get("status"),
                                       "matched_on": kind, "matched_text": phrase})
        return sites, operator_sites, len(ordered)


# ---------------------------------------------------------------- collection

def fetch_url(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT,
                                               "Accept": "application/rss+xml, application/atom+xml, application/xml"})
    with urllib.request.urlopen(req, timeout=TIMEOUT_S) as response:  # noqa: S310 (fixed https list)
        return response.read(MAX_BYTES + 1)


def collect(feeds, fetch, register, now_iso):
    items, health = [], []
    for url, source, _why in feeds:
        try:
            body = fetch(url)
            entries = parse_feed(body)
        except Exception as error:  # one feed failing never stops the run
            health.append({"url": url, "source": source, "status": "failed",
                           "error": (type(error).__name__ + ": " + str(error))[:200]})
            continue
        kept = 0
        for title, link, date, summary in entries:
            title = clean_text(title, 300)
            link = canonical_link(link)
            if not title or not link:
                continue
            if SPONSORED_RE.search(title):
                continue
            sites, operator_sites, site_matches = register.match(title) if register else ([], [], 0)
            named = bool(sites) or any(s["matched_text"].lower() not in GENERAL_OPERATORS for s in operator_sites)
            verdict = classify(title, clean_text(summary, 2000), named)
            if verdict is None:
                continue
            dc_terms, lanes, lane_terms = verdict
            items.append({"title": title, "link": link, "source": source, "date": parse_date(date),
                          "first_seen": now_iso, "lanes": lanes,
                          "matched_terms": {"datacentre": dc_terms, **lane_terms},
                          "capex_basis": capex_basis(lane_terms["capex"]), "pinned": False,
                          "sites": sites, "operator_sites": operator_sites, "site_matches": site_matches})
            kept += 1
        health.append({"url": url, "source": source, "status": "ok", "entries": len(entries), "kept": kept,
                       "sha256": hashlib.sha256(body).hexdigest()})
    return items, health


def sort_key(item):
    """Dated items newest first, then undated items by first_seen; link breaks ties (sorted in reverse)."""
    return (item.get("date") is not None, item.get("date") or item.get("first_seen") or "", item["link"])


def normalise(item):
    """Bring an item written by an earlier run to the current shape, or None when it is no longer kept."""
    if SPONSORED_RE.search(item.get("title", "")):
        return None
    item = dict(item)
    sites = item.get("sites") or []
    moved = [{k: v for k, v in s.items() if k != "repd_nearby"} for s in sites if s.get("matched_on") != "site_name"]
    item["sites"] = [s for s in sites if s.get("matched_on") == "site_name"]
    item["operator_sites"] = (item.get("operator_sites") or []) + moved
    pinned = bool((item.get("matched_terms") or {}).get("pinned"))
    item.setdefault("pinned", pinned)
    item.setdefault("capex_basis", None if pinned else capex_basis((item.get("matched_terms") or {}).get("capex")))
    return item


def merge(previous, incoming, cap=MAX_ITEMS):
    """Deduplicate by link. A fresh copy replaces an old one but keeps the earliest first_seen."""
    by_link = {}
    for item in [n for n in map(normalise, list(previous) + list(incoming)) if n is not None]:
        old = by_link.get(item["link"])
        if old is not None:
            item = dict(item, first_seen=min(old.get("first_seen") or item["first_seen"], item["first_seen"]))
        by_link[item["link"]] = item
    return sorted(by_link.values(), key=sort_key, reverse=True)[:cap]


def build(previous, items, health, now_iso, cap=MAX_ITEMS):
    merged = merge(previous.get("items", []), items, cap)
    ok = sum(h["status"] == "ok" for h in health)
    return {
        "schema": SCHEMA,
        "generated_at": now_iso,
        "status": "ok" if ok == len(health) else ("partial" if ok else "failed"),
        "counts": {"items": len(merged),
                   "capex": sum("capex" in i["lanes"] for i in merged),
                   "politics": sum("politics" in i["lanes"] for i in merged),
                   "with_register_site": sum(bool(i["sites"]) for i in merged),
                   "feeds_ok": ok, "feeds_failed": len(health) - ok},
        "limits": {"max_items": cap, "sites_per_item": SITES_PER_ITEM, "repd_radius_km": int(REPD_RADIUS_KM)},
        "scope": ("Headlines and links from public RSS/Atom feeds only; no article text is stored or republished. "
                  "Kept when the headline or feed summary names data centres and either money (capex) or policy "
                  "(politics)."),
        "caveats": [
            "sites: only register sites the headline names. operator_sites: register sites of an operator the "
            "headline names, listed for review only and not evidence that the story concerns them. "
            "capex_basis 'financing' means funds, rounds or amounts, not verified project spend. "
            "pinned items were placed by the owner and are not ranked as recent news. Sponsored entries are dropped.",
            "repd_nearby is the straight-line count and stated MW of live REPD solar, battery and wind projects "
            "within 10 km of the register point; it is not a connection, offtake or capacity claim.",
            "Blank REPD capacity is unknown, never zero: projects_mw_unknown counts them.",
        ],
        "feeds": health,
        "items": merged,
    }


def load_pinned(path, now_iso):
    """Items the owner asked to be in the feed whatever the feeds return. Same shape as fetched items."""
    path = Path(path)
    if not path.exists():
        return []
    out = []
    for row in json.loads(path.read_text(encoding="utf-8")).get("items", []):
        title, link = clean_text(row.get("title", ""), 300), canonical_link(row.get("link", ""))
        lanes = [lane for lane in row.get("lanes", []) if lane in ("capex", "politics")]
        if not title or not link or not lanes:
            continue
        out.append({"title": title, "link": link, "source": clean_text(row.get("source", ""), 120),
                    "date": parse_date(row.get("date", "")), "first_seen": now_iso, "lanes": lanes,
                    "matched_terms": {"datacentre": [], "capex": [], "politics": [],
                                      "pinned": [clean_text(row.get("reason", "owner"), 120)]},
                    "capex_basis": None, "pinned": True,
                    "sites": [], "operator_sites": [], "site_matches": 0})
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default="dist/datacentre_news.json")
    ap.add_argument("--proximity", default="dist/convergence/2026q3/datacentre_proximity.json",
                    help="convergence output with register ids, names, operators and REPD radii")
    ap.add_argument("--register", default=None, help="optional register GeoJSON (adds aliases)")
    ap.add_argument("--fixtures", default=None,
                    help="offline: directory of <sha256(url)[:16]>.xml files used instead of the network")
    ap.add_argument("--now", default=None, help="fixed UTC timestamp (tests)")
    ap.add_argument("--pinned", default=str(Path(__file__).with_name("datacentre_pinned.json")),
                    help="owner-selected items always included (headline and link only)")
    ap.add_argument("--max-items", type=int, default=MAX_ITEMS)
    args = ap.parse_args(argv)

    now_iso = args.now or dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    out = Path(args.out)
    previous = {}
    if out.exists():
        try:
            previous = json.loads(out.read_text(encoding="utf-8"))
            if previous.get("schema") != SCHEMA:
                previous = {}
        except ValueError:
            previous = {}
    register = Register.load(args.proximity, args.register)

    if args.fixtures:
        fixture_dir = Path(args.fixtures)

        def fetch(url):
            path = fixture_dir / (fixture_name(url))
            if not path.exists():
                raise OSError("no fixture for %s" % url)
            return path.read_bytes()
    else:
        fetch = fetch_url

    items, health = collect(FEEDS, fetch, register, now_iso)
    items.extend(load_pinned(args.pinned, now_iso))
    result = build(previous, items, health, now_iso, args.max_items)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".tmp")
    tmp.write_text(json.dumps(result, ensure_ascii=False, indent=1, sort_keys=False) + "\n", encoding="utf-8")
    tmp.replace(out)
    print(json.dumps({"status": result["status"], **result["counts"], "register_records": len(register.records),
                      "out": str(out)}))
    if result["status"] == "failed" and not previous:
        return 1
    return 0


def fixture_name(url):
    return hashlib.sha256(url.encode()).hexdigest()[:16] + ".xml"


if __name__ == "__main__":
    sys.exit(main())
