"""Offline tests for the shared title gate (gate.py) and date rule (dates.py), through all three collectors."""
from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

SIGNALS = Path(__file__).resolve().parents[1]
for path in (str(SIGNALS.parent), str(SIGNALS)):
    if path not in sys.path:
        sys.path.insert(0, path)

import combine as C  # noqa: E402
import dates as DATES  # noqa: E402
import gate as G  # noqa: E402
import index as I  # noqa: E402
import official as O  # noqa: E402
import trade as T  # noqa: E402

CASES = json.loads((SIGNALS / "tests" / "fixtures" / "gate_cases.json").read_text(encoding="utf-8"))
EXCLUSIONS = json.loads((SIGNALS / "exclusions.json").read_text(encoding="utf-8"))["projects"]
TODAY = dt.date(2026, 11, 14)


def test_gate_verdicts_on_the_plain_cases():
    for ref, title, verdict in (
            ("12588", "UK government refuses 840MW Botley West Solar Farm", "ok"),
            ("12588", "Botley West footpath closed after landslip", "drop"),              # a distinctive name alone
            ("12588", "Miliband refuses Botley West", "possible"),                        # planning word, no solar term
            ("12588", "Decision on EN010147 published", "ok"),                            # the reference is enough
            ("12588", "Huge solar farm refused in Oxfordshire", "none"),                  # the title does not name it
            ("9050", "Contractor named for £60m Lincolnshire bypass", "drop"),            # name and county, no solar term
            ("9050", "Bypass diodes: why solar modules fail in the field", "drop"),
            ("17429", "Fosse Way near Leamington now clear after earlier accident", "drop"),
            ("12117", "The new pavements installed on Cardiff's Cowbridge Road and how they work", "drop"),
            ("8483", "Belvoir Castle sees visitor numbers rise as it opens for the new season", "drop"),
            ("10529", "New life for Red House", "drop"),
            ("11678", "East Yorkshire bus drivers vote to strike", "drop"),
            ("7945", "Cornwell solar panels on village hall", "drop"),                    # panels are not a solar farm
            ("19007", "Thornton solar farm plan in Lancashire", "drop"),                  # another county
            ("11476", "Helios Solar Farm reaches financial close in Spain", "drop"),      # abroad
            ("6012", "Kells solar farm plan in County Meath", "drop"),
            ("8479", "Octopus Energy fined for breach of supply rules", "drop"),          # a developer and an everyday word
            ("15252", "RES wins permit for 450MW Steeple solar farm", "ok"),
            ("7188", "500MW Sunnica permit call hit by fresh delay", "ok"),               # the project's own capacity
            ("9904", "Windel, Canadian Solar file Mallard Pass paperwork", "ok"),         # "Canadian" is the developer here
            ("14096", "Cubico opens Frodsham consultation", "possible")):                 # developer only
        assert G.judge(ref, title)[0] == verdict, (ref, title, G.judge(ref, title))
    assert G.judge("15793", "Green Hill Solar Farm development consent decision announced", official=True)[0] == "ok"
    assert G.judge("99999", "Anything") == ("none", "")


def test_no_false_headline_is_confirmed_by_the_gate_beyond_the_known_few():
    verdicts = [G.judge(ref, title)[0] for ref, title, _real in CASES["false"]]
    assert len(verdicts) == 240
    assert verdicts.count("ok") <= 12, verdicts.count("ok")            # was 168 "confirmed" before the gate
    assert verdicts.count("drop") >= 190
    real = [G.judge(ref, title)[0] for ref, title, is_real in CASES["false"] if is_real]
    assert real == ["drop"] * 7                                        # the seven real published headlines


def test_true_headlines_survive_the_gate():
    lost = [(ref, title) for ref, title, team in CASES["true"] if G.judge(ref, title, official=team == "official")[0] != "ok"]
    assert lost == [] and len(CASES["true"]) >= 80


