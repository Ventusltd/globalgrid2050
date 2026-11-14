"""Tests for automation/convergence/build_repd_datacentres.py. Synthetic fixtures only; no network.

The optional real-input test runs when CONVERGENCE_REAL_INPUTS=1 and the pinned files exist.
"""
from __future__ import annotations

import csv
import hashlib
import json
import math
import os
import sys
from pathlib import Path

import pytest

PKG = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PKG))

import build_repd_datacentres as B  # noqa: E402

COLS = ["Old Ref ID", "Ref ID", "Operator (or Applicant)", "Site Name", "Technology Type",
        "Installed Capacity (MWelec)", "Development Status", "Development Status (short)", "Address", "County",
        "Region", "Country", "X-coordinate", "Y-coordinate"]

# a point in Slough-ish west London, BNG metres
X0, Y0 = 500000.0, 180000.0
LAT0, LON0 = B.bng_to_wgs84(X0, Y0)


def km_north(lat, km):
    return round(lat + km / 111.195, 6)


def repd_row(ref, tech="Solar Photovoltaics", status="Awaiting Construction", mw="10", x=X0, y=Y0,
             site=None, op="Op Ltd", region="South East", country="England", addr=""):
    return {"Old Ref ID": "", "Ref ID": str(ref), "Operator (or Applicant)": op, "Site Name": site or "Site %s" % ref,
            "Technology Type": tech, "Installed Capacity (MWelec)": mw, "Development Status": status,
            "Development Status (short)": status, "Address": addr, "County": "Berkshire", "Region": region,
            "Country": country, "X-coordinate": "" if x is None else str(x), "Y-coordinate": "" if y is None else str(y)}


def dc_feature(i, lat, lon, status="operational", precision="exact_site", operator=None, name=None,
               it=None, gc=None, un=None, un_label=None, geometry=True):
    did = "dcuk-%016x" % i
    return {"type": "Feature", "id": did,
            "geometry": {"type": "Point", "coordinates": [lon, lat]} if geometry else None,
            "properties": {"id": did, "name": name or "DC %d" % i, "status": status, "operator": operator,
                           "location": {"lat": lat, "lon": lon, "precision": precision},
                           "it_load_mw": {"value": it, "label": None, "source_id": None},
                           "grid_connection_mw": {"value": gc, "label": None, "source_id": None},
                           "unclassified_mw": {"value": un, "label": un_label, "source_id": None},
                           "sources": [{"licence": "ODbL-1.0"}]}}


def write_inputs(tmp, rows, feats, nodes=None):
    rp = tmp / "repd.csv"
    with open(rp, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=COLS)
        w.writeheader()
        for r in rows:
            w.writerow(r)
    dp = tmp / "dc.geojson"
    dp.write_text(json.dumps({"type": "FeatureCollection", "metadata": {"title": "t"}, "features": feats}))
    cp = tmp / "cp.json"
    cp.write_text(json.dumps({"schema": "data-grid-gb.connection-points.v3", "connection_points": nodes or []}))
    return rp, dp, cp


def node(code, lat, lon):
    return {"site_code": code, "name": code + " NODE", "transmission_owner": "NGET", "voltages_kv": [400, 132],
            "location": {"lat": lat, "lon": lon}}


def run(tmp, rows, feats, nodes=None, out="out"):
    rp, dp, cp = write_inputs(tmp, rows, feats, nodes)

    class A:
        pass
    a = A()
    a.repd, a.identity, a.datacentres, a.connection_points, a.osm_substations = str(rp), None, str(dp), str(cp), None
    a.release, a.out = "test", str(tmp / out)
    man = B.run(a)
    o = tmp / out
    load = lambda n: json.loads((o / n).read_text())  # noqa: E731
    return man, o, load


# ---------------------------------------------------------------------------------------------- geodesy
def test_bng_to_wgs84_regression_points():
    # values agree with pyproj EPSG:27700 -> 4326 (Helmert) to < 0.1 m; frozen here as a regression
    assert B.bng_to_wgs84(530000, 180000) == (51.503991, -0.128354)
    assert B.bng_to_wgs84(146000, 530000) == (54.601125, -5.93421)     # Belfast: NI rows are BNG in REPD
    assert B.bng_to_wgs84(450000, 1150000) == (60.231239, -1.099095)   # Shetland


