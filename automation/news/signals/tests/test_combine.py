"""Offline tests for automation/news/signals/combine.py (contract version 2)."""
from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

SIGNALS = Path(__file__).resolve().parents[1]
for path in (str(SIGNALS.parent), str(SIGNALS)):
    if path not in sys.path:
        sys.path.insert(0, path)

import combine as C  # noqa: E402

NOW = "2026-11-14T12:00:00Z"
LATER = "2026-11-15T05:23:00Z"
ROWS = [
    {"rank": 1, "repd_ref": "12588", "site_name": "Botley West, Botley - Botley West Solar Project", "country": "England",
     "county": "Oxfordshire", "mw": 840.0, "operator": "Photovolt Development Partners",
     "planning_authority": "The Planning Inspectorate - National Infrastructure", "planning_ref": "EN010147"},
    {"rank": 2, "repd_ref": "20001", "site_name": "Rigifa Solar Farm", "country": "Scotland",
     "planning_authority": "Scottish Government (S36)", "planning_ref": "ECU00004567"},
    {"rank": 3, "repd_ref": "9050", "site_name": "Bypass Solar Farm", "country": "England", "county": "Lincolnshire",
     "mw": 49.99, "operator": "By-Pass Farm Solar Limited", "planning_authority": "South Kesteven", "planning_ref": "S20/1433"},
    {"rank": 4, "repd_ref": "20003", "site_name": "Quiet Solar Farm", "country": "Wales",
     "planning_authority": "Welsh Government (PEDW)", "planning_ref": "DNS/3240001"},
    {"rank": 5, "repd_ref": "20004", "site_name": "Hulam Solar Farm", "country": "England", "county": "Durham",
     "planning_authority": "Durham", "planning_ref": "DM/20/1"},
]
ALIASES = {"projects": {
    "12588": {"aliases": ["Botley West Solar Farm"], "alias_status": "confirmed", "alias_evidence": "developer and EN010147 agree",
              "planning_file": {"authority": "The Planning Inspectorate", "reference": "EN010147", "kind": "pins_project",
                                "verified": True,
                                "url": "https://national-infrastructure-consenting.planninginspectorate.gov.uk/projects/EN010147"}},
    "20001": {"aliases": ["Rigifa Solar Farm"], "alias_status": "confirmed", "alias_evidence": "", "alias_evidence_url": ""},
    "9050": {"aliases": ["Bypass Solar Farm", "Foston solar farm"], "alias_status": "confirmed",
             "alias_evidence": "applicant and authority agree"},
    "20003": {"aliases": ["Quiet Solar Farm"], "alias_status": "uncertain", "alias_evidence": "one article"},
    "20004": {"aliases": ["Hulam Solar Farm"], "alias_status": "confirmed", "alias_evidence_url": "https://example.co.uk/e"},
}}
EXCLUSIONS = json.loads((SIGNALS / "exclusions.json").read_text())


def item(ref, n, family="trade", date="2026-11-01", confidence="confirmed", **more):
    base = {"repd_ref": ref, "title": "Headline %s" % n, "link": "https://example.co.uk/%s?utm_source=x" % n,
            "publisher": "Example", "date": date, "family": family, "basis": "alias in title", "confidence": confidence}
    base.update(more)
    return base


def part(team, items, sources=None, at=NOW):
    return {"schema": C.PART_SCHEMA, "team": team, "generated_at": at, "items": items,
            "sources": sources if sources is not None else [{"id": team + "-src", "url": "https://example.co.uk/", "status": "ok",
                                                             "requests": 3, "failures": 0, "items": len(items), "error": ""}]}


def run(parts, previous=None, now=NOW, **more):
    more.setdefault("exclusions", EXCLUSIONS)
    return C.combine(ROWS, ALIASES, parts, previous=previous, now_iso=now, use_module=False, **more)


def everything(project):
    return [i for tier in C.TIERS for i in project[tier]]


# ---------------------------------------------------------------- tiers, never mixed

