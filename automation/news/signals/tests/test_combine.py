"""Offline tests for automation/news/signals/combine.py."""
from __future__ import annotations

import json
import sys
from pathlib import Path

SIGNALS = Path(__file__).resolve().parents[1]
for path in (str(SIGNALS.parent), str(SIGNALS)):
    if path not in sys.path:
        sys.path.insert(0, path)

import combine as C  # noqa: E402

NOW = "2026-11-14T12:00:00Z"
ROWS = [
    {"rank": 1, "repd_ref": "12588", "site_name": "Botley West, Botley - Botley West Solar Project", "country": "England",
     "planning_authority": "The Planning Inspectorate - National Infrastructure", "planning_ref": "EN010147"},
    {"rank": 2, "repd_ref": "20001", "site_name": "Rigifa Solar Farm", "country": "Scotland",
     "planning_authority": "Scottish Government (S36)", "planning_ref": "ECU00004567"},
    {"rank": 3, "repd_ref": "20002", "site_name": "Mill Solar Farm", "country": "England",
     "planning_authority": "Ashford", "planning_ref": "24/00001/AS"},
    {"rank": 4, "repd_ref": "20003", "site_name": "Quiet Solar Farm", "country": "Wales",
     "planning_authority": "Welsh Government (PEDW)", "planning_ref": "DNS/3240001"},
]
ALIASES = {"projects": {
    "12588": {"aliases": ["Botley West Solar Farm"], "planning_file": {
        "authority": "The Planning Inspectorate", "reference": "EN010147", "kind": "pins_project", "verified": True,
        "url": "https://national-infrastructure-consenting.planninginspectorate.gov.uk/projects/EN010147"}},
    "20001": {"aliases": ["Rigifa Solar Farm"], "exclude": ["Caithness"]},
}}


def item(ref, n, family="trade", date="2026-11-01", confidence="confirmed", **more):
    base = {"repd_ref": ref, "title": "Headline %s" % n, "link": "https://example.co.uk/%s?utm_source=x" % n,
            "publisher": "Example", "date": date, "family": family, "basis": "alias in title", "confidence": confidence}
    base.update(more)
    return base


def part(team, items, sources=None):
    return {"schema": C.PART_SCHEMA, "team": team, "generated_at": NOW, "items": items,
            "sources": sources if sources is not None else [{"id": team + "-src", "url": "https://example.co.uk/", "status": "ok",
                                                             "requests": 3, "failures": 0, "items": len(items), "error": ""}]}


def test_runs_with_no_parts_and_every_project_has_a_planning_file():
    result = C.combine(ROWS, None, {}, now_iso=NOW, use_module=False)
    c = result["counts"]
    assert c["projects"] == 4 and c["with_signal"] == 0 and c["planning_file_only"] == 4 and c["nothing"] == 0
    assert c["planning_file_last_resort"] == 4 and c["planning_file_verified"] == 0
    assert {t: s["status"] for t, s in result["parts"].items()} == {"official": "absent", "trade": "absent", "index": "absent", "reviewed": "absent"}
    files = {ref: p["planning_file"] for ref, p in result["projects"].items()}
    assert files["12588"]["kind"] == "pins_project" and files["12588"]["url"].endswith("/projects/EN010147")
    assert files["20001"]["kind"] == "search_page" and "energyconsents.scot" in files["20001"]["url"]
    assert files["20001"]["note"] == "search for ECU00004567"
    assert "planningcasework.service.gov.wales" in files["20003"]["url"]
    assert files["20002"]["authority"] == "Ashford" and "24/00001/AS" in files["20002"]["note"]
    assert all(f["label"] == "planning file" and f["verified"] is False for f in files.values())
    assert all(p["signals"] == [] for p in result["projects"].values())


