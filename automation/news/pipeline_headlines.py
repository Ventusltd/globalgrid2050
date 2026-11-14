#!/usr/bin/env python3
"""Pipeline headlines: fresh UK renewables, storage, grid and data-centre headlines for Pipeline News.

Reads the public RSS/Atom feeds listed in automation/news/pipeline_feeds.json and writes
dist/pipeline_headlines.json (schema automation/news/schema/pipeline-headlines.v1.schema.json).

  python3 automation/news/pipeline_headlines.py --out dist/pipeline_headlines.json
  python3 automation/news/pipeline_headlines.py --probe report.md      # feed health report, writes no data file

The rule, in one sentence: keep a headline when its TITLE names a topic (solar, wind, storage, grid, data centre,
renewables) AND carries an event word (refused, approved, consent, DCO, financial close, construction, energised,
appeal, ...), and the story is about the UK.

- Priority lane (owner, 14 Nov 2026: "The main priority news feed is with key words solar and data centres and
  from BBC news rss feed"). Feeds marked "priority" in the list (BBC News) are fetched first, and a BBC item
  whose title or feed summary says solar or data centre is kept even with no event word, because BBC titles
  rarely name the project ("huge solar farm on palace estate"). It gets the event category when the title has
  an event word, otherwise "other" (solar) or "datacentre".
- Headlines and links only. Only title, link, source and date are stored. The feed summary is read in memory
  for the priority lane alone and is never written out; no article page is requested.
- On a feed that is not UK-only the title must itself say it is UK news: a UK word, a REPD county, or a REPD
  site name. A title that names another country and no UK word is dropped on every feed.
- One category per headline from a fixed list; technology when the title says it.
- possible_match: only when the title contains a whole name segment of a REPD Site Name (word-bounded, at
  least two words or a distinctive single word) AND a second thing in the title agrees with that REPD row:
  the developer, the planning authority, the county or the technology. Exactly one REPD site must remain
  (co-located rows sharing one Site Name and county count as one site; the lowest Ref ID is given); otherwise null. It is a labelled possible match for review, never a confirmed link.
- Fetching, feed parsing, dates, canonical links, the sponsored filter and the link merge are imported from
  datacentre_feed.py; nothing is copied. One feed failing is recorded in "feeds" and never stops the run.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import io
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import datacentre_feed as D  # noqa: E402  fetch, parse, dates, links, sponsored filter, merge
import names as N  # noqa: E402  the shared REPD name normalisation

SCHEMA = "globalgrid2050.news.pipeline-headlines.v1"
MAX_ITEMS = 200
MAX_AGE_DAYS = 120
CATEGORIES = ("planning_decision", "consent", "refusal", "dco", "finance", "construction", "energisation",
              "grid", "policy", "datacentre", "other")
TECHNOLOGIES = ("solar", "wind", "offshore_wind", "battery", "hydro", "tidal")
ITEM_FIELDS = ("title", "link", "source", "date", "first_seen", "category", "technology", "possible_match")
SCOPE = ("Headlines and links from public RSS and Atom feeds; no article text is stored. Category and technology "
         "are labels read from the headline. A possible match is a name coincidence for review, not a confirmed "
         "link to a REPD project.")


def _rx(pattern):
    return re.compile(r"(?<![\w])(?:" + pattern + r")(?![\w])", re.I)


# ---------------------------------------------------------------- topic (title only)

TOPICS = {
    "solar": _rx(r"solar(?!\s+(?:eclipse|system|storm|flare|wind|orbiter))|photovoltaics?|PV"),
    "wind": _rx(r"wind[\s-]?farms?|wind[\s-]?turbines?|turbines?|offshore wind|onshore wind|floating wind|"
                r"wind (?:power|energy|projects?|parks?|capacity|developers?|sector|industry)"),
    "storage": _rx(r"batter(?:y|ies)(?: energy)? storage|BESS|energy storage|battery (?:sites?|farms?|parks?|"
                   r"projects?|facilit(?:y|ies)|schemes?|units?)|pumped (?:hydro|storage)|"
                   r"(?<!EV )(?<!car )(?<!vehicle )(?<!phone )batter(?:y|ies)(?! (?:factor|plant|gigafactor|recycl|fire|maker|cell|swap))"),
    "grid": _rx(r"national grid|NESO|Ofgem|grid connections?|connections? queue|electricity (?:grid|networks?|"
                r"transmission|superhighway)|power grid|grid (?:upgrades?|reforms?|capacity|queue|operator|"
                r"infrastructure|reinforcement)|pylons?|substations?|interconnectors?|transmission (?:lines?|"
                r"networks?|upgrades?|infrastructure|assets)|overhead lines?|power lines?|(?:power|subsea|undersea) cables?"),
    "renewables": _rx(r"renewables?|clean energy|clean power|green energy|energy parks?|tidal (?:energy|power|"
                      r"stream|lagoon|park|project|array)|hydro(?:electric)? (?:scheme|project|plant|power)"),
    "datacentre": _rx(r"data[\s-]?cent(?:re|er)s?|hyperscal(?:e|er|ers)|AI growth zones?"),
}
ENERGY_TOPICS = ("solar", "wind", "storage", "grid", "renewables")

# ---------------------------------------------------------------- event words (title only)

LEGAL = _rx(r"judicial review|high court|court of (?:appeal|session)|supreme court|challeng(?:e|es|ed)|lawful|"
            r"unlawful|court|judge|quash(?:ed|es)?")
REFUSAL = _rx(r"refus(?:e|es|ed|al|als|ing)|reject(?:s|ed|ion|ing)?|turn(?:s|ed)? down|thrown out|throws? out|"
              r"block(?:s|ed)|denied|dismiss(?:ed|es)|says? no|appeal fail(?:s|ed)|"
              r"(?:loses?|lost) (?:\w+ )?appeal")
CONSENT = _rx(r"approv(?:e|es|ed|al|als)|grant(?:s|ed)|consents|consented|go[\s-]ahead|green[\s-]?lit|"
              r"green[\s-]light(?:s|ed)?|given the nod|gets? the nod|allowed|"
              r"(?:wins?|won|secur(?:e|es|ed)|gets?|gains?|gained|receiv(?:e|es|ed)|awarded|obtain(?:s|ed)?|lands?)"
              r"\b.{0,50}\b(?:consents?|permission|approval|DCOs?)|"
              r"(?:consent|permission) (?:given|secured|awarded|won)|(?:wins?|won) (?:\w+ )?appeal|"
              r"appeal (?:allowed|upheld|succeeds|success|win|victory)")
CANCELLED = _rx(r"cancel(?:s|led|lation)?|scrap(?:s|ped)?|shelv(?:e|es|ed)|withdr(?:aw|aws|awn|ew)|abandon(?:s|ed)?|"
                r"axe[sd]?|pull(?:s|ed) (?:out|the plug)|halt(?:s|ed)?|paus(?:e|es|ed)")
ENERGISED = _rx(r"energi[sz](?:e|es|ed|ation)|switch(?:es|ed)? on|go(?:es)? live|went live|operational|"
                r"commission(?:s|ed|ing)|comes? online|came online|first power|starts? (?:generating|exporting|"
                r"operations?)|begins? (?:generating|exporting|operations?)|connect(?:s|ed) to (?:the )?(?:national )?grid|"
                r"fully (?:operational|online)|officially open(?:s|ed)?|(?:enters?|into|begins?|starts?) (?:commercial )?"
                r"operations?|commercial operations?")
CONSTRUCTION = _rx(r"construction|break(?:s|ing)? ground|broke ground|ground[\s-]?breaking|"
                   r"(?:work|works|building|build) (?:start|starts|started|begin|begins|began|under ?way|to start|to begin)|"
                   r"start(?:s|ed)? (?:works?|building)|begins? (?:works?|building)|install(?:s|ed|ation|ing)|"
                   r"milestone|contractor|EPC|kicks? off")
FINANCE = _rx(r"financial close|financ(?:e|es|ed|ing)|refinanc(?:e|es|ed|ing)|fund(?:s|ed|ing)|invest(?:s|ed|ing|"
              r"ment|ments|or|ors)?|acqui(?:re|res|red|sition)|buys?|bought|sells?|sold|sale|stake|loans?|"
              r"debt|raises?|raised|joint venture|joins? forces|CfDs?|contracts? for difference|auction|AR[78]|tolling|PPA|offtake")
DCO = _rx(r"DCOs?|development consent|nationally significant|NSIPs?|examination|planning inspectorate|section 36|"
          r"recommendation")
DECISION = _rx(r"decisions?|decid(?:e|es|ed)|ruling|rules|ruled|appeals?|inquiry|verdict|call(?:ed|s)?[\s-]in|"
               r"planning (?:committee|permission)|secretary of state|ministers?|clear(?:s|ed)")
GRID_EVENT = _rx(r"connections?|connect(?:s|ed)|upgrad(?:e|es|ed)|reinforcement|queue|reforms?|capacity|"
                 r"constraints?|route|corridor|offers?")
POLICY = _rx(r"polic(?:y|ies)|consultations?|government|bills?|strateg(?:y|ies)|reforms?|rules|regulations?|"
             r"targets?|DESNZ|Miliband|parliament|MPs?|plan to|taskforce")
WEAK = _rx(r"planning|plans? (?:submitted|lodged|unveiled|revealed)|submit(?:s|ted)|lodg(?:es|ed)|applications?|"
           r"proposals?|consent")
POLICY_BODY = _rx(r"Ofgem|NESO|reforms?|polic(?:y|ies)|strateg(?:y|ies)|bills?|consultations?|rules|regulations?")
PROJECT_NOUN = _rx(r"farms?|parks?|projects?|plants?|sites?|schemes?|arrays?|stations?|substations?|"
                   r"interconnectors?|cables?|pylons?|lines?|BESS|windfarms?|turbines?|DCOs?")
DC_EXTRA = _rx(r"planning|council|ministers?|government|grid|power|energy|water|billions?|millions?|"
               r"\d[\d.,]*\s?(?:bn|m)|campus|build(?:s|ing)?|expan(?:d|ds|ded|sion)|capex|spend(?:s|ing)?")

TECH_RULES = (
    ("offshore_wind", _rx(r"offshore wind|floating wind|offshore wind[\s-]?farms?")),
    ("solar", TOPICS["solar"]),
    ("wind", _rx(r"wind|windfarms?|turbines?")),
    ("battery", _rx(r"batter(?:y|ies)|BESS|energy storage")),
    ("hydro", _rx(r"pumped (?:hydro|storage)|hydro(?:electric)?")),
    ("tidal", _rx(r"tidal")),
)

UK_WORDS = _rx(r"UK|U\.K\.|Britain|British|Great Britain|GB|England|English|Scotland|Scottish|Scots|"
               r"(?<!New South )Wales|Welsh|"
               r"Northern Ireland|Ofgem|NESO|National Grid|DESNZ|Miliband|Crown Estate|Planning Inspectorate|"
               r"Celtic Sea|Irish Sea|North Sea|Dogger Bank|Hornsea|East Anglia|Moray|Shetland|Orkney|Humber|London")
# A headline that names another country and no UK word is not UK news, whatever feed carried it.
FOREIGN = _rx(r"US|U\.S\.|USA|America|American|EU|Europe-wide|Ireland|Irish|Germany|German|France|French|Spain|"
              r"Spanish|Italy|Greece|Netherlands|Dutch|Poland|China|Chinese|India|Japan|Australia|Australian|"
              r"Canada|Texas|California|Singapore|Brazil|Africa|Taiwan|Korean?|Finland|Finnish|Norway|Norwegian|"
              r"Denmark|Danish|Sweden|Swedish|Belgium|Belgian|Baltic|New South Wales|Queensland|Vietnam|Philippines")
# Not this page's subject even when a topic word is present.
EXCLUDE = _rx(r"gas fields?|oil ?fields?|speech|solar (?:eclipse|system|storm|flare)")

# Opinion columns and letters are not project news (The Guardian marks them with " | Author").
OPINION_HOSTS = ("www.theguardian.com",)


def topics_of(title):
    return [name for name, rx in TOPICS.items() if rx.search(title)]


def technology_of(title):
    for tech, rx in TECH_RULES:
        if rx.search(title):
            return tech
    return None


def category_of(title, topics=None):
    """One category from CATEGORIES for an in-scope title, or None when it carries no event word.
    topics: given by the priority lane when the topic was found in the feed summary, not the title."""
    topics = topics or topics_of(title)
    if not topics or EXCLUDE.search(title):
        return None
    if topics == ["datacentre"]:
        if any(rx.search(title) for rx in (REFUSAL, CONSENT, FINANCE, CONSTRUCTION, DECISION, POLICY, DC_EXTRA, WEAK)):
            return "datacentre"
        return None
    has = lambda rx: bool(rx.search(title))  # noqa: E731
    # A regulator or policy headline with no project noun ("Ofgem approves connection reform") is not a consent.
    if has(POLICY_BODY) and not has(PROJECT_NOUN):
        if not any(has(rx) for rx in (REFUSAL, CONSENT, FINANCE, DECISION, GRID_EVENT, POLICY, WEAK)):
            return None
        return "grid" if "grid" in topics else "policy"
    if has(LEGAL):
        return "planning_decision"          # outcome of a court case is not safely read from a headline
    if has(REFUSAL):
        return "refusal"
    if has(CONSENT):
        return "consent"
    if has(CANCELLED):
        return "other"
    if has(ENERGISED):
        return "energisation"
    if has(CONSTRUCTION):
        return "construction"
    if has(FINANCE):
        return "finance"
    if has(DCO):
        return "dco"
    if has(DECISION):
        return "planning_decision"
    if "grid" in topics and has(GRID_EVENT):
        return "grid"
    if has(POLICY):
        return "policy"
    if has(WEAK):
        return "other"
    return None


# ---------------------------------------------------------------- REPD possible match

class Repd:
    """Name segments of REPD Site Names, for the possible-match rule. Empty when no CSV is given."""

    def __init__(self, rows=()):
        self.by_phrase = {}
        self.counties = set()
        place_tokens = set()
        rows = list(rows)
        for r in rows:
            for field in ("County", "Planning Authority", "Region"):
                place_tokens.update(N.norm(r.get(field)).split())
            county = N.norm(r.get("County"))
            if len(county) >= 4 and county != "offshore":
                self.counties.add(county)
        for r in rows:
            ref, site = N.clean(r.get("Ref ID")), N.clean(r.get("Site Name"))
            if not ref or not site:
                continue
            parts = N.segments(site)
            for seg in _name_segments(parts):
                phrase = N.norm(seg)
                toks = phrase.split()
                distinct = [t for t in toks if len(t) >= 4 and not t.isdigit() and t not in N.NAME_BOILERPLATE
                            and t not in N.GENERIC_SINGLE and t not in N.ADDRESS_ONLY]
                if not distinct:
                    continue
                if len(toks) == 1 and (len(toks[0]) < 7 or toks[0] in place_tokens):
                    continue        # a single word must be distinctive: long, and not a county or authority word
                self.by_phrase.setdefault(phrase, {})[ref] = {
                    "ref": ref, "site_name": site, "family": N.tech_family(r.get("Technology Type")),
                    "operator": N.operator_tokens(r.get("Operator (or Applicant)")),
                    "authority": _authority(r.get("Planning Authority")), "county": N.norm(r.get("County"))}
        self.max_words = max((len(p.split()) for p in self.by_phrase), default=0)

    @classmethod
    def load(cls, path):
        if not path or not Path(path).exists():
            return cls()
        raw = Path(path).read_bytes()
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = raw.decode("cp1252")
        return cls(csv.DictReader(io.StringIO(text)))

    def match(self, title):
        """{"repd_ref", "site_name", "basis"} or None. Longest name first; exactly one REPD site must remain."""
        text = N.padded(title)
        toks = text.split()
        for size in range(min(self.max_words, len(toks)), 0, -1):
            found = None
            for i in range(len(toks) - size + 1):
                phrase = " ".join(toks[i:i + size])
                rows = self.by_phrase.get(phrase)
                if not rows:
                    continue
                if size == 1 and not N.descriptor_adjacent(text, phrase):
                    continue        # a single word counts only right before a technology word ("Xyzzy solar")
                rest = N.padded(" ".join(toks[:i] + toks[i + size:]))
                agreed = {}
                for ref, row in rows.items():
                    basis = _agreement(row, rest, N.tech_context(text))
                    if basis:
                        agreed[ref] = (row, basis)
                named = {ref: v for ref, v in agreed.items() if v[1] != "technology"}
                agreed = named or agreed    # a developer, authority or county in the headline outranks technology
                if agreed and len({(row["site_name"], row["county"]) for row, _ in agreed.values()}) == 1:
                    # one row, or co-located rows of one site (same Site Name and county): lowest Ref ID stands for it
                    row, basis = agreed[min(agreed, key=lambda r: (len(r), r))]
                    found = {"repd_ref": row["ref"], "site_name": row["site_name"], "basis": basis}
                    break
                if agreed:
                    return None     # the name fits more than one REPD row: say nothing
            if found:
                return found
        return None


_COLOCATED_TAIL = re.compile(r"\s+(?:&|and)\s+(.+)$", re.I)


def _name_segments(parts):
    """First and last segment of a REPD Site Name as written, and each of them without a trailing
    '& Battery Storage'-style tail (a tail made only of technology words describes the co-located plant)."""
    out = []
    for seg in ([parts[0], parts[-1]] if parts else []):
        out.append(seg)
        tail = _COLOCATED_TAIL.search(seg)
        if tail and all(t in N.NAME_BOILERPLATE for t in N.norm(tail.group(1)).split()):
            out.append(seg[:tail.start()])
    return list(dict.fromkeys(out))


def _authority(value):
    parts = N.segments(value)
    toks = [t for t in N.norm(parts[0] if parts else "").split() if t not in ("the", "council")]
    return " ".join(toks)


def _agreement(row, rest, families):
    """What else in the headline agrees with this REPD row. rest = the headline without the matched name."""
    if row["operator"] & set(rest.split()):
        return "developer"
    if len(row["authority"]) >= 5 and N.contains_phrase(rest, row["authority"]):
        return "planning_authority"
    if len(row["county"]) >= 5 and row["county"] != "offshore" and N.contains_phrase(rest, row["county"]):
        return "county"
    if row["family"] in families:
        return "technology"
    return None


def newest_repd_csv(root):
    """The newest quarterly REPD file in the repository root (repd-2026q3.csv, ...), or None."""
    found = sorted(Path(root).glob("repd-20[0-9][0-9]q[1-4].csv"))
    return str(found[-1]) if found else None


# ---------------------------------------------------------------- collect, dedupe, build

def is_uk(title, repd):
    """The title itself says this is UK news: a UK word, a REPD county, or a REPD site name of two words or more."""
    if UK_WORDS.search(title):
        return True
    padded = N.padded(title)
    if any(N.contains_phrase(padded, county) for county in repd.counties):
        return True
    toks = padded.split()
    return any(" ".join(toks[i:i + size]) in repd.by_phrase
               for size in range(2, min(repd.max_words, len(toks)) + 1) for i in range(len(toks) - size + 1))


def label(title, repd):
    """(category, technology, possible_match) for a kept title, or None when the title is out of scope."""
    category = category_of(title)
    if category is None:
        return None
    match = None if category == "datacentre" else repd.match(title)
    return category, technology_of(title), match


def priority_label(title, summary, repd):
    """Priority lane: (category, technology, possible_match) when the title or feed summary says solar or
    data centre, with or without an event word; None otherwise."""
    text = title + " " + summary
    solar, datacentre = TOPICS["solar"].search(text), TOPICS["datacentre"].search(text)
    if not (solar or datacentre) or EXCLUDE.search(title):
        return None
    if not solar:
        return "datacentre", None, None
    return category_of(title, ["solar"]) or "other", technology_of(title), repd.match(title)


def load_feeds(path):
    feeds = json.loads(Path(path).read_text(encoding="utf-8"))["feeds"]
    return [f for f in feeds if f.get("url", "").startswith("https://") and f.get("source")]


def collect(feeds, fetch, repd, now_iso):
    """Returns (items, health). A feed that fails is recorded and skipped; the run carries on."""
    items, health = [], []
    horizon = _shift(now_iso, days=2)
    for feed in feeds:
        url, source = feed["url"], feed["source"]
        try:
            body = fetch(url)
            entries = D.parse_feed(body)
        except Exception as error:  # one feed failing never stops the run
            health.append({"url": url, "source": source, "status": "failed",
                           "error": (type(error).__name__ + ": " + str(error))[:200]})
            continue
        kept, newest = 0, None
        for title, link, date, summary in entries:
            title, link, date = D.clean_text(title, 300), D.canonical_link(link), D.parse_date(date)
            if date and (newest is None or date > newest):
                newest = date
            if not title or not link or D.SPONSORED_RE.search(title):
                continue
            if date and date > horizon:
                continue
            if any(h in link for h in OPINION_HOSTS) and " | " in title:
                continue
            if FOREIGN.search(title) and not UK_WORDS.search(title):
                continue
            verdict = label(title, repd)
            if verdict is None and feed.get("priority"):
                verdict = priority_label(title, D.clean_text(summary, 2000), repd)   # summary read, never stored
            if verdict is None:
                continue
            if not feed.get("uk_only") and not is_uk(title, repd):
                continue
            items.append({"_feed": url, "title": title, "link": link, "source": source, "date": date, "first_seen": now_iso,
                          "category": verdict[0], "technology": verdict[1], "possible_match": verdict[2]})
            kept += 1
        health.append({"url": url, "source": source, "status": "ok", "entries": len(entries), "kept": kept,
                       "newest": newest})
    return items, health


def _shift(iso, days):
    moved = dt.datetime.fromisoformat(iso.replace("Z", "+00:00")) + dt.timedelta(days=days)
    return moved.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def when(item):
    return item.get("date") or item.get("first_seen") or ""


_SUFFIX = re.compile(r"\s+[|–—-]\s+[^|–—-]{2,40}$")


def title_key(title):
    """Title reduced for comparing two feeds' copies: a trailing " - Publisher" removed, then names.norm."""
    return N.norm(_SUFFIX.sub("", title)) or N.norm(title)


