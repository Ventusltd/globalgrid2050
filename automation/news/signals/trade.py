#!/usr/bin/env python3
"""Trade-press signals for the 200 largest REPD solar projects (team "trade" of the project-signals contract).

For each project and each alias in automation/news/signals/aliases.json this script asks each trade site's own
public search for the alias and keeps the results whose HEADLINE names the project. It also reads each site's
main feed once a run and matches every alias against it, so fresh news is caught for all 200 every day.

  python3 automation/news/signals/trade.py --out dist/project_signals_trade.json --cache dist/trade_cache.json
  python3 automation/news/signals/trade.py --out part.json --probe summary.md --discover --batch 200

Sites, in priority order (owner: Solar Power Portal is the second primary source after BBC News):
Solar Power Portal, PV Tech, pv magazine, Energy-Storage.news, Current, reNEWS, Planning Resource,
Construction Enquirer, Solar Energy UK.

Rules
- Headlines and links only: title, link, publisher, date. Summaries are never stored; no article page is
  requested.
- robots.txt of every host is fetched first and honoured (the group for this User-Agent, else "*"; Allow,
  Disallow with * and $, Crawl-delay). A search route that robots.txt disallows is recorded as
  "refused by robots.txt" and never requested.
- One request a second per host at most (longer when Crawl-delay says so), HTTP 429: wait ten seconds and retry
  once, a request cap per host and per run, a time budget per host. One site failing never stops the run.
- Each site has an ordered list of search routes (WordPress REST posts search, WordPress RSS search, the site's
  HTML results page, WordPress REST search). The first route that answers a canary query with parsable results
  is used for the run; --discover tries every route and reports what each one returns.
- A result counts only when its title contains the alias phrase, whole words, case-insensitive. The phrase is
  the alias without its generic tail ("Botley West Solar Farm" -> "Botley West"). A short or common phrase
  (one word, or only everyday words such as "Low Farm") also needs a second agreeing term in the title: the
  developer, the county, the planning authority, or a solar word. A planning reference (EN010147) in the title
  matches on its own. The basis line of every item says which of these applied.
- Summary rule of the contract, as a fallback: when the headline does not name the project but the search or
  feed summary contains the alias phrase AND the developer, county, planning authority or planning reference
  agrees, the item is kept with confidence "uncertain" and a basis that says so. The summary itself is read in
  memory and never stored.
- A title containing one of the project's "exclude" phrases is dropped. Aliases with alias_status "derived" or
  "uncertain" give items with confidence "uncertain".
- Cache and rotation: the cache file is keyed by site and query and stores only matching headlines. A run
  searches the --batch (default 40) least recently searched projects, plus any project whose last search is
  older than --stale-days (default 30); a query younger than --fresh-days (default 4) is never repeated. At
  one run a day the 200 projects are covered in five runs (five days) and every project is searched again
  every five days; a cold start with an empty cache takes the same five runs. The main feeds are read on
  every run for all 200.
- Feed archive (Solar Power Portal): its RSS feed takes limit and offset, so the script pages backwards
  through the whole archive, --feed-pages (default 30) pages of 100 headlines a run, and applies the title rule
  and the summary rule to every item for all 200 projects; when the end is reached it starts again after
  --stale-days.
- Sitemap route (a site with no usable search, such as Solar Power Portal, whose robots.txt disallows /search):
  the sitemap files named in robots.txt are read, --sitemap-files (default 90) a run, those never read first;
  an article link whose path contains an alias phrase is kept and its headline and date are taken from the
  article page's own metadata, --page-lookups (default 60) a run, the newest link of each project first. Only
  the headline and the date are kept. The whole sitemap is covered in about five runs and re-read in rotation.
- Fetch failure handling, feed parsing, dates, canonical links and text cleaning are imported from
  datacentre_feed.py; nothing is copied.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
NEWS = HERE.parent
if str(NEWS) not in sys.path:
    sys.path.insert(0, str(NEWS))

import datacentre_feed as D  # noqa: E402  parse_feed, parse_date, canonical_link, clean_text, limits
import pipeline_headlines as P  # noqa: E402  FOREIGN and UK_WORDS: a headline naming another country is not UK news

SCHEMA = "project-signals-part.v1"
CACHE_SCHEMA = "project-signals-trade-cache.v1"
TEAM = "trade"
UA_TOKEN = "GlobalGrid2050-ProjectSignals"
USER_AGENT = UA_TOKEN + "/1.0 (+https://globalgrid2050.com)"
MIN_INTERVAL_S = 1.0
RETRY_429_S = 10.0
CANARY = "solar farm"
MAX_TERMS_PER_PROJECT = 2
PER_PUBLISHER = 5
BREAKER = 6  # consecutive failures after which a site is left alone for the rest of the run

WP_POSTS = "/wp-json/wp/v2/posts?search={q}&per_page=20&orderby=relevance&_fields=title,link,date,excerpt"
WP_SEARCH = "/wp-json/wp/v2/search?search={q}&per_page=20"
WP_RSS = "/?s={q}&feed=rss2"
WP_FEED = "/feed/?s={q}"

# id, publisher, base, main feeds, ordered search routes (kind, path template).
SITES = [
    {"id": "solar-power-portal", "publisher": "Solar Power Portal", "base": "https://www.solarpowerportal.co.uk",
     "feeds": ["https://www.solarpowerportal.co.uk/rss.xml?content_types=article&limit=100"],
     "routes": [("html", "/search?q={q}"), ("wp_posts", WP_POSTS), ("sitemap", "/sitemap.xml")],
     "feed_archive": "https://www.solarpowerportal.co.uk/rss.xml?content_types=article&limit=100&offset={offset}",
     "feed_archive_step": 100},
    {"id": "pv-tech", "publisher": "PV Tech", "base": "https://www.pv-tech.org",
     "feeds": ["https://www.pv-tech.org/feed/"],
     "routes": [("wp_posts", WP_POSTS), ("wp_rss", WP_RSS), ("wp_rss", WP_FEED), ("html", "/?s={q}"),
                ("wp_search", WP_SEARCH)]},
    {"id": "pv-magazine", "publisher": "pv magazine", "base": "https://www.pv-magazine.com",
     "feeds": ["https://www.pv-magazine.com/feed/"],
     "routes": [("wp_posts", WP_POSTS), ("wp_rss", WP_RSS), ("wp_rss", WP_FEED), ("html", "/?s={q}"),
                ("wp_search", WP_SEARCH)]},
    {"id": "energy-storage-news", "publisher": "Energy-Storage.news", "base": "https://www.energy-storage.news",
     "feeds": ["https://www.energy-storage.news/feed/"],
     "routes": [("wp_posts", WP_POSTS), ("wp_rss", WP_RSS), ("wp_rss", WP_FEED), ("html", "/?s={q}"),
                ("wp_search", WP_SEARCH)]},
    {"id": "current", "publisher": "Current", "base": "https://www.current-news.co.uk",
     "feeds": ["https://www.current-news.co.uk/feed/"],
     "routes": [("wp_posts", WP_POSTS), ("wp_rss", WP_RSS), ("wp_rss", WP_FEED), ("html", "/?s={q}"),
                ("wp_search", WP_SEARCH)]},
    {"id": "renews", "publisher": "reNEWS", "base": "https://renews.biz",
     "feeds": ["https://feeds.feedburner.com/Renews-RenewableEnergyNews"],
     "routes": [("wp_posts", WP_POSTS)]},
    {"id": "planning-resource", "publisher": "Planning Resource", "base": "https://www.planningresource.co.uk",
     "feeds": ["https://www.planningresource.co.uk/rss/news"],
     "routes": [("html", "/search/articles?KeyWords={q}"), ("html", "/search?q={q}")]},
    {"id": "construction-enquirer", "publisher": "Construction Enquirer",
     "base": "https://www.constructionenquirer.com",
     "feeds": ["https://www.constructionenquirer.com/feed/"],
     "routes": [("wp_posts", WP_POSTS), ("wp_rss", WP_RSS), ("wp_rss", WP_FEED), ("html", "/?s={q}"),
                ("wp_search", WP_SEARCH)]},
    {"id": "solar-energy-uk", "publisher": "Solar Energy UK", "base": "https://solarenergyuk.org",
     "feeds": ["https://solarenergyuk.org/feed/"],
     "routes": [("wp_posts", WP_POSTS), ("wp_rss", WP_RSS), ("wp_rss", WP_FEED), ("html", "/?s={q}"),
                ("wp_search", WP_SEARCH)]},
]


SITE_SUFFIX = re.compile(r"\s*[|\-\u2013\u2014]\s*(?:%s)\s*$" % "|".join(re.escape(x["publisher"]) for x in SITES), re.I)


def now_utc():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0)


def iso(moment):
    return moment.isoformat().replace("+00:00", "Z")


# ---------------------------------------------------------------- robots.txt

class Robots:
    """Rules of one robots.txt for this User-Agent. Missing or unreadable file: everything allowed (RFC 9309
    for 4xx); a 5xx or network error on robots.txt: nothing allowed for the run."""

    def __init__(self, text=None, blocked=False):
        self.rules, self.delay, self.sitemaps, self.blocked = [], None, [], blocked
        if text:
            self._parse(text)

    def _parse(self, text):
        groups, agents, rules, fresh = [], [], [], True
        for raw in text.splitlines():
            line = raw.split("#", 1)[0].strip()
            if ":" not in line:
                continue
            key, value = (part.strip() for part in line.split(":", 1))
            key = key.lower()
            if key == "sitemap":
                self.sitemaps.append(value)
            elif key == "user-agent":
                if not fresh:
                    groups.append((agents, rules))
                    agents, rules, fresh = [], [], True
                agents.append(value.lower())
            elif key in ("allow", "disallow", "crawl-delay"):
                fresh = False
                rules.append((key, value))
        groups.append((agents, rules))
        token = UA_TOKEN.lower()
        chosen = [r for a, r in groups if any(x != "*" and x in token for x in a)] or \
                 [r for a, r in groups if "*" in a]
        for rules in chosen:
            for key, value in rules:
                if key == "crawl-delay":
                    try:
                        self.delay = max(self.delay or 0.0, float(value))
                    except ValueError:
                        pass
                elif value:
                    self.rules.append((key == "allow", value, self._regex(value)))

    @staticmethod
    def _regex(pattern):
        end = pattern.endswith("$")
        body = "".join(".*" if ch == "*" else re.escape(ch) for ch in pattern.rstrip("$"))
        return re.compile(body + ("$" if end else ""))

    def allowed(self, url):
        if self.blocked:
            return False
        parts = urllib.parse.urlsplit(url)
        target = (parts.path or "/") + ("?" + parts.query if parts.query else "")
        best = None
        for allow, pattern, regex in self.rules:
            if regex.match(target):
                rank = (len(pattern), allow)
                if best is None or rank > best:
                    best = rank
        return True if best is None else best[1]


# ---------------------------------------------------------------- fetching

class HttpError(Exception):
    pass


def fetch_url(url):
    """(content type, body bytes). Raises HttpError with a short reason."""
    request = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "application/json, application/rss+xml, application/atom+xml, application/xml, text/html;q=0.8"})
    try:
        with urllib.request.urlopen(request, timeout=D.TIMEOUT_S) as response:  # noqa: S310 (fixed https list)
            return response.headers.get("Content-Type", ""), response.read(D.MAX_BYTES + 1)
    except urllib.error.HTTPError as error:
        raise HttpError("HTTP %d" % error.code) from None
    except Exception as error:  # network, TLS, timeout
        raise HttpError((type(error).__name__ + ": " + str(error))[:160]) from None


class Host:
    """Polite access to one site: robots.txt, spacing, the 429 rule, caps, counters."""

    def __init__(self, site, fetch, cap, seconds, sleep=time.sleep, clock=time.monotonic):
        self.site, self.fetch, self.cap, self.seconds = site, fetch, cap, seconds
        self.sleep, self.clock = sleep, clock
        self.last = {}
        self.started = clock()
        self.requests = self.failures = self.streak = 0
        self.robots = {}
        self.notes = []

    def _wait(self, host, interval):
        due = self.last.get(host, -1e9) + interval
        pause = due - self.clock()
        if pause > 0:
            self.sleep(pause)
        self.last[host] = self.clock()

    def _robots(self, url):
        parts = urllib.parse.urlsplit(url)
        host = parts.netloc
        if host not in self.robots:
            self._wait(host, MIN_INTERVAL_S)
            self.requests += 1
            try:
                _ctype, body = self.fetch("%s://%s/robots.txt" % (parts.scheme, host))
                self.robots[host] = Robots(body.decode("utf-8", "replace"))
            except HttpError as error:
                missing = re.match(r"HTTP 4\d\d", str(error)) is not None
                self.robots[host] = Robots(blocked=not missing)
                self.notes.append("robots.txt %s: %s (%s)" % (host, error,
                                                              "treated as no rules" if missing else "host skipped"))
        return self.robots[host]

    def spent(self):
        if self.requests >= self.cap:
            return "request cap of %d reached" % self.cap
        if self.clock() - self.started > self.seconds:
            return "time budget of %d s reached" % self.seconds
        if self.streak >= BREAKER:
            return "%d failures in a row" % self.streak
        return None

    def get(self, url):
        """(content type, body) or raises HttpError. 'refused by robots.txt' is raised without a request."""
        robots = self._robots(url)
        if not robots.allowed(url):
            raise HttpError("refused by robots.txt")
        reason = self.spent()
        if reason:
            raise HttpError(reason)
        host = urllib.parse.urlsplit(url).netloc
        interval = max(MIN_INTERVAL_S, robots.delay or 0.0)
        for attempt in (1, 2):
            self._wait(host, interval)
            self.requests += 1
            try:
                result = self.fetch(url)
                self.streak = 0
                return result
            except HttpError as error:
                if attempt == 1 and str(error) == "HTTP 429":
                    self.sleep(RETRY_429_S)
                    continue
                self.failures += 1
                self.streak += 1
                raise


# ---------------------------------------------------------------- reading search results

MONTHS = {m: i + 1 for i, m in enumerate(
    ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"))}
A_RE = re.compile(r"<a\b([^>]*)>(.*?)</a>", re.I | re.S)
HREF_RE = re.compile(r"""\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')""", re.I)
DATETIME_RE = re.compile(r"""\bdatetime\s*=\s*["'](\d{4}-\d{2}-\d{2})""", re.I)
DMY_RE = re.compile(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})\b")
MDY_RE = re.compile(r"\b([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b")
URL_DATE_RE = re.compile(r"/(20\d{2})/(\d{1,2})/(\d{1,2})/")