def test_bng_to_wgs84_matches_pyproj_if_present():
    pyproj = pytest.importorskip("pyproj")
    t = pyproj.Transformer.from_crs(27700, 4326, always_xy=True)
    for x, y in [(651409.903, 313177.270), (180000, 30000), (300000, 700000), (20000, 450000)]:
        lat, lon = B.bng_to_wgs84(x, y)
        lon2, lat2 = t.transform(x, y)
        assert B.haversine_km(lat, lon, lat2, lon2) < 0.005


def test_haversine_one_degree_latitude():
    assert abs(B.haversine_km(51, 0, 52, 0) - 111.195) < 0.01


# ---------------------------------------------------------------------------------------------- core rules
def test_blank_capacity_is_unknown_not_zero(tmp_path):
    rows = [repd_row(1, mw="10"), repd_row(2, mw="", x=X0 + 100, site="Other")]
    feats = [dc_feature(1, LAT0, LON0)]
    _, _, load = run(tmp_path, rows, feats)
    c = load("datacentre_proximity.json")["records"][0]["radii"]["5"]["solar"]["consented"]
    assert c == {"count": 2, "mw_stated": 10.0, "count_mw_unknown": 1}


def test_status_groups_and_excluded_statuses(tmp_path):
    rows = [repd_row(1, status="Operational"), repd_row(2, status="Under Construction", site="b"),
            repd_row(3, status="Awaiting Construction", site="c"), repd_row(4, status="Application Submitted", site="d"),
            repd_row(5, status="Appeal Lodged", site="e"), repd_row(6, status="Application Refused", site="f"),
            repd_row(7, status="Revised", site="g"), repd_row(8, status="Abandoned", site="h")]
    _, _, load = run(tmp_path, rows, [dc_feature(1, LAT0, LON0)])
    s = load("datacentre_proximity.json")["records"][0]["radii"]["5"]["solar"]
    assert [s[k]["count"] for k in B.STATUS_ORDER] == [1, 1, 1, 2]


def test_technology_groups(tmp_path):
    rows = [repd_row(1, tech="Battery"), repd_row(2, tech="Wind Onshore", site="w"),
            repd_row(3, tech="Wind Offshore", site="o"), repd_row(4, tech="Biomass (dedicated)", site="bio")]
    _, _, load = run(tmp_path, rows, [dc_feature(1, LAT0, LON0)])
    r = load("datacentre_proximity.json")["records"][0]["radii"]["5"]
    assert r["battery"]["consented"]["count"] == 1
    assert r["wind_onshore"]["consented"]["count"] == 1
    assert r["wind_offshore"]["consented"]["count"] == 1
    assert sum(r["solar"][s]["count"] for s in B.STATUS_ORDER) == 0


def test_radius_boundaries_and_nearest(tmp_path):
    # projects at about 3, 7, 20 and 40 km north of the data centre (BNG northing offsets)
    rows = [repd_row(i, y=Y0 + d * 1000, site="s%d" % i, mw=str(i)) for i, d in ((1, 3), (2, 7), (3, 20), (4, 40))]
    rows.append(repd_row(5, y=Y0 + 70000, site="far"))
    _, _, load = run(tmp_path, rows, [dc_feature(1, LAT0, LON0)])
    rec = load("datacentre_proximity.json")["records"][0]
    counts = [rec["radii"][str(r)]["solar"]["consented"]["count"] for r in B.RADII_KM]
    assert counts == [1, 2, 3, 4]
    assert rec["radii"]["50"]["solar"]["consented"]["mw_stated"] == 10.0
    assert rec["nearest_by_technology"]["solar"]["ref"] == "1"
    assert 2.9 < rec["nearest_by_technology"]["solar"]["distance_km"] < 3.1
    assert rec["nearest_by_technology"]["battery"] is None


def test_known_bad_coordinates_excluded_and_listed(tmp_path):
    rows = [repd_row(18561), repd_row(18562, tech="Battery"), repd_row(9, site="good")]
    man, _, load = run(tmp_path, rows, [dc_feature(1, LAT0, LON0)])
    assert {e["ref"] for e in man["excluded_repd_geography"]} == {"18561", "18562"}
    assert all(e["reason"] == "known_wrong_coordinates" for e in man["excluded_repd_geography"])
    assert load("datacentre_proximity.json")["records"][0]["radii"]["50"]["solar"]["consented"]["count"] == 1