def test_no_parts_every_project_has_a_planning_file_labelled_as_what_it_is():
    result = C.combine(ROWS, None, {}, now_iso=NOW, use_module=False)
    c = result["counts"]
    assert c["by_tier"] == {"recent_news": 0, "official": 0, "archive_only": 0, "planning_file_only": 5, "nothing": 0}
    assert c["headline"] == {"label": "projects with recent verified news", "value": 0}
    assert result["generated_at"] is None and result["stale"] is False
    assert {t: s["status"] for t, s in result["parts"].items()} == {
        "official": "absent", "trade": "absent", "index": "absent", "reviewed": "absent", "planning": "absent"}
    files = {ref: p["planning_file"] for ref, p in result["projects"].items()}
    assert files["12588"]["label"] == "planning file (unverified link)" and files["12588"]["link_type"] == "direct"
    assert files["20001"]["label"] == "planning register search" and files["20001"]["note"] == "search for ECU00004567"
    assert files["9050"]["label"] == "planning register finder" and "S20/1433" in files["9050"]["note"]
    assert all(f["verified"] is False for f in files.values())
    assert all(p["recent_news"] == p["official"] == p["archive"] == [] for p in result["projects"].values())
    assert C.schema_errors(result) == []


def test_tier_comes_from_the_date_and_family_not_from_how_the_item_arrived():
    index = part("index", [item("12588", "new", "bbc", "2026-11-10"), item("12588", "edge", "trade", "2026-08-16"),
                           item("12588", "old", "regional", "2026-08-15"), item("12588", "undated", "national", None),
                           item("12588", "dev", "trade", "2026-11-12", link="https://www.pvdp.co.uk/news/1")])
    official = part("official", [item("12588", "notice", "official", "2024-01-05"), item("12588", "case", "official", None)])
    reviewed = part("reviewed", [item("12588", "r-new", "regional", "2026-11-01", basis="reviewed 2026-11-14"),
                                 item("12588", "r-old", "regional", "2014-11-13", basis="reviewed 2026-11-14")])
    p = run({"index": index, "official": official, "reviewed": reviewed})["projects"]["12588"]
    assert [i["title"] for i in p["recent_news"]] == ["Headline new", "Headline r-new", "Headline edge"]
    assert [(i["title"], i["freshness"]) for i in p["official"]] == [("Headline notice", "older")]
    assert {i["title"]: (i["year"], i["freshness"]) for i in p["archive"]} == {
        "Headline dev": (2026, "recent"), "Headline old": (2026, "older"), "Headline r-old": (2014, "older"),
        "Headline undated": (None, "undated"), "Headline case": (None, "undated")}
    assert all(i["tier"] == tier for tier in C.TIERS for i in p[tier])
    assert {i["obtained"] for i in everything(p) if i["title"].startswith("Headline r-")} == {"reviewed"}
    assert all(i["collected_at"] == NOW and "utm_" not in i["link"] for i in everything(p))
    assert p["tier"] == "recent_news"


def test_freshness_is_measured_from_the_run_not_from_collection():
    index = part("index", [item("12588", "a", "bbc", "2026-11-10")])
    first = run({"index": index})
    much_later = run({}, previous=first, now="2027-03-01T00:00:00Z")
    kept = much_later["projects"]["12588"]
    assert kept["recent_news"] == [] and kept["archive"][0]["freshness"] == "older"
    assert kept["archive"][0]["collected_at"] == NOW and much_later["counts"]["headline"]["value"] == 0


def test_impossible_and_future_dates_are_treated_as_undated():
    index = part("index", [item("12588", "feb30", date="2026-02-30"), item("12588", "month99", date="2026-99-99"),
                           item("12588", "tomorrow2", date="2026-11-16"), item("12588", "text", date="last week"),
                           item("12588", "stamp", date="2026-11-13T08:00:00Z")])
    p = run({"index": index})["projects"]["12588"]
    assert [i["title"] for i in p["recent_news"]] == ["Headline stamp"] and p["recent_news"][0]["date"] == "2026-11-13"
    assert len(p["archive"]) == 4 and all(i["date"] is None and i["freshness"] == "undated" for i in p["archive"])


