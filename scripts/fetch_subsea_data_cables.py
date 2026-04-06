import requests
import json

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

def build_query() -> str:
    # 1. Ask for individual ways (local links, smaller cables)
    # 2. Ask for RELATIONS (The massive trans-oceanic global backbones)
    return """[out:json][timeout:180];
    (
      way["telecom"="cable"]["submarine"="yes"];
      way["telecom"="communication_cable"]["location"="underwater"];
      way["seamark:type"="cable_submarine"]["seamark:cable_submarine:category"="optical_fibre"];
      
      relation["telecom"="cable"]["submarine"="yes"];
      relation["telecom"="communication_cable"]["location"="underwater"];
      relation["route"="telecom"]["submarine"="yes"];
    );
    out geom;
    """

def process_data(data: dict) -> list:
    features = []
    seen_ways = set()

    # 1. FIRST PASS: Unpack the massive trans-oceanic Relations
    for el in data.get("elements", []):
        if el["type"] == "relation":
            tags = el.get("tags", {})
            name = tags.get("name", tags.get("seamark:name", "Global Subsea Route"))
            operator = tags.get("operator", "Telecom Operator")
            
            multiline = []
            for member in el.get("members", []):
                if member["type"] == "way" and "geometry" in member:
                    line = [[pt["lon"], pt["lat"]] for pt in member["geometry"]]
                    if len(line) >= 2:
                        multiline.append(line)
                        # Mark this way as seen so we don't duplicate it in step 2
                        seen_ways.add(member["ref"]) 
            
            if multiline:
                features.append({
                    "type": "Feature",
                    "properties": {
                        "name": name,
                        "operator": operator,
                        "osm_id": el["id"],
                        "type": "subsea_data_cable"
                    },
                    "geometry": {
                        "type": "MultiLineString",
                        "coordinates": multiline
                    }
                })

    # 2. SECOND PASS: Grab individual ways (that weren't part of a larger relation)
    for el in data.get("elements", []):
        if el["type"] == "way" and el["id"] not in seen_ways and "geometry" in el:
            tags = el.get("tags", {})
            name = tags.get("name", tags.get("seamark:name", "Subsea Data Cable"))
            operator = tags.get("operator", "Telecom Operator")
            
            line = [[pt["lon"], pt["lat"]] for pt in el["geometry"]]
            if len(line) >= 2:
                features.append({
                    "type": "Feature",
                    "properties": {
                        "name": name,
                        "operator": operator,
                        "osm_id": el["id"],
                        "type": "subsea_data_cable"
                    },
                    "geometry": {
                        "type": "LineString",
                        "coordinates": line
                    }
                })

    return features

def main():
    print("Fetching Global Subsea Data Cables (Including trans-oceanic relations)...")
    query = build_query()
    try:
        res = requests.post(OVERPASS_URL, data={"data": query}, timeout=180)
        res.raise_for_status()
        raw_data = res.json()
    except Exception as e:
        print(f"Error fetching data: {e}")
        return
        
    features = process_data(raw_data)
    
    geojson = {"type": "FeatureCollection", "features": features}
    with open("subsea_data_cables.geojson", "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, separators=(",", ":"))
        
    print(f"Saved {len(features)} global data cable structures to subsea_data_cables.geojson")

if __name__ == "__main__":
    main()
