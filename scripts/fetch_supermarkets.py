import requests
import json
import math
import time

OUTPUT_FILE = "supermarkets.geojson"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

MIN_AREA_M2 = 1500
BBOX = "49.5,-10.8,61.0,2.2"

BRANDS = [
    "Tesco",
    "Sainsbury's",
    "Asda",
    "Morrisons",
    "Aldi",
    "Lidl",
    "Waitrose",
    "Marks and Spencer",
    "M&S",
    "Co-op",
    "Iceland",
    "Farmfoods",
    "Costco",
    "Booths",
    "Spar",
]

BRAND_CANONICAL = {
    "tesco":             "Tesco",
    "sainsbury":         "Sainsbury's",
    "asda":              "Asda",
    "morrisons":         "Morrisons",
    "aldi":              "Aldi",
    "lidl":              "Lidl",
    "waitrose":          "Waitrose",
    "marks and spencer": "M&S Food",
    "m&s":               "M&S Food",
    "co-op":             "Co-op",
    "coop":              "Co-op",
    "cooperative":       "Co-op",
    "iceland":           "Iceland",
    "farmfoods":         "Farmfoods",
    "costco":            "Costco",
    "booths":            "Booths",
    "spar":              "Spar",
}

BRAND_COLOURS = {
    "Tesco":       "#ee1c2e",
    "Sainsbury's": "#ff8200",
    "Asda":        "#78be20",
    "Morrisons":   "#ffd700",
    "Aldi":        "#003087",
    "Lidl":        "#0050aa",
    "Waitrose":    "#7ab800",
    "M&S Food":    "#009b77",
    "Co-op":       "#00b1a9",
    "Iceland":     "#c8102e",
    "Farmfoods":   "#e30613",
    "Costco":      "#005daa",
    "Booths":      "#6d2077",
    "Spar":        "#00a650",
}


def build_query() -> str:
    blocks = ""
    for brand in BRANDS:
        b = brand.replace("'", "\\'").replace("&", "\\&")
        blocks += (
            f'way["shop"="supermarket"]["brand"~"{b}",i]({BBOX});\n'
            f'way["shop"="supermarket"]["name"~"{b}",i]({BBOX});\n'
            f'way["shop"="convenience"]["brand"~"{b}",i]({BBOX});\n'
            f'way["shop"="wholesale"]["brand"~"{b}",i]({BBOX});\n'
            f'relation["shop"="supermarket"]["brand"~"{b}",i]({BBOX});\n'
            f'relation["shop"="supermarket"]["name"~"{b}",i]({BBOX});\n'
        )
    return (
        f"[out:json][timeout:180];\n"
        f"(\n{blocks});\n"
        f"out body;\n>;\nout skel qt;\n"
    )


def fetch_overpass(query: str) -> dict:
    print("Fetching UK supermarkets from OpenStreetMap via Overpass API...")
    for attempt in range(3):
        try:
            response = requests.post(
                OVERPASS_URL,
                data={"data": query},
                timeout=240,
                headers={"User-Agent": "GlobalGrid2050-SupermarketFetcher/1.0"}
            )
            if response.status_code == 200:
                print("  Download successful!")
                return response.json()
            elif response.status_code == 429:
                print("  Rate limited, sleeping 60s...")
                time.sleep(60)
            else:
                print(f"  HTTP error: {response.status_code}")
                return {}
        except Exception as e:
            print(f"  Connection error: {e}")
            if attempt < 2:
                time.sleep(15)
    return {}


def node_map(elements: list) -> dict:
    return {
        el["id"]: (el["lon"], el["lat"])
        for el in elements if el["type"] == "node"
    }


def polygon_area_m2(coords: list) -> float:
    if not coords or len(coords) < 3:
        return 0.0
    lat_c = sum(c[1] for c in coords) / len(coords)
    mlat = 111_320.0
    mlon = 111_320.0 * math.cos(math.radians(lat_c))
    n = len(coords)
    area = 0.0
    for i in range(n):
        x1 = coords[i][0] * mlon
        y1 = coords[i][1] * mlat
        x2 = coords[(i + 1) % n][0] * mlon
        y2 = coords[(i + 1) % n][1] * mlat
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0


def centroid(coords: list) -> tuple:
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return (sum(lons) / len(lons), sum(lats) / len(lats))