# ---------------------------------------------------------------- ordering

def test_newest_first_confidence_only_breaks_ties_undated_last():
    index = part("index", [item("12588", "old-confirmed", "trade", "2026-09-01"),
                           item("12588", "new-possible", "trade", "2026-11-13", "uncertain"),
                           item("12588", "same-day-possible", "bbc", "2026-10-01", "uncertain"),
                           item("12588", "same-day-confirmed", "regional", "2026-10-01")])
    old = part("reviewed", [item("12588", "undated-confirmed", "trade", None, basis="reviewed 2026-11-14"),
                            item("12588", "y2014", "trade", "2014-01-01", "uncertain", basis="reviewed 2026-11-14")])
    result = run({"index": index, "reviewed": old})
    p = result["projects"]["12588"]
    assert [i["title"] for i in p["recent_news"]] == ["Headline new-possible", "Headline same-day-confirmed",
                                                      "Headline same-day-possible", "Headline old-confirmed"]
    assert p["recent_news"][0]["confidence"] == "possible"              # shown first, but labelled, never as fact
    assert [i["title"] for i in p["archive"]] == ["Headline y2014", "Headline undated-confirmed"]
    assert C.schema_errors(result) == []


def test_a_recent_item_is_never_hidden_by_older_ones():
    older = [item("12588", "o%d" % n, "trade", "2025-%02d-01" % n) for n in range(1, 10)]
    recent = [item("12588", "sale", "trade", "2026-11-13", "uncertain", title="TotalEnergies acquires 450MW solar project")]
    p = run({"trade": part("trade", older + recent)})["projects"]["12588"]
    assert [i["title"] for i in p["recent_news"]] == ["TotalEnergies acquires 450MW solar project"]
    assert p["recent_news"][0]["event"] == "sale" and len(p["archive"]) == C.MAX_PER_TIER
    assert p["archive"][0]["date"] == "2025-09-01"


# ---------------------------------------------------------------- confidence earned

def test_confidence_needs_recorded_alias_evidence():
    index = part("index", [item("12588", "a", date="2026-11-01"), item("20001", "b", date="2026-11-01", title="Rigifa Solar Farm approved"),
                           item("20003", "c", date="2026-11-01", title="Quiet Solar Farm approved")])
    result = run({"index": index})
    assert result["projects"]["12588"]["alias_standing"] == "confirmed"
    assert result["projects"]["20001"]["alias_standing"] == "possible"       # confirmed status, but no evidence recorded
    assert result["projects"]["20003"]["alias_standing"] == "possible"
    assert result["projects"]["20001"]["recent_news"][0]["confidence"] == "possible"
    assert result["counts"]["headline"]["value"] == 1 and result["counts"]["with_possible_recent_news"] == 2
    assert result["counts"]["by_tier"]["archive_only"] == 2 and result["counts"]["possible_only"] == 2
    assert result["downgraded"]["alias without recorded evidence"] == 2
    standings = {"projects": {"12588": {"standing": "possible"}, "20003": {"standing": "confirmed"}, "20001": {"standing": "unknown"}}}
    again = run({"index": index}, standings=standings)
    assert [again["projects"][r]["alias_standing"] for r in ("12588", "20003", "20001")] == ["possible", "confirmed", "possible"]


def test_one_word_alias_needs_a_second_agreeing_term():
    index = part("index", [item("20004", "bare", title="Hulam plan moves on"),
                           item("20004", "noun", title="Hulam solar farm plan moves on"),
                           item("20004", "place", title="Hulam scheme backed by Durham councillors"),
                           item("20004", "ref", title="Hulam update", basis="planning reference DM/20/1 in the title")])
    p = run({"index": index})["projects"]["20004"]
    got = {i["title"]: i["confidence"] for i in p["recent_news"]}
    assert got == {"Hulam plan moves on": "possible", "Hulam solar farm plan moves on": "confirmed",
                   "Hulam scheme backed by Durham councillors": "confirmed", "Hulam update": "confirmed"}
    assert C.needs_second_term("Bypass Solar Farm") and C.needs_second_term("Green Hill Solar Farm")
    assert not C.needs_second_term("Botley West Solar Farm")


