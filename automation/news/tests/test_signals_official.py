"""Tests for automation/news/signals/official.py. Offline: synthetic responses in the shape each source returns."""
from __future__ import annotations

import json
import sys
import urllib.error
from pathlib import Path

import pytest

SIG = Path(__file__).resolve().parents[1] / "signals"
sys.path.insert(0, str(SIG))

import official as O  # noqa: E402

NOW = "2026-11-14T12:00:00Z"
PINS_CSV = (
    "Project reference,Project name,Applicant name,Stage,Date of application,Date of decision,"
    "Anticipated submission date\r\n"
    "EN010147,Botley West Solar Farm,SolarFive Ltd,Decided,15/11/2024,10/11/2026,\r\n"
    "EN010148,Tween Bridge Solar Farm,RWE,Recommendation,2025-08-01,,\r\n"
    "EN010999,Hedgehog Grove Solar Farm,Example,Pre-application,,,01/03/2027\r\n"
    "EN020001,Some Power Line,National Grid,Decided,01/01/2020,01/01/2022,\r\n").encode()
GOVUK = {"results": [
    {"title": "Botley West Solar Farm: development consent decision", "link": "/government/publications/botley-west",
     "public_timestamp": "2026-11-10T15:00:00.000+00:00", "organisations": [{"title": "Department for Energy Security and Net Zero"}],
     "format": "decision", "description": "Decision on the application for development consent."},
    {"title": "Planning decisions this week", "link": "/government/news/decisions",
     "public_timestamp": "2026-11-11T09:00:00Z", "organisations": [], "format": "news",
     "description": "Includes Botley West Solar Farm in Oxfordshire."},
    {"title": "Botley village hall grant", "link": "/government/news/botley-hall",
     "public_timestamp": "2026-10-01T09:00:00Z", "organisations": [], "format": "news", "description": "A grant."},
]}


def project(ref="12588", alias="Botley West Solar Farm", pref="EN010147", authority="The Planning Inspectorate - National Infrastructure",
            status="confirmed", **extra):
    base = {"repd_ref": ref, "rank": 1, "site_name": alias, "operator": "Photovolt Development Partners & SolarFive",
            "mw": 840.0, "county": "Oxfordshire", "country": "England", "planning_authority": authority,
            "planning_ref": pref, "aliases": [alias], "alias_status": status, "exclude": [], "planning_file": None}
    base.update(extra)
    return base


class FakeFetcher:
    def __init__(self, routes):
        self.routes, self.calls = routes, []

    def get(self, url, accept="*/*"):
        self.calls.append(url)
        for prefix, value in self.routes.items():
            if url.startswith(prefix):
                if isinstance(value, Exception):
                    raise value
                return url, "text/plain", value(url) if callable(value) else value
        raise O.FetchError("HTTP 404", 404)


def test_derive_alias_strips_place_prefix_and_storage_tail():
    assert O.derive_alias("Springwell, Lincoln - Springwell Solar Farm & Battery Storage") == "Springwell Solar Farm"
    assert O.derive_alias("Bolt Hall Farm, Lark Hill Road - Solar Photovoltaic Farm") == "Bolt Hall Farm Solar Farm"
    assert O.derive_alias("Longfield") == "Longfield Solar Farm"
    assert O.derive_alias("The Tween Bridge Solar Farm ") == "Tween Bridge Solar Farm"


def test_match_needs_the_alias_in_the_title_or_summary_with_a_second_fact():
    p = project()
    assert O.match(p, "Botley West Solar Farm refused consent")[1] == "confirmed"
    assert O.match(p, "Planning decisions", "Includes Botley West Solar Farm in Oxfordshire.")
    assert O.match(p, "Planning decisions", "Includes Botley West Solar Farm.") is None
    assert O.match(p, "Botley village hall grant", "A grant.") is None
    assert O.match(p, "Decision letter EN010147") [0].startswith("planning reference")
    assert O.match(p, "Botley West: solar scheme decision")           # core of the alias plus a solar term


def test_match_whole_words_exclusions_and_uncertain_aliases():
    p = project(alias="Longfield Solar Farm", status="uncertain", exclude=["Longfield Academy"])
    assert O.match(p, "Longfield Solar Farm approved")[1] == "uncertain"
    assert O.match(p, "Longfields Solar Farm approved") is None
    assert O.match(p, "Longfield Solar Farm visit by Longfield Academy") is None
    generic = project(alias="Cowley Complex", pref="20/2131/FUL", authority="Stockton-on-Tees")
    assert O.match(generic, "Cowley Complex opens") is None           # no solar or energy word anywhere
    assert O.match(generic, "Cowley Complex solar farm opens")


def test_pins_csv_gives_the_newest_past_milestone_by_reference():
    rows = O.parse_pins_csv(PINS_CSV)
    assert [r["ref"] for r in rows] == ["EN010147", "EN010148", "EN010999", "EN020001"]
    items, found = O.pins_items([project(), project("12926", "Tween Bridge Solar Farm", "EN010148")], rows, "2026-11-14")
    assert items[0]["date"] == "2026-11-10" and items[0]["title"] == "Botley West Solar Farm: decision (stage: Decided)"
    assert items[0]["link"].endswith("/projects/EN010147") and items[0]["family"] == "official"
    assert items[0]["confidence"] == "confirmed" and items[0]["publisher"] == "Planning Inspectorate"
    assert items[1]["date"] == "2025-08-01" and "application" in items[1]["title"]
    assert set(found) == {"12588", "12926"}