def _valid_date(year, month, day):
    try:
        return dt.date(int(year), int(month), int(day)).isoformat()
    except (TypeError, ValueError):
        return None


def day_of(value):
    """YYYY-MM-DD from an RSS, Atom or ISO date; None when unreadable. A WordPress REST date has no zone."""
    stamp = D.parse_date(value)
    if stamp:
        return stamp[:10]
    found = re.match(r"\s*(\d{4})-(\d{2})-(\d{2})", value or "")
    return _valid_date(*found.groups()) if found else None


def date_near(text):
    """A date in a fragment of results-page markup: <time datetime>, '10 November 2026' or 'Nov 10, 2026'."""
    found = DATETIME_RE.search(text)
    if found:
        return found.group(1)
    plain = D.clean_text(text, 4000)
    for regex, order in ((DMY_RE, (2, 1, 0)), (MDY_RE, (2, 0, 1))):
        for found in regex.finditer(plain):
            parts = found.groups()
            month = MONTHS.get(parts[order[1]].lower()[:3])
            date = month and _valid_date(parts[order[0]], month, parts[order[2]])
            if date:
                return date
    return None


def parse_html_results(body, base):
    """[(title, link, date, "")] from a results page: every same-site link whose text reads like a headline. The
    date is the first one in the markup that follows the link (before the next headline link), else the date in
    the link itself. The alias rule decides afterwards which of these count."""
    text = body.decode("utf-8", "replace")
    host = urllib.parse.urlsplit(base).netloc.removeprefix("www.")
    found = []
    for match in A_RE.finditer(text):
        href = HREF_RE.search(match.group(1))
        title = D.clean_text(match.group(2), 300)
        if not href or len(title) < 20 or len(title.split()) < 4:
            continue
        link = D.canonical_link(urllib.parse.urljoin(base + "/", href.group(1) or href.group(2) or ""))
        if not link or urllib.parse.urlsplit(link).netloc.removeprefix("www.") != host:
            continue
        found.append((title, link, match.end()))
    out, seen = [], set()
    for index, (title, link, end) in enumerate(found):
        if link in seen:
            continue
        seen.add(link)
        stop = found[index + 1][2] if index + 1 < len(found) else len(text)
        url_date = URL_DATE_RE.search(link)
        date = date_near(text[end:min(stop, end + 1500)]) or (url_date and _valid_date(*url_date.groups()))
        out.append((title, link, date or None, ""))
    return out