def test_bypass_9050_false_match_is_excluded_and_purged_from_carried_items():
    false_match = item("9050", "diodes", "trade", "2026-11-02", title="Bypass diodes: why modules fail in the field")
    road = item("9050", "road", "regional", "2026-11-03", title="Bypass upgrade opens to traffic")
    real = item("9050", "real", "regional", "2026-11-04", title="Solar farm north of Grantham wins approval")
    first = run({"trade": part("trade", [false_match, road, real])}, exclusions=None)
    assert len(first["projects"]["9050"]["recent_news"]) == 3              # without the rule the false matches are in
    result = run({"trade": part("trade", [false_match, road, real])}, previous=first)
    assert [i["title"] for i in everything(result["projects"]["9050"])] == ["Solar farm north of Grantham wins approval"]
    assert result["dropped"]["exclusion rule"] == 4                        # two from this run, two carried copies
    stale = run({}, previous=first)                                        # a failed run does not bring them back either
    assert [i["title"] for i in everything(stale["projects"]["9050"])] == ["Solar farm north of Grantham wins approval"]


def test_committed_exclusions_cover_the_reported_cases():
    rules = EXCLUSIONS["projects"]
    drove = {"title": "Boom Power secures planning permission for 49.99MW Drove Lane solar PV plant in East Yorkshire", "link": "https://example.co.uk/d"}
    assert C.exclusion_reason(drove, rules["11678"])
    assert not C.exclusion_reason({"title": "Ampyr acquires 530MW East Yorkshire Solar Farm", "link": "https://example.co.uk/a"}, rules["11678"])
    assert C.exclusion_reason({"title": "How bypass diodes protect panels", "link": "https://example.co.uk/b"}, rules["9050"])
    assert rules["7191"]["weak_alias"] == "shared" and "11278" in rules["7191"]["shares_alias_with"]
    standings = json.loads((SIGNALS / "alias_standings.json").read_text())["projects"]
    assert len(standings) == 200 and {v["standing"] for v in standings.values()} == {"confirmed", "possible", "unknown"}


# ---------------------------------------------------------------- one link, several projects

def test_link_on_several_projects_only_when_title_or_reviewer_names_each():
    shared = "https://example.co.uk/two"
    both = [item("12588", "x", link=shared, title="Botley West Solar Farm and Hulam solar farm win consent"),
            item("20004", "x", link=shared, title="Botley West Solar Farm and Hulam solar farm win consent")]
    p = run({"index": part("index", both)})["projects"]
    assert p["12588"]["recent_news"][0]["also_projects"] == ["20004"] and p["20004"]["recent_news"][0]["also_projects"] == ["12588"]
    one = [item("12588", "y", link=shared, title="Botley West Solar Farm wins consent"),
           item("20004", "y", link=shared, title="Botley West Solar Farm wins consent", confidence="uncertain")]
    result = run({"index": part("index", one)})
    assert len(result["projects"]["12588"]["recent_news"]) == 1 and everything(result["projects"]["20004"]) == []
    assert "also_projects" not in result["projects"]["12588"]["recent_news"][0] and result["dropped"]["link on several projects"] == 1
    neither = [item("12588", "z", link=shared, title="Two solar farms approved"), item("20004", "z", link=shared, title="Two solar farms approved", confidence="uncertain")]
    result = run({"index": part("index", neither)})
    assert len(everything(result["projects"]["12588"])) == 1 and everything(result["projects"]["20004"]) == []
    by_hand = [dict(i, basis="reviewed 2026-11-14") for i in neither]
    result = run({"reviewed": part("reviewed", by_hand)})                  # a reviewer tied the story to each project
    assert all(len(everything(result["projects"][r])) == 1 for r in ("12588", "20004"))


