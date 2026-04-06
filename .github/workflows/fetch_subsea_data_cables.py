import requests
import json

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Massive Bounding Box: Mid-Atlantic to Eastern Europe, North Africa to Iceland.
BBOX = "35.0,-30.0,65.0,20.0"

def build_query() -> str:
    # Explicitly targets telecom/data cables. 
    # Where generic submarine tags are used, we explicitly EXCLUDE power cables ([!"power"]).
    return f"""[out:json][timeout:180];
    (
      way["telecom"="cable"]["submarine"="yes"]({BBOX});
      way["telecom"="communication_cable"]["location"="underwater"]({BBOX});
      way["man_made"="submarine_cable"]["cable"="telecommunication"]({BBOX});
      way["man_made"="submarine_cable"][!"power"]({BBOX});
      way["seamark:type"="cable_submarine"]["seamark:cable_submarine:category"="optical_fibre"]({BBOX});
      way["seamark:type"="cable_submarine"][!"power"]({BBOX});
    );
    out geom;
    """

def process_data(data: dict) -> list:
    features = []
    seen = set()

    for el in data.get("elements", []):
        el_id = el["id"]
        if el_id in seen:
            continue
            
        tags = el.get("tags", {})
        
        # We only want the physical geometry lines
        if el["type"] == "way" and "geometry" in el:
            seen.add(el_id)
            
            line = [[pt["lon"], pt["lat"]] for pt in el["geometry"]]
            
            if len(line) >= 2:
                name = tags.get("name", tags.get("seamark:name", "Subsea Data Cable"))
                operator = tags.get("operator", "Telecom Operator")
                
                features.append({
                    "type": "Feature",
                    "properties": {
                        "name": name,
                        "operator": operator,
                        "osm_id": el_id,
                        "type": "subsea_data_cable"
                    },
                    "geometry": {
                        "type": "LineString",
                        "coordinates": line
                    }
                })

    return features

def main():
    print("Fetching Subsea Data Cables (Fibre Optics) across the Atlantic and Europe...")
    query = build_query()
    try:
        # 180 second timeout because this is a heavy geographic query
        res = requests.post(OVERPASS_URL, data={"data": query}, timeout=180)
        res.raise_for_status()
        raw_data = res.json()
    except Exception as e:
        print(f"Error fetching data: {e}")
        return
        
    features = process_data(raw_data)
    
    geojson = {"type": "FeatureCollection", "features": features}
    with open("subsea_data_cables.geojson", "w", encoding="utf-8") as f:
        # Minified to keep the file size tight for WebGL
        json.dump(geojson, f, ensure_ascii=False, separators=(",", ":"))
        
    print(f"Saved {len(features)} Subsea Data Cable segments to subsea_data_cables.geojson")

if __name__ == "__main__":
    main()
