"""Offline tests for automation/news/signals/index.py. No network: feeds and GDELT answers are given in memory."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

SIGNALS = Path(__file__).resolve().parents[1]
for path in (str(SIGNALS.parent), str(SIGNALS)):
    if path not in sys.path:
        sys.path.insert(0, path)

import index as I  # noqa: E402

NOW = "2026-11-14T12:00:00Z"
FOUR = {"rank": 4, "repd_ref": "20003", "site_name": "Cottam Solar Project", "operator": "Island Green Power", "mw": 600.0,
        "county": "Lincolnshire", "country": "England", "planning_authority": "PINS", "planning_ref": "EN010133"}
TOP = [
    {"rank": 1, "repd_ref": "12588", "site_name": "Botley West, Botley - Botley West Solar Project",
     "operator": "Photovolt Development Partners & SolarFive ", "mw": 840.0, "county": "Oxfordshire",
     "country": "England", "planning_authority": "The Planning Inspectorate - National Infrastructure",
     "planning_ref": "EN010147"},
    {"rank": 2, "repd_ref": "20001", "site_name": "Rigifa Solar Farm & Battery Storage", "operator": "Example Energy Ltd",
     "mw": 60.0, "county": "Aberdeenshire", "country": "Scotland", "planning_authority": "Aberdeenshire",
     "planning_ref": "APP/2025/0001"},
    {"rank": 3, "repd_ref": "20002", "site_name": "Mill Solar Farm", "operator": "Example Energy Ltd", "mw": 50.0,
     "county": "Kent", "country": "England", "planning_authority": "Ashford", "planning_ref": "24/00001"},
]
ALIASES = {"schema": "project-signal-aliases.v1", "projects": {
    "12588": {"aliases": ["Botley West Solar Farm"], "alias_status": "confirmed", "planning_ref": "EN010147"},
    "20001": {"aliases": ["Rigifa Solar Farm"], "alias_status": "confirmed", "exclude": ["Caithness"]},
}}


def rss(*entries):
    body = "".join("<item><title>%s</title><link>%s</link><pubDate>%s</pubDate><description>%s</description></item>" % e
                   for e in entries)
    return ("<?xml version='1.0'?><rss version='2.0'><channel><title>t</title>%s</channel></rss>" % body).encode()


@pytest.fixture
def projects(tmp_path):
    top, aliases = tmp_path / "top.json", tmp_path / "aliases.json"
    top.write_text(json.dumps(TOP))
    aliases.write_text(json.dumps(ALIASES))
    return I.load_projects(top, aliases)


def test_derived_alias_and_core_names(tmp_path, projects):
    assert I.clean_site_name("Botley West, Botley - Botley West Solar Project") == "Botley West Solar Project"
    assert I.clean_site_name("Green Hill Solar Farm & Battery Storage") == "Green Hill Solar Farm"
    assert I.clean_site_name("Tillbridge Solar Farm, Hemswell - Solar Panels") == "Tillbridge Solar Farm"
    assert I.core_name("The Tween Bridge Solar Farm") == "Tween Bridge"
    botley, rigifa, mill = projects
    assert botley["cores"] == ["botley west"] and botley["alias_status"] == "confirmed"
    assert mill["alias_status"] == "derived" and mill["aliases"] == ["Mill Solar Farm"]
    assert mill["cores"] == []                       # "Mill" alone is too common to match on
    top = tmp_path / "top.json"
    assert [p["alias_status"] for p in I.load_projects(top, tmp_path / "missing.json")] == ["derived"] * 3


def test_match_rule(projects):
    botley, rigifa, mill = projects
    assert I.match_item(botley, "Botley West solar farm refused by minister")[0] == "strong"
    assert I.match_item(botley, "Botley West solar project decision due")[0] == "strong"
    assert I.match_item(botley, "Decision on EN010147 published")[0] == "strong"
    assert I.match_item(botley, "Huge solar farm refused", "The Botley West Solar Farm would have covered farmland.", True)[0] == "strong"
    assert I.match_item(botley, "Huge solar farm refused", "The Botley West Solar Farm in Oxfordshire is refused.")[0] == "strong"
    assert I.match_item(botley, "Huge solar farm refused", "The Botley West Solar Farm would have covered farmland.")[0] == "weak"
    assert I.match_item(botley, "Solar plan near Botley West divides villagers")[0] == "weak"
    assert I.match_item(botley, "Botley West residents meet over road closure") is None      # a bare name is not enough
    assert I.match_item(botley, "Solar farm refused in Oxfordshire") is None
    assert I.match_item(rigifa, "Rigifa solar farm in Caithness approved") is None           # exclude phrase
    assert I.match_item(mill, "Mill solar farm approved")[0] == "strong"                     # full alias still matches
    assert I.match_item(mill, "Solar plan for old mill site") is None


def test_bbc_feed_list_is_derived_from_the_counties(projects):
    feeds, unmapped = I.bbc_feeds(projects)
    urls = dict(feeds)
    assert "https://feeds.bbci.co.uk/news/england/oxford/rss.xml" in urls
    assert urls["https://feeds.bbci.co.uk/news/england/oxford/rss.xml"] == {"oxfordshire"}
    assert "https://feeds.bbci.co.uk/news/rss.xml" in urls and unmapped == []
    assert "https://feeds.bbci.co.uk/news/england/norfolk/rss.xml" not in urls


def test_every_top200_county_has_a_bbc_feed():
    projects = I.load_projects(SIGNALS / "top200_solar.json", None)
    assert len(projects) == 200
    feeds, unmapped = I.bbc_feeds(projects)
    assert unmapped == []
    assert all(url.startswith("https://feeds.bbci.co.uk/news/") and url.endswith("rss.xml") for url, _ in feeds)


def test_collect_rss_reads_summary_but_never_stores_it(projects):
    oxford = "https://feeds.bbci.co.uk/news/england/oxford/rss.xml"
    bodies = {
        oxford: rss(("Minister refuses giant solar farm", "https://www.bbc.co.uk/news/articles/abc?at_medium=RSS",
                     "Tue, 10 Nov 2026 12:00:00 GMT", "The Botley West Solar Farm was refused development consent."),
                    ("Bus timetable changes", "https://www.bbc.co.uk/news/articles/def", "Tue, 10 Nov 2026 12:00:00 GMT", "x"),
                    ("Solar eclipse photos", "https://news.google.com/rss/articles/xyz", "Tue, 10 Nov 2026 12:00:00 GMT", "x")),
    }

    def fetch(url):
        if url not in bodies:
            raise OSError("HTTP 404")
        return bodies[url]

    feeds = [(oxford, {"oxfordshire"}), ("https://feeds.bbci.co.uk/news/england/nowhere/rss.xml", set())]
    items, health = I.collect_rss(feeds, projects, fetch, "BBC News", "bbc", "BBC News RSS")
    assert [h["status"] for h in health] == ["ok", "failed"]            # one bad feed never stops the run
    assert [v[2] for v in I.collect_rss.unmatched.values()] == []       # the eclipse item is a Google link: dropped
    assert len(items) == 1
    item = items[0]
    assert item == {"repd_ref": "12588", "title": "Minister refuses giant solar farm",
                    "link": "https://www.bbc.co.uk/news/articles/abc", "publisher": "BBC News", "date": "2026-11-10",
                    "family": "bbc", "confidence": "confirmed",
                    "basis": "BBC News RSS: alias 'Botley West Solar Farm' in feed summary; the feed is the project's county feed"}
    assert "refused development consent" not in json.dumps(items)
    record = I.source_record("bbc-rss", I.BBC_BASE, health)
    assert record["status"] == "partial" and record["failures"] == 1 and record["items"] == 1


def test_excluded_sources_and_publishers():
    assert I.is_excluded("https://news.google.com/rss/articles/x")
    assert I.is_excluded("https://www.google.co.uk/url?q=x")
    assert I.is_excluded("https://www.reuters.com/world/uk/x")
    assert not I.is_excluded("https://www.bbc.co.uk/news/articles/x")
    assert I.publisher_of("https://www.bbc.co.uk/news/articles/x") == ("BBC News", "bbc")
    assert I.publisher_of("https://www.solarpowerportal.co.uk/x") == ("Solar Power Portal", "trade")
    assert I.publisher_of("https://www.oxfordmail.co.uk/news/x") == ("oxfordmail.co.uk", "regional")


def test_gdelt_query_and_url(projects):
    botley = projects[0]
    assert I.gdelt_phrase(botley) == "Botley West"
    assert I.gdelt_phrase(projects[2]) == "Mill Solar Farm"            # weak name: the full alias is asked
    assert I.gdelt_query("Botley West") == '"Botley West" solar sourcecountry:UK'
    assert I.gdelt_query("Sunnica") == "Sunnica solar sourcecountry:UK"
    assert "domainis:bbc.co.uk OR domainis:theguardian.com" in I.gdelt_query("Botley West", "domains")
    url = I.gdelt_url(I.gdelt_query("Botley West"), I.GDELT_WINDOWS[0][1], NOW)
    assert url.startswith("https://api.gdeltproject.org/api/v2/doc/doc?query=%22Botley+West%22+solar+sourcecountry%3AUK")
    assert "mode=artlist" in url and "format=json" in url and "startdatetime=20170101000000" in url
    assert "enddatetime=20261114120000" in url


def test_parse_gdelt():
    assert I.parse_gdelt("") == [] and I.parse_gdelt("{}") == []
    body = json.dumps({"articles": [{"url": "https://www.bbc.co.uk/news/a", "title": "Botley West solar farm refused",
                                     "seendate": "20261110T121500Z", "domain": "bbc.co.uk", "language": "English"}]})
    assert I.parse_gdelt(body) == [("Botley West solar farm refused", "https://www.bbc.co.uk/news/a", "bbc.co.uk",
                                    "2026-11-10", "English")]
    with pytest.raises(ValueError, match="too short"):
        I.parse_gdelt("The specified phrase is too short.")


def gdelt_body(*arts):
    return json.dumps({"articles": [{"url": u, "title": t, "seendate": d, "domain": "x", "language": "English"}
                                    for t, u, d in arts]})


def test_gdelt_cache_rate_limit_and_rotation(projects):
    calls, sleeps = [], []
    answers = {
        "Botley West": [(429, "rate limit"), (200, gdelt_body(
            ("Botley West solar farm refused", "https://www.bbc.co.uk/news/a", "20261110T120000Z"),
            ("Oxfordshire solar farm row deepens | Oxford Mail", "https://www.oxfordmail.co.uk/news/b", "20261001T120000Z"),
            ("Oxfordshire solar farm row deepens", "https://www.heraldseries.co.uk/news/b", "20261001T120000Z"),
            ("Solar tiles , roofs and prices", "https://www.oxfordmail.co.uk/news/d", "20261001T120000Z"),
            ("Oxfordshire reacts as Rigifa solar farm approved", "https://www.oxfordmail.co.uk/news/e", "20261001T120000Z"),
            ("Council budget agreed", "https://www.oxfordmail.co.uk/news/c", "20261002T120000Z"),
            ("Botley West solar farm refused", "https://news.google.com/x", "20261110T120000Z"),
            ("Botley West solar farm refused - Reuters", "https://www.reuters.com/x", "20261110T120000Z")))],
        "Rigifa": [(200, gdelt_body(("Rigifa solar farm in Caithness approved", "https://www.example.co.uk/r", "20260101T000000Z")))],
        "Mill Solar Farm": [(200, "{}")],
    }

    def fetch(url):
        calls.append(url)
        for phrase, queue in answers.items():
            if phrase.replace(" ", "+") in url:
                return queue.pop(0) if len(queue) > 1 else queue[0]
        return 200, "{}"

    cache = {}
    client = I.Gdelt(fetch, cache, NOW, cap=10, sleep=sleeps.append, interval=0)
    items, per_project, dropped = I.collect_gdelt(projects, client)
    assert client.stats["http_429"] == 1 and 10 in sleeps                 # waited ten seconds, retried once
    items = I.tidy(items)
    assert [(i["repd_ref"], i["family"], i["confidence"], i["title"]) for i in items] == [
        ("12588", "bbc", "confirmed", "Botley West solar farm refused"),
        ("12588", "regional", "uncertain", "Oxfordshire solar farm row deepens")]      # syndicated copy kept once
    assert "headline says solar and Oxfordshire but not the name" in items[1]["basis"]
    assert dropped["headline says solar but neither the name nor the county"] == 1
    assert dropped["headline names another of the 200"] == 1
    assert dropped["excluded source"] == 2 and dropped["headline has neither the name nor solar"] == 1
    assert dropped["exclude phrase"] == 1 and per_project["20001"]["kept"] == 0
    assert len(cache) == 3 and client.stats["empty"] == 1
    before = len(calls)
    again = I.Gdelt(fetch, cache, NOW, cap=10, sleep=sleeps.append, interval=0)
    items2, _, _ = I.collect_gdelt(projects, again)
    assert len(calls) == before and again.stats["cache_hits"] == 3 and len(I.tidy(items2)) == 2   # cached by query
    cache[I.gdelt_query("Botley West")]["fetched_at"] = "2026-11-01T00:00:00Z"
    del cache[I.gdelt_query("Rigifa")]
    assert [p["repd_ref"] for p in I.rotation(projects, cache)] == ["20001", "12588", "20002"]   # never asked first


def test_gdelt_stops_politely_and_respects_the_cap(projects, monkeypatch):
    monkeypatch.setattr(I, "GDELT_MAX_REFUSALS", 2)
    stopped = I.Gdelt(lambda url: (429, ""), {}, NOW, cap=10, sleep=lambda s: None, interval=0)
    items, per_project, _ = I.collect_gdelt(projects, stopped)
    assert items == [] and per_project == {} and "429" in stopped.stats["stopped"]
    assert stopped.stats["requests"] == 2 * I.GDELT_MAX_REFUSALS and stopped.stats["refused_queries"] == I.GDELT_MAX_REFUSALS
    capped = I.Gdelt(lambda url: (200, "{}"), {}, NOW, cap=1, sleep=lambda s: None, interval=0)
    I.collect_gdelt(projects, capped)
    assert capped.stats["requests"] == 1 and capped.stats["not_asked"] >= 2


def test_gdelt_carries_on_after_one_refused_query(tmp_path):
    top = tmp_path / "top.json"
    top.write_text(json.dumps(TOP + [FOUR]))
    projects = I.load_projects(top, None)
    seen = []

    def fetch(url):
        seen.append(url)
        return (429, "Please limit requests to one every 5 seconds or contact someone@example.org.") if "Botley" in url else (200, "{}")

    client = I.Gdelt(fetch, {}, NOW, cap=20, sleep=lambda s: None, interval=0)
    _, per_project, _ = I.collect_gdelt(projects, client)
    assert "12588" not in per_project and len(per_project) == 3 and not client.stats["stopped"]
    assert client.stats["refused_queries"] == 1 and "limit requests" in client.stats["error_samples"][0]
    assert "@" not in client.stats["error_samples"][0] and "(address removed)" in client.stats["error_samples"][0]
    assert I.gdelt_title("Government greenlights 400MW Beacon Fen solar , storage | Paper") == "Government greenlights 400MW Beacon Fen solar, storage"


def test_gdelt_time_budget(projects):
    ticks = iter(range(0, 10000, 50))
    client = I.Gdelt(lambda url: (200, "{}"), {}, NOW, cap=50, sleep=lambda s: None, interval=0, seconds=120,
                     clock=lambda: next(ticks))
    I.collect_gdelt(projects, client)
    assert "time budget" in client.stats["stopped"] and client.stats["not_asked"] >= 1 and client.stats["answered"] >= 1


def test_gdelt_steps_down_when_a_window_is_not_allowed(projects):
    def fetch(url):
        if "startdatetime" in url:
            return 200, "Invalid timespan or start date."
        return 200, gdelt_body(("Botley West solar farm refused", "https://www.bbc.co.uk/news/a", "20261110T120000Z"))

    client = I.Gdelt(fetch, {}, NOW, cap=10, sleep=lambda s: None, interval=0)
    assert len(client.ask(I.gdelt_query("Botley West"))) == 1
    assert client.stats["window"] == "last 12 months" and client.stats["errors"] == 0


def test_tidy_dedupes_prefers_confirmed_and_caps(projects):
    def item(n, confidence="uncertain", date="2026-01-0%d"):
        return {"repd_ref": "12588", "title": "t%d" % n, "link": "https://e.co.uk/%d" % n, "publisher": "e",
                "date": date % n if "%d" in date else date, "family": "regional", "basis": "b", "confidence": confidence}

    rows = [item(1), item(1, "confirmed"), item(2), item(3)] + [dict(item(4), repd_ref="99999")]
    out = I.tidy(rows, [item(5), {"repd_ref": "12588", "title": "g", "link": "https://news.google.com/x",
                                  "confidence": "uncertain", "date": None, "family": "regional"}], {"12588"})
    assert [i["link"][-1] for i in out] == ["1", "5", "3", "2"] and out[0]["confidence"] == "confirmed"
    assert len(I.tidy([item(n) for n in range(1, 10)], cap=3)) == 3
    cov = I.coverage(out, projects)
    assert cov["with_signal"] == 1 and cov["with_confirmed_signal"] == 1 and cov["with_signal_by_family"]["regional"] == 1


def test_main_offline_writes_the_contract_part(tmp_path, monkeypatch):
    top, aliases = tmp_path / "top.json", tmp_path / "aliases.json"
    top.write_text(json.dumps(TOP))
    aliases.write_text(json.dumps(ALIASES))
    monkeypatch.setattr(I, "fetch_feed", lambda url: rss(
        ("Botley West solar farm refused", "https://www.bbc.co.uk/news/articles/abc", "Tue, 10 Nov 2026 12:00:00 GMT", "s")))
    monkeypatch.setattr(I, "fetch_gdelt", lambda url: (200, "{}"))
    monkeypatch.setattr(I.time, "sleep", lambda s: None)
    monkeypatch.setattr(I, "GDELT_INTERVAL_S", 0)
    monkeypatch.setattr(I.Throttle, "wait", lambda self, host, interval=None: None)
    out, probe, cache = tmp_path / "part.json", tmp_path / "probe.md", tmp_path / "cache.json"
    code = I.main(["--top200", str(top), "--aliases", str(aliases), "--out", str(out), "--probe", str(probe),
                   "--cache", str(cache), "--now", NOW, "--truth", str(tmp_path / "none.json")])
    part = json.loads(out.read_text())
    assert code == 0 and part["schema"] == "project-signals-part.v1" and part["team"] == "index"
    assert [s["id"] for s in part["sources"]] == ["bbc-rss", "guardian-rss", "gdelt-doc"]
    assert all(set(s) == {"id", "url", "status", "requests", "failures", "items", "error"} for s in part["sources"])
    assert len(part["items"]) == 1                                         # the same link from many feeds, once
    assert set(part["items"][0]) == {"repd_ref", "title", "link", "publisher", "date", "family", "basis", "confidence"}
    assert part["coverage"]["with_signal"] == 1
    assert "1 of 3" in probe.read_text() and len(json.loads(cache.read_text())["queries"]) == 3
    text = out.read_text() + probe.read_text()
    assert "/home/" not in text and "@" not in text