def dedupe_titles(items):
    """Collapse near-identical titles (same words, or 85% of words shared, within 3 days). The earliest
    published copy stays; the link breaks ties."""
    kept = []
    for item in sorted(items, key=lambda i: (when(i), i["link"])):
        key = title_key(item["title"])
        words = set(key.split())
        day = when(item)[:10]
        duplicate = False
        for other_key, other_words, other_day in ((k["_k"], k["_w"], k["_d"]) for k in kept):
            if key == other_key:
                duplicate = True
            elif len(words) >= 5 and abs(_days(day, other_day)) <= 3:
                duplicate = len(words & other_words) / len(words | other_words) >= 0.85
            if duplicate:
                break
        if not duplicate:
            kept.append(dict(item, _k=key, _w=words, _d=day))
    return [{f: k.get(f) for f in ITEM_FIELDS} for k in kept]


def _days(a, b):
    try:
        return (dt.date.fromisoformat(a) - dt.date.fromisoformat(b)).days
    except ValueError:
        return 0


def merge(previous, incoming, repd, now_iso, cap=MAX_ITEMS, max_age_days=MAX_AGE_DAYS, priority_sources=()):
    """Earlier items are kept (a rolling feed must not make a story vanish) and re-labelled with today's rules.
    Link merge and first_seen are datacentre_feed.merge; then age limit, title dedupe, newest first, cap.
    An item from a priority source that was kept on its feed summary keeps the labels it was given then,
    because the summary is not stored and cannot be read again."""
    fresh = {i["link"]: i for i in incoming}
    by_link = D.merge(previous, incoming, cap=10 ** 6)
    cutoff = _shift(now_iso, days=-max_age_days)
    out = []
    for item in by_link:
        verdict = label(item.get("title", ""), repd)
        if verdict is None and (item["link"] in fresh or item.get("source") in priority_sources) \
                and item.get("category") in CATEGORIES:
            verdict = (item["category"], item.get("technology"), item.get("possible_match"))
        if verdict is None or when(item) < cutoff:
            continue
        out.append({"title": item["title"], "link": item["link"], "source": item.get("source", ""),
                    "date": item.get("date"), "first_seen": item.get("first_seen") or now_iso,
                    "category": verdict[0], "technology": verdict[1], "possible_match": verdict[2]})
    out = dedupe_titles(out)
    out.sort(key=lambda i: (when(i), i["link"]), reverse=True)
    return out[:cap]


