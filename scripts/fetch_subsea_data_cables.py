import requests
import json

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

def build_query() -> str:
    # BBOX COMPLETELY REMOVED. 
    # This executes a planetary-scale query for data/telecom cables, explicitly excluding power.
    return """[out:json][timeout:180];
    (
      way["telecom"="cable"]["submarine"="yes"];
      way["telecom"="communication_cable"]["location"="underwater"];
      way["man_made"="submarine_cable"]["cable"="telecommunication"];
      way["man_made"="submarine_cable"][!"power"];
      way["seamark:type"="cable_submarine"]["seamark:cable_submarine:category"="optical_fibre"];
      way["seamark:type"="cable_submarine"][!"power"];
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
                name = tags.get("name", tags.get("seamark:name", "Global Subsea Data Cable"))
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
    print("Fetching Global Subsea Data Cables (Fibre Optics) for the entire planet...")
    query = build_query()
    try:
        # 180 second timeout because a global geometric query is heavy
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
        
    print(f"Saved {len(features)} Global Subsea Data Cable segments to subsea_data_cables.geojson")

if __name__ == "__main__":
    main()
