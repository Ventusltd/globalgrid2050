import requests
import json
import math
from collections import defaultdict

# Use the primary, fast Overpass API endpoint
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
MIN_AREA_M2 = 2500
BBOX = "49.5,-10.8,61.0,2.2"

# Added a few aliases to the search logic below to catch messy OSM tags
BRANDS = [
    {"name": "Tesco",             "canonical": "Tesco",       "file": "supermarkets_tesco.geojson",      "colour": "#ee1c2e"},
    {"name": "Sainsbury's",       "canonical": "Sainsbury's", "file": "supermarkets_sainsburys.geojson", "colour": "#ff8200"},
    {"name": "Sainsbury",         "canonical": "Sainsbury's", "file": "supermarkets_sainsburys.geojson", "colour": "#ff8200"},
    {"name": "Asda",              "canonical": "Asda",        "file": "supermarkets_asda.geojson",       "colour": "#78be20"},
    {"name": "Morrisons",         "canonical": "Morrisons",   "file": "supermarkets_morrisons.geojson",  "colour": "#ffd700"},
    {"name": "Aldi",              "canonical": "Aldi",        "file": "supermarkets_aldi.geojson",       "colour": "#003087"},
    {"name": "Lidl",              "canonical": "Lidl",        "file": "supermarkets_lidl.geojson",       "colour": "#0050aa"},
    {"name": "Waitrose",          "canonical": "Waitrose",    "file": "supermarkets_waitrose.geojson",   "colour": "#7ab800"},
    {"name": "Marks and Spencer", "canonical": "M&S Food",    "file": "supermarkets_ms.geojson",         "colour": "#009b77"},
    {"name": "M&S",               "canonical": "M&S Food",    "file": "supermarkets_ms.geojson",         "colour": "#009b77"},
    {"name": "Co-op",             "canonical": "Co-op",       "file": "supermarkets_coop.geojson",       "colour": "#00b1a9"},
    {"name": "Coop",              "canonical": "Co-op",       "file": "supermarkets_coop.geojson",       "colour": "#00b1a9"},
    {"name": "Iceland",           "canonical": "Iceland",     "file": "supermarkets_iceland.geojson",    "colour": "#c8102e"},
    {"name": "Farmfoods",         "canonical": "Farmfoods",   "file": "supermarkets_farmfoods.geojson",  "colour": "#e30613"},
    {"name": "Costco",            "canonical": "Costco",      "file": "supermarkets_costco.geojson",     "colour": "#005daa"},
    {"name": "Booths",            "canonical": "Booths",      "file": "supermarkets_booths.geojson",     "colour": "#6d2077"},
    {"name": "Spar",              "canonical": "Spar",        "file": "supermarkets_spar.geojson",       "colour": "#00a650"},
]

def build_bulk_query() -> str:
    # ONE query to pull every supermarket & wholesale store in the UK
    blocks = (
        f'way["shop"="supermarket"]({BBOX});\n'
        f'way["shop"="wholesale"]({BBOX});\n'
        f'relation["shop"="supermarket"]({BBOX});\n'
        f'relation["shop"="wholesale"]({BBOX});\n'
    )
    return f"[out:json][timeout:180];\n(\n{blocks});\nout body;\n>;\nout skel qt;\n"

def fetch_overpass(query: str) -> dict:
    print("Fetching all supermarkets from Overpass... (This takes ~10 seconds)")
    try:
        response = requests.post(OVERPASS_URL, data={"data": query}, timeout=180)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"CRITICAL ERROR fetching Overpass data: {e}")
        return {}

def node_map(elements: list) -> dict:
    return {el["id"]: (el["lon"], el["lat"]) for el in elements if el["type"] == "node"}

def polygon_area_m2(coords: list) -> float:
    if not coords or len(coords) < 3: return 0.0
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
    return (sum(c[0] for c in coords) / len(coords), sum(c[1] for c in coords) / len(coords))

def way_to_ring(way: dict, nodes: dict):
    coords = [nodes[nid] for nid in way.get("nodes", []) if nid in nodes]
    if len(coords) < 3: return None
    if coords[0] != coords[-1]: coords.append(coords[0])
    return coords