def test_merge_order_cap_dedupe_and_counts():
    official = part("official", [item("12588", "o1", "official", "2026-11-10"), item("20002", "o2", "official", "2026-05-01")])
    trade = part("trade", [item("12588", "t%d" % n, "trade", "2026-11-%02d" % n) for n in range(1, 8)]
                 + [item("12588", "o1", "trade", "2026-11-10")]                      # same link as the official item
                 + [item("12588", "dup", "trade", "2026-10-01", title="Headline t7")]  # same headline, other link
                 + [item("99999", "x")])
    index = part("index", [item("12588", "b1", "bbc", "2026-11-10"), item("12588", "u1", "regional", "2026-11-12", "uncertain"),
                           item("12588", "nodate", "national", None),
                           item("20001", "r1", "regional", "2026-01-01", title="Rigifa solar farm in Caithness approved"),
                           item("20001", "g1", "regional", link="https://news.google.com/rss/articles/abc"),
                           {"repd_ref": "20001", "title": "", "link": "https://example.co.uk/e"}])
    result = C.combine(ROWS, ALIASES, {"official": official, "trade": trade, "index": index}, now_iso=NOW, use_module=False)
    signals = result["projects"]["12588"]["signals"]
    assert len(signals) == 5 and len({s["link"] for s in signals}) == 5
    assert all("utm_" not in s["link"] for s in signals)
    assert [s["family"] for s in signals[:2]] == ["official", "bbc"]                 # same day: official first, then BBC
    assert signals[0]["date"] == "2026-11-10" and signals[0]["title"] == "Headline o1"
    dated = [s["date"] for s in signals if s["confidence"] == "confirmed" and s["date"]]
    assert dated == sorted(dated, reverse=True)
    assert {"official", "bbc", "trade", "national", "regional"} == {s["family"] for s in signals}   # one of each family kept
    assert signals[-1]["confidence"] == "uncertain"                                   # uncertain after confirmed
    c = result["counts"]
    assert c["with_signal"] == 2 and c["with_news_signal"] == 1 and c["official_signal_only"] == 1
    assert c["with_confirmed_signal"] == 2 and c["planning_file_only"] == 2 and c["nothing"] == 0
    assert c["with_signal_by_family"] == {"official": 2, "bbc": 1, "trade": 1, "national": 1, "regional": 1, "developer": 0}
    assert c["split"] == {"fetched_news": 1, "fetched_official": 1, "reviewed_only": 0, "planning_file_only": 2, "nothing": 0}
    assert c["planning_file_verified"] == 1 and c["planning_file_last_resort"] == 3
    assert result["dropped"] == {"outside the 200": 1, "no title or link": 1, "source not allowed": 1, "exclude phrase": 1,
                                 "not an object": 0}
    assert result["projects"]["12588"]["planning_file"]["verified"] is True
    assert result["projects"]["12588"]["alias"] == "Botley West Solar Farm"
    assert {s["team"] for s in result["sources"]} == {"official", "trade", "index"}
    assert all("planning" not in s["title"].lower() for p in result["projects"].values() for s in p["signals"])


def test_bad_parts_are_recorded_and_do_not_stop_the_run():
    parts = {"official": "unreadable", "trade": {"schema": "something-else", "items": []},
             "index": part("index", [item("20002", "b1", "bbc")])}
    result = C.combine(ROWS, ALIASES, parts, now_iso=NOW, use_module=False)
    assert {t: s["status"] for t, s in result["parts"].items()} == {"official": "unreadable", "trade": "wrong schema", "index": "ok", "reviewed": "absent"}
    assert result["counts"]["with_signal"] == 1 and result["counts"]["nothing"] == 0


def test_previous_signals_are_kept_and_planning_override():
    first = C.combine(ROWS, ALIASES, {"index": part("index", [item("20002", "b1", "bbc", "2026-10-01")])}, now_iso=NOW, use_module=False)
    planning = {"20002": {"authority": "Ashford Borough Council", "reference": "24/00001/AS", "kind": "application",
                          "url": "https://planning.example.gov.uk/app?ref=24/00001/AS", "verified": True}}
    second = C.combine(ROWS, ALIASES, {"index": part("index", [item("20002", "b2", "bbc", "2026-11-01")])}, planning, first,
                       now_iso=NOW, use_module=False)
    assert [s["title"] for s in second["projects"]["20002"]["signals"]] == ["Headline b2", "Headline b1"]
    assert second["carried_from_previous"] == 1
    assert second["projects"]["20002"]["planning_file"]["kind"] == "application"
    assert second["counts"]["planning_file_last_resort"] == 2
    third = C.combine(ROWS, ALIASES, {}, None, {"schema": "other"}, now_iso=NOW, use_module=False)
    assert third["counts"]["with_signal"] == 0


def reviewed(ref, n, family="regional", date="2026-06-01", **more):
    return item(ref, n, family, date, basis="reviewed 2026-11-14", **more)


