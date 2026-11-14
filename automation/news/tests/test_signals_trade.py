"""Offline tests for automation/news/signals/trade.py. No network: a scripted fetch stands in for the sites."""
from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

import pytest

SIGNALS = Path(__file__).resolve().parents[1] / "signals"
if str(SIGNALS) not in sys.path:
    sys.path.insert(0, str(SIGNALS))

import trade as T  # noqa: E402

NOW = dt.datetime(2026, 11, 14, 12, 0, tzinfo=dt.timezone.utc)


def record(ref, rank, aliases, **extra):
    base = {"repd_ref": str(ref), "rank": rank, "site_name": aliases[0], "aliases": aliases,
            "alias_status": "confirmed", "operator": "Example Power Ltd", "county": "Oxfordshire",
            "planning_authority": "The Planning Inspectorate - National Infrastructure", "planning_ref": ""}
    base.update(extra)
    return base


def project(*args, **kwargs):
    return T.Project(record(*args, **kwargs), counties={"oxfordshire", "east yorkshire"})


# ---------------------------------------------------------------- aliases and the title rule

@pytest.mark.parametrize("alias, core", [
    ("Botley West Solar Farm", "Botley West"),
    ("The Tween Bridge Solar Farm", "Tween Bridge"),
    ("East Park Energy", "East Park"),
    ("Great North Road Solar and Biodiversity Park", "Great North Road"),
    ("Cleve Hill Solar Park", "Cleve Hill"),
    ("East Yorkshire (Howden) Solar Farm", "East Yorkshire"),
    ("Helios Renewable Energy Project", "Helios"),
    ("Stonestreet Green Solar", "Stonestreet Green"),
    ("Low Farm", "Low Farm"),
    ("Mallard Pass Solar Project", "Mallard Pass"),
    ("Desborough Airfield", "Desborough Airfield"),
])
def test_core_of(alias, core):
    assert T.core_of(alias) == core


def test_distinctive_phrase_matches_alone_and_is_word_bounded():
    p = project(12588, 1, ["Botley West Solar Farm"])
    basis, confidence = p.match("Miliband refuses Botley West")
    assert "Botley West" in basis and confidence == "confirmed"
    assert p.match("Botley Westfield plan lodged") is None
    assert p.match("West Botley residents object to solar") is None
    assert p.match("Botley West's 840MW solar plan refused")


def test_single_word_alias_needs_a_second_term():
    p = project(7188, 10, ["Sunnica Energy Farm"], county="Cambridgeshire")
    assert p.match("Sunnica wins court case") is None
    assert "solar" in p.match("Sunnica solar farm wins court case")[0]
    assert "county" in p.match("Sunnica scheme in Cambridgeshire cleared")[0]
    assert "developer" in p.match("Example hails Sunnica ruling")[0]


def test_everyday_words_need_the_solar_word_directly_after_or_the_developer():
    p = project(15793, 15, ["Green Hill Solar Farm"], county="Northamptonshire")
    assert p.match("Solar panels approved for Green Hill school") is None
    assert p.match("Green Hill Solar Farm examination opens")
    assert p.match("Example lodges Green Hill plans")
    county = project(1, 22, ["East Yorkshire Solar Farm"], county="East Yorkshire")
    assert county.match("Solar farm approved in East Yorkshire") is None
    assert county.match("East Yorkshire Solar Farm gets consent")


def test_planning_reference_matches_alone_and_exclude_drops():
    p = project(12588, 1, ["Botley West Solar Farm"], planning_ref="EN010147", exclude=["Botley West station"])
    assert "EN010147" in p.match("Decision issued on EN010147")[0]
    assert p.match("Botley West station reopens") is None
    local = project(2, 2, ["Tween Bridge Solar Farm"], planning_ref="21/01234/FUL")
    assert local.ref_rx is None


def test_unconfirmed_alias_gives_uncertain_items_and_generic_alias_is_ignored():
    p = project(3, 3, ["Mallard Pass Solar Farm"], alias_status="derived")
    assert p.match("Mallard Pass approved")[1] == "uncertain"
    assert project(4, 4, ["Solar Farm"]).aliases == []


