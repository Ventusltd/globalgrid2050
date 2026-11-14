#!/usr/bin/env python3
"""REPD x UK data-centre convergence: one deterministic, offline join.

Inputs (read only, pinned by SHA-256 in the manifest this writes):
  --repd               cleaned REPD register CSV (official 53 columns; X/Y are British National Grid metres)
  --identity           project_identity_<release>.json (V6 identity; gives gg_project_id per REPD Ref ID)
  --datacentres        uk_datacentre_pipeline_<stamp>.geojson (the GridAtlas / data-grid-gb DC-A7 baseline)
  --connection-points  data-grid-gb derived/connection-points.v3.json (NESO ETYS nodes >= 132 kV; OSM-joined points)
  --osm-substations    optional grid_substations.geojson (OpenStreetMap; only nodes >= 132 kV are used)

Outputs (in --out): JSON and CSV for
  datacentre_proximity      one row per data centre: REPD MW and counts by technology x status x radius,
                            nearest project per technology, nearest transmission node and the REPD projects
                            that share it as their own nearest node
  repd_datacentre_proximity one row per REPD solar / battery / wind project with usable coordinates: nearest
                            data centres and data-centre counts and stated MW within the same radii
  colocation_candidates     same-site / same-operator pairs between the two registers, each with an evidence class
  rollup_region, rollup_cluster  regional and data-centre-cluster roll-ups
plus manifest.json (input and output hashes, parameters, counts) and schema.json.

Rules carried from the source contracts:
  * blank REPD capacity is unknown, never zero: MW sums are over stated values and the count of projects with
    unknown capacity is reported beside every sum;
  * data-centre IT load MW and grid connection MW are separate and never derived from each other; the baseline's
    unclassified_mw is NOT summed as demand (it mixes facility, zone-ambition and even battery figures) and is only
    passed through with its source label;
  * distance is straight line (haversine on WGS84). Proximity is not connection, capacity or feasibility; the
    "shared nearest transmission node" is a screening grouping, not a statement about any feeder or connection.
  * REPD refs with known wrong coordinates are excluded from geography and listed in the manifest.
No network access, no clock: identical inputs give byte-identical outputs.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

TOOL_VERSION = "1.0.0"
SCHEMA_ID = "globalgrid2050.convergence.repd-datacentres.v1"

RADII_KM = (5, 10, 25, 50)
TECH_GROUPS = {
    "Solar Photovoltaics": "solar",
    "Battery": "battery",
    "Wind Onshore": "wind_onshore",
    "Wind Offshore": "wind_offshore",
}
TECH_ORDER = ("solar", "battery", "wind_onshore", "wind_offshore")
# REPD "Development Status (short)" -> convergence status group. Everything else (refused, withdrawn, abandoned,
# expired, revised, decommissioned, no application required/made) is outside the live pipeline and not counted.
STATUS_GROUPS = {
    "Operational": "operational",
    "Under Construction": "under_construction",
    "Awaiting Construction": "consented",
    "Application Submitted": "in_planning",
    "Appeal Lodged": "in_planning",
}
STATUS_ORDER = ("operational", "under_construction", "consented", "in_planning")
# Known wrong points (docs/repd/AUTOMATION.md "Wrong points"): Salters Lane, Sunderland, plotted in southern England.
BAD_COORD_REFS = frozenset({"18561", "18562"})
BNG_X_RANGE = (0.0, 700000.0)
BNG_Y_RANGE = (0.0, 1300000.0)
UK_LAT = (49.0, 61.5)   # WGS84 bounds a UK data-centre point must fall in
UK_LON = (-11.0, 2.5)
# Data-centre location precisions whose point is good enough for km-scale proximity. "region" points are regional
# centroids (AI Growth Zones and similar) and "unknown" has no point: they keep a row but take no part in
# per-project radii, clusters or same-site candidates.
PROXIMITY_PRECISIONS = frozenset({"exact_site", "settlement"})
NEAREST_DC_LIST = 3
CLUSTER_LINK_KM = 10.0
CLUSTER_MIN_SITES = 3
REGION_VOTE_K = 15
SAME_SITE_KM = 0.5
SAME_SITE_OPERATOR_KM = 1.0
NAME_MATCH_KM = 2.0
NAME_TOKEN_MAX_DF = 10
CLUSTER_TOP_PROJECTS = 5
CLUSTER_TOP_RADIUS_KM = 25
PROJECT_PARTS = (("solar", ("solar",)), ("battery", ("battery",)), ("wind", ("wind_onshore", "wind_offshore")))
MAX_FILE_BYTES = 5 * 1024 * 1024
EARTH_R_KM = 6371.0088  # IUGG mean radius, as data-grid-gb dcmerge.haversine_km

REGION_COUNTRY = {"Scotland": "Scotland", "Wales": "Wales", "Northern Ireland": "Northern Ireland",
                  "Offshore": "Offshore"}

CAVEATS = [
    "Straight-line distance between published points; proximity is not connection, capacity or feasibility.",
    "The shared nearest transmission node is a screening grouping of points nearest the same NESO ETYS node; it says nothing about any feeder, connection offer or queue position.",
    "Blank REPD capacity is unknown, never zero: MW sums are over stated values; unknown-capacity counts are given beside them.",
    "Data-centre IT load MW and grid connection MW are separate source figures and never derived from each other; unclassified_mw is not summed as demand.",
    "A data-centre pipeline entry is not a commitment; data-centre status is the baseline's own status field.",
    "REPD status groups: operational = Operational; under_construction = Under Construction; consented = Awaiting Construction; in_planning = Application Submitted or Appeal Lodged.",
    "REPD refs 18561 and 18562 carry known wrong coordinates and are excluded from all geography.",
    "Live REPD records repeating one site (same technology, site name, stated capacity and point) are counted once: the most advanced status, then the highest Ref ID; the manifest lists every collapsed ref.",
    "A data-centre point outside UK WGS84 bounds is treated as unplaced (never re-projected or guessed).",
]

# ---------------------------------------------------------------------------------------------- normalisers
# Copied from data-grid-gb datacentres/lanes/dc-a7-merge/dcmerge.py (main 01a4491) so operator matching here is
# the same strict rule the data-centre merge uses: tokens, corporate stop words removed, parenthesised gloss
# dropped, exact equality only (no subset or fuzzy matching).
_OP_STOP = {"ltd", "limited", "plc", "llp", "llc", "inc", "uk", "group", "holdings", "holding",
            "europe", "emea", "data", "centre", "centres", "center", "centers", "services",
            "the", "co", "company", "gb", "international", "and"}
# Site-name tokens too common to be evidence of the same site on their own.
_SITE_STOP = {"land", "at", "of", "and", "the", "north", "south", "east", "west", "road", "lane", "farm", "park",
              "site", "street", "near", "adjacent", "to", "former", "new", "old", "rear", "off", "estate",
              "industrial", "business", "centre", "center", "data", "datacentre", "datacenter", "campus", "uk",
              "ltd", "limited", "solar", "battery", "storage", "energy", "bess", "pv", "wind", "power", "station",
              "project", "scheme", "development", "extension", "phase", "plot", "unit", "units", "building",
              "house", "way", "close", "drive", "avenue", "court", "hill", "green", "great", "little", "upper",
              "lower", "st", "ltd", "facility", "proposed", "scheme", "system", "systems", "renewable", "plant",
              "a", "an", "in", "on", "by", "for", "with", "from", "s", "nr", "rd", "la"}
DC_TEXT = re.compile(r"\bdata\s*cent(re|er)s?\b|\bdatacent(re|er)s?\b", re.I)


def _tokens(s):
    s = (s or "").lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return s.split()


def _op_core(s):
    return re.sub(r"\([^)]*\)", " ", s or "")


def norm_operator(s):
    return " ".join(t for t in _tokens(_op_core(s)) if t not in _OP_STOP)


def operator_keys(s):
    """Strict keys of an operator string; a ';'-separated list names several operators."""
    out = []
    for part in (s or "").split(";"):
        k = norm_operator(part)
        if len(k.replace(" ", "")) >= 4 and k not in out:
            out.append(k)
    return out


def site_tokens(s):
    return {t for t in _tokens(s) if len(t) >= 3 and t not in _SITE_STOP and not t.isdigit()}


# ---------------------------------------------------------------------------------------------- geodesy
def bng_to_wgs84(easting, northing):
    """OSGB36 British National Grid (EPSG:27700) -> WGS84 lat/lon, Ordnance Survey formulae and the published
    7-parameter Helmert (about 5 m accuracy, ample for km radii; no OSTN15 grid, so the result is the same on
    every machine)."""
    a, b = 6377563.396, 6356256.909
    f0 = 0.9996012717
    lat0, lon0 = math.radians(49.0), math.radians(-2.0)
    n0, e0 = -100000.0, 400000.0
    e2 = 1 - (b * b) / (a * a)
    n = (a - b) / (a + b)
    n2, n3 = n * n, n * n * n
    lat, m = lat0, 0.0
    while True:
        lat = (northing - n0 - m) / (a * f0) + lat
        ma = (1 + n + 1.25 * n2 + 1.25 * n3) * (lat - lat0)
        mb = (3 * n + 3 * n2 + 2.625 * n3) * math.sin(lat - lat0) * math.cos(lat + lat0)
        mc = (1.875 * n2 + 1.875 * n3) * math.sin(2 * (lat - lat0)) * math.cos(2 * (lat + lat0))
        md = (35 / 24) * n3 * math.sin(3 * (lat - lat0)) * math.cos(3 * (lat + lat0))
        m = b * f0 * (ma - mb + mc - md)
        if abs(northing - n0 - m) < 0.00001:
            break
    sl, cl, tl = math.sin(lat), math.cos(lat), math.tan(lat)
    nu = a * f0 / math.sqrt(1 - e2 * sl * sl)
    rho = a * f0 * (1 - e2) / (1 - e2 * sl * sl) ** 1.5
    eta2 = nu / rho - 1
    t2, t4, t6 = tl * tl, tl ** 4, tl ** 6
    vii = tl / (2 * rho * nu)
    viii = tl / (24 * rho * nu ** 3) * (5 + 3 * t2 + eta2 - 9 * t2 * eta2)
    ix = tl / (720 * rho * nu ** 5) * (61 + 90 * t2 + 45 * t4)
    x = 1 / cl / nu
    xi = 1 / cl / (6 * nu ** 3) * (nu / rho + 2 * t2)
    xii = 1 / cl / (120 * nu ** 5) * (5 + 28 * t2 + 24 * t4)
    xiia = 1 / cl / (5040 * nu ** 7) * (61 + 662 * t2 + 1320 * t4 + 720 * t6)
    de = easting - e0
    phi = lat - vii * de ** 2 + viii * de ** 4 - ix * de ** 6
    lam = lon0 + x * de - xi * de ** 3 + xii * de ** 5 - xiia * de ** 7
    # OSGB36 geodetic -> cartesian (Airy 1830)
    h = 0.0
    sp, cp = math.sin(phi), math.cos(phi)
    nu1 = a / math.sqrt(1 - e2 * sp * sp)
    x1 = (nu1 + h) * cp * math.cos(lam)
    y1 = (nu1 + h) * cp * math.sin(lam)
    z1 = ((1 - e2) * nu1 + h) * sp
    # Helmert OSGB36 -> WGS84
    tx, ty, tz = 446.448, -125.157, 542.060
    s = -20.4894e-6
    rx, ry, rz = (math.radians(v / 3600) for v in (0.1502, 0.2470, 0.8421))
    x2 = tx + (1 + s) * x1 - rz * y1 + ry * z1
    y2 = ty + rz * x1 + (1 + s) * y1 - rx * z1
    z2 = tz - ry * x1 + rx * y1 + (1 + s) * z1
    # cartesian -> WGS84 geodetic (GRS80/WGS84 ellipsoid)
    a2, b2 = 6378137.0, 6356752.314245
    e22 = 1 - (b2 * b2) / (a2 * a2)
    p = math.sqrt(x2 * x2 + y2 * y2)
    phi2 = math.atan2(z2, p * (1 - e22))
    for _ in range(10):
        nu2 = a2 / math.sqrt(1 - e22 * math.sin(phi2) ** 2)
        phi2 = math.atan2(z2 + e22 * nu2 * math.sin(phi2), p)
    lam2 = math.atan2(y2, x2)
    return round(math.degrees(phi2), 6), round(math.degrees(lam2), 6)


def haversine_km(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_R_KM * math.asin(min(1.0, math.sqrt(h)))


def r3(v):
    return None if v is None else round(v + 0.0, 3)


def msum(vals):
    return round(math.fsum(sorted(vals)), 3)


# ---------------------------------------------------------------------------------------------- loaders
def sha256_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def parse_capacity(raw):
    s = (raw or "").strip().replace(",", "")
    if not s:
        return None
    try:
        v = float(s)
    except ValueError:
        return None
    return v if math.isfinite(v) and v >= 0 else None


def parse_coord(raw):
    s = (raw or "").strip().replace(",", "")
    if not s:
        return None
    try:
        v = float(s)
    except ValueError:
        return None
    return v if math.isfinite(v) else None


def load_repd(path, identity_path=None):
    gg = {}
    if identity_path:
        ident = json.loads(Path(identity_path).read_text(encoding="utf-8"))
        for r in ident.get("records", []):
            if r.get("repd_ref"):
                gg[str(r["repd_ref"])] = r.get("gg_project_id")
    rows, excluded = [], []
    with open(path, encoding="utf-8-sig", newline="") as fh:
        for raw in csv.DictReader(fh):
            ref = (raw.get("Ref ID") or "").strip()
            tech_raw = (raw.get("Technology Type") or "").strip()
            status_raw = (raw.get("Development Status (short)") or "").strip()
            x, y = parse_coord(raw.get("X-coordinate")), parse_coord(raw.get("Y-coordinate"))
            lat = lon = None
            why = None
            if ref in BAD_COORD_REFS:
                why = "known_wrong_coordinates"
            elif x is None or y is None:
                why = "no_coordinates"
            elif abs(x) <= 180 and abs(y) <= 90:
                why = "coordinates_look_like_degrees_not_bng"
            elif not (BNG_X_RANGE[0] <= x <= BNG_X_RANGE[1] and BNG_Y_RANGE[0] <= y <= BNG_Y_RANGE[1]):
                why = "coordinates_outside_bng_range"
            else:
                lat, lon = bng_to_wgs84(x, y)
            region = (raw.get("Region") or "").strip()
            country = (raw.get("Country") or "").strip()
            rec = {
                "ref": ref,
                "gg_project_id": gg.get(ref),
                "site_name": (raw.get("Site Name") or "").strip(),
                "operator": (raw.get("Operator (or Applicant)") or "").strip(),
                "address": (raw.get("Address") or "").strip(),
                "technology": tech_raw,
                "tech_group": TECH_GROUPS.get(tech_raw),
                "status": status_raw,
                "status_group": STATUS_GROUPS.get(status_raw),
                "capacity_mw": parse_capacity(raw.get("Installed Capacity (MWelec)")),
                "region": region or None,
                "country": country or None,
                "lat": lat,
                "lon": lon,
            }
            if why and rec["tech_group"]:
                excluded.append({"ref": ref, "technology": tech_raw, "status": status_raw, "reason": why})
            rows.append(rec)
    return rows, excluded


def load_datacentres(path):
    gj = json.loads(Path(path).read_text(encoding="utf-8"))
    out = []
    for f in gj["features"]:
        p = f["properties"]
        g = f.get("geometry")
        lat = lon = None
        geo_issue = None
        if g and g.get("type") == "Point" and g.get("coordinates"):
            lon, lat = float(g["coordinates"][0]), float(g["coordinates"][1])
            if not (UK_LAT[0] <= lat <= UK_LAT[1] and UK_LON[0] <= lon <= UK_LON[1]):
                # swapped axes or a projected CRS read as degrees: never guess, treat as unplaced
                geo_issue = "outside_uk_wgs84_bounds"
                lat = lon = None
        loc = p.get("location") or {}
        precision = loc.get("precision") or ("unknown" if lat is None else "unstated")
        if geo_issue:
            precision = "rejected"

        def mw(key):
            o = p.get(key) or {}
            return {"value": o.get("value"), "label": o.get("label"), "source_id": o.get("source_id")}

        out.append({
            "id": p.get("id") or f.get("id"),
            "name": p.get("name"),
            "status": p.get("status") or "unknown",
            "operator": p.get("operator"),
            "lat": lat, "lon": lon,
            "precision": precision,
            "proximity_reliable": lat is not None and precision in PROXIMITY_PRECISIONS,
            "it_load_mw": mw("it_load_mw"),
            "grid_connection_mw": mw("grid_connection_mw"),
            "unclassified_mw": mw("unclassified_mw"),
            "licences": sorted({s.get("licence") for s in p.get("sources", []) if s.get("licence")}),
            "geometry_issue": geo_issue,
        })
    out.sort(key=lambda d: d["id"])
    return out, gj.get("metadata", {})


def load_connection_points(path):
    d = json.loads(Path(path).read_text(encoding="utf-8"))
    nodes = []
    for c in d.get("connection_points", []):
        loc = c.get("location") or {}
        if loc.get("lat") is None or loc.get("lon") is None:
            continue
        nodes.append({"site_code": c["site_code"], "name": c.get("name"),
                      "transmission_owner": c.get("transmission_owner"),
                      "voltages_kv": c.get("voltages_kv") or [],
                      "lat": float(loc["lat"]), "lon": float(loc["lon"])})
    nodes.sort(key=lambda n: n["site_code"])
    return nodes, {"schema": d.get("schema"), "connection_points": len(d.get("connection_points", [])),
                   "located": len(nodes)}


def _max_kv(v):
    best = 0
    for part in str(v or "").replace(",", ";").split(";"):
        part = part.strip()
        if part.isdigit():
            best = max(best, int(part))
    return best // 1000


def load_osm_substations(path, min_kv=132):
    d = json.loads(Path(path).read_text(encoding="utf-8"))
    out = []
    for f in d.get("features", []):
        g = f.get("geometry") or {}
        if g.get("type") != "Point":
            continue
        p = f.get("properties") or {}
        kv = _max_kv(p.get("voltage"))
        if kv < min_kv:
            continue
        lon, lat = g["coordinates"][:2]
        out.append({"name": p.get("name"), "operator": p.get("operator"), "max_kv": kv,
                    "lat": float(lat), "lon": float(lon)})
    out.sort(key=lambda s: (s["lat"], s["lon"], s["name"] or ""))
    return out, {"features": len(d.get("features", [])), "used_min_kv": min_kv, "used": len(out)}


# ---------------------------------------------------------------------------------------------- spatial index
class GridIndex:
    """Bucket points by 0.5 degree cells; exact nearest-n by expanding rings, deterministic tie-break."""

    CELL = 0.5

    def __init__(self, items):
        self.items = items
        self.cells = defaultdict(list)
        for i, it in enumerate(items):
            self.cells[self._cell(it["lat"], it["lon"])].append(i)

    def _cell(self, lat, lon):
        return (math.floor(lat / self.CELL), math.floor(lon / self.CELL))

    def nearest(self, lat, lon, n=1, key=lambda it: ""):
        ci, cj = self._cell(lat, lon)
        found = []
        ring = 0
        km_per_cell = 111.0 * self.CELL * max(0.3, math.cos(math.radians(min(abs(lat) + 1, 89))))
        max_ring = 80
        while ring <= max_ring:
            for di in range(-ring, ring + 1):
                for dj in range(-ring, ring + 1):
                    if max(abs(di), abs(dj)) != ring:
                        continue
                    for i in self.cells.get((ci + di, cj + dj), ()):
                        it = self.items[i]
                        found.append((haversine_km(lat, lon, it["lat"], it["lon"]), key(it), i))
            if len(found) >= n:
                found.sort()
                # every unvisited cell is at least ring * km_per_cell away
                if found[n - 1][0] <= ring * km_per_cell:
                    break
            ring += 1
        found.sort()
        return [(d, self.items[i]) for d, _, i in found[:n]]


# ---------------------------------------------------------------------------------------------- core
def empty_cells():
    return {t: {s: {"count": 0, "mw": [], "mw_unknown": 0} for s in STATUS_ORDER} for t in TECH_ORDER}


def add_cell(cells, p):
    c = cells[p["tech_group"]][p["status_group"]]
    c["count"] += 1
    if p["capacity_mw"] is None:
        c["mw_unknown"] += 1
    else:
        c["mw"].append(p["capacity_mw"])


def close_cells(cells):
    return {t: {s: {"count": v["count"], "mw_stated": msum(v["mw"]), "count_mw_unknown": v["mw_unknown"]}
                for s, v in sts.items()} for t, sts in cells.items()}


def project_brief(p, d=None):
    o = {"ref": p["ref"], "gg_project_id": p["gg_project_id"], "site_name": p["site_name"],
         "technology": p["technology"], "status": p["status"], "status_group": p["status_group"],
         "capacity_mw": p["capacity_mw"]}
    if d is not None:
        o["distance_km"] = r3(d)
    return o


def node_brief(n, d):
    return {"site_code": n["site_code"], "name": n["name"], "transmission_owner": n["transmission_owner"],
            "voltages_kv": n["voltages_kv"], "distance_km": r3(d)}


def dc_brief(dc, d=None):
    o = {"id": dc["id"], "name": dc["name"], "status": dc["status"], "precision": dc["precision"]}
    if d is not None:
        o["distance_km"] = r3(d)
    return o


def infer_region(dc, repd_index):
    near = repd_index.nearest(dc["lat"], dc["lon"], REGION_VOTE_K, key=lambda p: int(p["ref"]))
    votes, first = Counter(), {}
    for rank, (_, p) in enumerate(near):
        votes[p["region"]] += 1
        first.setdefault(p["region"], rank)
    if not votes:
        return None
    region = sorted(votes, key=lambda r: (-votes[r], first[r]))[0]
    return region


def country_of(region):
    if region is None:
        return None
    return REGION_COUNTRY.get(region, "England")


def cluster_datacentres(dcs):
    """Single-linkage clusters of reliable data-centre points at CLUSTER_LINK_KM; clusters smaller than
    CLUSTER_MIN_SITES are not named. Ids are assigned by size (desc), then by member id, so they are stable."""
    pts = [d for d in dcs if d["proximity_reliable"]]
    parent = list(range(len(pts)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            if haversine_km(pts[i]["lat"], pts[i]["lon"], pts[j]["lat"], pts[j]["lon"]) <= CLUSTER_LINK_KM:
                a, b = find(i), find(j)
                if a != b:
                    parent[max(a, b)] = min(a, b)
    groups = defaultdict(list)
    for i, p in enumerate(pts):
        groups[find(i)].append(p)
    named = [sorted(g, key=lambda d: d["id"]) for g in groups.values() if len(g) >= CLUSTER_MIN_SITES]
    named.sort(key=lambda g: (-len(g), g[0]["id"]))
    out = []
    for k, g in enumerate(named, 1):
        out.append({"cluster_id": "DCC%02d" % k, "members": g})
    return out


STATUS_RANK = {s: i for i, s in enumerate(STATUS_ORDER)}


def find_duplicates(rows):
    """Live records that repeat one site: same technology group, same normalised site name, same stated
    capacity text (blank included) and the same BNG point. The record kept is the most advanced status
    (operational first), then the highest Ref ID (the latest entry); the others are collapsed: they keep their
    own row in the per-project table but are not counted in any radius or roll-up. Returns {ref: kept_ref}."""
    groups = defaultdict(list)
    for p in rows:
        if p["tech_group"] and p["status_group"] and p["lat"] is not None:
            k = (p["tech_group"], " ".join(_tokens(p["site_name"])), p["capacity_mw"], p["lat"], p["lon"])
            groups[k].append(p)
    out = {}
    for g in groups.values():
        if len(g) < 2:
            continue
        g = sorted(g, key=lambda p: (STATUS_RANK[p["status_group"]], -int(p["ref"])))
        for p in g[1:]:
            out[p["ref"]] = g[0]["ref"]
    return out


def build(repd_rows, dcs, nodes, osm=None):
    dups = find_duplicates(repd_rows)
    live = [p for p in repd_rows if p["tech_group"] and p["status_group"] and p["lat"] is not None
            and p["ref"] not in dups]
    located = [p for p in repd_rows if p["lat"] is not None and p["region"] and p["region"] != "Offshore"]
    repd_index = GridIndex(located)
    node_index = GridIndex(nodes) if nodes else None
    osm_index = GridIndex(osm) if osm else None
    reliable = [d for d in dcs if d["proximity_reliable"]]
    placed = [d for d in dcs if d["lat"] is not None]

    # nearest transmission node of every live project (for the shared-node grouping)
    proj_node = {}
    node_members = defaultdict(list)
    if node_index:
        for p in live:
            d, n = node_index.nearest(p["lat"], p["lon"], 1, key=lambda n: n["site_code"])[0]
            proj_node[p["ref"]] = (n, d)
            node_members[n["site_code"]].append(p)

    # region inference and clusters for data centres
    for dc in dcs:
        dc["region_inferred"] = infer_region(dc, repd_index) if dc["lat"] is not None else None
        dc["country_inferred"] = country_of(dc["region_inferred"])
    clusters = cluster_datacentres(dcs)
    dc_cluster = {}
    for c in clusters:
        for m in c["members"]:
            dc_cluster[m["id"]] = c["cluster_id"]

    # ---- (a) per data centre
    dc_rows = []
    for dc in dcs:
        row = {**dc_brief(dc), "operator": dc["operator"], "lat": dc["lat"], "lon": dc["lon"],
               "proximity_reliable": dc["proximity_reliable"], "cluster_id": dc_cluster.get(dc["id"]),
               "region_inferred": dc["region_inferred"], "country_inferred": dc["country_inferred"],
               "it_load_mw": dc["it_load_mw"]["value"], "grid_connection_mw": dc["grid_connection_mw"]["value"],
               "unclassified_mw": dc["unclassified_mw"]["value"],
               "unclassified_mw_label": dc["unclassified_mw"]["label"]}
        if dc["lat"] is None:
            row.update({"radii": None, "nearest_by_technology": None, "nearest_transmission_node": None,
                        "shared_node": None, "nearest_osm_substation_132kv_plus": None})
            dc_rows.append(row)
            continue
        radii = {r: empty_cells() for r in RADII_KM}
        best = {t: None for t in TECH_ORDER}
        for p in live:
            d = haversine_km(dc["lat"], dc["lon"], p["lat"], p["lon"])
            t = p["tech_group"]
            k = (d, int(p["ref"]))
            if best[t] is None or k < best[t][0]:
                best[t] = (k, p)
            for r in RADII_KM:
                if d <= r:
                    add_cell(radii[r], p)
        row["radii"] = {str(r): close_cells(radii[r]) for r in RADII_KM}
        row["nearest_by_technology"] = {t: (project_brief(best[t][1], best[t][0][0]) if best[t] else None)
                                        for t in TECH_ORDER}
        if node_index:
            d, n = node_index.nearest(dc["lat"], dc["lon"], 1, key=lambda n: n["site_code"])[0]
            row["nearest_transmission_node"] = node_brief(n, d)
            cells = empty_cells()
            members = node_members.get(n["site_code"], [])
            for p in members:
                add_cell(cells, p)
            row["shared_node"] = {"site_code": n["site_code"], "repd_projects": len(members),
                                  "by_technology": close_cells(cells),
                                  "repd_refs": sorted((p["ref"] for p in members), key=int)}
        else:
            row["nearest_transmission_node"] = row["shared_node"] = None
        if osm_index:
            d, s = osm_index.nearest(dc["lat"], dc["lon"], 1, key=lambda s: (s["name"] or ""))[0]
            row["nearest_osm_substation_132kv_plus"] = {"name": s["name"], "max_kv": s["max_kv"],
                                                        "operator": s["operator"], "distance_km": r3(d)}
        else:
            row["nearest_osm_substation_132kv_plus"] = None
        dc_rows.append(row)

    # ---- (b) per REPD project (solar and battery first, then wind), all statuses with usable coordinates
    dc_index = GridIndex(reliable) if reliable else None
    proj_rows = []
    order = {t: i for i, t in enumerate(TECH_ORDER)}
    targets = sorted((p for p in repd_rows if p["tech_group"] and p["lat"] is not None),
                     key=lambda p: (order[p["tech_group"]], int(p["ref"])))
    for p in targets:
        row = {**project_brief(p), "tech_group": p["tech_group"], "region": p["region"], "country": p["country"],
               "lat": p["lat"], "lon": p["lon"], "duplicate_of": dups.get(p["ref"])}
        dists = sorted(((haversine_km(p["lat"], p["lon"], dc["lat"], dc["lon"]), dc["id"], dc) for dc in reliable),
                       key=lambda t: (t[0], t[1]))
        row["nearest_datacentres"] = [dc_brief(dc, d) for d, _, dc in dists[:NEAREST_DC_LIST]]
        within = {}
        for r in RADII_KM:
            inr = [dc for d, _, dc in dists if d <= r]
            st = Counter(dc["status"] for dc in inr)
            it = [dc["it_load_mw"]["value"] for dc in inr if dc["it_load_mw"]["value"] is not None]
            gc = [dc["grid_connection_mw"]["value"] for dc in inr if dc["grid_connection_mw"]["value"] is not None]
            within[str(r)] = {"datacentres": len(inr), "operational": st.get("operational", 0),
                              "pipeline": len(inr) - st.get("operational", 0),
                              "it_load_mw_stated": msum(it), "it_load_mw_known_sites": len(it),
                              "grid_connection_mw_stated": msum(gc), "grid_connection_mw_known_sites": len(gc)}
        row["within"] = within
        nd = proj_node.get(p["ref"])
        if nd is None and node_index:
            nd = node_index.nearest(p["lat"], p["lon"], 1, key=lambda n: n["site_code"])[0][::-1]
        row["nearest_transmission_node"] = node_brief(*nd) if nd else None
        proj_rows.append(row)

    # ---- (c) co-location candidates
    coloc = []
    dc_ops = {dc["id"]: operator_keys(dc["operator"]) for dc in dcs}
    ops_to_dc = defaultdict(list)
    for dc in dcs:
        for k in dc_ops[dc["id"]]:
            ops_to_dc[k].append(dc)
    techful = [p for p in repd_rows if p["lat"] is not None]
    seen = set()

    def emit(cls, p, dc, d, evidence):
        key = (cls, p["ref"], dc["id"])
        if key in seen:
            return
        seen.add(key)
        coloc.append({"evidence_class": cls, "datacentre": dc_brief(dc), "repd": project_brief(p),
                      "distance_km": r3(d), "evidence": evidence})

    for p in sorted(repd_rows, key=lambda p: int(p["ref"])):
        pkeys = operator_keys(p["operator"])
        for k in pkeys:
            for dc in ops_to_dc.get(k, ()):
                d = (haversine_km(p["lat"], p["lon"], dc["lat"], dc["lon"])
                     if p["lat"] is not None and dc["lat"] is not None else None)
                if d is not None and d <= SAME_SITE_OPERATOR_KM and dc["precision"] == "exact_site":
                    emit("A_same_site_and_operator", p, dc, d, {"operator_key": k})
                emit("B_operator_match", p, dc, d, {"operator_key": k})
        text = "%s %s" % (p["site_name"], p["address"])
        if DC_TEXT.search(text) and p["lat"] is not None and dc_index:
            d, dc = dc_index.nearest(p["lat"], p["lon"], 1, key=lambda x: x["id"])[0]
            emit("E_repd_text_mentions_datacentre", p, dc, d,
                 {"matched_text": DC_TEXT.search(text).group(0), "datacentre_is_nearest_reliable_point": True,
                  "nearest_within_name_match_km": d <= NAME_MATCH_KM})
    # a site-name token is distinctive when it occurs in at most NAME_TOKEN_MAX_DF REPD name+address strings
    # (place names such as a town occur in many and are not evidence of one site)
    df = Counter()
    for p in repd_rows:
        df.update(site_tokens(p["site_name"] + " " + p["address"]))
    for dc in reliable:
        dtoks = site_tokens(dc["name"])
        for p in techful:
            d = haversine_km(dc["lat"], dc["lon"], p["lat"], p["lon"])
            if d > NAME_MATCH_KM:
                continue
            shared = sorted(dtoks & site_tokens(p["site_name"] + " " + p["address"]))
            distinctive = [t for t in shared if df[t] <= NAME_TOKEN_MAX_DF]
            if len(shared) >= 2 and distinctive:
                emit("C_same_site_name_and_proximity", p, dc, d,
                     {"shared_site_tokens": shared, "distinctive_tokens": distinctive})
            if d <= SAME_SITE_KM and dc["precision"] == "exact_site":
                emit("D_same_site_proximity", p, dc, d, {"radius_km": SAME_SITE_KM})
    coloc.sort(key=lambda c: (c["evidence_class"], c["datacentre"]["id"], int(c["repd"]["ref"])))

    # ---- (d) roll-ups
    regions = defaultdict(lambda: {"cells": empty_cells(), "dc": Counter(), "it": [], "gc": [], "dc_ids": []})
    for p in [p for p in repd_rows if p["tech_group"] and p["status_group"] and p["ref"] not in dups]:
        add_cell(regions[p["region"] or "(blank)"]["cells"], p)
    for dc in placed:
        g = regions[dc["region_inferred"] or "(unplaced)"]
        g["dc"][dc["status"]] += 1
        g["dc_ids"].append(dc["id"])
        if dc["it_load_mw"]["value"] is not None:
            g["it"].append(dc["it_load_mw"]["value"])
        if dc["grid_connection_mw"]["value"] is not None:
            g["gc"].append(dc["grid_connection_mw"]["value"])
    region_rows = []
    for name in sorted(regions):
        g = regions[name]
        region_rows.append({"level": "region", "name": name, "country": country_of(name) if name[0] != "(" else None,
                            "repd": close_cells(g["cells"]), "datacentres": sum(g["dc"].values()),
                            "datacentres_by_status": dict(sorted(g["dc"].items())),
                            "it_load_mw_stated": msum(g["it"]), "it_load_mw_known_sites": len(g["it"]),
                            "grid_connection_mw_stated": msum(g["gc"]),
                            "grid_connection_mw_known_sites": len(g["gc"])})
    countries = defaultdict(list)
    for rr in region_rows:
        if rr["country"]:
            countries[rr["country"]].append(rr)
    for cname in sorted(countries):
        rs = countries[cname]
        cells = {t: {s: {"count": sum(r["repd"][t][s]["count"] for r in rs),
                         "mw_stated": msum([r["repd"][t][s]["mw_stated"] for r in rs]),
                         "count_mw_unknown": sum(r["repd"][t][s]["count_mw_unknown"] for r in rs)}
                     for s in STATUS_ORDER} for t in TECH_ORDER}
        st = Counter()
        for r in rs:
            st.update(r["datacentres_by_status"])
        region_rows.append({"level": "country", "name": cname, "country": cname, "repd": cells,
                            "datacentres": sum(st.values()), "datacentres_by_status": dict(sorted(st.items())),
                            "it_load_mw_stated": msum([r["it_load_mw_stated"] for r in rs]),
                            "it_load_mw_known_sites": sum(r["it_load_mw_known_sites"] for r in rs),
                            "grid_connection_mw_stated": msum([r["grid_connection_mw_stated"] for r in rs]),
                            "grid_connection_mw_known_sites": sum(r["grid_connection_mw_known_sites"] for r in rs)})

    cluster_rows = []
    for c in clusters:
        mem = c["members"]
        lat = round(math.fsum(m["lat"] for m in mem) / len(mem), 5)
        lon = round(math.fsum(m["lon"] for m in mem) / len(mem), 5)
        st = Counter(m["status"] for m in mem)
        it = [m["it_load_mw"]["value"] for m in mem if m["it_load_mw"]["value"] is not None]
        gc = [m["grid_connection_mw"]["value"] for m in mem if m["grid_connection_mw"]["value"] is not None]
        reg = Counter(m["region_inferred"] for m in mem)
        region = sorted(reg, key=lambda r: (-reg[r], r or ""))[0]
        label_node = None
        if node_index:
            d, n = node_index.nearest(lat, lon, 1, key=lambda n: n["site_code"])[0]
            label_node = node_brief(n, d)
        cells_by_r = {r: empty_cells() for r in RADII_KM}
        top = {"solar": [], "battery": []}
        for p in live:
            dmin = min(haversine_km(m["lat"], m["lon"], p["lat"], p["lon"]) for m in mem)
            if dmin > RADII_KM[-1]:
                continue
            for r in RADII_KM:
                if dmin <= r:
                    add_cell(cells_by_r[r], p)
            if dmin <= CLUSTER_TOP_RADIUS_KM and p["status_group"] == "consented" and p["tech_group"] in top:
                top[p["tech_group"]].append((p, dmin))
        radii = {str(r): close_cells(cells_by_r[r]) for r in RADII_KM}
        tops = {}
        for t, lst in top.items():
            lst.sort(key=lambda x: (-(x[0]["capacity_mw"] if x[0]["capacity_mw"] is not None else -1),
                                    int(x[0]["ref"])))
            tops[t] = [project_brief(p, d) for p, d in lst[:CLUSTER_TOP_PROJECTS]]
        cluster_rows.append({"level": "cluster", "cluster_id": c["cluster_id"], "sites": len(mem),
                             "centroid": {"lat": lat, "lon": lon}, "region_inferred": region,
                             "label_transmission_node": label_node,
                             "datacentres_by_status": dict(sorted(st.items())),
                             "member_ids": [m["id"] for m in mem],
                             "it_load_mw_stated": msum(it), "it_load_mw_known_sites": len(it),
                             "grid_connection_mw_stated": msum(gc), "grid_connection_mw_known_sites": len(gc),
                             "repd_within_km_of_any_member": radii,
                             "largest_consented_within_%dkm" % CLUSTER_TOP_RADIUS_KM: tops})

    stats = {
        "repd_records": len(repd_rows),
        "repd_live_target_projects_located": len(live),
        "repd_target_projects_located_all_statuses": len(targets),
        "datacentres": len(dcs), "datacentres_placed": len(placed),
        "datacentres_proximity_reliable": len(reliable),
        "transmission_nodes_located": len(nodes), "osm_substations_132kv_plus": len(osm or []),
        "clusters": len(clusters),
        "repd_duplicates_collapsed": len(dups),
        "datacentres_geometry_rejected": sum(1 for d in dcs if d.get("geometry_issue")),
        "colocation_candidates_by_class": dict(sorted(Counter(c["evidence_class"] for c in coloc).items())),
    }
    return {"datacentre_proximity": dc_rows, "repd_datacentre_proximity": proj_rows,
            "colocation_candidates": coloc, "rollup_region": region_rows, "rollup_cluster": cluster_rows,
            "stats": stats, "duplicates": dups}


# ---------------------------------------------------------------------------------------------- CSV flattening
def flat_cells(prefix, cells, out):
    for t in TECH_ORDER:
        for s in STATUS_ORDER:
            c = cells[t][s]
            out["%s%s_%s_mw" % (prefix, t, s)] = c["mw_stated"]
            out["%s%s_%s_count" % (prefix, t, s)] = c["count"]
            out["%s%s_%s_mw_unknown" % (prefix, t, s)] = c["count_mw_unknown"]


def csv_dc(rows):
    out = []
    for r in rows:
        o = {k: r[k] for k in ("id", "name", "status", "precision", "proximity_reliable", "operator", "lat", "lon",
                               "cluster_id", "region_inferred", "country_inferred", "it_load_mw",
                               "grid_connection_mw", "unclassified_mw", "unclassified_mw_label")}
        n = r.get("nearest_transmission_node") or {}
        o["nearest_node_site_code"] = n.get("site_code")
        o["nearest_node_name"] = n.get("name")
        o["nearest_node_km"] = n.get("distance_km")
        sh = r.get("shared_node") or {}
        o["shared_node_repd_projects"] = sh.get("repd_projects")
        for t in TECH_ORDER:
            nb = (r.get("nearest_by_technology") or {}).get(t) or {}
            o["nearest_%s_ref" % t] = nb.get("ref")
            o["nearest_%s_km" % t] = nb.get("distance_km")
            o["nearest_%s_status" % t] = nb.get("status")
            o["nearest_%s_mw" % t] = nb.get("capacity_mw")
        if sh:
            flat_cells("shared_node_", sh["by_technology"], o)
        for rad in RADII_KM:
            if r.get("radii"):
                flat_cells("r%dkm_" % rad, r["radii"][str(rad)], o)
        out.append(o)
    return out


def csv_proj(rows):
    out = []
    for r in rows:
        o = {k: r[k] for k in ("ref", "gg_project_id", "site_name", "technology", "tech_group", "status",
                               "status_group", "capacity_mw", "region", "country", "lat", "lon", "duplicate_of")}
        for i in range(NEAREST_DC_LIST):
            nd = r["nearest_datacentres"][i] if i < len(r["nearest_datacentres"]) else {}
            o["dc%d_id" % (i + 1)] = nd.get("id")
            o["dc%d_name" % (i + 1)] = nd.get("name")
            o["dc%d_status" % (i + 1)] = nd.get("status")
            o["dc%d_km" % (i + 1)] = nd.get("distance_km")
        for rad in RADII_KM:
            w = r["within"][str(rad)]
            for k in ("datacentres", "operational", "pipeline", "it_load_mw_stated", "it_load_mw_known_sites",
                      "grid_connection_mw_stated", "grid_connection_mw_known_sites"):
                o["r%dkm_%s" % (rad, k)] = w[k]
        n = r.get("nearest_transmission_node") or {}
        o["nearest_node_site_code"] = n.get("site_code")
        o["nearest_node_km"] = n.get("distance_km")
        out.append(o)
    return out


def csv_coloc(rows):
    return [{"evidence_class": c["evidence_class"], "datacentre_id": c["datacentre"]["id"],
             "datacentre_name": c["datacentre"]["name"], "datacentre_status": c["datacentre"]["status"],
             "repd_ref": c["repd"]["ref"], "gg_project_id": c["repd"]["gg_project_id"],
             "repd_site_name": c["repd"]["site_name"], "repd_technology": c["repd"]["technology"],
             "repd_status": c["repd"]["status"], "repd_capacity_mw": c["repd"]["capacity_mw"],
             "distance_km": c["distance_km"], "evidence": json.dumps(c["evidence"], sort_keys=True)} for c in rows]


def csv_region(rows):
    out = []
    for r in rows:
        o = {"level": r["level"], "name": r["name"], "country": r["country"], "datacentres": r["datacentres"],
             "datacentres_by_status": json.dumps(r["datacentres_by_status"], sort_keys=True),
             "it_load_mw_stated": r["it_load_mw_stated"], "it_load_mw_known_sites": r["it_load_mw_known_sites"],
             "grid_connection_mw_stated": r["grid_connection_mw_stated"],
             "grid_connection_mw_known_sites": r["grid_connection_mw_known_sites"]}
        flat_cells("repd_", r["repd"], o)
        out.append(o)
    return out


def csv_cluster(rows):
    out = []
    for r in rows:
        n = r["label_transmission_node"] or {}
        o = {"cluster_id": r["cluster_id"], "sites": r["sites"], "centroid_lat": r["centroid"]["lat"],
             "centroid_lon": r["centroid"]["lon"], "region_inferred": r["region_inferred"],
             "label_node_site_code": n.get("site_code"), "label_node_name": n.get("name"),
             "datacentres_by_status": json.dumps(r["datacentres_by_status"], sort_keys=True),
             "it_load_mw_stated": r["it_load_mw_stated"], "it_load_mw_known_sites": r["it_load_mw_known_sites"],
             "grid_connection_mw_stated": r["grid_connection_mw_stated"],
             "grid_connection_mw_known_sites": r["grid_connection_mw_known_sites"],
             "member_ids": ";".join(r["member_ids"])}
        for rad in RADII_KM:
            flat_cells("r%dkm_" % rad, r["repd_within_km_of_any_member"][str(rad)], o)
        out.append(o)
    return out


def to_csv_bytes(rows):
    if not rows:
        return b""
    cols = list(rows[0].keys())
    for r in rows[1:]:
        for k in r:
            if k not in cols:
                cols.append(k)
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=cols, lineterminator="\n")
    w.writeheader()
    for r in rows:
        w.writerow({k: ("" if r.get(k) is None else r.get(k)) for k in cols})
    return buf.getvalue().encode("utf-8")


def to_json_bytes(obj, compact=False):
    if compact:
        return (json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
    return (json.dumps(obj, ensure_ascii=False, indent=1) + "\n").encode("utf-8")


# ---------------------------------------------------------------------------------------------- schema
def schema_doc():
    cell = {"count": "projects in the cell", "mw_stated": "sum of stated Installed Capacity (MWelec); blanks excluded",
            "count_mw_unknown": "projects in the cell whose capacity is blank (unknown, not zero)"}
    return {
        "schema": SCHEMA_ID,
        "tool_version": TOOL_VERSION,
        "parameters": {"radii_km": list(RADII_KM), "technology_groups": TECH_GROUPS, "status_groups": STATUS_GROUPS,
                       "proximity_precisions": sorted(PROXIMITY_PRECISIONS), "cluster_link_km": CLUSTER_LINK_KM,
                       "cluster_min_sites": CLUSTER_MIN_SITES, "region_vote_k": REGION_VOTE_K,
                       "same_site_km": SAME_SITE_KM, "same_site_operator_km": SAME_SITE_OPERATOR_KM,
                       "name_match_km": NAME_MATCH_KM, "name_token_max_df": NAME_TOKEN_MAX_DF,
                       "earth_radius_km": EARTH_R_KM},
        "caveats": CAVEATS,
        "cell": cell,
        "files": {
            "datacentre_proximity.json": {
                "key": "id (data-centre id from the baseline)",
                "fields": {
                    "precision": "baseline location.precision; proximity_reliable is true for exact_site and settlement",
                    "region_inferred": "majority REPD Region of the %d nearest located onshore REPD records (any technology or status); an inference, not a source field" % REGION_VOTE_K,
                    "it_load_mw / grid_connection_mw": "baseline values as published; null is unknown",
                    "unclassified_mw (+label)": "passed through, never summed: the label says what the figure is",
                    "radii[<km>][<tech>][<status>]": "cell of REPD projects within <km> straight line",
                    "nearest_by_technology[<tech>]": "nearest REPD project of that technology in the four live status groups",
                    "nearest_transmission_node": "nearest located NESO ETYS node (connection-points.v3, >=132 kV)",
                    "shared_node": "live REPD projects (four technologies) whose own nearest ETYS node is the same node",
                    "nearest_osm_substation_132kv_plus": "nearest OpenStreetMap substation tagged >= 132 kV"}},
            "repd_datacentre_proximity_{solar,battery,wind}.json": {
                "key": "ref (REPD Ref ID); gg_project_id from the V6 identity",
                "layout": "columnar (columns + rows) with the same columns as the CSV, for size; one file per technology part",
                "scope": "solar, battery, onshore and offshore wind with usable coordinates, every status (status_group null outside the live pipeline); ordered solar, battery, wind onshore, wind offshore, then ref",
                "fields": {"duplicate_of": "set when this live record repeats a site (same technology group, normalised site name, stated capacity and point); the record named is counted instead and this one is in no radius or roll-up",
                           "nearest_datacentres": "up to %d nearest proximity-reliable data centres" % NEAREST_DC_LIST,
                           "within[<km>]": "proximity-reliable data centres within <km>: count, operational, pipeline (every other status), stated IT load MW and grid connection MW with the number of sites stating each"}},
            "colocation_candidates.json": {
                "key": "(evidence_class, datacentre.id, repd.ref)",
                "evidence_classes": {
                    "A_same_site_and_operator": "strict operator match and <= %.1f km, data centre at exact_site precision" % SAME_SITE_OPERATOR_KM,
                    "B_operator_match": "strict operator match at any distance (dcmerge norm_operator after dropping a parenthesised gloss; exact equality; ';' splits several operators)",
                    "C_same_site_name_and_proximity": ">= 2 shared site-name tokens, at least one distinctive (in <= %d REPD name+address strings), and <= %.1f km" % (NAME_TOKEN_MAX_DF, NAME_MATCH_KM),
                    "D_same_site_proximity": "<= %.1f km, data centre at exact_site precision; any REPD technology or status" % SAME_SITE_KM,
                    "E_repd_text_mentions_datacentre": "REPD Site Name or Address mentions a data centre; paired with the nearest proximity-reliable data centre, which may be far away (evidence.nearest_within_name_match_km says whether it is within %.1f km): the REPD text is the evidence, the pairing is only a pointer" % NAME_MATCH_KM},
                "note": "a candidate is evidence to review, not a confirmed relationship"},
            "rollup_region.json": {"levels": "region (REPD Region; data centres by region_inferred) and country",
                                   "repd": "live-pipeline cells of the four technologies"},
            "rollup_cluster.json": {"clusters": "single-linkage of proximity-reliable data centres at %.0f km, at least %d sites; ids by size then member id" % (CLUSTER_LINK_KM, CLUSTER_MIN_SITES),
                                    "repd_within_km_of_any_member": "live REPD projects within <km> of any member, each counted once",
                                    "largest_consented_within_%dkm" % CLUSTER_TOP_RADIUS_KM: "the %d largest stated-capacity Awaiting Construction solar and battery projects within %d km of any member (unknown capacity last)" % (CLUSTER_TOP_PROJECTS, CLUSTER_TOP_RADIUS_KM)},
            "CSV files": "flattened views of the JSON files: columns r<km>km_<tech>_<status>_{mw,count,mw_unknown}; blank cell = null",
        },
    }


# ---------------------------------------------------------------------------------------------- main
def run(args):
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    repd_rows, excluded = load_repd(args.repd, args.identity)
    dcs, dc_meta = load_datacentres(args.datacentres)
    nodes, node_meta = load_connection_points(args.connection_points) if args.connection_points else ([], None)
    osm, osm_meta = load_osm_substations(args.osm_substations) if args.osm_substations else (None, None)
    res = build(repd_rows, dcs, nodes, osm)

    files = {}
    meta = {"schema": SCHEMA_ID, "caveats": CAVEATS}
    for name, rows, flat in (("datacentre_proximity", res["datacentre_proximity"], csv_dc),
                             ("colocation_candidates", res["colocation_candidates"], csv_coloc),
                             ("rollup_region", res["rollup_region"], csv_region),
                             ("rollup_cluster", res["rollup_cluster"], csv_cluster)):
        files[name + ".json"] = to_json_bytes({**meta, "records": rows})
        files[name + ".csv"] = to_csv_bytes(flat(rows))
    # the per-project table is split by technology and written compactly so every file stays under the
    # repository's 5 MB per-file guard (.github/workflows/pr-file-size-guard.yml MAX_MB)
    for part, groups in PROJECT_PARTS:
        rows = [r for r in res["repd_datacentre_proximity"] if r["tech_group"] in groups]
        flat = csv_proj(rows)
        cols = list(flat[0].keys()) if flat else []
        files["repd_datacentre_proximity_%s.json" % part] = to_json_bytes(
            {**meta, "layout": "columnar: one array per project in the order of columns; null is unknown",
             "columns": cols, "rows": [[r.get(c) for c in cols] for r in flat]}, compact=True)
        files["repd_datacentre_proximity_%s.csv" % part] = to_csv_bytes(flat)
    files["schema.json"] = to_json_bytes(schema_doc())

    def inp(label, path, extra=None):
        p = Path(path)
        o = {"role": label, "file": p.name, "sha256": sha256_file(p), "bytes": p.stat().st_size}
        if extra:
            o.update(extra)
        return o

    inputs = [inp("repd_register", args.repd, {"records": len(repd_rows)})]
    if args.identity:
        inputs.append(inp("repd_identity", args.identity))
    inputs.append(inp("datacentre_baseline", args.datacentres,
                      {"features": len(dcs), "title": dc_meta.get("title")}))
    if args.connection_points:
        inputs.append(inp("transmission_nodes", args.connection_points, node_meta))
    if args.osm_substations:
        inputs.append(inp("osm_substations", args.osm_substations, osm_meta))
    manifest = {
        "schema": SCHEMA_ID + ".manifest",
        "tool": {"file": "automation/convergence/build_repd_datacentres.py", "version": TOOL_VERSION,
                 "sha256": sha256_file(__file__)},
        "release": args.release,
        "inputs": inputs,
        "excluded_repd_geography": sorted(excluded, key=lambda e: int(e["ref"]) if e["ref"].isdigit() else 0),
        "repd_duplicates_collapsed": [{"ref": r, "kept_ref": k} for r, k in
                                      sorted(res["duplicates"].items(), key=lambda kv: int(kv[0]))],
        "datacentres_geometry_rejected": [{"id": d["id"], "reason": d["geometry_issue"]} for d in dcs
                                          if d.get("geometry_issue")],
        "stats": res["stats"],
        "outputs": [{"file": n, "sha256": hashlib.sha256(b).hexdigest(), "bytes": len(b)}
                    for n, b in sorted(files.items())],
    }
    files["manifest.json"] = to_json_bytes(manifest)
    for n, b in files.items():
        (out / n).write_bytes(b)
    return manifest


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--repd", required=True)
    ap.add_argument("--identity")
    ap.add_argument("--datacentres", required=True)
    ap.add_argument("--connection-points")
    ap.add_argument("--osm-substations")
    ap.add_argument("--release", default="2026q3")
    ap.add_argument("--out", required=True)
    a = ap.parse_args(argv)
    m = run(a)
    json.dump(m["stats"], sys.stdout, indent=1)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