def parse_results(kind, body, base):
    """[(title, link, date, summary)] for one search route; the summary is read in memory for the summary rule
    and is never written anywhere. Raises ValueError when the answer is not what the route
    promises (an HTML challenge page where JSON was expected, for example)."""
    if kind in ("wp_posts", "wp_search"):
        try:
            rows = json.loads(body.decode("utf-8", "replace"))
        except ValueError:
            raise ValueError("not JSON") from None
        if not isinstance(rows, list):
            raise ValueError("JSON is not a list")
        out = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            title = row.get("title")
            if isinstance(title, dict):
                title = title.get("rendered")
            link = D.canonical_link(row.get("link") or row.get("url") or "")
            title = D.clean_text(title if isinstance(title, str) else "", 300)
            excerpt = row.get("excerpt")
            if isinstance(excerpt, dict):
                excerpt = excerpt.get("rendered")
            if title and link:
                out.append((title, link, day_of(row.get("date_gmt") or row.get("date") or ""),
                            D.clean_text(excerpt if isinstance(excerpt, str) else "", 1500)))
        return out
    if kind in ("wp_rss", "feed"):
        out = []
        for title, link, date, summary in D.parse_feed(body):
            title, link = D.clean_text(title, 300), D.canonical_link(link)
            if title and link:
                out.append((title, link, day_of(date), D.clean_text(summary, 1500)))
        return out
    if kind == "html":
        return parse_html_results(body, base)
    raise ValueError("unknown route kind %s" % kind)


LOC_RE = re.compile(r"<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)", re.I)
URL_RE = re.compile(r"<url>(.*?)</url>", re.I | re.S)
LASTMOD_RE = re.compile(r"<lastmod>\s*(\d{4}-\d{2}-\d{2})", re.I)
NEWS_TITLE_RE = re.compile(r"<news:title>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*</news:title>", re.I | re.S)
NEWS_DATE_RE = re.compile(r"<news:publication_date>\s*(\d{4}-\d{2}-\d{2})", re.I)
META_RE = re.compile(r"<meta\b[^>]*>", re.I)
ATTR_RE = re.compile(r"""\b(property|name|content)\s*=\s*(?:"([^"]*)"|'([^']*)')""", re.I)
PUBLISHED_RE = re.compile(r""""datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})""")
H1_RE = re.compile(r"<h1\b[^>]*>(.*?)</h1>", re.I | re.S)
TITLE_TAG_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.I | re.S)


def parse_sitemap(body):
    """('index', [sitemap urls]) or ('urls', [(loc, lastmod, news title, news date)]). Read with regular
    expressions so that a file cut off at the size limit still gives its complete entries."""
    text = body.decode("utf-8", "replace")
    if "<sitemapindex" in text[:3000].lower():
        return "index", [html_unescape(u) for u in LOC_RE.findall(text)]
    out = []
    for block in URL_RE.findall(text):
        loc = LOC_RE.search(block)
        if not loc:
            continue
        lastmod, title, date = LASTMOD_RE.search(block), NEWS_TITLE_RE.search(block), NEWS_DATE_RE.search(block)
        out.append((html_unescape(loc.group(1)), lastmod.group(1) if lastmod else None,
                    D.clean_text(title.group(1), 300) if title else "", date.group(1) if date else None))
    return "urls", out


def html_unescape(value):
    return D.clean_text(value, 2000)


def slug_words(text):
    """Lower-case words of a URL path or a phrase, for matching an alias against a link: 'Bloy's Grove' and
    '/solar-projects/edf-renewables-50mw-bloy-s-grove-solar-farm' both give '... bloy s grove ...'."""
    return " " + " ".join(re.findall(r"[a-z0-9]+", urllib.parse.unquote(text).lower().replace("\u2019", "'"))) + " "


def parse_article_head(body):
    """(headline, YYYY-MM-DD or None) from an article page's own metadata (og:title, article:published_time,
    datePublished). Nothing else of the page is read or kept."""
    text = body.decode("utf-8", "replace")
    meta = {}
    for tag in META_RE.findall(text):
        attrs = {k.lower(): (a or b) for k, a, b in ATTR_RE.findall(tag)}
        key = (attrs.get("property") or attrs.get("name") or "").lower()
        if key and "content" in attrs:
            meta.setdefault(key, attrs["content"])
    title = D.clean_text(meta.get("og:title") or meta.get("twitter:title") or "", 300)
    if not title:
        found = TITLE_TAG_RE.search(text)
        title = re.sub(r"\s+[|\-\u2013]\s+[^|\-\u2013]{3,40}$", "", D.clean_text(found.group(1) if found else "", 300))
    title = SITE_SUFFIX.sub("", title)
    h1 = H1_RE.search(text)
    h1 = D.clean_text(h1.group(1), 300) if h1 else ""
    if title and len(h1) > len(title) and h1.lower().startswith(title.lower().rstrip(". ")):
        title = h1  # the page's own headline when the metadata carries a shortened one
    date = day_of(meta.get("article:published_time") or meta.get("og:article:published_time") or "")
    if not date:
        found = PUBLISHED_RE.search(text)
        date = found.group(1) if found else None
    return title, date


def route_url(site, template, term):
    return site["base"] + template.format(q=urllib.parse.quote_plus(term))


# ---------------------------------------------------------------- aliases and the title rule

KEYWORD = re.compile(r"\s+(?:solar|energy|energyfarm|renewables?|photovoltaics?|pv|battery|bess)(?!\w)", re.I)
TAIL = re.compile(r"(?:\s+(?:farm|park|project|scheme|array|plant|development|ltd|limited|nsip|dco))+\s*$", re.I)
ADJACENT = (r"(?:[\s\-]+[\w&'.]+){0,2}?[\s\-]+(?:solar|photovoltaics?|pv|energyfarm|(?:renewable\s+)?energy\s+(?:park|farm|project|centre|hub)"
            r"|(?:green|clean)\s+energy)(?!\w)")
COMMON = frozenset(
    "farm farms hill hills lane manor house park grange hall wood woods green north south east west great little "
    "new old high low lower upper moor field fields bridge road drove mill church land lands meadow meadows "
    "marsh fen common court lodge cottage barn home top end side long big cross way gate lakes lake valley "
    "airfield quarry airport the of and at on".split())
ELSEWHERE = re.compile(
    r"(?<!\w)(?:New Zealand|Kenya|Chile|Mexico|Portugal|Romania|Bulgaria|Hungary|Turkey|Türkiye|Saudi|UAE|Egypt|"
    r"South Africa|Indonesia|Malaysia|Thailand|Pakistan|Bangladesh|Colombia|Argentina|Peru|Ontario|Alberta|"
    r"Arizona|Nevada|Florida|Ohio|Indiana|Virginia|Illinois|Tasmania|Western Australia|Austria|Switzerland|"
    r"Croatia|Serbia|Ukraine|Lithuania|Latvia|Estonia|Czech|Slovakia|Israel|Oman|Qatar|Nigeria|Ghana|Zambia|"
    r"Uzbekistan|Kazakhstan|Louisiana|Colorado|Utah|Oregon|Michigan|Wisconsin|Kentucky|Tennessee|Oklahoma)(?!\w)")