# ---------------------------------------------------------------- events and clusters

def test_event_from_the_title_and_one_story_shown_once_with_its_sources():
    trade = part("trade", [item("12588", "a", "trade", "2026-11-11", title="UK government refuses 840MW Botley West Solar Farm"),
                           item("12588", "b", "trade", "2026-11-10", title="UK rejects 840MW Botley West solar farm", publisher="reNEWS"),
                           item("12588", "c", "regional", "2026-11-12", "uncertain", title="Solar farm plan turned down by minister"),
                           item("12588", "d", "trade", "2026-09-03", title="Botley West decision deadline extended"),
                           item("12588", "e", "trade", "2026-08-20", title="Botley West Solar Farm refused by council committee")])
    p = run({"trade": part("trade", trade["items"])})["projects"]["12588"]
    lead = p["recent_news"][0]
    assert lead["title"].startswith("UK government refuses") and lead["confidence"] == "confirmed" and lead["event"] == "refusal"
    assert lead["cluster"] == "12588:refusal:2026-11-10" and [s["link"] for s in lead["sources"]] == [
        "https://example.co.uk/c", "https://example.co.uk/b"]
    assert [i["title"] for i in p["recent_news"][1:]] == ["Botley West decision deadline extended",
                                                          "Botley West Solar Farm refused by council committee"]
    assert "cluster" not in p["recent_news"][2]                             # same event type, but months apart
    for title, event in (("Council approves solar farm", "consent"), ("Appeal lodged over solar farm", "appeal"),
                         ("High Court dismisses judicial review of solar farm", "legal_challenge"),
                         ("Project reaches financial close", "financial_close"), ("Developer breaks ground", "construction_start"),
                         ("Solar farm energised", "energisation"), ("Grid connection agreed for solar farm", "grid_connection"),
                         ("EDF buys 500MW project", "sale"), ("Botley West Solar Farm: development consent order, Planning Act 2008", None),
                         ("Firm signs power purchase agreement", None), ("Developer seeks approval", None)):
        assert C.event_of(title) == event, title


def test_a_fetched_item_replaces_the_reviewed_copy_and_same_headline_is_one_story():
    reviewed = part("reviewed", [item("12588", "same", "regional", "2026-11-01", basis="reviewed 2026-11-14", title="Botley West Solar Farm refused"),
                                 item("12588", "other", "regional", "2026-11-01", basis="reviewed 2026-11-14", title="Botley West Solar Farm refused",
                                      publisher="Second Paper")], at="2026-11-14T09:00:00Z")
    index = part("index", [item("12588", "same", "bbc", "2026-11-01", title="Botley West Solar Farm refused")])
    result = run({"index": index, "reviewed": reviewed})
    news = result["projects"]["12588"]["recent_news"]
    assert len(news) == 1 and news[0]["obtained"] == "fetched" and news[0]["family"] == "bbc" and news[0]["source"] == "index"
    assert [s["publisher"] for s in news[0]["sources"]] == ["Second Paper"] and result["counts"]["items"]["recent_news"] == 1


# ---------------------------------------------------------------- honest publishing