def build(previous, items, health, repd, now_iso, cap=MAX_ITEMS, priority_sources=()):
    merged = merge(previous.get("items", []), items, repd, now_iso, cap, priority_sources=priority_sources)
    ok = sum(h["status"] == "ok" for h in health)
    by_category = {c: n for c in CATEGORIES if (n := sum(i["category"] == c for i in merged))}
    return {
        "schema": SCHEMA,
        "generated_at": now_iso,
        "status": "ok" if ok == len(health) and health else ("partial" if ok else "failed"),
        "counts": {"items": len(merged), "with_possible_match": sum(bool(i["possible_match"]) for i in merged),
                   "feeds_ok": ok, "feeds_failed": len(health) - ok, "by_category": by_category},
        "limits": {"max_items": cap, "max_age_days": MAX_AGE_DAYS},
        "scope": SCOPE,
        "feeds": health,
        "items": merged,
    }


def probe_report(items, merged, health, now_iso, priority_sources=()):
    """Markdown feed-health report for the pull-request probe job: every feed, then the headlines that would
    be published (after merge and dedupe)."""
    by_feed = {}
    for i in items:
        by_feed.setdefault(i["_feed"], []).append(i)
    lines = ["# Pipeline headlines feed probe, %s" % now_iso, "",
             "%d feeds: %d ok, %d failed. %d headlines kept; %d after merge and dedupe." % (
                 len(health), sum(h["status"] == "ok" for h in health),
                 sum(h["status"] != "ok" for h in health), len(items), len(merged)), "",
             "| feed | status | items | newest | kept | sample kept titles |", "|---|---|---|---|---|---|"]
    for h in health:
        samples = [i["title"] for i in by_feed.get(h["url"], [])][:3]
        cell = " / ".join(s.replace("|", "/") for s in samples)
        lines.append("| %s (%s) | %s | %s | %s | %s | %s |" % (
            h["url"], h["source"], h["status"] if h["status"] == "ok" else "FAILED " + h.get("error", "").replace("|", "/"),
            h.get("entries", ""), (h.get("newest") or "")[:10], h.get("kept", ""), cell))
    merged = sorted(merged, key=lambda i: i["source"] not in priority_sources)   # stable: newest first within each
    lines += ["", "## Headlines that would be published: priority sources (BBC News) first, then newest first", "",
              "| date | category | technology | possible match | source | title |", "|---|---|---|---|---|---|"]
    for i in merged:
        m = i["possible_match"]
        lines.append("| %s | %s | %s | %s | %s | %s |" % (
            (i["date"] or "undated")[:10], i["category"], i["technology"] or "",
            "REPD %s %s (%s)" % (m["repd_ref"], m["site_name"].replace("|", "/"), m["basis"]) if m else "",
            i["source"], i["title"].replace("|", "/")))
    return "\n".join(lines) + "\n"