def test_summary_rule_needs_alias_and_an_agreeing_fact_and_is_uncertain():
    p = project(10914, 8, ["Cottam Solar Project"], county="Lincolnshire", operator="Island Green Power")
    title = "UK's biggest solar farm gets development consent order"
    assert p.match(title) is None
    assert p.match(title, "The 600MW Cottam Solar Project has been approved.") is None  # alias alone
    basis, confidence = p.match(title, "Island Green Power's 600MW Cottam Solar Project has been approved.")
    assert confidence == "uncertain" and "summary" in basis and "Island" in basis and "headline" in basis
    assert p.match(title, "Island Green Power wins consent in Lincolnshire.") is None  # no alias
    everyday = project(15793, 15, ["Green Hill Solar Farm"], operator="Island Green Power")
    assert everyday.match(title, "Island Green Power plans a solar farm at a green hill site.") is None
    assert everyday.match(title, "Island Green Power's Green Hill Solar Farm moves on.")


def test_search_terms():
    assert project(1, 1, ["Botley West Solar Farm", "Botley West"]).terms() == ["Botley West"]
    assert project(1, 1, ["Sunnica Energy Farm"]).terms() == ["Sunnica solar"]


# ---------------------------------------------------------------- robots.txt

ROBOTS = """
User-agent: *
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php
Disallow: /?s=
Disallow: /search
Disallow: /*.pdf$
Crawl-delay: 2
Sitemap: https://example.org/sitemap.xml

User-agent: BadBot
Disallow: /
"""


def test_robots_rules():
    r = T.Robots(ROBOTS)
    assert not r.allowed("https://example.org/?s=botley&feed=rss2")
    assert not r.allowed("https://example.org/search?q=botley")
    assert r.allowed("https://example.org/wp-json/wp/v2/posts?search=botley")
    assert r.allowed("https://example.org/wp-admin/admin-ajax.php")
    assert not r.allowed("https://example.org/wp-admin/x")
    assert not r.allowed("https://example.org/a/b.pdf")
    assert r.allowed("https://example.org/a/b.pdf?x=1")
    assert r.delay == 2 and r.sitemaps == ["https://example.org/sitemap.xml"]
    assert T.Robots("").allowed("https://example.org/anything")
    assert not T.Robots(blocked=True).allowed("https://example.org/")


def test_robots_group_for_this_agent_wins():
    r = T.Robots("User-agent: *\nDisallow: /\n\nUser-agent: globalgrid2050-projectsignals\nDisallow: /private\n")
    assert r.allowed("https://example.org/feed/") and not r.allowed("https://example.org/private/x")


# ---------------------------------------------------------------- reading results

def test_parse_wp_posts_and_search_json():
    body = json.dumps([{"title": {"rendered": "Botley West &#8216;refused&#8217; by <em>Miliband</em>"},
                        "link": "https://www.example.org/botley/?utm_source=x", "date": "2026-11-10T09:30:00"},
                       {"title": {"rendered": ""}, "link": "https://www.example.org/x/"}]).encode()
    rows = T.parse_results("wp_posts", body, "https://www.example.org")
    assert rows == [("Botley West ‘refused’ by Miliband", "https://www.example.org/botley/", "2026-11-10", "")]
    body = json.dumps([{"title": "Cleve Hill goes live", "url": "https://www.example.org/cleve/"}]).encode()
    assert T.parse_results("wp_search", body, "https://www.example.org") == [
        ("Cleve Hill goes live", "https://www.example.org/cleve/", None, "")]
    with pytest.raises(ValueError):
        T.parse_results("wp_posts", b"<html>Just a moment...</html>", "https://www.example.org")
    with pytest.raises(ValueError):
        T.parse_results("wp_posts", b'{"code": "rest_forbidden"}', "https://www.example.org")


def test_parse_rss_search():
    body = (b'<?xml version="1.0"?><rss version="2.0"><channel><item><title>Cleve Hill Solar Park energised</title>'
            b'<link>https://www.example.org/cleve-hill/</link><pubDate>Tue, 10 Nov 2026 09:00:00 +0000</pubDate>'
            b'<description>never stored</description></item></channel></rss>')
    assert T.parse_results("wp_rss", body, "https://www.example.org") == [
        ("Cleve Hill Solar Park energised", "https://www.example.org/cleve-hill/", "2026-11-10", "never stored")]