GENERIC_CORES = frozenset(("solar", "solar farm", "solar park", "land", "farm", "energy", "pv"))
SOLAR_WORD = re.compile(r"(?<!\w)(?:solar|PV|photovoltaics?|energy (?:park|farm)|DCO|NSIP)(?!\w)", re.I)
OPERATOR_STOP = frozenset(
    "ltd limited plc llp uk gb group holdings energy energies renewable renewables solar power partners "
    "development developments company co and the of infrastructure capital investments generation green "
    "services management international europe farm park project".split())
PLAIN_FIRST_WORDS = frozenset("british european low green island national scottish welsh big new good united "
                              "clean one first north south east west renewable solar energy power".split())
OTHER_TECH = re.compile(r"(?<!\w)(?:batter(?:y|ies)|BESS|gas|wind|hydrogen|nuclear|compressor|CCGT|EV|"
                        r"data[\s-]?cent(?:re|er)s?|power station|offshore|onshore|turbines?)(?!\w)", re.I)
AUTHORITY_STOP = frozenset(
    "nsip pins dco the planning inspectorate national infrastructure council district borough county city of and unitary "
    "metropolitan authority government scottish welsh ministers energy consents unit north south east west "
    "mid central vale".split())


def straight(text):
    """Typographic apostrophes as plain ones, so that "Bloy\u2019s Grove" is "Bloy's Grove"."""
    return (text or "").replace("\u2019", "'").replace("\u2018", "'")


def fold(text):
    """Letters the REPD writes plainly: 'Ørsted' is 'Orsted' there."""
    return text.replace("\u00d8", "O").replace("\u00f8", "o")


def bounded(phrase):
    words = [re.escape(w) for w in re.split(r"[\s\-]+", phrase.strip()) if w]
    return re.compile(r"(?<!\w)" + r"[\s\-]+".join(words) + r"(?:['’]s)?(?!\w)", re.I)


def core_of(alias):
    """The alias without its generic tail: 'Botley West Solar Farm' -> 'Botley West', 'East Park Energy' ->
    'East Park', 'Great North Road Solar and Biodiversity Park' -> 'Great North Road'."""
    text = re.sub(r"^\s*the\s+", "", " ".join((alias or "").split()), flags=re.I)
    text = " ".join(re.sub(r"\([^)]*\)", " ", text).split())
    cut = KEYWORD.search(text)
    if cut:
        return text[:cut.start()].strip(" ,-") or text
    core = TAIL.sub("", text).strip(" ,-")
    if not core or all(w.lower() in COMMON for w in core.split()):
        return text  # 'Low Farm' stays 'Low Farm'
    return core


def weakness(core, counties=()):
    """0 = distinctive phrase (two or more words, not all everyday words): the phrase alone is enough.
    1 = one distinctive word: a second agreeing term is needed anywhere in the title.
    2 = only everyday words, or a county name: the developer or county must agree, or a solar or energy word
    must follow the phrase directly ('Green Hill Solar Farm', 'East Yorkshire Solar Farm')."""
    words = re.findall(r"[A-Za-z0-9']+", core)
    if all(w.lower() in COMMON for w in words) or core.lower() in counties:
        return 2
    return 1 if len(words) < 2 or len(core) < 6 else 0


def _tokens(text, stop):
    return [w for w in re.findall(r"[A-Za-z][A-Za-z0-9]{2,}", text or "") if w.lower() not in stop]


class Project:
    def __init__(self, record, counties=()):
        self.ref = str(record["repd_ref"])
        self.rank = record.get("rank") or 999
        self.site_name = record.get("site_name") or ""
        self.status = record.get("alias_status") or "derived"
        self.planning_ref = (record.get("planning_ref") or "").strip()
        self.aliases, self.full = [], []
        seen = set()
        for alias in record.get("aliases") or []:
            core = core_of(alias)
            if core and core.lower() not in seen and core.lower() not in GENERIC_CORES:
                seen.add(core.lower())
                self.aliases.append((alias, core, bounded(core), weakness(core, counties)))
            full = " ".join(re.sub(r"\([^)]*\)", " ", alias).split())
            if core and len(full) > len(core) + 3 and core.lower() not in GENERIC_CORES:
                self.full.append(bounded(full))
        self.exclude = [bounded(p) for p in record.get("exclude") or [] if p and p.strip()]
        second = []
        for name in re.split(r"\s*(?:&|/|,|\band\b)\s*", record.get("operator") or ""):
            words = _tokens(name, OPERATOR_STOP)
            if words and words[0].lower() in PLAIN_FIRST_WORDS:
                found = re.search(re.escape(words[0]) + r"\s+[A-Za-z0-9]+", name)  # 'Low Carbon', 'British Solar'
                if found:
                    second.append(("developer", found.group(0)))
            elif words:
                second.append(("developer", words[0]))
        if record.get("county"):
            second.append(("county", record["county"]))
        for word in _tokens(record.get("planning_authority"), AUTHORITY_STOP):
            second.append(("planning authority", word))
        self.second = [(label, text, bounded(text)) for label, text in second]
        try:
            mw = float(record.get("mw") or 0)
        except (TypeError, ValueError):
            mw = 0.0
        if mw >= 5:  # the stated capacity is an agreeing fact: '740MW One Earth'
            number = ("%d" % mw) if mw == int(mw) else re.escape(("%.2f" % mw).rstrip("0"))
            self.second.append(("capacity", "%gMW" % mw, re.compile(
                r"(?<![\d.,])" + number + r"(?:\.0+)?\s?MW(?:p|ac|dc)?(?!\w)", re.I)))
        self.ref_rx = bounded(self.planning_ref) if re.match(r"^[A-Z]{2}\d{6}$", self.planning_ref) else None

    def terms(self):
        """Search phrases, most distinctive first. A weak phrase is sent with 'solar' beside it."""
        out = []
        for _alias, core, _rx, weak in self.aliases[:MAX_TERMS_PER_PROJECT]:
            out.append(core + " solar" if weak else core)
        return out

    def match(self, title, summary=""):
        """(basis, confidence) when the title names this project, else None. The summary rule of the contract
        is the fallback: the alias phrase in the feed or search summary together with the developer, county,
        planning authority or planning reference (in the title or the summary). Such an item is always
        'uncertain' and its basis says the headline does not name the project."""
        title = straight(title)
        summary = straight(summary)
        if any(rx.search(title) for rx in self.exclude):
            return None
        if (P.FOREIGN.search(title) or ELSEWHERE.search(title)) and not P.UK_WORDS.search(title):
            return None  # 'Meridian Energy ... in New Zealand' is not the Lincolnshire project
        confidence = "confirmed" if self.status == "confirmed" else "uncertain"
        if self.ref_rx and self.ref_rx.search(title):
            return "planning reference %s in title" % self.planning_ref, confidence
        for _alias, core, rx, weak in self.aliases:
            if not rx.search(title):
                continue
            agree = [(label, text) for label, text, srx in self.second
                     if srx.search(fold(title)) and text.lower() not in core.lower()]
            rest = rx.sub(" ", title)
            named = any(full.search(title) for full in self.full)
            near = re.search(rx.pattern + ADJACENT, title, re.I) is not None
            if not named and not near and OTHER_TECH.search(rest) and not SOLAR_WORD.search(rest) \
                    and not any(label == "developer" for label, _text in agree):
                continue  # 'West Burton C battery', 'St Fergus gas compressor': the same place, another scheme
            if weak == 2:
                agree = []  # everyday words or a county name: only the name followed by its solar word counts
            if agree:
                extra = "%s '%s'" % agree[0]
            elif named:
                extra = "the full alias"
            elif near:
                extra = "solar or energy word directly after it"
            else:
                extra = None
            if weak and not extra:
                continue
            basis = "alias phrase '%s' in title" % core
            if extra:
                basis += " with %s" % extra
            return basis, confidence
        if summary:
            return self.match_summary(title, summary)
        return None

    def match_summary(self, title, summary):
        title, summary = straight(title), straight(summary)
        if any(rx.search(summary) for rx in self.exclude):
            return None
        both = title + " . " + summary
        if (P.FOREIGN.search(both) or ELSEWHERE.search(both)) and not P.UK_WORDS.search(both):
            return None
        for _alias, core, rx, weak in self.aliases:
            if not rx.search(summary):
                continue
            if weak == 2 and not (re.search(rx.pattern + ADJACENT, summary, re.I)
                                  or any(full.search(summary) for full in self.full)):
                continue
            agree = [(label, text) for label, text, srx in self.second
                     if srx.search(fold(both)) and text.lower() not in core.lower()]
            if self.ref_rx and self.ref_rx.search(both):
                agree.insert(0, ("planning reference", self.planning_ref))
            if agree:
                return ("alias phrase '%s' in the summary with %s '%s'; the headline does not name the project"
                        % (core, agree[0][0], agree[0][1])), "uncertain"
        return None