def test_all_three_collectors_reject_the_false_headlines():
    trade = {p.ref: p for p in T.load_projects(str(SIGNALS / "aliases.json"))}
    official = {p["repd_ref"]: p for p in O.load_projects()}
    index = {p["repd_ref"]: p for p in I.load_projects(str(SIGNALS / "top200_solar.json"), str(SIGNALS / "aliases.json"))}
    counts = {"trade": 0, "trade confirmed": 0, "official": 0, "index": 0, "index strong": 0, "confirmed and not excluded": 0}
    for ref, title, _real in CASES["false"]:
        t, o, i = trade[ref].match(title), O.match(official[ref], title), I.match_item(index[ref], title)
        counts["trade"] += bool(t)
        counts["trade confirmed"] += bool(t and t[1] == "confirmed")
        counts["official"] += bool(o)
        counts["index"] += bool(i)
        counts["index strong"] += bool(i and i[0] == "strong")
        confirmed = (t and t[1] == "confirmed") or (o and o[1] == "confirmed") or (i and i[0] == "strong")
        excluded = C.exclusion_reason({"title": title, "link": "https://example.co.uk/x"}, EXCLUSIONS.get(ref) or {})
        counts["confirmed and not excluded"] += bool(confirmed and not excluded)
    # before the gate (the tester's run of the same file): trade 229, index 85, official 45, 168 confirmed
    assert counts["trade"] <= 50 and counts["trade confirmed"] <= 12, counts
    assert counts["official"] <= 16 and counts["index"] <= 20, counts
    assert counts["confirmed and not excluded"] <= 18, counts


def test_collectors_still_match_the_true_headlines():
    trade = {p.ref: p for p in T.load_projects(str(SIGNALS / "aliases.json"))}
    official = {p["repd_ref"]: p for p in O.load_projects()}
    missed = []
    for ref, title, team in CASES["true"]:
        found = trade[ref].match(title) if team == "trade" else O.match(official[ref], title)
        if not found:
            missed.append((team, ref, title))
    assert missed == []


def test_combiner_purges_a_carried_false_match_and_keeps_reviewed_items():
    rows = json.loads((SIGNALS / "top200_solar.json").read_text())
    aliases = json.loads((SIGNALS / "aliases.json").read_text())
    exclusions = {"projects": EXCLUSIONS}
    standings = json.loads((SIGNALS / "alias_standings.json").read_text())
    stamp = "2026-11-14T12:34:49Z"
    previous = {"schema": "project-signals.v1", "generated_at": "2026-11-14T12:46:07Z",
                "parts": {"trade": {"status": "ok", "items": 3, "generated_at": stamp}},
                "projects": {"11678": {"signals": [
                    {"title": "Falling masonry kills man in East Yorkshire", "link": "https://www.constructionenquirer.com/a",
                     "publisher": "Construction Enquirer", "date": "2026-11-05", "family": "trade", "basis": "alias", "confidence": "confirmed"},
                    {"title": "Boom Power secures planning permission for 49.99MW Drove Lane solar PV plant in East Yorkshire",
                     "link": "https://www.solarpowerportal.co.uk/b", "publisher": "Solar Power Portal", "date": "2026-10-23",
                     "family": "trade", "basis": "alias", "confidence": "confirmed"}]},
                    "12588": {"signals": [
                        {"title": "UK rejects 840MW Botley West solar farm", "link": "https://renews.biz/c", "publisher": "reNEWS",
                         "date": "2026-11-10", "family": "trade", "basis": "alias", "confidence": "confirmed"}]}}}
    result = C.combine(rows, aliases, {}, previous=previous, now_iso="2026-11-15T05:23:00Z", use_module=False,
                       exclusions=exclusions, standings=standings)
    assert [i for t in C.TIERS for i in result["projects"]["11678"][t]] == []
    kept = result["projects"]["12588"]["recent_news"]
    assert [i["title"] for i in kept] == ["UK rejects 840MW Botley West solar farm"] and kept[0]["collected_at"] == stamp
    assert result["dropped"]["title gate"] == 1 and result["dropped"]["exclusion rule"] == 1
    assert result["generated_at"] == stamp and result["parts"]["trade"]["status"] == "stale"