def match_brand(tags: dict) -> dict:
    # Mash relevant tags together to catch messy OpenStreetMap data
    search_string = f"{tags.get('brand', '')} {tags.get('name', '')} {tags.get('operator', '')}".lower()
    
    for b in BRANDS:
        if b["name"].lower() in search_string:
            return b
    return None

def process_bulk_data(data: dict) -> dict:
    print("Processing geometries and filtering by brand...")
    elements = data.get("elements", [])
    nodes = node_map(elements)
    ways = {el["id"]: el for el in elements if el["type"] == "way" and "tags" in el}
    relations = [el for el in elements if el["type"] == "relation" and "tags" in el]
    
    brand_features = defaultdict(list)
    seen = set()

    # Process Ways
    for way in ways.values():
        if way["id"] in seen: continue
        brand_match = match_brand(way["tags"])
        if not brand_match: continue
        
        ring = way_to_ring(way, nodes)
        if not ring: continue
        
        area = polygon_area_m2(ring)
        if area < MIN_AREA_M2: continue
        
        seen.add(way["id"])
        lon, lat = centroid(ring)
        feature = _feature(lon, lat, way["tags"], area, way["id"], "way", brand_match)
        brand_features[brand_match["canonical"]].append(feature)

    # Process Relations
    for rel in relations:
        if rel["id"] in seen: continue
        brand_match = match_brand(rel["tags"])
        if not brand_match: continue

        outer_coords = []
        for member in rel.get("members", []):
            if member["type"] == "way" and member.get("role") in ("outer", ""):
                way = ways.get(member["ref"])
                if way:
                    ring = way_to_ring(way, nodes)
                    if ring: outer_coords.extend(ring)
        if not outer_coords: continue
        
        area = polygon_area_m2(outer_coords)
        if area < MIN_AREA_M2: continue
        
        seen.add(rel["id"])
        lon, lat = centroid(outer_coords)
        feature = _feature(lon, lat, rel["tags"], area, rel["id"], "relation", brand_match)
        brand_features[brand_match["canonical"]].append(feature)

    return brand_features

def _feature(lon, lat, tags, area, osm_id, osm_type, brand) -> dict:
    return {
        "type": "Feature",
        "properties": {
            "name":     tags.get("name", ""),
            "brand":    brand["canonical"],
            "colour":   brand["colour"],
            "street":   tags.get("addr:street", ""),
            "city":     tags.get("addr:city", ""),
            "postcode": tags.get("addr:postcode", ""),
            "website":  tags.get("website", ""),
            "area_m2":  round(area),
            "osm_id":   osm_id,
            "osm_type": osm_type,
            "type":     "supermarket",
        },
        "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]}
    }

def deduplicate(features: list, tol_m: float = 80.0) -> list:
    tol = tol_m / 111_320.0
    kept = []
    for f in features:
        lon, lat = f["geometry"]["coordinates"]
        dup = False
        for k in kept:
            klon, klat = k["geometry"]["coordinates"]
            if abs(lon - klon) < tol and abs(lat - klat) < tol:
                if f["properties"]["area_m2"] > k["properties"]["area_m2"]:
                    kept.remove(k)
                else:
                    dup = True
                break
        if not dup: kept.append(f)
    return kept

def main():
    query = build_bulk_query()
    raw_data = fetch_overpass(query)
    
    if not raw_data:
        return
        
    brand_features_map = process_bulk_data(raw_data)
    
    total = 0
    # Create an output file based on the unique canon names in our config
    unique_brands = {b["canonical"]: b for b in BRANDS}.values()
    
    for brand in unique_brands:
        raw_features = brand_features_map.get(brand["canonical"], [])
        cleaned_features = deduplicate(raw_features)
        
        geojson = {"type": "FeatureCollection", "features": cleaned_features}
        with open(brand["file"], "w", encoding="utf-8") as f:
            json.dump(geojson, f, ensure_ascii=False, separators=(",", ":"))
            
        print(f"  Saved {len(cleaned_features)} stores to {brand['file']}")
        total += len(cleaned_features)

    print(f"\nBOOM. Done. {total} total stores generated instantly.")

if __name__ == "__main__":
    main()