# ---------------------------------------------------------------------------------------------- negative cases
def test_wrong_crs_repd_degrees_rejected(tmp_path):
    # lat/lon written into the BNG columns: never treated as metres
    rows = [repd_row(1, x=-0.59, y=51.5), repd_row(2, x=0.5, y=51.5, site="b"), repd_row(3, x=None, y=None, site="c"),
            repd_row(4, x=900000, y=100000, site="d")]
    man, _, load = run(tmp_path, rows, [dc_feature(1, LAT0, LON0)])
    why = {e["ref"]: e["reason"] for e in man["excluded_repd_geography"]}
    assert why == {"1": "coordinates_look_like_degrees_not_bng", "2": "coordinates_look_like_degrees_not_bng",
                   "3": "no_coordinates", "4": "coordinates_outside_bng_range"}
    assert man["stats"]["repd_live_target_projects_located"] == 0


def test_wrong_crs_datacentre_swapped_axes_unplaced(tmp_path):
    feats = [dc_feature(1, LON0, LAT0), dc_feature(2, LAT0, LON0)]   # first has lat/lon swapped
    man, _, load = run(tmp_path, [repd_row(1)], feats)
    recs = {r["id"]: r for r in load("datacentre_proximity.json")["records"]}
    bad = recs["dcuk-%016x" % 1]
    assert bad["lat"] is None and bad["radii"] is None and bad["precision"] == "rejected"
    assert man["datacentres_geometry_rejected"] == [{"id": "dcuk-%016x" % 1, "reason": "outside_uk_wgs84_bounds"}]


def test_unplaced_datacentre_keeps_row_with_null_metrics(tmp_path):
    feats = [dc_feature(1, None, None, geometry=False, status="in_planning")]
    feats[0]["properties"]["location"] = {"lat": None, "lon": None, "precision": None}
    _, _, load = run(tmp_path, [repd_row(1)], feats)
    r = load("datacentre_proximity.json")["records"][0]
    assert r["lat"] is None and r["radii"] is None and r["nearest_transmission_node"] is None
    assert r["precision"] == "unknown" and r["proximity_reliable"] is False


def test_duplicates_counted_once_most_advanced_kept(tmp_path):
    rows = [repd_row(10, status="Awaiting Construction", site="Feldon Vale Solar Farm", mw="49.9"),
            repd_row(12, status="Operational", site="Feldon Vale  solar farm", mw="49.9"),
            repd_row(13, status="Operational", site="Different", mw="49.9")]
    man, o, load = run(tmp_path, rows, [dc_feature(1, LAT0, LON0)])
    s = load("datacentre_proximity.json")["records"][0]["radii"]["5"]["solar"]
    assert s["operational"]["count"] == 2 and s["consented"]["count"] == 0
    assert man["repd_duplicates_collapsed"] == [{"ref": "10", "kept_ref": "12"}]
    proj = load("repd_datacentre_proximity_solar.json")
    i = proj["columns"].index("duplicate_of")
    byref = {r[0]: r for r in proj["rows"]}
    assert byref["10"][i] == "12" and byref["12"][i] is None


def test_operator_match_is_strict():
    k = B.operator_keys
    assert k("Digital Realty Ltd") == k("Digital Realty") == ["digital realty"]
    assert k("Global Digital Realty") != k("Digital Realty")
    assert k("Slough Holdings UK Limited (SDC Capital Partners)") == k("Slough")
    assert k("Cobalt Park Data Centres; Nscale (GPU deployment); Stargate UK") == ["cobalt park", "nscale", "stargate"]
    assert k("UK Ltd") == [] and k("") == [] and k(None) == []
    assert k("Abc") == []   # too short to be evidence


def test_colocation_classes_and_false_matches(tmp_path):
    rows = [
        # A + B: same operator at the same point
        repd_row(1, op="Redcentric Ltd", site="Lowfields Way - Solar"),
        # B only: same operator, far away
        repd_row(2, op="Redcentric", site="Elsewhere", y=Y0 + 30000),
        # not a match: operator shares a word only
        repd_row(3, op="Global Redcentric Partners", site="Nope", y=Y0 + 20000),
        # E: REPD text mentions a data centre
        repd_row(4, site="Energy Park & Data Centre", y=Y0 + 10000, op="X Energy"),
        # town-name tokens shared with the DC name but common across REPD: not class C
        *[repd_row(100 + i, site="Milton Keynes solar %d" % i, x=X0 + 1500, y=Y0 + 300 * i, op="Op %d" % i)
          for i in range(12)],
        # distinctive shared tokens within 2 km: class C
        repd_row(50, site="Wapseys Wood battery", x=X0 + 1000, y=Y0, op="Someone"),
    ]
    feats = [dc_feature(1, LAT0, LON0, operator="Redcentric", name="Redcentric Milton Keynes Wapseys Wood")]
    man, _, load = run(tmp_path, rows, feats)
    c = load("colocation_candidates.json")["records"]
    got = {(r["evidence_class"], r["repd"]["ref"]) for r in c}
    assert ("A_same_site_and_operator", "1") in got
    assert ("B_operator_match", "1") in got and ("B_operator_match", "2") in got
    assert not any(ref == "3" for cls, ref in got if cls.startswith(("A", "B")))
    assert ("E_repd_text_mentions_datacentre", "4") in got
    assert ("C_same_site_name_and_proximity", "50") in got
    assert not any(cls.startswith("C") and ref.startswith("10") for cls, ref in got)
    e = [r for r in c if r["evidence_class"].startswith("E")][0]
    assert e["evidence"]["nearest_within_name_match_km"] is False