def test_shared_links_follow_the_reviewers_findings():
    rows = json.loads((SIGNALS / "top200_solar.json").read_text())
    aliases = json.loads((SIGNALS / "aliases.json").read_text())
    reviewed = json.loads((SIGNALS / "reviewed_signals.json").read_text())
    reviewed["items"].append({"repd_ref": "7840", "title": "£80m solar farm gets green light", "publisher": "Evesham Observer",
                              "link": "http://www.eveshamobserver.co.uk/?p=35578", "date": "2014-11-13", "family": "regional",
                              "basis": "reviewed 2026-11-14", "confidence": "confirmed"})
    result = C.combine(rows, aliases, {"reviewed": reviewed}, now_iso="2026-11-14T12:00:00Z", use_module=False,
                       exclusions={"projects": EXCLUSIONS}, standings=json.loads((SIGNALS / "alias_standings.json").read_text()))

    def on(ref, needle):
        return [i for t in C.TIERS for i in result["projects"][ref][t] if needle in i["link"]]

    assert on("1980", "eveshamobserver") and not on("7840", "eveshamobserver")          # the 2014 approval is 1980's
    assert on("11278", "inkl.com") and not on("7191", "inkl.com")                         # one refusal, one project
    for ref, other in (("9729", "9739"), ("9739", "9729"), ("7823", "8254"), ("8254", "7823")):
        assert on(ref, "morpethherald" if ref.startswith("97") else "high-court")[0]["also_projects"] == [other]
    for ref in ("6071", "7630"):                                                         # names neither: never as fact
        assert on(ref, "edf-acquires-100mw")[0]["confidence"] == "possible"
    assert "Defford Aerodrome solar farm" not in aliases["projects"]["7840"]["aliases"]


def test_link_key_recognises_copies_of_one_page():
    same = (("http://eveshamobserver.co.uk/?p=35578", "https://eveshamobserver.co.uk/?p=35578"),
            ("https://thecourier.co.uk/fp/news/x", "https://www.thecourier.co.uk/fp/news/x"),
            ("https://m.thecourier.co.uk/fp/news/x", "https://www.thecourier.co.uk/fp/news/x"),
            ("https://www.energyglobal.com/solar/13102025/a/amp/", "https://www.energyglobal.com/solar/13102025/a"),
            ("https://www.energyglobal.com/solar/12122025/b/", "https://www.energyglobal.com/solar/12122025/b"),
            ("https://moderngov.stockton.gov.uk/Data/Planning Committee/1/att.pdf", "https://moderngov.stockton.gov.uk/Data/Planning%20Committee/1/att.pdf"),
            ("https://x.example/a?a=1&b=2", "https://x.example/a?b=2&a=1"),
            ("https://x.example/projects/EN010118?lang=en", "https://x.example/projects/EN010118"))
    for a, b in same:
        assert C.link_key(C.D.canonical_link(a) or a) == C.link_key(C.D.canonical_link(b) or b), (a, b)
    assert C.link_key("https://eveshamobserver.co.uk/?p=35578") != C.link_key("https://eveshamobserver.co.uk/?p=35579")


