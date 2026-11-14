#!/usr/bin/env python3
"""Offline tests for scripts/news_binder_refaware.py and scripts/build_news_feed_2026q3.py.

Run: python3 scripts/test_news_binder_refaware.py   (or pytest scripts/test_news_binder_refaware.py)
Needs only committed files: dist/major_projects_v6.json, dist/major_projects_2026q3.json,
dist/major_project_news_v4/v5/v6/v9_5_1.json, docs/repd/2026q3/changes-jul-to-oct/diff.json and
scripts/fixtures/news_binding_labels_2026q3.json. No network. Writes nothing in the repository.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import major_project_news_v6 as base  # noqa: E402
import news_binder_refaware as nb  # noqa: E402
import build_news_feed_2026q3 as feed  # noqa: E402

LABELS = ROOT / "scripts" / "fixtures" / "news_binding_labels_2026q3.json"
Q2 = ROOT / "dist" / "major_projects_v6.json"
Q3 = ROOT / "dist" / "major_projects_2026q3.json"
CRAWL_INSTANT = "2026-08-22T20:45:25.507638+00:00"


def story(title, source="Example News", url="https://example.com", published=None):
    return {"title": title, "description": "", "source": source, "source_url": url, "link": "https://example.test/x",
            "published": published or datetime(2026, 8, 1, tzinfo=timezone.utc)}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


base.pin_scoring_reference(CRAWL_INSTANT)
_, Q3P = nb.load_universe(Q3)
Q3BY = {p["repd_ref"]: p for p in Q3P}


def resolve(title, **kw):
    item, reason, _ = nb.resolve_story(story(title, **kw), Q3P, Q3BY)
    return (item["repd_ref"] if item else None), reason


# ---- unit rules -----------------------------------------------------------
def test_operator_parties():
    assert nb.normalise_operator_parties("Fidra Energy & Drax") == ["fidra", "drax"]
    assert nb.normalise_operator_parties("JBM Solar & RWE") == ["jbm", "rwe"]
    assert nb.normalise_operator_parties("Innagreen Investments & RES") == ["innagreen", "res"]
    assert nb.normalise_operator_parties("Photovolt Development Partners / SolarFive") == \
        nb.normalise_operator_parties("Photovolt Development Partners & SolarFive")
    assert nb.operator_party_key("Low Carbon Limited") == nb.operator_party_key("Low Carbon Ltd")


def test_capacity_extraction():
    assert nb.extract_capacities("Government approves new 1,900MW Camblesforth solar farm") == [1900.0]
    assert nb.extract_capacities("46.5MW Brecks") == [46.5]
    assert nb.extract_capacities("49.9MWp Staffordshire") == [49.9]
    assert nb.extract_capacities("1GWh Coalburn 1 battery") == []


def test_c1_capacity_contradiction_blocks_camblesforth():
    assert resolve("Government approves new 1,900MW Camblesforth solar farm")[0] is None
    assert resolve("Government approves new 49.9MW Camblesforth solar farm")[0] == "8100"


def test_c2_qualifier_coalburn_ii():
    ref, _ = resolve("Meadow Partners Acquires Ground Lease for Coalburn II Battery Storage Project in Scotland")
    assert ref == "12206", ref
    assert resolve("1GWh Coalburn 1 battery energy storage enters operations in Scotland")[0] == "11034"


def test_c3_full_exact_name_not_downgraded_by_shared_stem():
    assert resolve("Greencells signs 71 MW Carlton solar farm EPC deal",
                   source="Solar Power Portal", url="https://www.solarpowerportal.co.uk")[0] == "12017"


def test_c4_multi_token_stem_adjacent_descriptor():
    assert resolve("Monk Fryston BESS Set to Become One of the UK's Largest Battery Storage Assets")[0] == "15164"
    assert resolve("More than 1,000 people have say on Green Hill Solar Farm", source="BBC",
                   url="https://www.bbc.co.uk")[0] == "15793"


def test_c6_operator_route_and_vetoes():
    assert resolve("Lightsource bp secures planning approval at 57MW solar-plus-storage project in Wales",
                   source="Solar Power Portal", url="https://www.solarpowerportal.co.uk")[0] == "7858"
    # portfolio wording and capacity contradiction keep unnamed stories unbound
    assert resolve("NextEnergy UK I Acquires 107 MW Battery Storage Portfolio in the UK")[0] is None
    assert resolve("Harmony Energy energises new 35MW/70MWh BESS in North Yorkshire")[0] is None
    assert resolve("Eelpower Energy acquires 50MW/100MWh BESS project in Devon")[0] is None


def test_c7_stale_records():
    assert resolve("Solar farm plan for North Tawton field", published=datetime(2026, 8, 21, tzinfo=timezone.utc))[1] \
        in {"stale_record_candidate", "no_canonical_identity"}
    assert resolve("Solar farm plan for North Tawton field")[0] is None
    # full exact name still binds a stale-status site, flagged in evidence
    item, _, _ = nb.resolve_story(story("Work on solar farm at former Williamthorpe Colliery site starts"), Q3P, Q3BY)
    assert item and item["repd_ref"] == "5533" and item["match_evidence"]["stale_record"] is True


def test_c8_ref_aware():
    assert resolve("Update on REPD ref 13599 solar scheme")[0] == "13599"
    item, _, _ = nb.resolve_story(story("Kells solar farm refusal of planning appealed", source="BBC",
                                        url="https://www.bbc.co.uk"), Q3P, Q3BY)
    assert item["repd_ref"] == "6012" and item["match_evidence"]["superseded_repd_ref"] == "5967"


def test_west_burton_c_is_fidra_11928():
    assert resolve("Fidra Energy reaches financial close on 500 MW West Burton C BESS project")[0] == "11928"
    # the V9.5 hostile fixture (no operator, no corroboration) still does not bind
    assert resolve("West Burton C BESS project reaches financial close", source="Energy-Storage.News",
                   url="https://energy-storage.news")[0] is None


def test_v9_5_fixtures_on_both_universes():
    src = (ROOT / "scripts" / "test_news_binder_v9_5.py").read_text(encoding="utf-8")
    positives = eval(re.search(r"positives = (\(.*?\n\))\n", src, re.S).group(1))  # noqa: S307 (own repo file)
    negatives = eval(re.search(r"negatives = (\(.*?\n\))\n", src, re.S).group(1))  # noqa: S307
    for path in (Q2, Q3):
        _, projects = nb.load_universe(path)
        by_ref = {p["repd_ref"]: p for p in projects}
        hits = 0
        for title, source, url, expected in positives:
            item, _, _ = nb.resolve_story(story(title, source, url), projects, by_ref)
            hits += bool(item and item["repd_ref"] == expected)
        assert hits == len(positives), (path.name, hits)
        for title in negatives:
            item, _, _ = nb.resolve_story(story(title, "Energy-Storage.News", "https://energy-storage.news"),
                                          projects, by_ref)
            assert item is None, (path.name, title, item and item["repd_ref"])


def test_status_change_candidates_synthetic():
    diff = {"previous": {"label": "P"}, "new": {"label": "N"},
            "status_transitions": {"transitions": [{"from": "Application Submitted", "to": "Awaiting Construction",
                                                     "refs": ["13599"]}]},
            "milestones": {"categories": {"consented": {"label": "Newly consented", "refs": ["13599", "99999999"]},
                                          "refused": {"label": "Newly refused", "refs": []}}}}
    changes = nb.repd_status_change_candidates(diff, Q3P)
    assert [c["repd_ref"] for c in changes] == ["13599"]
    change = changes[0]
    assert change["role"] == "REPD_STATUS_CHANGE" and change["eligible_for_news_signal"] is False
    assert change["event"] == "CONSENT" and change["basis"] == "transition"
    article = {"gg_article_id": "A1", "repd_ref": "13599", "event": "CONSENT"}
    assert nb.corroborate(changes, [article]) == 1 and change["corroborating_articles"] == ["A1"]


# ---- measured precision / recall on the labelled set ----------------------
def evaluate(resolver) -> dict:
    labels = json.loads(LABELS.read_text(encoding="utf-8"))["pairs"]
    tp = fp = fn = tn = 0
    n_true = sum(p["label"] == "TRUE" for p in labels)
    for pair in labels:
        if pair["label"] == "UNCERTAIN":
            continue
        got = resolver(story(pair["headline"], pair["source"] or "", pair["source_url"] or "",
                             datetime.fromisoformat(pair["published"]).replace(tzinfo=timezone.utc)))
        truth = pair["true_repd_refs"]
        if got is None:
            fn += bool(truth)
            tn += not truth
        elif got in truth:
            tp += 1
        else:
            fp += 1
    return {"tp": tp, "fp": fp, "fn": fn, "tn": tn, "precision": round(tp / (tp + fp), 3),
            "recall": round(tp / n_true, 3)}


def test_labelled_precision_recall():
    legacy = evaluate(lambda s: (lambda r: r[0] and r[0]["repd_ref"])(base._resolve_story(s, Q3P)))
    refaware = evaluate(lambda s: (lambda r: r[0] and r[0]["repd_ref"])(nb.resolve_story(s, Q3P, Q3BY)))
    print("legacy  ", legacy)
    print("refaware", refaware)
    assert legacy["fp"] == 4 and legacy["tp"] == 40, legacy        # recorded baseline
    assert refaware["precision"] >= 0.98 and refaware["recall"] >= 0.85, refaware
    assert refaware["tp"] > legacy["tp"] and refaware["fp"] < legacy["fp"]


# ---- the October feed builder ---------------------------------------------
def test_feed_builder_is_additive_and_deterministic():
    protected = {p: sha(ROOT / p) for p in feed.PROTECTED}
    with tempfile.TemporaryDirectory() as tmp:
        outs = {}
        for binder in ("legacy", "refaware"):
            for run in (1, 2):
                out = Path(tmp) / f"{binder}{run}.json"
                feed.main(["--binder", binder, "--out", str(out)])
                outs[(binder, run)] = out.read_bytes()
        assert outs[("legacy", 1)] == outs[("legacy", 2)]
        assert outs[("refaware", 1)] == outs[("refaware", 2)]
        legacy = json.loads(outs[("legacy", 1)])
        refaware = json.loads(outs[("refaware", 1)])
    assert {p: sha(ROOT / p) for p in feed.PROTECTED} == protected
    q2 = json.loads((ROOT / "dist" / "major_project_news_v9_5_1.json").read_text(encoding="utf-8"))
    key = lambda i: (i["headline"], i["repd_ref"])  # noqa: E731
    assert sorted(map(key, legacy["canonical_items"])) == sorted(map(key, q2["canonical_items"]))
    assert legacy["project_snapshot"]["project_count"] == len(Q3P)
    refs = {i["repd_ref"] for i in refaware["canonical_items"]}
    assert {"1044", "2377", "5452", "8100"}.isdisjoint(refs)       # known false/stale bindings removed
    assert {"12206", "11928", "6502", "15164"} <= refs               # known misses recovered
    assert all("project" not in i for i in refaware["all_items"] if i["role"] == "DISCOVERY_ONLY"
               and i["discovery_origin"] in {"V4_BASELINE", "V5_BASELINE"})  # no unverified V5 labels shown
    assert refaware["repd_status_changes"]["count"] > 0
    assert all(c["eligible_for_news_signal"] is False for c in refaware["repd_status_changes"]["items"])
    try:
        feed.main(["--out", str(ROOT / "dist" / "major_project_news_v9_5_1.json")])
    except SystemExit:
        pass
    else:
        raise AssertionError("builder must refuse to overwrite the pinned V9.5.1 feed")


if __name__ == "__main__":
    tests = [(name, fn) for name, fn in sorted(globals().items()) if name.startswith("test_") and callable(fn)]
    for name, fn in tests:
        fn()
        print("PASS", name)
    print(f"news_binder_refaware: {len(tests)} tests PASS")
