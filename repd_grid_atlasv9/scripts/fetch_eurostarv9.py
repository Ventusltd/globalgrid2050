import requests
import json

# Use the primary, fast Overpass API endpoint
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

def build_query() -> str:
    # 1. Target all Eurostar route relations
    # 2. Ask for the full line geometry (out geom)
    # 3. Ask for the station nodes/platforms
    return """[out:json][timeout:90];
    (
      relation["route"="train"]["network"~"Eurostar",i];
      relation["route"="train"]["operator"~"Eurostar",i];
    )->.eurostar_routes;
    
    // Output the physical track geometries!
    .eurostar_routes out geom;
    
    // Output the station footprint geometries
    (
      node(r.eurostar_routes:"stop");
      node(r.eurostar_routes:"stop_entry_only");
      node(r.eurostar_routes:"stop_exit_only");
      node(r.eurostar_routes:"platform");
      way(r.eurostar_routes:"platform");
      relation(r.eurostar_routes:"platform");
    );
    out body;
    >;
    out skel qt;
    """

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

    def handle_station(el_id, tags, lon, lat):
        if el_id in seen: return
        seen.add(el_id)
        
        name = tags.get("name", tags.get("description", "Eurostar Station"))
        operator = tags.get("operator", "Eurostar")
        
        features.append({
            "type": "Feature",
            "properties": {
                "name": name,
                "operator": operator,
                "osm_id": el_id,
                "type": "eurostar_station" # Matches point layer config
            },
            "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]}
        })

    # Process Nodes (Stations)
    for node in nodes.values():
        if "tags" in node:
            handle_station(node["id"], node["tags"], node["lon"], node["lat"])

    # Process Ways (Station platforms/buildings)
    for way in ways.values():
        if way.get("tags", {}).get("public_transport") in ("platform", "station") or way.get("tags", {}).get("railway") == "platform":
            ring = way_to_ring(way, nodes)
            if ring:
                c_lon, c_lat = centroid(ring)
                handle_station(way["id"], way["tags"], c_lon, c_lat)

    # Process Relations (Routes vs Complex Stations)
    for rel in relations:
        tags = rel.get("tags", {})
        
        # 1. EXTRACT THE TRACK ROUTE GEOMETRIES
        if tags.get("route") == "train":
            multiline = []
            for member in rel.get("members", []):
                if member["type"] == "way" and "geometry" in member:
                    line = [[pt["lon"], pt["lat"]] for pt in member["geometry"]]
                    if len(line) >= 2:
                        multiline.append(line)
            
            if multiline:
                features.append({
                    "type": "Feature",
                    "properties": {
                        "name": tags.get("name", "Eurostar Route"),
                        "operator": tags.get("operator", "Eurostar"),
                        "osm_id": rel["id"],
                        "type": "route" # Matches line layer config!
                    },
                    "geometry": {
                        "type": "MultiLineString",
                        "coordinates": multiline
                    }
                })
        
        # 2. Extract MultiPolygon Stations
        else:
            outer_coords = []
            for member in rel.get("members", []):
                if member["type"] == "way" and member.get("role") in ("outer", ""):
                    w = ways.get(member["ref"])
                    if w:
                        ring = way_to_ring(w, nodes)
                        if ring: outer_coords.extend(ring)
            if outer_coords:
                c_lon, c_lat = centroid(outer_coords)
                handle_station(rel["id"], rel["tags"], c_lon, c_lat)

    return features

def main():
    print("Fetching Eurostar routes and stations across Europe...")
    query = build_query()
    try:
        res = requests.post(OVERPASS_URL, data={"data": query}, timeout=90)
        res.raise_for_status()
        raw_data = res.json()
    except Exception as e:
        print(f"Error fetching data: {e}")
        return
        
    features = process_data(raw_data)
    
    # Deduplicate overlapping nodes and platforms (within ~200m)
    tol = 200.0 / 111320.0
    kept = []
    
    for f in features:
        # Do not attempt to deduplicate or modify LineStrings!
        if f["geometry"]["type"] == "MultiLineString":
            kept.append(f)
            continue
            
        lon, lat = f["geometry"]["coordinates"]
        dup = False
        for k in kept:
            if k["geometry"]["type"] == "Point":
                klon, klat = k["geometry"]["coordinates"]
                if abs(lon - klon) < tol and abs(lat - klat) < tol:
                    dup = True
                    break
        if not dup: kept.append(f)

    geojson = {"type": "FeatureCollection", "features": kept}
    with open("eurostar.geojson", "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, separators=(",", ":"))
        
    print(f"Saved {len(kept)} Eurostar features (routes and stations) to eurostar.geojson")

if __name__ == "__main__":
    main()