def load_projects(path):
    table = json.loads(Path(path).read_text(encoding="utf-8"))
    records = table["projects"]
    records = records.values() if isinstance(records, dict) else records
    records = list(records)
    counties = {(r.get("county") or "").strip().lower() for r in records} - {""}
    return sorted((Project(r, counties) for r in records), key=lambda p: (p.rank, p.ref))


# ---------------------------------------------------------------- cache and rotation

def load_cache(path):
    try:
        cache = json.loads(Path(path).read_text(encoding="utf-8"))
        if cache.get("schema") == CACHE_SCHEMA:
            return cache
    except (OSError, ValueError, AttributeError, TypeError):
        pass
    return {"schema": CACHE_SCHEMA, "queries": {}, "feed_hits": {}}


def cache_key(site_id, term):
    return site_id + "|" + " ".join(term.lower().split())


def age_days(stamp, now):
    try:
        then = dt.datetime.fromisoformat(stamp.replace("Z", "+00:00"))
    except (AttributeError, ValueError):
        return 1e9
    return (now - then).total_seconds() / 86400.0


def last_searched(project, cache, now):
    """Age in days of the oldest search of this project across the sites (never searched: very large)."""
    ages = [age_days((cache["queries"].get(cache_key(site["id"], term)) or {}).get("at"), now)
            for site in SITES for term in project.terms()]
    return max(ages) if ages else 0.0


def choose(projects, cache, now, batch, stale_days):
    """The projects to search this run: the `batch` least recently searched, plus every project whose last
    search is older than `stale_days` (never-searched projects wait their turn in the batch)."""
    aged = sorted(((last_searched(p, cache, now), p) for p in projects), key=lambda x: (-x[0], x[1].rank))
    picked = [p for _age, p in aged[:batch]]
    picked += [p for age, p in aged[batch:] if stale_days < age < 1e8]
    return picked


# ---------------------------------------------------------------- one site

def pick_route(site, host, discover, report, main_links=frozenset()):
    """The first route that answers the canary query with results about the canary (a title that says solar),
    so that a home page, a navigation menu or a challenge page is never taken for search results. With
    discover, every route is tried and described in `report`."""
    chosen = None
    for kind, template in site["routes"]:
        url = route_url(site, template, CANARY)
        entry = {"route": kind, "url": url}
        try:
            ctype, body = host.get(url)
            if kind == "sitemap":
                shape, rows = parse_sitemap(body)
                entry.update(status="ok" if rows else "empty", content_type=ctype.split(";")[0], bytes=len(body),
                             results=len(rows), dated="", summaries="", relevant="",
                             sample="%s: %s" % (shape, rows[0] if shape == "index" else rows[0][0]) if rows else "")
                if rows and chosen is None:
                    chosen = (kind, template)
            else:
                rows = parse_results(kind, body, site["base"])
                dated = sum(1 for r in rows if r[2])
                relevant = sum(1 for r in rows if re.search(r"\bsolar\b", r[0], re.I))
                entry.update(status="ok" if relevant else ("no result about the query" if rows else "empty"),
                             content_type=ctype.split(";")[0], bytes=len(body), results=len(rows), dated=dated,
                             summaries=sum(1 for r in rows if r[3]), relevant=relevant,
                             sample=next((r[0] for r in rows if re.search(r"\bsolar\b", r[0], re.I)),
                                         rows[0][0] if rows else ""))
                if discover and kind == "html":
                    print("LINKS %s %s" % (site["id"], url), flush=True)
                    for row in rows[:25]:
                        print("  %s | %s | %s" % (row[2], row[0][:90], row[1][:110]), flush=True)
                usable = relevant >= 1 and (dated or kind != "wp_search")
                if kind == "html" and (relevant < 3 or relevant * 4 < len(rows)):
                    usable = False
                    entry["status"] = "not search results (%d of %d links say solar)" % (relevant, len(rows))
                if kind == "wp_rss" and rows and main_links and {r[1] for r in rows[:10]} <= main_links:
                    usable = False
                    entry["status"] = "ignores the query (same items as the main feed)"
                if usable and chosen is None:
                    chosen = (kind, template)
        except (HttpError, ValueError) as error:
            entry.update(status="refused" if "robots" in str(error) else "failed", error=str(error)[:160])
        report.append(entry)
        if chosen and not discover:
            break
    if discover:
        for path in site.get("probe_urls") or []:
            entry = {"route": "extra", "url": site["base"] + path}
            try:
                ctype, body = host.get(site["base"] + path)
                entry.update(status="ok", content_type=ctype.split(";")[0], bytes=len(body))
                try:
                    rows = parse_results("feed", body, site["base"])
                    dates = sorted(r[2] for r in rows if r[2])
                    entry.update(results=len(rows), dated=len(dates), sample="feed %s to %s; %s" % (
                        dates[0] if dates else "", dates[-1] if dates else "", rows[0][0] if rows else ""))
                except ValueError:
                    shape, rows = parse_sitemap(body)
                    entry.update(results=len(rows), sample="%s: %s" % (shape, " ; ".join(
                        str(r if shape == "index" else r[0]) for r in rows[:3])))
            except HttpError as error:
                entry.update(status="refused" if "robots" in str(error) else "failed", error=str(error)[:160])
            report.append(entry)
    return chosen


def read_feed_archive(site, host, projects, cache, health, feed_hits, main_links, now, args):
    """Page backwards through a feed that takes an offset (Solar Power Portal: 100 items a page, with
    summaries), --feed-pages pages a run, continuing where the last run stopped. Every item is matched against
    all projects with the title rule and the summary rule. When the end is reached the walk starts again
    after --stale-days."""
    state = cache.setdefault("feed_archive", {}).setdefault(site["id"], {"next": 1, "finished_at": ""})
    if state.get("finished_at") and age_days(state["finished_at"], now) < args.stale_days:
        health["feed_archive"] = {"pages_read": 0, "note": "complete; next pass after %d days" % args.stale_days}
        return
    if state.get("finished_at"):
        state.update(next=1, finished_at="")
    step, pages, entries, kept, oldest = site["feed_archive_step"], 0, 0, 0, ""
    while pages < args.feed_pages and not host.spent():
        try:
            _ctype, body = host.get(site["feed_archive"].format(offset=state["next"] * step))
            rows = parse_results("feed", body, site["base"])
        except (HttpError, ValueError) as error:
            health["notes"].append("feed archive page %d: %s" % (state["next"], str(error)[:80]))
            break  # not the end of the archive: the next run tries this page again
        pages += 1
        fresh = [r for r in rows if r[1] not in main_links]
        if not fresh:
            state["finished_at"] = iso(now)
            break
        for title, link, date, summary in fresh:
            main_links.add(link)
            entries += 1
            oldest = min(oldest or "9999", date or "9999")
            refs = {}
            for project in projects:
                verdict = project.match(title, summary)
                if verdict:
                    refs[project.ref] = verdict[0] if "in the summary" in verdict[0] else ""
            if refs:
                feed_hits[link] = {"title": title, "link": link, "date": date, "site": site["id"], "refs": refs,
                                   "how": "feed archive"}
                kept += 1
        state["next"] += 1
    health["feed_archive"] = {"pages_read": pages, "entries": entries, "oldest": oldest, "matched": kept,
                              "next_page": state["next"], "complete": bool(state.get("finished_at"))}