def test_pins_lookup_by_alias_only_for_inspectorate_rows_without_a_national_reference():
    rows = O.parse_pins_csv(PINS_CSV)
    hedgehog = project("18870", "Hedgehog Grove Solar Farm", "26/00440/FUL")
    items, _ = O.pins_items([hedgehog], rows, "2026-11-14")
    assert items[0]["date"] is None and items[0]["confidence"] == "uncertain" and "EN010999" in items[0]["link"]
    local = project("1", "Tween Bridge Solar Farm", "21/0001/FUL", authority="Doncaster")
    assert O.pins_items([local], rows, "2026-11-14")[0] == []
    with pytest.raises(ValueError):
        O.parse_pins_csv(b"a,b\n1,2\n")


def test_govuk_search_keeps_matching_results_only():
    fetcher = FakeFetcher({O.GOVUK_SEARCH: json.dumps(GOVUK).encode()})
    items, record = O.source_govuk([project()], fetcher)
    assert [i["link"] for i in items] == ["https://www.gov.uk/government/news/decisions",
                                          "https://www.gov.uk/government/publications/botley-west"]
    assert items[1]["publisher"] == "Department for Energy Security and Net Zero" and items[1]["date"] == "2026-11-10"
    assert record["status"] == "ok" and record["requests"] == 2 and record["items"] == 2
    assert "%22Botley+West+Solar+Farm%22" in fetcher.calls[0] and "q=EN010147" in fetcher.calls[1]


def test_one_failing_source_never_stops_a_run():
    fetcher = FakeFetcher({O.PINS_CSV: O.FetchError("HTTP 503", 503), O.GOVUK_SEARCH: json.dumps(GOVUK).encode(),
                           "https://www.energyconsents.scot/": b"<html><title>Case</title>ECU00005085 Bowshiel Solar Farm</html>"})
    scottish = project("17779", "Bowshiel Solar Farm", "ECU00005085", authority="Scottish Government (S36)")
    items, records, _ = O.run([project(), scottish], fetcher, "2026-11-14")
    status = {r["id"]: r["status"] for r in records}
    assert status == {"pins-register": "failed", "govuk-search": "ok", "ecu-case": "ok"}
    ecu = [i for i in items if i["repd_ref"] == "17779"]
    assert ecu and ecu[0]["date"] is None and ecu[0]["confidence"] == "confirmed" and "ECU00005085" in ecu[0]["link"]
    part = O.build_part(items, records, NOW)
    assert part["schema"] == "project-signals-part.v1" and part["team"] == "official"
    for it in part["items"]:
        assert set(it) >= {"repd_ref", "title", "link", "publisher", "date", "family", "basis", "confidence"}
        assert it["family"] == "official" and it["link"].startswith("https://") and len(it["title"]) <= 300
    report = O.probe_report([project(), scottish], items, records, NOW)
    assert "2 of 2 projects" in report and "pins-register" in report


def test_fetcher_throttles_per_host_retries_once_on_429_and_caps():
    slept, clock, calls = [], [0.0], []

    def opener(url, accept):
        calls.append(url)
        if len(calls) == 2:
            raise urllib.error.HTTPError(url, 429, "Too Many", {}, None)
        return 200, url, "text/plain", b"ok"

    def sleep(seconds):
        slept.append(seconds)
        clock[0] += seconds

    f = O.Fetcher(opener=opener, sleep=sleep, clock=lambda: clock[0], host_cap=4)
    assert f.get("https://a.example/1")[2] == b"ok"
    assert f.get("https://a.example/2")[2] == b"ok"            # 429, wait ten seconds, one retry
    assert 10 in slept and slept[0] == pytest.approx(1.0)
    assert f.get("https://b.example/1")[2] == b"ok"            # another host: its own allowance
    f.get("https://a.example/3")
    with pytest.raises(O.FetchError):
        f.get("https://a.example/4")                           # cap of four requests for the host
    with pytest.raises(O.FetchError):
        f.get("http://a.example/plain")


def test_shipped_tables_cover_the_200():
    projects = O.load_projects()
    assert len(projects) == 200 and len({p["repd_ref"] for p in projects}) == 200
    table = json.loads((SIG / "aliases.json").read_text(encoding="utf-8"))
    assert table["schema"] == "project-signal-aliases.v1" and set(table["projects"]) == {p["repd_ref"] for p in projects}
    for p in projects:
        assert p["aliases"] and all(len(a) >= 4 for a in p["aliases"]) and p["alias_status"] in ("confirmed", "uncertain", "derived")
    text = (SIG / "aliases.json").read_text(encoding="utf-8")
    assert "@" not in text.replace("@id", "") and "/home/" not in text