def test_failed_run_keeps_items_with_their_own_times_and_does_not_move_generated_at():
    first = run({"official": part("official", [item("12588", "o", "official", "2026-11-10")], at="2026-11-14T11:00:00Z"),
                 "trade": part("trade", [item("12588", "t", "trade", "2026-11-09")], at="2026-11-14T11:30:00Z")})
    assert first["generated_at"] == "2026-11-14T11:30:00Z" and first["run_at"] == NOW and first["stale"] is False
    dead = [{"id": "s", "url": "https://example.co.uk/", "status": "failed", "requests": 2, "failures": 2, "items": 0, "error": "down"}]
    second = run({"official": part("official", [], dead, at=LATER), "trade": "missing", "index": "missing"}, previous=first, now=LATER)
    assert second["generated_at"] == "2026-11-14T11:30:00Z" and second["run_at"] == LATER and second["stale"] is True
    assert second["parts"]["official"] == {"status": "stale", "collected_at": "2026-11-14T11:00:00Z", "items": 1,
                                           "note": "every source failed; items published before are kept with their own dates"}
    assert second["parts"]["trade"]["status"] == "stale" and second["parts"]["trade"]["collected_at"] == "2026-11-14T11:30:00Z"
    assert second["parts"]["index"]["status"] == "failed" and second["parts"]["index"]["collected_at"] is None
    p = second["projects"]["12588"]
    assert p["official"][0]["collected_at"] == "2026-11-14T11:00:00Z" and p["recent_news"][0]["collected_at"] == "2026-11-14T11:30:00Z"
    assert C.schema_errors(second) == [] and C.publication_check(second, first) == []
    empty = run({"official": part("official", [], at=LATER)}, previous=first, now=LATER)      # healthy sources, nothing found
    assert empty["parts"]["official"]["status"] == "stale" and "returned nothing" in empty["parts"]["official"]["note"]
    third = run({"official": part("official", [item("12588", "o", "official", "2026-11-10"), item("12588", "o2", "official", "2026-11-14")],
                                  at=LATER)}, previous=second, now=LATER)
    assert third["generated_at"] == LATER and third["parts"]["official"]["status"] == "ok"
    seen = {i["title"]: i["collected_at"] for i in third["projects"]["12588"]["official"]}
    assert seen == {"Headline o": "2026-11-14T11:00:00Z", "Headline o2": LATER}             # first collection time is kept


def test_version_1_previous_file_is_read_for_carry_over_without_its_reviewed_items():
    v1 = {"schema": "project-signals.v1", "generated_at": "2026-11-14T12:46:07Z",
          "parts": {"official": {"status": "ok", "items": 1, "generated_at": "2026-11-14T12:30:52Z"},
                    "trade": {"status": "ok", "items": 1, "generated_at": "2026-11-14T12:34:49Z"}},
          "projects": {"12588": {"signals": [
              dict(item("12588", "o", "official", "2026-11-10"), basis="register"), item("12588", "t", "trade", "2026-11-09"),
              dict(item("12588", "gone", "regional", "2020-01-01"), basis="reviewed 2026-11-14")]}}}
    result = run({}, previous=v1, now=LATER)
    p = result["projects"]["12588"]
    assert result["generated_at"] == "2026-11-14T12:34:49Z"                  # the newest collection, not the write time
    assert p["official"][0]["collected_at"] == "2026-11-14T12:30:52Z" and p["recent_news"][0]["source"] == "trade"
    assert p["archive"] == []                                              # a reviewed item no longer in the committed file is gone