def walk_sitemap(site, host, start, projects, cache, health, now, args, known):
    """Read the site's sitemap files (robots.txt 'Sitemap:' lines, else `start`), keep the article links whose
    path contains a project's alias phrase, and get each kept link's headline and date: from the sitemap when it
    carries news:title, else from the article page's own metadata (one request per new link, remembered in the
    cache; the newest link of every project first). At most --sitemap-files files a run, those never read
    first and then the ones read longest ago, so the whole sitemap is covered in a few runs and then re-read
    in rotation. Returns feed-hit records; the alias rule is applied to the real headline afterwards."""
    robots = host._robots(site["base"] + "/")
    skip = re.compile(r"image|video|event|webinar|contributor|author", re.I)
    roots = [u for u in robots.sitemaps if re.search(r"sitemap|\.xml", u, re.I) and not skip.search(u)] \
        or [site["base"] + start]
    wanted = []
    for project in projects:
        for _alias, core, _rx, _weak in project.aliases:
            wanted.append((slug_words(core), project))
    state = cache.setdefault("sitemaps", {}).setdefault(site["id"], {"files": {}, "links": {}})
    files, links = state["files"], state["links"]
    age = lambda u: files.get(u, "")  # noqa: E731  never read sorts first
    work, seen, indexes, read, urls, position = sorted(dict.fromkeys(roots), key=age), set(roots), set(), 0, 0, 0
    while position < len(work) and read < args.sitemap_files and not host.spent():
        url = work[position]
        position += 1
        try:
            _ctype, body = host.get(url)
        except HttpError as error:
            health["notes"].append("sitemap %s: %s" % (url, error))
            files[url] = iso(now)
            continue
        shape, rows = parse_sitemap(body)
        if shape == "index":
            indexes.add(url)
            fresh = sorted((c for c in dict.fromkeys(rows) if c not in seen and not skip.search(c)), key=age)
            seen.update(fresh)
            work[position:position] = fresh
            continue
        read += 1
        for loc, lastmod, news_title, news_date in rows:
            urls += 1
            link = D.canonical_link(loc)
            if not link:
                continue
            words = slug_words(urllib.parse.urlsplit(link).path)
            for phrase, project in wanted:
                if phrase in words:
                    found = links.setdefault(link, {"refs": []})
                    found.update(lastmod=lastmod, title=news_title or found.get("title") or "",
                                 date=news_date or found.get("date"))
                    if project.ref not in found["refs"]:
                        found["refs"].append(project.ref)
        files[url] = iso(now)
    known = [u for u in work if u not in indexes]
    print("SITEMAPS %s roots=%d files=%d sample=%s" % (site["id"], len(roots), len(known),
                                                      json.dumps(work[:6] + work[-6:])), flush=True)
    pages, hits, looked = cache.setdefault("pages", {}), {}, 0
    per_project = {}
    for link in sorted(links, key=lambda l: links[l].get("lastmod") or "", reverse=True):
        for ref in links[link]["refs"]:
            per_project.setdefault(ref, []).append(link)
    order = sorted({(position, link) for chain in per_project.values() for position, link in enumerate(chain)},
                   key=lambda x: (x[0], -int((links[x[1]].get("lastmod") or "0000-00-00").replace("-", ""))))
    done = set()
    for _position, link in order:
        if link in done:
            continue
        done.add(link)
        found = links[link]
        title, date = found.get("title"), found.get("date")
        if not title and link in known:
            continue  # the feed already gave this headline
        if not title and link in pages:
            title, date = pages[link]
        elif not title and looked < args.page_lookups and not host.spent():
            looked += 1
            try:
                _ctype, body = host.get(link)
                title, date = parse_article_head(body)
                if title:
                    pages[link] = [title, date]
            except HttpError:
                continue
        if title:
            hits[link] = {"title": title, "link": link, "date": date, "site": site["id"],
                          "refs": {ref: "" for ref in found["refs"]}, "how": "sitemap"}
    health["sitemap"] = {"files_known": len(known), "files_read_this_run": read,
                         "files_never_read": sum(1 for u in known if u not in files), "urls_read": urls,
                         "links_matching_an_alias": len(links), "pages_opened": looked,
                         "headlines_known": len(hits)}
    return hits


def run_site(site, projects, todo, cache, fetch, now, args, out):
    """Feeds, route choice and the searches of one site. Everything it learns goes into `out` (one dict per
    site, written by this thread only)."""
    host = Host(site, fetch, args.per_host_cap, args.host_seconds)
    health = {"id": site["id"], "url": site["base"], "status": "ok", "requests": 0, "failures": 0, "items": 0,
              "error": "", "route": "", "routes": [], "feeds": [], "searched": 0, "cached": 0, "skipped": 0}
    hits, main_links = [], set()
    new_queries, feed_hits = {}, {}
    try:
        for url in site["feeds"]:
            entry = {"url": url}
            try:
                _ctype, body = host.get(url)
                rows = parse_results("feed", body, site["base"])
                main_links.update(r[1] for r in rows)
                kept = 0
                for title, link, date, summary in rows:
                    refs = {}
                    for project in projects:
                        verdict = project.match(title, summary)
                        if verdict:
                            refs[project.ref] = verdict[0] if "in the summary" in verdict[0] else ""
                    if refs:
                        feed_hits[link] = {"title": title, "link": link, "date": date, "site": site["id"],
                                           "refs": refs}
                        kept += 1
                entry.update(status="ok", entries=len(rows), matched=kept,
                             newest=max((r[2] for r in rows if r[2]), default=""))
            except (HttpError, ValueError) as error:
                entry.update(status="failed", error=str(error)[:160])
            health["feeds"].append(entry)

        if site.get("feed_archive"):
            read_feed_archive(site, host, projects, cache, health, feed_hits, main_links, now, args)
        route = pick_route(site, host, args.discover, health["routes"], frozenset(main_links))
        host.failures = host.streak = 0  # routes that do not exist are findings, not failures of the run
        health["notes"] = host.notes
        if route and route[0] == "sitemap":
            health["route"] = "sitemap (links by alias in the path, headline from the article's metadata)"
            known = set(feed_hits) | set(cache.get("feed_hits") or {})
            for link, hit in walk_sitemap(site, host, route[1], projects, cache, health, now, args, known).items():
                feed_hits.setdefault(link, hit)  # a headline from the feed is kept as the feed gave it
            health["searched"] = len(projects)
        elif route:
            kind, template = route
            health["route"] = kind + " " + template
            for project in todo:
                for term in project.terms():
                    key = cache_key(site["id"], term)
                    old = cache["queries"].get(key)
                    if old and old.get("status") == "ok" and age_days(old.get("at"), now) < args.fresh_days:
                        health["cached"] += 1
                        continue
                    if host.spent():
                        health["skipped"] += 1
                        continue
                    try:
                        _ctype, body = host.get(route_url(site, template, term))
                        rows = parse_results(kind, body, site["base"])
                        core_rx = bounded(term[:-6] if term.endswith(" solar") else term)
                        keep = []
                        for title, link, date, summary in rows:
                            if core_rx.search(straight(title)) or (project.ref_rx and project.ref_rx.search(title)):
                                keep.append([title, link, date])
                            else:
                                verdict = project.match_summary(title, summary) if summary else None
                                if verdict:
                                    keep.append([title, link, date, verdict[0]])
                        new_queries[key] = {"at": iso(now), "status": "ok", "route": kind, "returned": len(rows),
                                            "results": keep[:12]}
                        health["searched"] += 1
                    except (HttpError, ValueError) as error:
                        if isinstance(error, ValueError):
                            host.failures += 1
                            host.streak += 1
                        print("FAILED %s %r: %s" % (site["id"], term, str(error)[:100]), flush=True)
                        new_queries.setdefault(key, {"at": iso(now), "status": "failed",
                                                     "error": str(error)[:120], "results": (old or {}).get("results", [])})
                        health["skipped"] += 1
        else:
            health["error"] = "no search route usable: " + "; ".join(
                "%s %s" % (r["route"], r.get("error") or r["status"]) for r in health["routes"])
    except Exception as error:  # a bug in one site must not stop the others
        health["error"] = (type(error).__name__ + ": " + str(error))[:200]
    reason = host.spent()
    if reason and not health["error"]:
        health["error"] = reason
    feeds_ok = any(f["status"] == "ok" for f in health["feeds"])
    if not health["route"] and not feeds_ok:
        health["status"] = "failed"
    elif not health["route"] or health["error"] or host.failures > 3 or health["skipped"] > 3:
        health["status"] = "partial"
    health["requests"], health["failures"] = host.requests, host.failures
    print("SITE " + json.dumps({k: v for k, v in health.items() if k not in ("routes", "feeds")}), flush=True)
    out[site["id"]] = {"health": health, "queries": new_queries, "feed_hits": feed_hits, "hits": hits}


