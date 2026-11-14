"""Tests for automation/news/pipeline_headlines.py. Offline: fixtures hold real headlines, links and dates only."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pytest

PKG = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PKG))

import datacentre_feed as D  # noqa: E402
import pipeline_headlines as P  # noqa: E402

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "pipeline"
SCHEMA = json.loads((PKG / "schema" / "pipeline-headlines.v1.schema.json").read_text(encoding="utf-8"))
NOW = "2026-11-14T12:00:00Z"


def repd_row(ref, site, tech="Solar Photovoltaics", operator="Example Energy Ltd", county="Oxfordshire",
             authority="West Oxfordshire"):
    return {"Ref ID": ref, "Site Name": site, "Technology Type": tech, "Operator (or Applicant)": operator,
            "County": county, "Planning Authority": authority, "Region": "South East"}


REPD = P.Repd([
    repd_row("12588", "Botley West, Botley - Botley West Solar Project",
             operator="Photovolt Development Partners & SolarFive",
             authority="The Planning Inspectorate - National Infrastructure"),
    repd_row("10529", "Botley - Solar Photovoltaic Array", operator="Red House Solar Limited"),
    repd_row("13599", "Beacon Fen Energy Park", operator="Low Carbon Limited", county="Lincolnshire"),
    repd_row("13600", "Beacon Fen Energy Park", tech="Battery", operator="Low Carbon Limited", county="Lincolnshire"),
    repd_row("15793", "Green Hill Solar Farm & Battery Storage", operator="Island Green Power",
             county="Northamptonshire"),
    repd_row("15252", "Steeple Renewables Project", operator="Renewable Energy Systems RES Limited",
             county="Nottinghamshire"),
    repd_row("70001", "Manor Farm - Solar Farm"),
    repd_row("70002", "Twin Oaks Solar Farm", county="Kent"),
    repd_row("70003", "Twin Oaks Solar Farm", county="Devon"),
    repd_row("70004", "Zennorwick - Battery Storage", tech="Battery", county="Cornwall"),
])


@pytest.mark.parametrize("title, category, technology", [
    ("UK government refuses 840MW Botley West Solar Farm in first-ever solar NSIP no", "refusal", "solar"),
    ("Planned solar farm in Oxfordshire scrapped as government rejects application", "refusal", "solar"),
    ("Botley West Solar Farm: development consent order, Planning Act 2008", "dco", "solar"),
    ("Great North Road Solar and Biodiversity Park development consent decision announced", "dco", "solar"),
    ("Major solar projects by Elements Green, Cubico granted DCOs", "consent", "solar"),
    ("Low Carbon wins DCO for Beacon Fen Energy Park in Lincolnshire", "consent", None),
    ("Llyr offshore wind farm secures Section 36 Consent from Welsh Ministers", "consent", "offshore_wind"),
    ("PACE wins appeal for 49.5MW solar plant in Gloucestershire", "consent", "solar"),
    ("Blocked BESS in Britain: Clearstone's appeal fails for 150 MW site at Axminster [UPDATED]", "refusal", "battery"),
    ("UK's largest Solar farm approval deemed lawful by High Court", "planning_decision", "solar"),
    ("Decision due on huge solar farm on palace estate", "planning_decision", "solar"),
    ("RWE and KKR Reach Financial Close for 2.8 GW UK Offshore Wind Projects", "finance", "offshore_wind"),
    ("TotalEnergies acquires 450MW solar, 150MW BESS NSIP project", "finance", "solar"),
    ("Qair begins construction of 46 MW Brecks Solar Farm in Nottinghamshire", "construction", "solar"),
    ("Harmony Energy switches on 70 MWh Skeeby BESS in UK", "energisation", "battery"),
    ("1GWh Coalburn 1 battery energy storage enters operations in Scotland", "energisation", "battery"),
    ("Clean energy projects to be prioritised as grid connections reform evidence window opens", "grid", None),
    ("DESNZ steps back from proposal to require solar over car parks", "policy", "solar"),
    ("AI datacentres plan on-site power stations on huge scale despite climate risks, research reveals",
     "datacentre", None),
    ("Thistle Wind Partners submits offshore plans for Bowdun offshore wind farm", "other", "offshore_wind"),
])
def test_real_headlines_are_kept_and_classified(title, category, technology):
    assert P.category_of(title) == category
    assert P.technology_of(title) == technology


@pytest.mark.parametrize("title", [
    "Mini-gardens for bees on bus stop roofs approved",                       # event word, no topic
    "Investment delivers better bus stops and shelters across Lincolnshire",
    "Kier wins planning battle for Birmingham towers",
    "SMA Solar narrows 2026 guidance off strong nine-month performance",      # topic, no event word
    "Uskmouth BESS makes progress",
    "World is now in 'age of electricity', energy agency chief says",
    "Independent investigation concludes allegations against NESO were unsubstantiated",
    "Total solar eclipse approved as school holiday",                         # not the energy sense of solar
    "Sea Link development consent decision announced",                        # no topic word: a known miss
])
def test_out_of_scope_headlines_are_dropped(title):
    assert P.category_of(title) is None


def test_every_category_and_technology_is_in_the_contract_list():
    assert set(SCHEMA["$defs"]["category"]["enum"]) == set(P.CATEGORIES)
    assert set(SCHEMA["properties"]["items"]["items"]["properties"]["technology"]["enum"]) == set(P.TECHNOLOGIES) | {None}


# ---------------------------------------------------------------- possible match

def test_owner_example_botley_west_is_a_possible_match_on_name_plus_technology():
    m = REPD.match("UK government refuses 840MW Botley West Solar Farm in first-ever solar NSIP no")
    assert m == {"repd_ref": "12588", "site_name": "Botley West, Botley - Botley West Solar Project",
                 "basis": "technology"}


def test_match_bases_developer_authority_county():
    assert REPD.match("SolarFive loses Botley West decision")["basis"] == "developer"
    assert REPD.match("Planning Inspectorate reports on Botley West")["basis"] == "planning_authority"
    assert REPD.match("Oxfordshire reacts to Botley West ruling")["basis"] == "county"


def test_name_alone_is_never_a_match():
    assert REPD.match("Botley West decision announced") is None
    assert REPD.match("Steeple Renewables Project development consent decision announced") is None


def test_name_must_be_exact_and_word_bounded():
    assert REPD.match("Botley Westfield solar farm refused") is None
    assert REPD.match("Green Hills solar farm approved") is None
    assert REPD.match("West Botley solar farm approved") is None      # 'Botley' alone is too short to stand as a name


def test_generic_names_never_match():
    assert REPD.match("Manor Farm solar farm approved in Oxfordshire") is None
    assert "manor farm" not in REPD.by_phrase and "solar farm" not in REPD.by_phrase


def test_colocated_rows_of_one_site_give_the_lowest_ref_and_two_sites_give_nothing():
    m = REPD.match("Low Carbon wins DCO for Beacon Fen Energy Park in Lincolnshire")
    assert (m["repd_ref"], m["basis"]) == ("13599", "developer")
    assert REPD.match("Twin Oaks Solar Farm approved") is None         # two rows, same name, same technology
    assert REPD.match("Twin Oaks Solar Farm approved in Devon")["repd_ref"] == "70003"


def test_name_without_colocated_tail_and_single_distinctive_word():
    assert REPD.match("Green Hill Solar Farm development consent decision announced")["repd_ref"] == "15793"
    assert REPD.match("Zennorwick battery scheme approved")["repd_ref"] == "70004"
    assert REPD.match("Battery scheme approved in Zennorwick") is None  # single word must sit before the technology


def test_data_centre_headlines_never_get_a_repd_match():
    title = "Botley West data centre approved"
    assert P.label(title, REPD) == ("datacentre", None, None)


# ---------------------------------------------------------------- end to end on fixtures

def run(tmp_path, *extra):
    out = tmp_path / "pipeline_headlines.json"
    code = P.main(["--out", str(out), "--feeds", str(FIXTURES / "feeds.json"), "--fixtures", str(FIXTURES),
                   "--now", NOW, *extra])
    return code, (json.loads(out.read_text(encoding="utf-8")) if out.exists() else None)


def validate(node, schema, root=SCHEMA, path="$"):
    """Small JSON Schema checker for the keywords this schema uses (no third-party dependency)."""
    if "$ref" in schema:
        schema = root["$defs"][schema["$ref"].split("/")[-1]]
    if "anyOf" in schema:
        errors = []
        for option in schema["anyOf"]:
            try:
                return validate(node, option, root, path)
            except AssertionError as error:
                errors.append(str(error))
        raise AssertionError("%s: no anyOf option fits: %s" % (path, errors))
    if "const" in schema:
        assert node == schema["const"], path
    if "enum" in schema:
        assert node in schema["enum"], "%s: %r" % (path, node)
    kind = schema.get("type")
    if kind:
        ok = {"object": dict, "array": list, "string": str, "integer": int, "null": type(None)}[kind]
        assert isinstance(node, ok) and not (kind == "integer" and isinstance(node, bool)), "%s: not %s" % (path, kind)
    if isinstance(node, str):
        assert len(node) >= schema.get("minLength", 0) and len(node) <= schema.get("maxLength", 10 ** 9), path
        if "pattern" in schema:
            assert re.search(schema["pattern"], node), "%s: %r" % (path, node)
    if isinstance(node, int) and "minimum" in schema:
        assert node >= schema["minimum"], path
    if isinstance(node, list):
        assert len(node) <= schema.get("maxItems", 10 ** 9), path
        for n, child in enumerate(node):
            validate(child, schema.get("items", {}), root, "%s[%d]" % (path, n))
    if isinstance(node, dict):
        for key in schema.get("required", []):
            assert key in node, "%s: missing %s" % (path, key)
        props, extra = schema.get("properties", {}), schema.get("additionalProperties", True)
        for key, child in node.items():
            if "propertyNames" in schema:
                validate(key, schema["propertyNames"], root, path + "." + key)
            if key in props:
                validate(child, props[key], root, path + "." + key)
            else:
                assert extra is not False, "%s: unexpected %s" % (path, key)
                if isinstance(extra, dict):
                    validate(child, extra, root, path + "." + key)


def test_fixture_run_matches_schema_and_contract(tmp_path):
    code, d = run(tmp_path)
    assert code == 0
    validate(d, SCHEMA)
    assert d["status"] == "partial" and d["counts"]["feeds_failed"] == 1 and d["counts"]["feeds_ok"] == 5
    failed = [f for f in d["feeds"] if f["status"] == "failed"]
    assert len(failed) == 1 and "error" in failed[0]
    items = d["items"]
    assert d["counts"]["items"] == len(items) >= 30
    assert sum(d["counts"]["by_category"].values()) == len(items)
    keys = [(P.when(i), i["link"]) for i in items]
    assert keys == sorted(keys, reverse=True)                       # newest first
    assert len({i["link"] for i in items}) == len(items)
    assert all(set(i) == set(P.ITEM_FIELDS) for i in items)         # nothing beyond the contract is stored
    titles = [i["title"] for i in items]
    botley = [i for i in items if "Botley West" in i["title"]]
    assert {i["category"] for i in botley} == {"refusal", "dco"}
    assert all(i["possible_match"]["repd_ref"] == "12588" for i in botley)
    assert not any("bus stop" in t for t in titles)
    assert not any(" | " in t for t in titles)                      # opinion column dropped
    assert "Seaway7 Kicks Off Cable Installation Work at Ørsted's Hornsea 3" not in titles   # no UK word, global feed


def test_previous_items_are_kept_first_seen_is_stable_and_rerun_is_identical(tmp_path):
    out = tmp_path / "pipeline_headlines.json"
    old = {"schema": P.SCHEMA, "items": [
        {"title": "Example Wind Farm refused by council", "link": "https://example.org/old-story", "source": "Old",
         "date": "2026-10-01T08:00:00Z", "first_seen": "2026-10-01T13:00:00Z", "category": "consent",
         "technology": None, "possible_match": None},
        {"title": "Solar farm approved long ago", "link": "https://example.org/ancient", "source": "Old",
         "date": "2026-01-01T08:00:00Z", "first_seen": "2026-01-01T13:00:00Z", "category": "consent",
         "technology": "solar", "possible_match": None},
        {"title": "A headline today's rules would not keep", "link": "https://example.org/off-topic", "source": "Old",
         "date": "2026-11-01T08:00:00Z", "first_seen": "2026-11-01T13:00:00Z", "category": "other",
         "technology": None, "possible_match": None}]}
    out.write_text(json.dumps(old), encoding="utf-8")
    _, first = run(tmp_path)
    kept = {i["link"]: i for i in first["items"]}
    assert kept["https://example.org/old-story"]["first_seen"] == "2026-10-01T13:00:00Z"
    assert kept["https://example.org/old-story"]["category"] == "refusal"     # re-labelled with today's rules
    assert "https://example.org/ancient" not in kept                          # older than max_age_days
    assert "https://example.org/off-topic" not in kept
    _, second = run(tmp_path, "--now", "2026-11-14T18:00:00Z")
    assert [i for i in second["items"]] == [i for i in first["items"]]        # first_seen does not move


def test_all_feeds_failing_keeps_earlier_items_and_fails_only_without_any(tmp_path):
    feeds = tmp_path / "feeds.json"
    feeds.write_text(json.dumps({"feeds": [{"url": "https://example.invalid/a.xml", "source": "A", "uk_only": True}]}))
    out = tmp_path / "out.json"
    args = ["--out", str(out), "--feeds", str(feeds), "--fixtures", str(tmp_path), "--now", NOW]
    assert P.main(args) == 1                                                  # nothing fetched, nothing to keep
    out.write_text(json.dumps({"schema": P.SCHEMA, "items": [
        {"title": "Solar farm approved", "link": "https://example.org/a", "source": "A", "date": "2026-11-13T08:00:00Z",
         "first_seen": "2026-11-13T13:00:00Z", "category": "consent", "technology": "solar", "possible_match": None}]}))
    assert P.main(args) == 0
    d = json.loads(out.read_text())
    assert d["status"] == "failed" and len(d["items"]) == 1


def test_one_bad_feed_does_not_stop_the_others():
    def fetch(url):
        if "bad" in url:
            raise OSError("boom")
        return (b'<rss version="2.0"><channel><item><title>Sponsored: solar farm approved</title>'
                b'<link>https://example.org/s</link></item><item><title>Solar farm refused in Kent</title>'
                b'<link>http://Example.org/x?utm_source=a#top</link><description>Body text never stored</description>'
                b'</item></channel></rss>')
    feeds = [{"url": "https://bad.example/f", "source": "Bad", "uk_only": True},
             {"url": "https://good.example/f", "source": "Good", "uk_only": True}]
    items, health = P.collect(feeds, fetch, P.Repd(), NOW)
    assert [h["status"] for h in health] == ["failed", "ok"]
    assert [(i["title"], i["link"], i["date"]) for i in items] == [
        ("Solar farm refused in Kent", "https://example.org/x", None)]        # sponsored dropped, link canonical
    assert "Body text" not in json.dumps(items)


def test_global_feed_needs_a_uk_word_and_foreign_headlines_are_dropped():
    body = (b'<rss version="2.0"><channel>'
            b'<item><title>Solar farm approved</title><link>https://example.org/1</link><description>In Kent, England</description></item>'
            b'<item><title>Solar farm approved in Greece</title><link>https://example.org/2</link></item>'
            b'<item><title>Solar farm approved somewhere</title><link>https://example.org/3</link></item>'
            b'</channel></rss>')
    world, _ = P.collect([{"url": "https://w.example/f", "source": "W", "uk_only": False}], lambda u: body, P.Repd(), NOW)
    assert [i["link"] for i in world] == ["https://example.org/1"]
    uk, _ = P.collect([{"url": "https://w.example/f", "source": "W", "uk_only": True}], lambda u: body, P.Repd(), NOW)
    assert [i["link"] for i in uk] == ["https://example.org/1", "https://example.org/3"]


def test_near_identical_titles_from_two_feeds_collapse_to_the_earliest():
    a = {"title": "Statkraft hits key milestone at first UK solar scheme in Yorkshire", "link": "https://a.example/1",
         "source": "A", "date": "2026-09-01T09:00:00Z", "first_seen": NOW}
    b = dict(a, title="Statkraft hits key milestone at first UK solar scheme in Yorkshire - Example Site",
             link="https://b.example/2", source="B", date="2026-09-02T09:00:00Z")
    c = dict(a, title="Statkraft hits a key milestone at first UK solar scheme in Yorkshire", link="https://c.example/3")
    merged = P.merge([], [b, a, c], P.Repd(), NOW)
    assert [i["link"] for i in merged] == ["https://a.example/1"]


def test_probe_report_lists_every_feed_and_kept_headline(tmp_path):
    report = tmp_path / "probe.md"
    assert P.main(["--probe", str(report), "--feeds", str(FIXTURES / "feeds.json"), "--fixtures", str(FIXTURES),
                   "--now", NOW, "--out", str(tmp_path / "never.json")]) == 0
    text = report.read_text(encoding="utf-8")
    assert "FAILED OSError" in text and "Botley West" in text and "REPD 12588" in text
    assert not (tmp_path / "never.json").exists()


def test_live_feed_list_is_https_and_reuses_the_shared_fetcher():
    feeds = P.load_feeds(PKG / "pipeline_feeds.json")
    assert feeds and all(f["url"].startswith("https://") and f["source"] for f in feeds)
    assert len({f["url"] for f in feeds}) == len(feeds)
    assert P.D.fetch_url is D.fetch_url and P.D.parse_feed is D.parse_feed