def main(argv=None):
    root = HERE.parents[1]
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default="dist/pipeline_headlines.json")
    ap.add_argument("--feeds", default=str(HERE / "pipeline_feeds.json"), help="JSON list of feeds to read")
    ap.add_argument("--repd", default=None, help="REPD CSV for possible matches (default: newest repd-<yyyy>q<n>.csv)")
    ap.add_argument("--fixtures", default=None,
                    help="offline: directory of <sha256(url)[:16]>.xml files used instead of the network")
    ap.add_argument("--probe", default=None, help="write a Markdown feed-health report here; no data file is written")
    ap.add_argument("--now", default=None, help="fixed UTC timestamp (tests)")
    ap.add_argument("--max-items", type=int, default=MAX_ITEMS)
    args = ap.parse_args(argv)

    now_iso = args.now or dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    repd = Repd.load(args.repd or newest_repd_csv(root))
    feeds = load_feeds(args.feeds)
    if args.fixtures:
        fixture_dir = Path(args.fixtures)

        def fetch(url):
            path = fixture_dir / D.fixture_name(url)
            if not path.exists():
                raise OSError("no fixture for %s" % url)
            return path.read_bytes()
    else:
        fetch = D.fetch_url

    feeds.sort(key=lambda f: not f.get("priority"))        # priority feeds are fetched first
    priority_sources = {f["source"] for f in feeds if f.get("priority")}
    items, health = collect(feeds, fetch, repd, now_iso)
    if args.probe:
        report = probe_report(items, merge([], items, repd, now_iso, args.max_items), health, now_iso,
                              priority_sources)
        Path(args.probe).write_text(report, encoding="utf-8")
        print(report)
        return 0

    out = Path(args.out)
    previous = {}
    if out.exists():
        try:
            previous = json.loads(out.read_text(encoding="utf-8"))
            if previous.get("schema") != SCHEMA:
                previous = {}
        except ValueError:
            previous = {}
    result = build(previous, items, health, repd, now_iso, args.max_items, priority_sources)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".tmp")
    tmp.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    tmp.replace(out)
    print(json.dumps({"status": result["status"], **result["counts"], "repd_names": len(repd.by_phrase),
                      "out": str(out)}))
    return 1 if result["status"] == "failed" and not previous else 0


if __name__ == "__main__":
    sys.exit(main())