def test_datacentre_mw_never_conflated(tmp_path):
    feats = [dc_feature(1, LAT0, LON0, it=100.0), dc_feature(2, km_north(LAT0, 1), LON0, gc=50.0),
             dc_feature(3, km_north(LAT0, 2), LON0, un=100.0, un_label="battery energy storage capacity"),
             dc_feature(4, km_north(LAT0, 3), LON0, status="in_planning")]
    _, _, load = run(tmp_path, [repd_row(1)], feats)
    proj = load("repd_datacentre_proximity_solar.json")
    row = dict(zip(proj["columns"], proj["rows"][0]))
    assert row["r5km_datacentres"] == 4 and row["r5km_operational"] == 3 and row["r5km_pipeline"] == 1
    assert row["r5km_it_load_mw_stated"] == 100.0 and row["r5km_it_load_mw_known_sites"] == 1
    assert row["r5km_grid_connection_mw_stated"] == 50.0 and row["r5km_grid_connection_mw_known_sites"] == 1
    assert "unclassified" not in " ".join(proj["columns"])
    dcp = {r["id"]: r for r in load("datacentre_proximity.json")["records"]}
    assert dcp["dcuk-%016x" % 3]["unclassified_mw_label"] == "battery energy storage capacity"


def test_region_precision_points_not_used_for_project_radii(tmp_path):
    feats = [dc_feature(1, LAT0, LON0, precision="region")]
    _, _, load = run(tmp_path, [repd_row(1)], feats)
    proj = load("repd_datacentre_proximity_solar.json")
    row = dict(zip(proj["columns"], proj["rows"][0]))
    assert row["r50km_datacentres"] == 0 and row["dc1_id"] is None
    dc = load("datacentre_proximity.json")["records"][0]
    assert dc["proximity_reliable"] is False and dc["radii"]["5"]["solar"]["consented"]["count"] == 1


def test_shared_nearest_transmission_node(tmp_path):
    nodes = [node("AAAA", LAT0, LON0), node("BBBB", km_north(LAT0, 60), LON0)]
    rows = [repd_row(1, y=Y0 + 5000), repd_row(2, y=Y0 + 25000, site="b", tech="Battery"),
            repd_row(3, y=Y0 + 55000, site="c")]
    _, _, load = run(tmp_path, rows, [dc_feature(1, LAT0, LON0)], nodes=nodes)
    r = load("datacentre_proximity.json")["records"][0]
    assert r["nearest_transmission_node"]["site_code"] == "AAAA"
    assert r["shared_node"]["repd_refs"] == ["1", "2"]
    assert r["shared_node"]["by_technology"]["battery"]["consented"]["count"] == 1


def test_clusters_need_three_sites_and_rollups(tmp_path):
    feats = [dc_feature(i, km_north(LAT0, 4 * i), LON0) for i in range(3)]          # chain of 3 at 4 km steps
    feats += [dc_feature(10 + i, km_north(LAT0, 200 + 4 * i), LON0) for i in range(2)]  # pair: not a cluster
    rows = [repd_row(1, y=Y0 + 1000), repd_row(2, y=Y0 + 12000, site="b", tech="Battery", mw="")]
    _, _, load = run(tmp_path, rows, feats)
    cl = load("rollup_cluster.json")["records"]
    assert [c["cluster_id"] for c in cl] == ["DCC01"] and cl[0]["sites"] == 3
    assert cl[0]["largest_consented_within_25km"]["solar"][0]["ref"] == "1"
    assert cl[0]["largest_consented_within_25km"]["battery"][0]["capacity_mw"] is None
    reg = {(r["level"], r["name"]): r for r in load("rollup_region.json")["records"]}
    assert reg[("region", "South East")]["repd"]["solar"]["consented"]["count"] == 1
    assert reg[("country", "England")]["datacentres"] == 5