HTML = b"""<html><body><nav><a href="/news">News</a><a href="/about-us/our-team-and-contacts">About</a></nav>
<article><h3><a href="/planning/botley-west-refused">Botley West solar farm refused consent</a></h3>
<span class="date">10 November 2026</span></article>
<article><a class="t" href='https://www.example.org/2025/03/07/cleve-hill-live/'><span>Cleve Hill Solar Park goes live in Kent</span></a></article>
<article><a href="/x/y">Mallard Pass contractor named by developer</a><time datetime="2026-01-05T08:00:00Z">5 Jan</time></article>
<a href="https://other.example.com/story">A story on another site with a long title</a>
</body></html>"""


def test_parse_html_results_page():
    rows = T.parse_results("html", HTML, "https://www.example.org")
    assert rows == [
        ("Botley West solar farm refused consent", "https://www.example.org/planning/botley-west-refused", "2026-11-10", ""),
        ("Cleve Hill Solar Park goes live in Kent", "https://www.example.org/2025/03/07/cleve-hill-live/", "2025-03-07", ""),
        ("Mallard Pass contractor named by developer", "https://www.example.org/x/y", "2026-01-05", ""),
    ]


def test_date_near_reads_us_order_and_rejects_nonsense():
    assert T.date_near("<span>Nov 10, 2026</span>") == "2026-11-10"
    assert T.date_near("<span>31 Feb 2026</span>") is None


# ---------------------------------------------------------------- polite host

class Clock:
    def __init__(self):
        self.t, self.sleeps = 0.0, []

    def now(self):
        return self.t

    def sleep(self, seconds):
        self.sleeps.append(seconds)
        self.t += seconds


def test_host_spacing_robots_and_429_retry():
    clock, calls = Clock(), []
    answers = {"https://a.example/robots.txt": "User-agent: *\nDisallow: /search\nCrawl-delay: 3\n"}

    def fetch(url):
        calls.append(url)
        if url in answers:
            return "text/plain", answers[url].encode()
        if url.endswith("/busy") and calls.count(url) == 1:
            raise T.HttpError("HTTP 429")
        return "application/json", b"[]"

    host = T.Host({"id": "a"}, fetch, cap=10, seconds=10_000, sleep=clock.sleep, clock=clock.now)
    host.get("https://a.example/one")
    host.get("https://a.example/two")
    assert clock.sleeps[-1] == 3  # Crawl-delay honoured between two requests to one host
    with pytest.raises(T.HttpError, match="robots"):
        host.get("https://a.example/search?q=x")
    assert "https://a.example/search?q=x" not in calls
    host.get("https://a.example/busy")
    assert T.RETRY_429_S in clock.sleeps and calls.count("https://a.example/busy") == 2
    assert host.failures == 0


def test_host_request_cap_and_missing_robots():
    clock = Clock()

    def fetch(url):
        if url.endswith("robots.txt"):
            raise T.HttpError("HTTP 404")
        return "text/html", b""

    host = T.Host({"id": "a"}, fetch, cap=3, seconds=10_000, sleep=clock.sleep, clock=clock.now)
    host.get("https://a.example/1")
    host.get("https://a.example/2")
    with pytest.raises(T.HttpError, match="cap"):
        host.get("https://a.example/3")

    def down(url):
        raise T.HttpError("HTTP 503")

    host = T.Host({"id": "a"}, down, cap=9, seconds=10_000, sleep=clock.sleep, clock=clock.now)
    with pytest.raises(T.HttpError, match="robots"):
        host.get("https://a.example/1")


# ---------------------------------------------------------------- whole run, cache and rotation

def write_aliases(tmp_path, records):
    path = tmp_path / "aliases.json"
    path.write_text(json.dumps({"schema": "project-signal-aliases.v1", "projects": {r["repd_ref"]: r for r in records}}))
    return path


