import requests
import json
import math

# Use the primary, fast Overpass API endpoint
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
BBOX = "49.5,-10.8,61.0,2.2"

def build_query() -> str:
    # Searches for stations/halts where the network or line is explicitly tagged as Elizabeth line
    blocks = (
        f'node["railway"~"station|halt"]["network"~"Elizabeth line",i]({BBOX});\n'
        f'way["railway"~"station|halt"]["network"~"Elizabeth line",i]({BBOX});\n'
        f'relation["railway"~"station|halt"]["network"~"Elizabeth line",i]({BBOX});\n'
        f'node["railway"~"station|halt"]["line"~"Elizabeth line",i]({BBOX});\n'
        f'way["railway"~"station|halt"]["line"~"Elizabeth line",i]({BBOX});\n'
        f'relation["railway"~"station|halt"]["line"~"Elizabeth line",i]({BBOX});\n'
    )
    return f"[out:json][timeout:90];\n(\n{blocks});\nout body;\n>;\nout skel qt;\n"

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

    def handle_element(el_id, tags, lon, lat):
        if el_id in seen: return
        seen.add(el_id)
        
        name = tags.get("name", "Unnamed Station")
        operator = tags.get("operator", "Transport for London")
        
        features.append({
            "type": "Feature",
            "properties": {
                "name": name,
                "operator": operator,
                "osm_id": el_id,
                "type": "elizabeth_line_station"
            },
            "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]}
        })

    # Process Nodes
    for node in nodes.values():
        if "tags" in node:
            handle_element(node["id"], node["tags"], node["lon"], node["lat"])

    # Process Ways (Station buildings/polygons)
    for way in ways.values():
        ring = way_to_ring(way, nodes)
        if ring:
            c_lon, c_lat = centroid(ring)
            handle_element(way["id"], way["tags"], c_lon, c_lat)

    # Process Relations (Complex station layouts)
    for rel in relations:
        outer_coords = []
        for member in rel.get("members", []):
            if member["type"] == "way" and member.get("role") in ("outer", ""):
                w = ways.get(member["ref"])
                if w:
                    ring = way_to_ring(w, nodes)
                    if ring: outer_coords.extend(ring)
        if outer_coords:
            c_lon, c_lat = centroid(outer_coords)
            handle_element(rel["id"], rel["tags"], c_lon, c_lat)

    return features

def main():
    print("Fetching Elizabeth Line stations...")
    query = build_query()
    try:
        res = requests.post(OVERPASS_URL, data={"data": query}, timeout=90)
        res.raise_for_status()
        raw_data = res.json()
    except Exception as e:
        print(f"Error fetching data: {e}")
        return
        
    features = process_data(raw_data)
    
    # Deduplicate overlapping nodes and ways (within ~150m)
    tol = 150.0 / 111320.0
    kept = []
    for f in features:
        lon, lat = f["geometry"]["coordinates"]
        dup = False
        for k in kept:
            klon, klat = k["geometry"]["coordinates"]
            if abs(lon - klon) < tol and abs(lat - klat) < tol:
                dup = True
                break
        if not dup: kept.append(f)

    geojson = {"type": "FeatureCollection", "features": kept}
    with open("elizabeth_line.geojson", "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, separators=(",", ":"))
        
    print(f"Saved {len(kept)} stations to elizabeth_line.geojson")

if __name__ == "__main__":
    main()
