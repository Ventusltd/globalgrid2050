"""Tests for automation/news/datacentre_feed.py. Synthetic fixtures only; no network."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

PKG = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PKG))

import datacentre_feed as D  # noqa: E402

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "datacentre"
NOW = "2026-11-14T01:30:00Z"


def cell(count=0, mw=0.0, unknown=0):
    return {"count": count, "mw_stated": mw, "count_mw_unknown": unknown}


def site(rid, name, operator, reliable=True, solar=(0, 0.0, 0), battery=(0, 0.0, 0)):
    statuses = ("operational", "under_construction", "consented", "in_planning")
    radii = {"10": {"solar": {s: cell() for s in statuses}, "battery": {s: cell() for s in statuses},
                    "wind_onshore": {s: cell() for s in statuses}, "wind_offshore": {s: cell() for s in statuses}}}
    radii["10"]["solar"]["consented"] = cell(*solar)
    radii["10"]["battery"]["in_planning"] = cell(*battery)
    return {"id": rid, "name": name, "operator": operator, "status": "pipeline", "proximity_reliable": reliable,
            "radii": radii}


REGISTER = [
    site("dc-1", "Equinix LD8", "Equinix", solar=(3, 40.5, 1)),
    site("dc-2", "Equinix MA1", "Equinix", battery=(2, 99.0, 0)),
    site("dc-3", "North Wales AI Growth Zone", None, reliable=False),
    site("dc-4", "Microsoft Newport data centre", "Microsoft"),
    site("dc-5", "Unnamed data centre", None),
    site("dc-6", "SCC", "SCC"),
    site("dc-7", "AWS Example", "Amazon Web Services"),
]


def rss(*items):
    body = "".join("<item><title>%s</title><link>%s</link><description>%s</description><pubDate>%s</pubDate></item>"
                   % it for it in items)
    return ('<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>%s</channel></rss>' % body).encode()


def atom(*entries):
    body = "".join('<entry><title>%s</title><link href="%s"/><summary>%s</summary><updated>%s</updated></entry>'
                   % e for e in entries)
    return ('<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>t</title>%s</feed>'
            % body).encode()


# ----------------------------------------------------------------- classification

@pytest.mark.parametrize("title,lanes", [
    ("Firm to invest £2bn in new data centre", ["capex"]),
    ("Datacentre expansion approved by council planning committee", ["capex", "politics"]),
    ("Minister names second AI growth zone", ["politics"]),
    ("Hyperscaler capex passes $190bn as staff cut", ["capex"]),
    ("Data centres face water limits in drought", ["politics"]),
    ("AI infrastructure build slows", ["capex"]),
    ("Supercomputer consultation opens", ["politics"]),
    ("Data center funding round closes", ["capex"]),
])
def test_classify_in_scope(title, lanes):
    assert D.classify(title, "")[1] == lanes


@pytest.mark.parametrize("title", [
    "Council planning row over housing estate",       # policy but no data-centre term
    "Data centre opens to visitors",                  # data centre but no money or policy term
    "Computer prices rise",                           # 'compute' must be a whole word
    "Datacentre-themed board game wins prize",        # no lane term
])
def test_classify_out_of_scope(title):
    assert D.classify(title, "") is None


def test_summary_is_used_for_matching_but_never_stored():
    feed = rss(("Big announcement in Slough", "https://example.org/a", "A £1bn data centre investment, secret body",
                "Thu, 12 Nov 2026 07:10:00 GMT"))
    items, health = D.collect([("u", "S", "w")], lambda u: feed, None, NOW)
    assert len(items) == 1 and items[0]["lanes"] == ["capex"]
    assert "secret body" not in json.dumps(items)
    assert set(items[0]) == {"title", "link", "source", "date", "first_seen", "lanes", "matched_terms", "sites",
                             "site_matches", "capex_basis", "pinned", "operator_sites"}


# ----------------------------------------------------------------- parsing

def test_parse_rss_and_atom_dates_and_links():
    r = D.parse_feed(rss(("A", "https://x.org/1", "", "Thu, 12 Nov 2026 07:10:00 GMT")))
    a = D.parse_feed(atom(("B", "https://x.org/2", "", "2026-11-12T10:00:00+01:00")))
    assert r[0][:2] == ("A", "https://x.org/1") and a[0][:2] == ("B", "https://x.org/2")
    assert D.parse_date(r[0][2]) == "2026-11-12T07:10:00Z"
    assert D.parse_date(a[0][2]) == "2026-11-12T09:00:00Z"
    assert D.parse_date("") is None and D.parse_date("not a date") is None
    assert D.parse_date("2026-11-12T10:00:00") is None   # no timezone: unknown, not guessed


def test_parse_rejects_dtd_entities_oversize_and_non_feeds():
    with pytest.raises(ValueError):
        D.parse_feed(b'<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]><rss><channel/></rss>')
    with pytest.raises(ValueError):
        D.parse_feed(b"<html><body>hi</body></html>")
    with pytest.raises(ValueError):
        D.parse_feed(b"<rss><channel><title>broken")
    with pytest.raises(ValueError):
        D.parse_feed(b"<rss>" + b" " * (D.MAX_BYTES + 1) + b"</rss>")


def test_canonical_link_strips_tracking_and_fragment():
    a = D.canonical_link("https://www.BBC.co.uk/news/articles/x1?at_medium=RSS&at_campaign=rss#top")
    b = D.canonical_link("https://www.bbc.co.uk/news/articles/x1?utm_source=feed")
    assert a == b == "https://www.bbc.co.uk/news/articles/x1"
    assert D.canonical_link("https://example.org/p?id=7&utm_medium=x") == "https://example.org/p?id=7"
    assert D.canonical_link("javascript:alert(1)") is None
    assert D.canonical_link("") is None


def test_titles_are_plain_text():
    assert D.clean_text("<b>Data</b> &amp; centres  &lt;bn&gt;", 300) == "Data & centres <bn>"


# ----------------------------------------------------------------- register join

def test_register_site_name_beats_operator_and_repd_context():
    reg = D.Register(REGISTER)
    sites, operator_sites, n = reg.match("Equinix LD8 expansion: £500m investment")
    assert n == 2 and [s["id"] for s in sites] == ["dc-1"] and sites[0]["matched_on"] == "site_name"
    # The operator's other site is listed for review only: not a named site, and no REPD context.
    assert [s["id"] for s in operator_sites] == ["dc-2"] and operator_sites[0]["matched_on"] == "operator"
    assert "repd_nearby" not in operator_sites[0]
    ctx = sites[0]["repd_nearby"]
    assert ctx["radius_km"] == 10 and ctx["projects"] == 3 and ctx["projects_mw_unknown"] == 1
    assert ctx["mw_stated"] == 40.5 and ctx["mw_stated_by_technology"]["solar"] == 40.5


def test_unreliable_point_has_no_repd_context_and_generic_names_never_match():
    reg = D.Register(REGISTER)
    sites, _, _ = reg.match("North Wales AI Growth Zone gets minister visit")
    assert sites[0]["id"] == "dc-3" and sites[0]["repd_nearby"] is None
    assert reg.match("Unnamed data centre planning row")[0] == []


def test_short_uppercase_operator_is_case_exact_and_alias_works():
    reg = D.Register(REGISTER)
    assert reg.match("SCC wins data centre contract")[1][0]["id"] == "dc-6"
    assert reg.match("Accessibility of data centre jobs")[:2] == ([], [])
    assert reg.match("AWS to invest £8bn in UK data centres")[1][0]["id"] == "dc-7"


def test_general_operator_alone_does_not_make_a_datacentre_story():
    reg = D.Register(REGISTER)
    feed = rss(("Microsoft to invest £1bn in new office software", "https://e.org/1", "", ""),
               ("Equinix secures £300m funding", "https://e.org/2", "", ""),
               ("Microsoft data centre investment confirmed", "https://e.org/3", "", ""))
    items, _ = D.collect([("u", "S", "w")], lambda u: feed, reg, NOW)
    assert [i["link"] for i in items] == ["https://e.org/2", "https://e.org/3"]
    assert "register site" in items[0]["matched_terms"]["datacentre"]
    assert items[1]["sites"] == [] and items[1]["operator_sites"][0]["id"] == "dc-4"
    assert items[0]["capex_basis"] == "financing"


def test_sponsored_headlines_are_dropped_and_build_is_told_from_financing():
    feed = rss(("Sponsored: Why data centre investment must rethink water", "https://e.org/1", "", ""),
               ("Fund of £600m established to support data centre projects", "https://e.org/2", "", ""),
               ("Construction starts on £1bn data centre", "https://e.org/3", "", ""))
    items, _ = D.collect([("u", "S", "w")], lambda u: feed, None, NOW)
    assert [(i["link"], i["capex_basis"]) for i in items] == [("https://e.org/2", "financing"),
                                                              ("https://e.org/3", "build")]
    assert all(i["pinned"] is False for i in items)


def test_sites_capped_per_item():
    many = [site("dc-%02d" % i, "Op Site %d" % i, "Bigco") for i in range(9)]
    sites, operator_sites, n = D.Register(many).match("Bigco data centre investment")
    assert n == 9 and sites == [] and len(operator_sites) == D.SITES_PER_ITEM


# ----------------------------------------------------------------- collection, failure, merge, ordering

def test_one_failing_feed_is_recorded_and_others_continue():
    good = rss(("Data centre £1bn investment", "https://e.org/1", "", "Thu, 12 Nov 2026 07:10:00 GMT"))

    def fetch(url):
        if url == "bad":
            raise OSError("network unreachable")
        return good
    items, health = D.collect([("bad", "X", "w"), ("good", "Y", "w")], fetch, None, NOW)
    assert [h["status"] for h in health] == ["failed", "ok"] and "network unreachable" in health[0]["error"]
    assert len(items) == 1
    out = D.build({}, items, health, NOW)
    assert out["status"] == "partial" and out["counts"]["feeds_failed"] == 1


def test_merge_dedups_by_link_keeps_first_seen_orders_and_caps():
    old = [{"link": "https://e.org/1", "date": "2026-11-01T00:00:00Z", "first_seen": "2026-11-01T01:00:00Z",
            "lanes": ["capex"], "sites": [], "title": "old"}]
    new = [{"link": "https://e.org/1", "date": "2026-11-01T00:00:00Z", "first_seen": NOW, "lanes": ["capex"],
            "sites": [], "title": "new"},
           {"link": "https://e.org/2", "date": None, "first_seen": NOW, "lanes": ["politics"], "sites": [],
            "title": "undated"},
           {"link": "https://e.org/3", "date": "2026-11-05T00:00:00Z", "first_seen": NOW, "lanes": ["politics"],
            "sites": [], "title": "newer"}]
    merged = D.merge(old, new)
    assert [m["link"] for m in merged] == ["https://e.org/3", "https://e.org/1", "https://e.org/2"]
    assert merged[1]["title"] == "new" and merged[1]["first_seen"] == "2026-11-01T01:00:00Z"
    assert len(D.merge(old, new, cap=2)) == 2 and D.merge(old, new, cap=2)[-1]["link"] == "https://e.org/1"


def test_fixture_run_end_to_end_is_deterministic(tmp_path):
    reg = tmp_path / "prox.json"
    reg.write_text(json.dumps({"records": REGISTER}), encoding="utf-8")
    out1, out2 = tmp_path / "a.json", tmp_path / "b.json"
    args = ["--pinned", "none.json", "--fixtures", str(FIXTURES), "--proximity", str(reg), "--now", NOW]
    assert D.main(args + ["--out", str(out1)]) == 0
    assert D.main(args + ["--out", str(out2)]) == 0
    a, b = out1.read_bytes(), out2.read_bytes()
    assert a == b
    data = json.loads(a)
    assert data["schema"] == D.SCHEMA and data["status"] == "partial"
    # 9 feeds: politics fixture is broken XML, science and DCD have no fixture (network failure stand-ins)
    assert data["counts"]["feeds_ok"] == 6 and data["counts"]["feeds_failed"] == 3
    links = [i["link"] for i in data["items"]]
    assert len(links) == len(set(links)) == 9          # Kao Data is not in this synthetic register
    assert links.count("https://www.bbc.co.uk/news/articles/fx0001") == 1     # same story via two feeds
    assert data["items"][-1]["date"] is None                                  # undated last
    dates = [i["date"] for i in data["items"] if i["date"]]
    assert dates == sorted(dates, reverse=True)
    eq = next(i for i in data["items"] if i["link"].endswith("fx0001"))
    assert eq["lanes"] == ["capex"] and {s["id"] for s in eq["sites"] + eq["operator_sites"]} == {"dc-1", "dc-2"}
    # re-running over its own output keeps the file stable (merge is idempotent)
    assert D.main(args + ["--out", str(out1)]) == 0
    assert out1.read_bytes() == a


def test_all_feeds_failing_without_previous_output_exits_nonzero(tmp_path):
    empty = tmp_path / "none"
    empty.mkdir()
    out = tmp_path / "o.json"
    assert D.main(["--pinned", "none.json", "--fixtures", str(empty), "--proximity", str(tmp_path / "missing.json"), "--now", NOW,
                   "--out", str(out)]) == 1
    data = json.loads(out.read_text(encoding="utf-8"))
    assert data["status"] == "failed" and data["items"] == []
    # with an earlier good file the run keeps it and exits 0
    out.write_text(json.dumps({"schema": D.SCHEMA, "items": [
        {"link": "https://e.org/k", "date": None, "first_seen": NOW, "lanes": ["capex"], "sites": [],
         "title": "kept"}]}), encoding="utf-8")
    assert D.main(["--pinned", "none.json", "--fixtures", str(empty), "--now", NOW, "--out", str(out)]) == 0
    assert json.loads(out.read_text(encoding="utf-8"))["items"][0]["title"] == "kept"


def test_feed_list_is_https_and_explained():
    assert len(D.FEEDS) == len({u for u, _, _ in D.FEEDS}) <= 12
    for url, source, why in D.FEEDS:
        assert url.startswith("https://") and source and len(why) > 20


def test_output_matches_json_schema(tmp_path):
    jsonschema = pytest.importorskip("jsonschema")
    reg = tmp_path / "prox.json"
    reg.write_text(json.dumps({"records": REGISTER}), encoding="utf-8")
    out = tmp_path / "o.json"
    D.main(["--pinned", "none.json", "--fixtures", str(FIXTURES), "--proximity", str(reg), "--now", NOW, "--out", str(out)])
    schema = json.loads((PKG / "schema" / "datacentre-news.v1.schema.json").read_text(encoding="utf-8"))
    jsonschema.validate(json.loads(out.read_text(encoding="utf-8")), schema)


def test_pinned_items_are_always_in_the_feed(tmp_path):
    """An owner-pinned headline is carried even when every feed is empty or failing."""
    import json
    from automation.news import datacentre_feed as feed

    pinned = tmp_path / "pinned.json"
    pinned.write_text(json.dumps({"items": [
        {"title": "A pinned headline", "link": "https://example.org/a?utm_source=x", "source": "Example",
         "date": "2026-11-08", "lanes": ["politics"], "reason": "owner"},
        {"title": "No lane, dropped", "link": "https://example.org/b", "lanes": []},
    ]}), encoding="utf-8")
    items = feed.load_pinned(pinned, "2026-11-14T00:00:00Z")
    assert [i["title"] for i in items] == ["A pinned headline"]
    assert items[0]["lanes"] == ["politics"] and items[0]["sites"] == []
    assert feed.load_pinned(tmp_path / "absent.json", "2026-11-14T00:00:00Z") == []


def test_shipped_pinned_file_is_valid():
    import json
    from pathlib import Path
    from automation.news import datacentre_feed as feed

    path = Path(feed.__file__).with_name("datacentre_pinned.json")
    items = feed.load_pinned(path, "2026-11-14T00:00:00Z")
    assert len(items) == len(json.loads(path.read_text(encoding="utf-8"))["items"]) >= 1
    assert all(i["link"].startswith("https://") for i in items)


def test_shipped_pinned_items_carry_a_date():
    from pathlib import Path
    from automation.news import datacentre_feed as feed

    items = feed.load_pinned(Path(feed.__file__).with_name("datacentre_pinned.json"), "2026-11-14T00:00:00Z")
    assert all(i["date"] for i in items), "a pinned item without a parseable date shows undated in the panel"


def test_items_from_earlier_runs_are_brought_to_the_current_shape():
    old = [{"title": "Sponsored: data centre water", "link": "https://e.org/s", "date": None, "first_seen": NOW,
            "lanes": ["politics"], "matched_terms": {"datacentre": [], "capex": [], "politics": ["water"]},
            "sites": [], "site_matches": 0},
           {"title": "Equinix LD8 expansion", "link": "https://e.org/1", "date": None, "first_seen": NOW,
            "lanes": ["capex"], "matched_terms": {"datacentre": [], "capex": ["expansion"], "politics": []},
            "sites": [{"id": "dc-1", "matched_on": "site_name", "repd_nearby": None},
                      {"id": "dc-2", "matched_on": "operator", "repd_nearby": {"projects": 2}}], "site_matches": 2}]
    merged = D.merge(old, [])
    assert [m["link"] for m in merged] == ["https://e.org/1"]
    assert [s["id"] for s in merged[0]["sites"]] == ["dc-1"]
    assert merged[0]["operator_sites"] == [{"id": "dc-2", "matched_on": "operator"}]
    assert merged[0]["capex_basis"] == "build" and merged[0]["pinned"] is False