def fake_site(monkeypatch):
    monkeypatch.setattr(T, "MIN_INTERVAL_S", 0.0)
    monkeypatch.setattr(T, "SITES", [
        {"id": "one", "publisher": "Site One", "base": "https://one.example", "feeds": ["https://one.example/feed/"],
         "routes": [("wp_posts", T.WP_POSTS), ("wp_rss", T.WP_RSS)]},
        {"id": "two", "publisher": "Site Two", "base": "https://two.example", "feeds": ["https://two.example/feed/"],
         "routes": [("wp_rss", T.WP_RSS)]},
    ])
    calls = []
    feed = (b'<rss version="2.0"><channel><item><title>Tween Bridge solar farm accepted for examination</title>'
            b'<link>https://one.example/tween/</link><pubDate>Mon, 09 Nov 2026 09:00:00 +0000</pubDate></item>'
            b'</channel></rss>')

    def fetch(url):
        calls.append(url)
        if url.endswith("/robots.txt"):
            if "two.example" in url:
                return "text/plain", b"User-agent: *\nDisallow: /?s=\n"
            raise T.HttpError("HTTP 404")
        if url == "https://one.example/feed/":
            return "application/rss+xml", feed
        if url == "https://two.example/feed/":
            raise T.HttpError("HTTP 500")
        if "search=solar+farm" in url:
            return "application/json", json.dumps([{"title": {"rendered": "A solar farm story"},
                                                    "link": "https://one.example/a/", "date": "2026-11-01T00:00:00"}]).encode()
        if "search=Botley+West" in url:
            return "application/json", json.dumps([
                {"title": {"rendered": "Botley West refused"}, "link": "https://one.example/bw/", "date": "2026-11-10T10:00:00"},
                {"title": {"rendered": "Unrelated solar story"}, "link": "https://one.example/u/", "date": "2026-11-09T10:00:00"},
                {"title": {"rendered": "Largest UK solar farm refused"}, "link": "https://one.example/big/",
                 "date": "2026-11-11T10:00:00",
                 "excerpt": {"rendered": "<p>Example Power's Botley West Solar Farm was refused.</p>"}},
            ]).encode()
        return "application/json", b"[]"

    return fetch, calls


def test_run_writes_contract_part_uses_cache_and_survives_a_failing_site(tmp_path, monkeypatch):
    fetch, calls = fake_site(monkeypatch)
    aliases = write_aliases(tmp_path, [record(12588, 1, ["Botley West Solar Farm"]),
                                       record(12926, 2, ["Tween Bridge Solar Farm"], alias_status="uncertain"),
                                       record(7188, 3, ["Sunnica Energy Farm"])])
    out, probe = tmp_path / "part.json", tmp_path / "probe.md"
    truth = tmp_path / "truth.json"
    truth.write_text(json.dumps([{"repd_ref": "12588", "title": "Botley West refused", "link": "https://one.example/bw/"},
                                 {"repd_ref": "7188", "title": "Sunnica", "link": "https://one.example/missing/"},
                                 {"repd_ref": "7188", "title": "Elsewhere", "link": "https://elsewhere.example/x/"}]))
    argv = ["--out", str(out), "--aliases", str(aliases), "--probe", str(probe), "--truth", str(truth)]
    assert T.main(argv, fetch=fetch) == 0
    part = json.loads(out.read_text())
    assert part["schema"] == "project-signals-part.v1" and part["team"] == "trade"
    assert [(i["repd_ref"], i["link"], i["date"], i["confidence"], i["family"]) for i in part["items"]] == [
        ("12588", "https://one.example/big/", "2026-11-11", "uncertain", "trade"),
        ("12588", "https://one.example/bw/", "2026-11-10", "confirmed", "trade"),
        ("12926", "https://one.example/tween/", "2026-11-09", "uncertain", "trade")]
    assert all(set(i) == {"repd_ref", "title", "link", "publisher", "date", "family", "basis", "confidence"}
               for i in part["items"])
    assert "summary" in part["items"][0]["basis"] and "Example Power" not in json.dumps(part)
    assert "search" in part["items"][1]["basis"] and "feed" in part["items"][2]["basis"]
    one, two = part["sources"]
    assert one["status"] == "ok" and one["items"] == 3 and one["route"].startswith("wp_posts")
    assert two["status"] == "failed" and "robots" in two["error"]
    assert not any("two.example/?s=" in c for c in calls)  # the disallowed route was never requested
    text = probe.read_text()
    assert "at least one trade signal: 2 of 3" in text and "found by link: **1 of 2**" in text
    # second run: every query is fresh in the cache, so only robots.txt, feeds and the canary are requested
    before = len(calls)
    assert T.main(argv, fetch=fetch) == 0
    assert not any("search=Botley" in c for c in calls[before:])
    assert json.loads(out.read_text())["items"] == part["items"]
    cache = json.loads((tmp_path / "part.cache.json").read_text())
    assert cache["queries"]["one|botley west"]["results"][0] == ["Botley West refused", "https://one.example/bw/", "2026-11-10"]
    assert "was refused" not in json.dumps(cache)  # the summary text is never stored