# ---------------------------------------------------------------- build

def build_items(projects, cache):
    """Items of the contract from everything the cache holds (search results and feed hits)."""
    publisher = {s["id"]: s["publisher"] for s in SITES}
    by_term = {}
    for project in projects:
        for term in project.terms():
            by_term.setdefault(" ".join(term.lower().split()), []).append(project)
    items, seen = [], set()

    def add(project, title, link, date, site_id, how, summary_basis=""):
        if summary_basis:
            if any(rx.search(title) for rx in project.exclude):
                return
            verdict = (summary_basis, "uncertain")
        else:
            verdict = project.match(title)
        if not verdict or (project.ref, link) in seen:
            return
        seen.add((project.ref, link))
        items.append({"repd_ref": project.ref, "title": title[:300], "link": link, "publisher": publisher[site_id],
                      "date": date, "family": "trade", "basis": "%s %s: %s" % (publisher[site_id], how, verdict[0]),
                      "confidence": verdict[1]})

    by_ref = {p.ref: p for p in projects}
    for key in sorted(cache["queries"]):
        site_id, _, term = key.partition("|")
        if site_id not in publisher:
            continue
        for row in cache["queries"][key].get("results") or []:
            for project in by_term.get(term, []):
                add(project, row[0], row[1], row[2], site_id, "search", row[3] if len(row) > 3 else "")
    for link in sorted(cache.get("feed_hits") or {}):
        hit = cache["feed_hits"][link]
        if hit.get("site") not in publisher:
            continue
        for ref, summary_basis in sorted((hit.get("refs") or {}).items()):
            if ref in by_ref:
                add(by_ref[ref], hit["title"], hit["link"], hit.get("date"), hit["site"], hit.get("how") or "feed",
                    summary_basis)
    strong = re.compile(r" with (?:developer|county|capacity|planning authority) |planning reference ")
    by_link = {}
    for item in items:
        by_link.setdefault(item["link"], []).append(item)
    for group in by_link.values():  # one headline, several projects of the same name: the agreeing fact decides
        if len(group) > 1 and any(strong.search(i["basis"]) for i in group):
            cores = {}
            for item in group:
                found = re.search(r"alias phrase '([^']*)'", item["basis"])
                cores.setdefault(found.group(1).lower() if found else item["repd_ref"], []).append(item)
            for same in cores.values():
                if len(same) > 1 and any(strong.search(i["basis"]) for i in same):
                    for item in same:
                        if not strong.search(item["basis"]):
                            items.remove(item)
    rank = {p.ref: p.rank for p in projects}
    items.sort(key=lambda i: (rank[i["repd_ref"]], i["date"] is None, "" if i["date"] is None else
                              "%08d" % (99999999 - int(i["date"].replace("-", ""))), i["link"]))
    kept, count = [], {}
    for item in items:  # newest first within a project: at most PER_PUBLISHER items per project and site
        key = (item["repd_ref"], item["publisher"])
        count[key] = count.get(key, 0) + 1
        if count[key] <= PER_PUBLISHER:
            kept.append(item)
    return kept