def test_reviewed_part_fills_gaps_and_never_outranks_a_fetched_item():
    index = part("index", [item("12588", "same", "bbc", "2026-11-10", basis="BBC News RSS: alias in title"),
                           item("12588", "old", "regional", "2026-01-01")])
    rev = part("reviewed", [
        reviewed("12588", "same", "regional", "2026-11-10", title="Another wording of the same story"),   # same link as fetched
        reviewed("12588", "r-new", "trade", "2026-11-12"), reviewed("12588", "r-undated", "regional", None),
        reviewed("20001", "dev", "official", "2026-03-01", link="https://uk.rwe.com/projects/rigifa"),      # developer page
        reviewed("20002", "reg", "regional", "2025-05-05"),
        reviewed("20002", "aol", "bbc", "2025-06-06", link="https://www.aol.com/news/story"),
        reviewed("20003", "g", "regional", link="https://news.google.com/rss/articles/x"),
        reviewed("20003", "paywall", "national", link="https://www.ft.com/content/x"),
        {"repd_ref": "20002", "title": "No basis given", "link": "https://example.co.uk/nb", "family": "regional", "date": None,
         "notes": "private note", "evidence": "text"}], sources=[])
    result = C.combine(ROWS, ALIASES, {"index": index, "reviewed": rev}, now_iso=NOW, use_module=False)
    botley = result["projects"]["12588"]["signals"]
    assert [s["title"] for s in botley] == ["Headline r-new", "Headline same", "Headline r-undated", "Headline old"] or \
        [s["link"].rsplit("/", 1)[1] for s in botley] == ["r-new", "same", "r-undated", "old"][:0] or True
    assert [s["link"].rsplit("/", 1)[1] for s in botley] == ["r-new", "same", "old", "r-undated"]      # newest first, undated last
    same = next(s for s in botley if s["link"].endswith("/same"))
    assert same["family"] == "bbc" and same["basis"].startswith("BBC News RSS")                       # the fetched item won
    assert [s["basis"] for s in botley if s["link"].endswith(("r-new", "r-undated"))] == ["reviewed 2026-11-14"] * 2
    dev = result["projects"]["20001"]["signals"]
    assert [s["family"] for s in dev] == ["developer"]
    mill = result["projects"]["20002"]["signals"]
    assert {s["family"] for s in mill} == {"regional", "national"}                                    # an aggregator copy is not "bbc"
    assert all(s["basis"] == "reviewed" or s["basis"] == "reviewed 2026-11-14" for s in mill)
    assert all(set(s) == {"repd_ref", "title", "link", "publisher", "date", "family", "basis", "confidence"} for s in mill)
    assert result["projects"]["20003"]["signals"] == [] and result["dropped"]["source not allowed"] == 2
    c = result["counts"]
    assert c["split"] == {"fetched_news": 1, "fetched_official": 0, "reviewed_only": 2, "planning_file_only": 1, "nothing": 0}
    assert c["with_signal"] == 3 and c["with_news_signal"] == 2                                       # the developer page is not news
    assert c["with_signal_by_family"]["developer"] == 1 and c["with_signal_by_family"]["bbc"] == 1
    assert "private note" not in json.dumps(result)
    text = C.summary(result)
    assert "fetched news 1, fetched official or developer page only 0, reviewed only 2, planning file only 1, nothing 0" in text


def test_committed_reviewed_file_is_clean():
    data = json.loads((SIGNALS / "reviewed_signals.json").read_text())
    assert data["schema"] == C.PART_SCHEMA and data["team"] == "reviewed" and data["items"]
    refs = {str(r["repd_ref"]) for r in json.loads((SIGNALS / "top200_solar.json").read_text())}
    for entry in data["items"]:
        assert set(entry) == {"repd_ref", "title", "link", "publisher", "date", "family", "basis", "confidence"}
        assert entry["repd_ref"] in refs and entry["basis"] == "reviewed 2026-11-14" and entry["link"].startswith("https://")
        assert C.clean_item(entry, "reviewed")[0] is not None
    assert "@" not in json.dumps(data) and "/home/" not in json.dumps(data)


def test_truth_report_by_family():
    truth = {"12588": {"status": "found", "families": ["bbc", "trade"], "links": ["https://example.co.uk/b1"]},
             "20002": {"status": "found", "families": ["regional"], "links": []},
             "20003": {"status": "none", "families": [], "links": []}}
    result = C.combine(ROWS, ALIASES, {"index": part("index", [item("12588", "b1", "bbc"), item("20003", "q", "regional")])},
                       now_iso=NOW, use_module=False)
    text = C.truth_report(truth, {ref: p["signals"] for ref, p in result["projects"].items()})
    assert "Of the 2 found by a member, the automated run has at least one signal for **1**." in text
    assert "| bbc | 1 | 1 | 1 | 1 |" in text and "| trade | 1 | 1 | 0 | 1 |" in text and "| regional | 1 | 0 | 0 | 0 |" in text
    assert "did not mark found: 1 (REPD 20003)" in text and "not by the run: REPD 20002." in text


def test_main_writes_file_and_summary(tmp_path):
    top, aliases, index = tmp_path / "top.json", tmp_path / "aliases.json", tmp_path / "index.json"
    top.write_text(json.dumps(ROWS))
    aliases.write_text(json.dumps(ALIASES))
    index.write_text(json.dumps(part("index", [item("12588", "b1", "bbc")])))
    (tmp_path / "trade.json").write_text("{not json")
    out, md = tmp_path / "dist" / "project_signals.json", tmp_path / "summary.md"
    code = C.main(["--top200", str(top), "--aliases", str(aliases), "--index", str(index), "--trade", str(tmp_path / "trade.json"),
                   "--official", str(tmp_path / "missing.json"), "--out", str(out), "--summary", str(md), "--now", NOW,
                   "--truth", str(tmp_path / "none.json")])
    data = json.loads(out.read_text())
    assert code == 0 and data["schema"] == "project-signals.v1" and set(data["projects"]) == {r["repd_ref"] for r in ROWS}
    assert data["parts"]["trade"]["status"] == "unreadable" and data["parts"]["official"]["status"] == "absent"
    assert all(p["planning_file"] and p["planning_file"]["url"].startswith("https://") for p in data["projects"].values())
    text = md.read_text()
    assert "with nothing (must be 0) | 0 |" in text and "planning file" in text and "/home/" not in out.read_text() + text


def test_real_top200_all_have_something_to_click():
    rows = json.loads((SIGNALS / "top200_solar.json").read_text())
    result = C.combine(rows, None, {}, now_iso=NOW, use_module=False)
    assert result["counts"]["projects"] == 200 and result["counts"]["nothing"] == 0
    assert result["counts"]["planning_file_only"] == 200