def test_deterministic_bytes_and_manifest(tmp_path):
    rows = [repd_row(i, y=Y0 + 1000 * i, site="s%d" % i) for i in range(1, 30)]
    feats = [dc_feature(i, km_north(LAT0, 3 * i), LON0) for i in range(5)]
    m1, o1, _ = run(tmp_path, rows, feats, out="a")
    m2, o2, _ = run(tmp_path, rows, feats, out="b")
    names = sorted(p.name for p in o1.iterdir())
    assert names == sorted(p.name for p in o2.iterdir())
    for n in names:
        assert (o1 / n).read_bytes() == (o2 / n).read_bytes(), n
    for e in m1["outputs"]:
        assert hashlib.sha256((o1 / e["file"]).read_bytes()).hexdigest() == e["sha256"]
    assert {i["role"] for i in m1["inputs"]} == {"repd_register", "datacentre_baseline", "transmission_nodes"}
    assert "schema.json" in names and "manifest.json" in names


# ---------------------------------------------------------------------------------------------- real inputs
REAL = {
    "repd": "/home/claude/gg-wt/repd-2026q3.csv",
    "identity": "/home/claude/gg-wt/dist/project_identity_2026q3.json",
    "datacentres": "/home/claude/gridatlas/data/uk_datacentre_pipeline_202610312133.geojson",
    "connection_points": "/home/claude/data-grid-gb/derived/connection-points.v3.json",
    "osm_substations": "/home/claude/globalgrid2050/grid_substations.geojson",
}


@pytest.mark.skipif(os.environ.get("CONVERGENCE_REAL_INPUTS") != "1" or not all(map(os.path.exists, REAL.values())),
                    reason="set CONVERGENCE_REAL_INPUTS=1 with the pinned inputs present")
def test_real_inputs(tmp_path):
    class A:
        pass
    a = A()
    for k, v in REAL.items():
        setattr(a, k, v)
    a.release, a.out = "2026q3", str(tmp_path / "out")
    m = B.run(a)
    s = m["stats"]
    assert s["repd_records"] == 14967 and s["datacentres"] == 226 and s["datacentres_placed"] == 225
    ins = {i["role"]: i for i in m["inputs"]}
    assert ins["datacentre_baseline"]["sha256"] == "87337db5d3bf7959f7f605d3abd029dd4196ab24a79107ceb95210c5b7751654"
    assert {"18561", "18562"} <= {e["ref"] for e in m["excluded_repd_geography"]}
    for e in m["outputs"]:
        assert e["bytes"] < B.MAX_FILE_BYTES, e


# ---------------------------------------------------------------------------------------------- Pipeline News sidecar
def test_pipelinenews_sidecar_keys_by_spine_ref(tmp_path):
    import build_pipelinenews_context as P
    rows = [repd_row(1), repd_row(2, tech="Battery", site="b"), repd_row(3, x=None, y=None, site="c"),
            repd_row(4, site="not in spine")]
    _, o, _ = run(tmp_path, rows, [dc_feature(1, km_north(LAT0, 2), LON0, it=50.0)])
    rel = tmp_path / "202611132345"
    (rel / "data" / "v9.1" / "projects").mkdir(parents=True)
    (rel / "data" / "v9.1" / "projects" / "part-001.json").write_text(json.dumps(
        {"projects": [{"repd_ref": "2"}, {"repd_ref": "1"}, {"repd_ref": "3"}]}))
    doc = P.build(o, rel)
    assert [r[0] for r in doc["rows"]] == ["1", "2"]          # spine order by ref, ref 4 not in the spine
    assert doc["no_coordinates"] == ["3"]
    row = dict(zip(doc["columns"], doc["rows"][0]))
    assert row["nearest_dc_id"] == "dcuk-%016x" % 1 and 1.9 < row["nearest_dc_km"] < 2.1
    assert row["it_load_mw_stated_within_25km"] == 50.0
    assert not any(str(r[0]).startswith("dcuk-") for r in doc["rows"])   # no data-centre id posing as a REPD ref
    (rel / "data" / "v9.1" / "projects" / "part-002.json").write_text(json.dumps({"projects": [{"repd_ref": "1"}]}))
    with pytest.raises(SystemExit):
        P.build(o, rel)