def test_rotation_takes_least_recently_searched_then_stale(monkeypatch):
    fake_site(monkeypatch)
    projects = [T.Project(record(i, i, ["Name%d Place Solar Farm" % i])) for i in range(1, 7)]
    cache = {"schema": T.CACHE_SCHEMA, "queries": {}, "feed_hits": {}}

    def searched(p, days):
        for site in T.SITES:
            cache["queries"][T.cache_key(site["id"], p.terms()[0])] = {
                "at": T.iso(NOW - dt.timedelta(days=days)), "status": "ok", "results": []}

    searched(projects[0], 1)
    searched(projects[1], 40)
    searched(projects[2], 35)
    searched(projects[3], 2)
    # 5 and 6 never searched: first in the batch; then the stale ones (40 and 35 days) are added
    picked = T.choose(projects, cache, NOW, batch=2, stale_days=30)
    assert [p.ref for p in picked] == ["5", "6", "2", "3"]
    assert [p.ref for p in T.choose(projects, cache, NOW, batch=3, stale_days=30)] == ["5", "6", "2", "3"]


def test_every_site_failing_gives_exit_code_1(tmp_path, monkeypatch):
    monkeypatch.setattr(T, "MIN_INTERVAL_S", 0.0)

    def fetch(url):
        raise T.HttpError("URLError: no network")

    aliases = write_aliases(tmp_path, [record(12588, 1, ["Botley West Solar Farm"])])
    assert T.main(["--out", str(tmp_path / "p.json"), "--aliases", str(aliases)], fetch=fetch) == 1
    part = json.loads((tmp_path / "p.json").read_text())
    assert len(part["sources"]) == len(T.SITES) and part["items"] == []


def test_shared_alias_table_loads_and_gives_terms_for_all_200():
    projects = T.load_projects(SIGNALS / "aliases.json")
    assert len(projects) == 200 and projects[0].ref == "12588"
    assert sum(1 for p in projects if p.terms()) >= 195  # a project whose only alias is generic is not searched
    top = json.loads((SIGNALS / "top200_solar.json").read_text())
    assert {p.ref for p in projects} == {str(r["repd_ref"]) for r in top}


# ---------------------------------------------------------------- foreign headlines, sitemap route

def test_foreign_headline_is_dropped_and_company_name_is_not_a_project():
    p = project(15866, 5, ["Meridian Solar"], county="Lincolnshire")
    assert p.match("Meridian Energy bags consent for 110MW solar PV plant in New Zealand") is None
    assert p.match("Meridian Energy reports record profit") is None
    assert p.match("Meridian Solar consultation opens")
    east = project(15347, 24, ["East Park Energy"], county="Bedfordshire")
    assert "full alias" in east.match("East Park Energy submits DCO application")[0]
    assert east.match("New energy centre for East Park estate") is None