def test_writer_refuses_a_bad_schema_and_a_sharp_drop(tmp_path):
    items = [item(ref, "n%d" % n, "trade", "2026-11-01") for n, ref in enumerate(["12588"] * 4 + ["20004"] * 4)]
    good = run({"trade": part("trade", items)})
    assert C.publication_check(good, None) == []
    broken = copy.deepcopy(good)
    broken["projects"]["12588"]["recent_news"][0]["date"] = "2026-02-30"
    broken["projects"]["12588"]["planning_file"]["label"] = "planning file"
    broken["counts"]["by_tier"]["recent_news"] = 7
    reasons = C.publication_check(broken, None)
    assert any("not a past calendar date" in r for r in reasons) and any("mislabelled" in r for r in reasons)
    assert any("does not sum" in r for r in reasons)
    mixed = copy.deepcopy(good)
    mixed["projects"]["12588"]["recent_news"].append(dict(mixed["projects"]["12588"]["recent_news"][0], date=None, freshness="undated", year=None,
                                                          link="https://example.co.uk/zz"))
    assert any("undated item outside the archive" in r for r in C.schema_errors(mixed))
    shrunk = run({"trade": part("trade", items[:1])})
    shrunk_reasons = C.publication_check(shrunk, good)
    assert any("sharp drop" in r and "items fell from 8 to 1" in r for r in shrunk_reasons)

    top, aliases, trade, prev = (tmp_path / n for n in ("top.json", "aliases.json", "trade.json", "previous.json"))
    top.write_text(json.dumps(ROWS))
    aliases.write_text(json.dumps(ALIASES))
    prev.write_text(json.dumps(good))
    trade.write_text(json.dumps(part("trade", [])))
    out, md = tmp_path / "dist" / "project_signals.json", tmp_path / "summary.md"
    base = ["--top200", str(top), "--aliases", str(aliases), "--reviewed", str(tmp_path / "none.json"), "--out", str(out),
            "--summary", str(md), "--truth", str(tmp_path / "none.json"), "--standings", str(tmp_path / "none.json")]
    code = C.main(base + ["--trade", str(trade), "--now", NOW])           # no previous file given: the 8 items are gone
    assert code == 0 and out.exists()
    out.unlink()
    lost = dict(good, projects={ref: dict(p, recent_news=[]) for ref, p in good["projects"].items()})
    (tmp_path / "lost.json").write_text(json.dumps(lost))
    trade.write_text(json.dumps(part("trade", items)))
    assert C.main(base + ["--trade", str(trade), "--previous", str(prev), "--now", NOW]) == 0 and out.exists()
    out.write_text(json.dumps(good))
    trade.write_text(json.dumps(part("trade", items[:1])))
    assert C.main(base + ["--trade", str(trade), "--now", NOW]) == 0       # written: nothing to compare with
    out.write_text(json.dumps(good))
    exclusions = tmp_path / "ex.json"
    exclusions.write_text(json.dumps({"projects": {"12588": {"exclude": ["Headline"]}, "20004": {"exclude": ["Headline"]}}}))
    code = C.main(base + ["--trade", str(trade), "--previous", str(prev), "--exclusions", str(exclusions), "--now", NOW])
    text = md.read_text()
    assert code == 3 and json.loads(out.read_text()) == good               # refused: the published file is untouched
    assert "Not published" in text and "refused because: sharp drop" in text


def test_main_writes_file_and_summary_with_counts_by_tier(tmp_path):
    top, aliases, index = tmp_path / "top.json", tmp_path / "aliases.json", tmp_path / "index.json"
    top.write_text(json.dumps(ROWS))
    aliases.write_text(json.dumps(ALIASES))
    index.write_text(json.dumps(part("index", [item("12588", "b1", "bbc"), item("20004", "old", "regional", "2019-05-01", title="Hulam solar farm approved")])))
    (tmp_path / "trade.json").write_text("{not json")
    out, md = tmp_path / "dist" / "project_signals.json", tmp_path / "summary.md"
    args = ["--top200", str(top), "--aliases", str(aliases), "--index", str(index), "--trade", str(tmp_path / "trade.json"),
            "--official", str(tmp_path / "missing.json"), "--out", str(out), "--summary", str(md), "--now", NOW,
            "--truth", str(tmp_path / "none.json"), "--reviewed", str(tmp_path / "none.json")]
    code = C.main(args)
    data = json.loads(out.read_text())
    assert code == 0 and data["schema"] == "project-signals.v2" and set(data["projects"]) == {r["repd_ref"] for r in ROWS}
    assert data["parts"]["trade"]["status"] == "failed" and "unreadable" in data["parts"]["trade"]["note"]
    assert data["parts"]["official"]["status"] == "failed" and data["parts"]["index"]["status"] == "ok"
    assert data["generated_at"] == NOW and data["stale"] is True
    text = md.read_text()
    for line in ("**Projects with recent verified news: 1 of 5**", "| with recent news | 1 |",
                 "| with an official item (and no recent news) | 0 |", "| with archive only (older or undated items, shown with their year) | 1 |",
                 "| with planning file only | 3 |", "| with nothing (zero) | 0 |", "**Published.**"):
        assert line in text, line
    assert "/home/" not in out.read_text() + text and "@" not in text
    before = out.read_text()
    assert C.main(args + ["--previous", str(out), "--now", LATER]) == 0     # same parts, later clock
    again = json.loads(out.read_text())
    assert again["generated_at"] == NOW and again["projects"] == data["projects"]