def test_one_date_rule_for_collectors_and_combiner():
    for value, expected in (
            ("Fri, 14 Nov 2026 10:00:00 -0000", "2026-11-14"), ("Fri, 14 Nov 2026 10:00:00 BST", "2026-11-14"),
            ("Fri, 14 Nov 2026 10:00:00 CET", "2026-11-14"), ("Fri, 14 Nov 2026 10:00:00", "2026-11-14"),
            ("2026-11-14", "2026-11-14"), ("2026-11-14T10:00:00", "2026-11-14"), ("20261114", "2026-11-14"),
            ("Sat, 14 Nov 26 10:00:00 GMT", "2026-11-14"), ("Sun, 14 Nov 49 10:00:00 GMT", None),
            ("Fri, 14 Nov 69 10:00:00 GMT", None), ("2027-01-01T00:00:00Z", None), ("Thu, 01 Jan 1970 00:00:00 GMT", None),
            ("Sat, 15 Nov 2026 00:30:00 +0100", "2026-11-15"), ("2026-11-14T23:30:00-05:00", "2026-11-14"),
            ("Mon, 30 Feb 2026 10:00:00 GMT", None), ("2026-02-30", None), ("2026-99-99", None), ("2026-13-45", None),
            ("0000-00-00", None), ("03/04/2026", "2026-04-03"), ("3/4/26", "2026-04-03"), ("1/2/0026", None),
            ("2026-11-14 10:00", "2026-11-14"), ("14 Sept 2026", "2026-09-14"), ("14.11.2026", "2026-11-14"),
            ("04/14/2026", "2026-04-14"), ("", None), (None, None), ("last week", None)):
        assert DATES.day(value, TODAY) == expected, value
        assert C.parse_date(value, TODAY) == expected, value
    assert DATES.day("2026-11-15", TODAY) == "2026-11-15" and DATES.day("2026-11-16", TODAY) is None   # tomorrow, not later
    assert T.day_of("2026-11-14T23:30:00-05:00") == "2026-11-14" and T.day_of("Fri, 14 Nov 2026 10:00:00 BST") == "2026-11-14"
    assert O.parse_day("3/4/26") == "2026-04-03" and O.parse_day("1/2/0026") is None and O.parse_day("14 Sept 2026") == "2026-09-14"
    assert T.date_near("Nov 10, 2026 | Related: Solar farm refused 3 December 2025") == "2026-11-10"
    assert T.date_near("Hearing on 3 December 2099") is None
    assert DATES.url_day("https://www.energyglobal.com/solar/12052025/a-headline/") == "2025-05-12"
    assert DATES.url_day("https://now.solar/2026/10/29/a-headline/") == "2026-10-29"
    assert DATES.url_day("https://example.co.uk/news/2025/06/a-headline") is None
    assert DATES.url_year("https://example.co.uk/news/2025/06/a-headline") == 2025


def test_year_is_kept_for_an_undated_item_when_the_link_or_the_reviewer_gives_it():
    rows = [{"rank": 1, "repd_ref": "12588", "site_name": "Botley West Solar Project", "planning_ref": "EN010147"}]
    reviewed = {"schema": C.PART_SCHEMA, "team": "reviewed", "generated_at": "2026-11-14T12:00:00Z", "sources": [], "items": [
        {"repd_ref": "12588", "title": "Update", "link": "https://example.co.uk/wp-content/uploads/2023/12/update.pdf",
         "publisher": "Parish", "date": None, "year": 2024, "family": "regional", "basis": "reviewed 2026-11-14", "confidence": "confirmed"},
        {"repd_ref": "12588", "title": "Milestone", "link": "https://example.co.uk/newsroom/2026/milestone/",
         "publisher": "Paper", "date": None, "family": "regional", "basis": "reviewed 2026-11-14", "confidence": "confirmed"},
        {"repd_ref": "12588", "title": "No clue", "link": "https://example.co.uk/a", "publisher": "Paper", "date": None,
         "family": "regional", "basis": "reviewed 2026-11-14", "confidence": "confirmed"}]}
    result = C.combine(rows, None, {"reviewed": reviewed}, now_iso="2026-11-14T12:00:00Z", use_module=False)
    got = {i["title"]: (i["year"], i["freshness"], i["tier"]) for i in result["projects"]["12588"]["archive"]}
    assert got == {"Update": (2024, "undated", "archive"), "Milestone": (2026, "undated", "archive"), "No clue": (None, "undated", "archive")}
    assert result["projects"]["12588"]["recent_news"] == [] and C.schema_errors(result) == []


def test_a_part_file_older_than_two_days_is_stale_not_ok():
    rows = [{"rank": 1, "repd_ref": "12588", "site_name": "Botley West Solar Project", "planning_ref": "EN010147"}]
    old = {"schema": C.PART_SCHEMA, "team": "trade", "generated_at": "2026-10-01T00:00:00Z", "sources": [], "items": [
        {"repd_ref": "12588", "title": "Botley West Solar Farm refused", "link": "https://example.co.uk/a", "publisher": "Paper",
         "date": "2026-09-30", "family": "trade", "basis": "alias", "confidence": "confirmed"}]}
    result = C.combine(rows, None, {"trade": old}, now_iso="2026-11-14T12:00:00Z", use_module=False)
    assert result["parts"]["trade"]["status"] == "failed" and "older than 48 hours" in result["parts"]["trade"]["note"]
    assert result["generated_at"] is None and result["stale"] is True