SITEMAP_INDEX = b"""<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<sitemap><loc>https://sp.example/sitemap-articles-1.xml</loc></sitemap>
<sitemap><loc>https://sp.example/sitemap-authors.xml</loc></sitemap></sitemapindex>"""
SITEMAP_URLS = b"""<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://sp.example/solar-projects/edf-renewables-50mw-bloy-s-grove-solar-farm-gets-green-light</loc><lastmod>2022-07-01T10:00:00Z</lastmod></url>
<url><loc>https://sp.example/news/some_other_story_about_rooftop_solar</loc><lastmod>2022-07-02</lastmod></url>
<url><loc>https://sp.example/solar-planning/uk-government-refuses-840mw-botley-west-solar-farm</loc><lastmod>2026-11-11</lastmod></url>
<url><loc>https://sp.example/cut-off"""
ARTICLE = b"""<html><head><title>Wrong | Site</title>
<meta property="og:title" content="EDF Renewables&#x27; 50MW Bloy&#x27;s Grove solar farm gets green light" />
<meta content="2022-07-01T09:12:00.000Z" property="article:published_time">
</head><body><p>Body text that must never be stored.</p></body></html>"""


def test_parse_sitemap_and_article_head():
    assert T.parse_sitemap(SITEMAP_INDEX) == ("index", ["https://sp.example/sitemap-articles-1.xml",
                                                       "https://sp.example/sitemap-authors.xml"])
    shape, rows = T.parse_sitemap(SITEMAP_URLS)
    assert shape == "urls" and len(rows) == 3 and rows[0][1] == "2022-07-01"
    assert T.parse_article_head(ARTICLE) == ("EDF Renewables' 50MW Bloy's Grove solar farm gets green light", "2022-07-01")
    assert T.parse_article_head(b'<title>Headline here - Site Name</title><script>{"datePublished":"2024-05-06T01:00"}</script>') == (
        "Headline here", "2024-05-06")
    assert " bloy s grove " in T.slug_words("Bloy's Grove") and " bloy s grove " in T.slug_words(rows[0][0])


def test_sitemap_route_finds_articles_by_alias_in_the_link(tmp_path, monkeypatch):
    monkeypatch.setattr(T, "MIN_INTERVAL_S", 0.0)
    monkeypatch.setattr(T, "SITES", [{"id": "sp", "publisher": "Site SP", "base": "https://sp.example", "feeds": [],
                                      "routes": [("html", "/search?q={q}"), ("sitemap", "/sitemap.xml")]}])
    calls = []

    def fetch(url):
        calls.append(url)
        if url.endswith("/robots.txt"):
            return "text/plain", b"User-agent: *\nDisallow: /search\nSitemap: https://sp.example/sitemap.xml\n"
        if url == "https://sp.example/sitemap.xml":
            return "application/xml", SITEMAP_INDEX
        if url == "https://sp.example/sitemap-articles-1.xml":
            return "application/xml", SITEMAP_URLS
        if "bloy-s-grove" in url:
            return "text/html", ARTICLE
        if "botley-west" in url:
            return "text/html", b'<meta property="og:title" content="UK government refuses 840MW Botley West Solar Farm">'
        raise T.HttpError("HTTP 404")

    aliases = write_aliases(tmp_path, [record(12588, 1, ["Botley West Solar Farm"]),
                                       record(8308, 2, ["Bloy's Grove Solar Farm"])])
    argv = ["--out", str(tmp_path / "p.json"), "--aliases", str(aliases), "--probe", str(tmp_path / "p.md")]
    assert T.main(argv, fetch=fetch) == 0
    part = json.loads((tmp_path / "p.json").read_text())
    assert [(i["repd_ref"], i["date"], i["title"]) for i in part["items"]] == [
        ("12588", None, "UK government refuses 840MW Botley West Solar Farm"),
        ("8308", "2022-07-01", "EDF Renewables' 50MW Bloy's Grove solar farm gets green light")]
    assert "sitemap" in part["items"][0]["basis"] and part["sources"][0]["status"] == "ok"
    assert not any("/search" in c for c in calls) and not any("authors" in c for c in calls)
    assert "never be stored" not in (tmp_path / "p.cache.json").read_text()
    opened = [c for c in calls if "bloy-s-grove" in c]
    assert T.main(argv, fetch=fetch) == 0  # second run: the headline comes from the cache, the page is not reopened
    assert [c for c in calls if "bloy-s-grove" in c] == opened