def test_unchanged_failed_run_does_not_rewrite_the_file(tmp_path):
    top, aliases = tmp_path / "top.json", tmp_path / "aliases.json"
    top.write_text(json.dumps(ROWS))
    aliases.write_text(json.dumps(ALIASES))
    out = tmp_path / "project_signals.json"
    base = ["--top200", str(top), "--aliases", str(aliases), "--out", str(out), "--truth", str(tmp_path / "none.json"),
            "--reviewed", str(tmp_path / "none.json"), "--official", str(tmp_path / "o.json"), "--previous", str(out)]
    (tmp_path / "o.json").write_text(json.dumps(part("official", [item("12588", "o", "official", "2026-11-10")])))
    assert C.main(base + ["--now", NOW]) == 0
    (tmp_path / "o.json").unlink()
    assert C.main(base + ["--now", LATER]) == 0                            # first failure: published once, marked stale
    stale = out.read_text()
    assert json.loads(stale)["stale"] is True and json.loads(stale)["generated_at"] == NOW
    assert C.main(base + ["--now", "2026-11-15T17:23:00Z"]) == 0
    assert out.read_text() == stale                                        # second failure: byte for byte the same


# ---------------------------------------------------------------- the committed data

def test_committed_reviewed_file_is_routed_by_date():
    rows = json.loads((SIGNALS / "top200_solar.json").read_text())
    aliases = json.loads((SIGNALS / "aliases.json").read_text())
    reviewed = json.loads((SIGNALS / "reviewed_signals.json").read_text())
    standings = json.loads((SIGNALS / "alias_standings.json").read_text())
    assert reviewed["schema"] == C.PART_SCHEMA and "@" not in json.dumps(reviewed) and "/home/" not in json.dumps(reviewed)
    result = C.combine(rows, aliases, {"reviewed": reviewed}, now_iso=NOW, use_module=False, exclusions=EXCLUSIONS, standings=standings)
    c = result["counts"]
    assert C.schema_errors(result, [r["repd_ref"] for r in rows]) == []
    assert c["projects"] == 200 and sum(c["by_tier"].values()) == 200 and c["by_tier"]["nothing"] == 0
    assert 0 < c["headline"]["value"] < 30                                 # recent verified news is rare; the archive is not news
    assert c["by_tier"]["archive_only"] > c["by_tier"]["recent_news"]
    for p in result["projects"].values():
        assert all(i["freshness"] == "recent" and i["date"] >= "2026-08-16" for i in p["recent_news"])
        assert all(i["obtained"] == "reviewed" for i in everything(p))
    assert everything(result["projects"]["9050"])[0]["title"].startswith("'Large' Solar farm north of Grantham")


def test_truth_report_by_family():
    truth = {"12588": {"status": "found", "families": ["bbc", "trade"], "links": ["https://example.co.uk/b1"]},
             "20004": {"status": "found", "families": ["regional"], "links": []},
             "20003": {"status": "none", "families": [], "links": []}}
    result = run({"index": part("index", [item("12588", "b1", "bbc"), item("20003", "q", "regional")])})
    text = C.truth_report(truth, {ref: everything(p) for ref, p in result["projects"].items()})
    assert "Of the 2 found by a member, the automated run has at least one signal for **1**." in text
    assert "| bbc | 1 | 1 | 1 | 1 |" in text and "| trade | 1 | 1 | 0 | 1 |" in text and "| regional | 1 | 0 | 0 | 0 |" in text
    assert "did not mark found: 1 (REPD 20003)" in text and "not by the run: REPD 20004." in text
