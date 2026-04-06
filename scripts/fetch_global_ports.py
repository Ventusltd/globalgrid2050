import requests
import json

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

def build_query() -> str:
    # A planetary query targeting major commercial, cargo, and industrial ports.
    return """[out:json][timeout:180];
    (
      node["industrial"="port"];
      way["industrial"="port"];
      relation["industrial"="port"];
      
      node["landuse"="port"];
      way["landuse"="port"];
      relation["landuse"="port"];
      
      node["harbour"="yes"]["seamark:harbour:category"~"commercial|cargo",i];
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
        
        # Determine coordinates (nodes use lat/lon, areas use center)
        lat = el.get("lat")
        lon = el.get("lon")
        if "center" in el:
            lat = el["center"]["lat"]
            lon = el["center"]["lon"]
            
        if lat is not None and lon is not None:
            # Filter out unnamed/minor local docks to keep the global map strategic
            name = tags.get("name")
            if not name:
                name = tags.get("seamark:name", tags.get("description"))
                
            if name:
                seen.add(el_id)
                operator = tags.get("operator", tags.get("brand", "Port Authority"))
                
                features.append({
                    "type": "Feature",
                    "properties": {
                        "name": name,
                        "operator": operator,
                        "osm_id": el_id,
                        "type": "global_port"
                    },
                    "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]}
                })

    return features

def main():
    print("Fetching Global Ports and Maritime Infrastructure...")
    query = build_query()
    try:
        res = requests.post(OVERPASS_URL, data={"data": query}, timeout=180)
        res.raise_for_status()
        raw_data = res.json()
    except Exception as e:
        print(f"Error fetching data: {e}")
        return
        
    features = process_data(raw_data)
    
    # Deduplicate overlapping port terminals (within ~1.5km)
    # Ports are massive; this prevents 10 dots clustering over a single harbor
    tol = 1500.0 / 111320.0
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
    with open("global_ports.geojson", "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, separators=(",", ":"))
        
    print(f"Saved {len(kept)} Major Global Ports to global_ports.geojson")

if __name__ == "__main__":
    main()
