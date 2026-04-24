import requests
import json
import math

# Use the primary, fast Overpass API endpoint
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
MIN_CAPACITY = 18000 # Target ~20k, but allow a slight buffer for borderline stadiums
MIN_AREA_M2 = 20000  # Fallback: A 20k stadium footprint is typically 25k+ m2
BBOX = "49.5,-10.8,61.0,2.2"

def build_query() -> str:
    blocks = (
        f'way["leisure"="stadium"]({BBOX});\n'
        f'relation["leisure"="stadium"]({BBOX});\n'
    )
    return f"[out:json][timeout:180];\n(\n{blocks});\nout body;\n>;\nout skel qt;\n"

def is_in_uk_ireland(lon: float, lat: float) -> bool:
    if lat < 51.4 and lon > 1.45: return False
    if lat < 51.0 and lon > 1.10: return False
    if lat < 50.7 and lon > 0.00: return False
    if lat < 50.4 and lon > -2.00: return False
    if lat < 49.8 and lon > -5.00: return False
    return True

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
    coords = []
    for nid in way.get("nodes", []):
        if nid in nodes:
            node = nodes[nid]
            coords.append((node["lon"], node["lat"]))
    if len(coords) < 3: return None
    if coords[0] != coords[-1]: coords.append(coords[0])
    return coords

def process_data(data: dict) -> list:
    elements = data.get("elements", [])
    nodes = {el["id"]: el for el in elements if el["type"] == "node"}
    ways = {el["id"]: el for el in elements if el["type"] == "way" and "tags" in el}
    relations = [el for el in elements if el["type"] == "relation" and "tags" in el]
    
    features = []
    seen = set()

    def handle_element(el_id, tags, coords):
        if el_id in seen: return
        
        lon, lat = centroid(coords)
        if not is_in_uk_ireland(lon, lat): return
        
        area = polygon_area_m2(coords)
        
        # Check capacity
        cap_str = tags.get("capacity", "0")
        try:
            clean_cap = ''.join(filter(str.isdigit, cap_str))
            capacity = int(clean_cap) if clean_cap else 0
        except:
            capacity = 0
            
        # Drop if it doesn't meet either the capacity or area requirement
        if capacity > 0:
            if capacity < MIN_CAPACITY: return
        else:
            if area < MIN_AREA_M2: return

        # Validate the sport
        sport = tags.get("sport", "").lower()
        valid_sports = ["soccer", "rugby_union", "rugby_league", "cricket", "athletics", "rugby", "multi"]
        
        if sport and not any(s in sport for s in valid_sports):
            return # Drops unwanted venues like greyhound or horse racing tracks
            
        seen.add(el_id)
        
        features.append({
            "type": "Feature",
            "properties": {
                "name": tags.get("name", "Unnamed Stadium"),
                "sport": sport.replace("_", " ").title() if sport else "Multi-Sport",
                "club": tags.get("club", tags.get("operator", "")),
                "capacity": capacity if capacity > 0 else "Unknown",
                "area_m2": round(area),
                "osm_id": el_id,
                "type": "stadium"
            },
            "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]}
        })

    for way in ways.values():
        ring = way_to_ring(way, nodes)
        if ring: handle_element(way["id"], way["tags"], ring)

    for rel in relations:
        outer_coords = []
        for member in rel.get("members", []):
            if member["type"] == "way" and member.get("role") in ("outer", ""):
                w = ways.get(member["ref"])
                if w:
                    ring = way_to_ring(w, nodes)
                    if ring: outer_coords.extend(ring)
        if outer_coords:
            handle_element(rel["id"], rel["tags"], outer_coords)

    return features

def main():
    print("Fetching major UK stadiums...")
    query = build_query()
    try:
        res = requests.post(OVERPASS_URL, data={"data": query}, timeout=180)
        res.raise_for_status()
        raw_data = res.json()
    except Exception as e:
        print(f"Error fetching data: {e}")
        return
        
    features = process_data(raw_data)
    
    # Deduplicate overlapping ways and relations
    tol = 150.0 / 111320.0
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

    geojson = {"type": "FeatureCollection", "features": kept}
    with open("stadiums.geojson", "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, separators=(",", ":"))
        
    print(f"Saved {len(kept)} major stadiums to stadiums.geojson")

if __name__ == "__main__":
    main()
