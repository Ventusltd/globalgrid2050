import requests
import json
import time
import math
import os

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OUTPUT_GEOJSON = "heaviest_emitters.geojson"

HEAVY_OPERATORS = [
    "tata", "british steel", "cemex", "heidelberg", "tarmac", 
    "aggregate industries", "ineos", "shell", "bp", "total", 
    "phillips 66", "sabic", "dow", "valero", "exxon"
]

def fetch_overpass_data(query):
    for attempt in range(3):
        try:
            print(f"  -> Requesting data from Overpass (attempt {attempt + 1})...")
            response = requests.post(OVERPASS_URL, data={"data": query}, timeout=120)

            if response.status_code == 200:
                print("  ✅ Data downloaded!")
                return response.json()

            if response.status_code == 429:
                print("  ⚠️ Server busy, sleeping 60s...")
                time.sleep(60)
                continue

            print(f"  ⚠️ Error: {response.status_code}, retrying...")
            time.sleep(10)

        except Exception as e:
            print(f"  ⚠️ Connection error: {e}, retrying...")
            time.sleep(10)

    print("  ❌ Failed to fetch data from Overpass.")
    return None

def process_osm_data(osm_data, geojson_features, seen):
    if not osm_data:
        return

    for element in osm_data.get("elements", []):
        tags = element.get("tags", {})

        if "center" not in element:
            continue

        lat = element["center"].get("lat")
        lon = element["center"].get("lon")

        if lat is None or lon is None:
            continue

        name = tags.get("name", "").strip()
        operator = (tags.get("operator", "") or tags.get("brand", "")).strip()

        if not name:
            continue

        # Filter to ensure we are only mapping major heavy industry players
        searchable_text = f"{name} {operator}".lower()
        if not any(op in searchable_text for op in HEAVY_OPERATORS):
            continue

        key = (round(lat, 4), round(lon, 4), name.lower())
        if key in seen:
            continue
        seen.add(key)

        ind_type = (
            tags.get("industrial") or tags.get("man_made") or 
            tags.get("power") or "Heavy Industry"
        ).replace("_", " ").title()

        # Calculate approximate area using the bounding box
        area_ha = 0
        bounds = element.get("bounds")
        if bounds:
            minlat, minlon = bounds["minlat"], bounds["minlon"]
            maxlat, maxlon = bounds["maxlat"], bounds["maxlon"]
            
            # 1 degree of latitude is ~111,000 meters
            lat_dist = (maxlat - minlat) * 111000
            lon_dist = (maxlon - minlon) * 111000 * math.cos(math.radians((maxlat + minlat) / 2))
            
            area_sq_m = lat_dist * lon_dist
            area_ha = round(area_sq_m / 10000, 1) # Convert to Hectares

        # Proxy Math: Multiply hectares by an intensity factor to simulate emissions (kt CO2)
        # This allows the frontend interpolation array to render size dynamically
        emissions_proxy = round(area_ha * 45, 1)

        feature = {
            "type": "Feature",
            "properties": {
                "name": name,
                "operator": operator if operator else "Unknown",
                "type": ind_type,
                "area_ha": area_ha,
                "emissions_kt": emissions_proxy # Our automated proxy metric
            },
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat]
            }
        }

        geojson_features.append(feature)

def fetch_heavy_industry():
    print("🚀 Fetching UK heavy industry sites...")

    geojson = {
        "type": "FeatureCollection",
        "features": []
    }

    seen = set()

    query_heavy_industry = """
    [out:json][timeout:180];
    area(3600062149)->.uk;
    (
      way["industrial"~"steel|cement|chemical|oil|refinery|glass"](area.uk);
      relation["industrial"~"steel|cement|chemical|oil|refinery|glass"](area.uk);

      way["man_made"="works"]["product"~"steel|cement|chemical"](area.uk);
      relation["man_made"="works"]["product"~"steel|cement|chemical"](area.uk);
    );
    out center bb;
    """

    data = fetch_overpass_data(query_heavy_industry)
    process_osm_data(data, geojson["features"], seen)

    # Save to the root directory
    with open(OUTPUT_GEOJSON, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)

    print(f"🎉 Successfully saved {len(geojson['features'])} heavy emitters to {OUTPUT_GEOJSON}!")

if __name__ == "__main__":
    fetch_heavy_industry()