def run(projects, cache, fetch, now, args):
    todo = choose(projects, cache, now, args.batch, args.stale_days)
    results, threads = {}, []
    for site in SITES:
        thread = threading.Thread(target=run_site, args=(site, projects, todo, cache, fetch, now, args, results),
                                  daemon=True)
        threads.append(thread)
        thread.start()
    for thread in threads:
        thread.join()
    sources = []
    for site in SITES:
        result = results.get(site["id"])
        if not result:
            sources.append({"id": site["id"], "url": site["base"], "status": "failed", "requests": 0,
                            "failures": 0, "items": 0, "error": "no result"})
            continue
        cache["queries"].update(result["queries"])
        store = cache.setdefault("feed_hits", {})
        for link, hit in result["feed_hits"].items():
            if hit.get("how") == "sitemap" and link in store and store[link].get("how") != "sitemap":
                store[link].setdefault("refs", {}).update({r: b for r, b in hit["refs"].items()
                                                           if r not in store[link].get("refs", {})})
            else:
                store[link] = hit
        sources.append(result["health"])
    # An item held in cache may be useful historical evidence, but must not
    # be promoted as newly fetched because a different publisher answered.
    # Build an independent *per site, per URL* observation ledger from only
    # successful fresh queries, feeds and sitemap article fetches THIS run.
    observed = {}
    for site in SITES:
        site_id = site["id"]
        result = results.get(site_id) or {}
        urls = set((result.get("feed_hits") or {}).keys())
        for query in (result.get("queries") or {}).values():
            if query.get("status") != "ok":
                continue
            for row in query.get("results") or []:
                if isinstance(row, list) and len(row) >= 2 and isinstance(row[1], str):
                    urls.add(row[1])
        observed[site_id] = urls
    cache["updated_at"] = iso(now)
    items = build_items(projects, cache)
    publisher = {s["publisher"]: s["id"] for s in SITES}
    for item in items:
        source_id = publisher[item["publisher"]]
        this_run = item["link"] in observed.get(source_id, set())
        item["source_id"] = source_id
        item["fetched_this_run"] = this_run
        item["observed_at"] = iso(now) if this_run else None
    for source in sources:
        source["items"] = sum(1 for i in items if publisher[i["publisher"]] == source["id"])
        source["observed_urls"] = sorted(observed.get(source["id"], set()))
    return {"schema": SCHEMA, "team": TEAM, "generated_at": iso(now), "items": items, "sources": sources,
            "rotation": {"projects": len(projects), "searched_this_run": len(todo), "batch": args.batch,
                         "stale_days": args.stale_days, "fresh_days": args.fresh_days,
                         "full_cycle_runs": -(-len(projects) // max(1, args.batch))}}


# ---------------------------------------------------------------- report

def compare_truth(items, truth, projects):
    """How many of the members' trade-press signals the script found (by canonical link), and for how many
    projects with a trade signal in the ground truth the script has at least one item."""
    hosts = {urllib.parse.urlsplit(s["base"]).netloc.removeprefix("www.") for s in SITES}
    known = {p.ref for p in projects}
    found_links = {(i["repd_ref"], i["link"]) for i in items}
    have = {i["repd_ref"] for i in items}
    rows = []
    for signal in truth:
        link = D.canonical_link(signal.get("link") or "")
        if not link or str(signal.get("repd_ref")) not in known:
            continue
        host = urllib.parse.urlsplit(link).netloc.removeprefix("www.")
        if host not in hosts:
            continue
        ref = str(signal["repd_ref"])
        rows.append({"repd_ref": ref, "title": signal.get("title") or "", "link": link, "host": host,
                     "link_found": (ref, link) in found_links, "project_found": ref in have})
    refs = {r["repd_ref"] for r in rows}
    return {"signals": len(rows), "signals_found": sum(r["link_found"] for r in rows),
            "projects": len(refs), "projects_found": len({r["repd_ref"] for r in rows if r["project_found"]}),
            "rows": rows}


def cell(text):
    return str(text).replace("|", "/").replace("\n", " ")


def report(part, projects, truth, discover):
    items, lines = part["items"], []
    with_signal = {i["repd_ref"] for i in items}
    confirmed = {i["repd_ref"] for i in items if i["confidence"] == "confirmed"}
    by_title = {i["repd_ref"] for i in items if "in the summary" not in i["basis"]}
    rot = part["rotation"]
    lines.append("## Trade-press signals for the top 200 solar projects\n")
    lines.append("**Projects with at least one trade signal: %d of %d** (%d by the title rule, %d more by the "
                 "summary rule only; %d with a confirmed item; %d items).  Searched this run: %d projects; a full "
                 "cycle is %d runs of %d.\n"
                 % (len(with_signal), len(projects), len(by_title), len(with_signal - by_title), len(confirmed),
                    len(items), rot["searched_this_run"],
                    rot["full_cycle_runs"], rot["batch"]))
    lines.append("### Per site\n")
    lines.append("| site | status | search route used | searched | cached | skipped | requests | failures | "
                 "projects | items | note |\n|---|---|---|---|---|---|---|---|---|---|---|")
    by_pub = {}
    for item in items:
        by_pub.setdefault(item["publisher"], set()).add(item["repd_ref"])
    for site, source in zip(SITES, part["sources"]):
        lines.append("| %s | %s | %s | %s | %s | %s | %s | %s | %d | %s | %s |" % (
            site["publisher"], source["status"], cell(source.get("route") or "none"), source.get("searched", ""),
            source.get("cached", ""), source.get("skipped", ""), source["requests"], source["failures"],
            len(by_pub.get(site["publisher"], ())), source["items"],
            cell("; ".join([source.get("error") or ""] + (source.get("notes") or [])
                           + ["%s %s" % (k, json.dumps(source[k])) for k in ("feed_archive", "sitemap")
                              if source.get(k)]).strip("; "))))
    lines.append("\n### Routes tried (canary query '%s')%s\n" % (CANARY, "" if discover else
                                                                   " - stops at the first that works"))
    lines.append("| site | route | result | type | results | about solar | dated | with summary | sample or error |\n"
                 "|---|---|---|---|---|---|---|---|---|")
    for site, source in zip(SITES, part["sources"]):
        for route in source.get("routes") or []:
            lines.append("| %s | %s | %s | %s | %s | %s | %s | %s | %s |" % (
                site["publisher"], cell(route["url"].replace(site["base"], "")), route["status"],
                route.get("content_type", ""), route.get("results", ""), route.get("relevant", ""),
                route.get("dated", ""),
                route.get("summaries", ""),
                cell((route.get("sample") or route.get("error") or "")[:160])))
    lines.append("\n### Main feeds\n")
    lines.append("| site | feed | result | entries | newest | matched a project |\n|---|---|---|---|---|---|")
    for site, source in zip(SITES, part["sources"]):
        for feed in source.get("feeds") or []:
            lines.append("| %s | %s | %s | %s | %s | %s |" % (
                site["publisher"], feed["url"], feed["status"] + (" " + feed.get("error", "") if feed.get("error") else ""),
                feed.get("entries", ""), feed.get("newest", ""), feed.get("matched", "")))
    if truth is not None:
        result = compare_truth(items, truth, projects)
        lines.append("\n### Against the members' ground truth (trade-press signals on these nine sites)\n")
        lines.append("Truth signals found by link: **%d of %d**. Projects with a truth trade signal for which the "
                     "script has at least one item: **%d of %d**.\n"
                     % (result["signals_found"], result["signals"], result["projects_found"], result["projects"]))
        missed = [r for r in result["rows"] if not r["link_found"]]
        if missed:
            lines.append("| REPD | host | project has an item | truth title not found by link |\n|---|---|---|---|")
            for row in missed[:60]:
                lines.append("| %s | %s | %s | %s |" % (row["repd_ref"], row["host"],
                                                       "yes" if row["project_found"] else "no", cell(row["title"][:110])))
    lines.append("\n### Newest item per project (first 60 by rank)\n")
    lines.append("| rank | REPD | date | publisher | confidence | title | basis |\n|---|---|---|---|---|---|---|")
    rank = {p.ref: p.rank for p in projects}
    shown = set()
    for item in items:
        if item["repd_ref"] in shown or len(shown) >= 60:
            continue
        shown.add(item["repd_ref"])
        lines.append("| %s | %s | %s | %s | %s | [%s](%s) | %s |" % (
            rank[item["repd_ref"]], item["repd_ref"], item["date"] or "", item["publisher"], item["confidence"],
            cell(item["title"][:120]), item["link"], cell(item["basis"])))
    without = [p for p in projects if p.ref not in with_signal]
    lines.append("\n### Projects without a trade signal (%d)\n" % len(without))
    lines.append(", ".join("%s (%s)" % (p.ref, cell(p.aliases[0][1] if p.aliases else p.site_name))
                           for p in without))
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------- main

def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--out", required=True)
    parser.add_argument("--aliases", default=str(HERE / "aliases.json"))
    parser.add_argument("--cache", default="", help="query cache, read and rewritten (default: next to --out)")
    parser.add_argument("--probe", default="", help="write a markdown report here")
    parser.add_argument("--truth", default="", help="ground-truth signals (JSON list) to compare with")
    parser.add_argument("--discover", action="store_true", help="try every search route of every site")
    parser.add_argument("--limit", type=int, default=0, help="only the first N projects by rank")
    parser.add_argument("--batch", type=int, default=40, help="projects searched per run")
    parser.add_argument("--stale-days", type=float, default=30.0)
    parser.add_argument("--fresh-days", type=float, default=4.0)
    parser.add_argument("--per-host-cap", type=int, default=200, help="requests per site per run")
    parser.add_argument("--host-seconds", type=int, default=900, help="time budget per site per run")
    parser.add_argument("--feed-pages", type=int, default=30, help="pages of an offset feed read per run")
    parser.add_argument("--sitemap-files", type=int, default=90, help="sitemap files read per run (sitemap route)")
    parser.add_argument("--page-lookups", type=int, default=60,
                        help="article pages opened per run for their headline and date (sitemap route)")
    return parser.parse_args(argv)


def main(argv=None, fetch=fetch_url):
    args = parse_args(argv)
    now = now_utc()
    projects = load_projects(args.aliases)
    if args.limit:
        projects = projects[:args.limit]
    out = Path(args.out)
    cache_path = Path(args.cache) if args.cache else out.with_name(out.stem + ".cache.json")
    cache = load_cache(cache_path)
    part = run(projects, cache, fetch, now, args)
    for path, payload in ((out, part), (cache_path, cache)):
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        tmp.replace(path)
    truth = None
    if args.truth and Path(args.truth).exists():
        truth = json.loads(Path(args.truth).read_text(encoding="utf-8"))
    if args.probe:
        Path(args.probe).write_text(report(part, projects, truth, args.discover), encoding="utf-8")
    with_signal = len({i["repd_ref"] for i in part["items"]})
    print(json.dumps({"projects": len(projects), "with_trade_signal": with_signal, "items": len(part["items"]),
                      "sources": {s["id"]: s["status"] for s in part["sources"]}}))
    return 1 if all(s["status"] == "failed" for s in part["sources"]) else 0


if __name__ == "__main__":
    sys.exit(main())