def way_to_ring(way: dict, nodes: dict):
    coords = []
    for nid in way.get("nodes", []):
        if nid not in nodes:
            return None
        coords.append(nodes[nid])
    if len(coords) < 3:
        return None
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    return coords


def canonical_brand(tags: dict) -> str:
    combined = (tags.get("brand", "") + " " + tags.get("name", "")).lower()
    for fragment, label in BRAND_CANONICAL.items():
        if fragment in combined:
            return label
    return tags.get("brand") or tags.get("name") or "Unknown"


def process(data: dict) -> list:
    elements = data.get("elements", [])
    nodes = node_map(elements)
    ways = {el["id"]: el for el in elements if el["type"] == "way" and "tags" in el}
    relations = [el for el in elements if el["type"] == "relation" and "tags" in el]

    print(f"  Received {len(elements)} elements ({len(ways)} tagged ways, {len(relations)} relations)")

    features = []
    seen = set()

    for way in ways.values():
        if way["id"] in seen:
            continue
        ring = way_to_ring(way, nodes)
        if not ring:
            continue
        area = polygon_area_m2(ring)
        if area < MIN_AREA_M2:
            continue
        seen.add(way["id"])
        lon, lat = centroid(ring)
        features.append(_feature(lon, lat, way["tags"], area, way["id"], "way"))

    for rel in relations:
        if rel["id"] in seen:
            continue
        outer_coords = []
        for member in rel.get("members", []):
            if member["type"] == "way" and member.get("role") in ("outer", ""):
                way = ways.get(member["ref"])
                if way:
                    ring = way_to_ring(way, nodes)
                    if ring:
                        outer_coords.extend(ring)
        if not outer_coords:
            continue
        area = polygon_area_m2(outer_coords)
        if area < MIN_AREA_M2:
            continue
        seen.add(rel["id"])
        lon, lat = centroid(outer_coords)
        features.append(_feature(lon, lat, rel["tags"], area, rel["id"], "relation"))

    return features


def _feature(lon, lat, tags, area, osm_id, osm_type) -> dict:
    brand = canonical_brand(tags)
    return {
        "type": "Feature",
        "properties": {
            "name":     tags.get("name", ""),
            "brand":    brand,
            "colour":   BRAND_COLOURS.get(brand, "#ffffff"),
            "street":   tags.get("addr:street", ""),
            "city":     tags.get("addr:city", ""),
            "postcode": tags.get("addr:postcode", ""),
            "website":  tags.get("website", ""),
            "area_m2":  round(area),
            "osm_id":   osm_id,
            "osm_type": osm_type,
            "type":     "supermarket",
        },
        "geometry": {
            "type": "Point",
            "coordinates": [round(lon, 6), round(lat, 6)]
        }
    }


def deduplicate(features: list, tol_m: float = 80.0) -> list:
    tol = tol_m / 111_320.0
    kept = []
    for f in features:
        lon, lat = f["geometry"]["coordinates"]
        brand = f["properties"]["brand"]
        dup = False
        for k in kept:
            klon, klat = k["geometry"]["coordinates"]
            if k["properties"]["brand"] == brand:
                if abs(lon - klon) < tol and abs(lat - klat) < tol:
                    if f["properties"]["area_m2"] > k["properties"]["area_m2"]:
                        kept.remove(k)
                    else:
                        dup = True
                    break
        if not dup:
            kept.append(f)
    return kept


def summary(features: list):
    from collections import Counter
    counts = Counter(f["properties"]["brand"] for f in features)
    print("\n  Stores by brand:")
    for brand, n in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"    {brand:<22} {n:>4}")
    print(f"    {'TOTAL':<22} {len(features):>4}")


def fetch_supermarkets():
    query = build_query()
    print(f"  Query built ({len(query)} chars, {len(BRANDS)} brands)")

    raw = fetch_overpass(query)
    if not raw:
        print("No data returned - aborting.")
        return

    features = process(raw)
    print(f"  Valid features before dedup: {len(features)}")

    features = deduplicate(features)
    print(f"  Features after dedup:        {len(features)}")

    summary(features)

    geojson = {"type": "FeatureCollection", "features": features}

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, separators=(",", ":"))

    print(f"\nSaved {len(features)} supermarkets to {OUTPUT_FILE}")


if __name__ == "__main__":
    fetch_supermarkets()
