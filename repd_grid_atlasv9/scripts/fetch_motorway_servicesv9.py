import requests
import json

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
# Strict UK Bounding Box to filter out French/Irish services
BBOX = "49.8,-8.5,60.9,1.8"

def build_query() -> str:
    # Targets Motorway and major Trunk Road services explicitly
    return f"""[out:json][timeout:90];
    (
      node["highway"="services"]({BBOX});
      way["highway"="services"]({BBOX});
      relation["highway"="services"]({BBOX});
    );
    out center tags;
    """

def process_data(data: dict) -> list:
    features = []
    seen = set()

    for el in data.get("elements", []):
        el_id = el["id"]
        if el_id in seen:
            continue
            
        tags = el.get("tags", {})
        
        # Determine coordinates (nodes use lat/lon, ways/relations use center)
        lat = el.get("lat")
        lon = el.get("lon")
        if "center" in el:
            lat = el["center"]["lat"]
            lon = el["center"]["lon"]
            
        if lat is not None and lon is not None:
            seen.add(el_id)
            
            name = tags.get("name", "Motorway Services")
            operator = tags.get("operator", tags.get("brand", "Unknown Operator"))
            
            features.append({
                "type": "Feature",
                "properties": {
                    "name": name,
                    "operator": operator,
                    "osm_id": el_id,
                    "type": "motorway_services"
                },
                "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]}
            })

    return features

def main():
    print("Fetching UK Motorway Service Areas...")
    query = build_query()
    try:
        res = requests.post(OVERPASS_URL, data={"data": query}, timeout=90)
        res.raise_for_status()
        raw_data = res.json()
    except Exception as e:
        print(f"Error fetching data: {e}")
        return
        
    features = process_data(raw_data)
    
    # Deduplicate overlapping nodes/polygons (within ~150m)
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
    with open("motorway_services.geojson", "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, separators=(",", ":"))
        
    print(f"Saved {len(kept)} Motorway Services to motorway_services.geojson")

if __name__ == "__main__":
    main()
