import requests
import json
import time
import math
import os

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OUTPUT_GEOJSON = "heaviest_emitters.geojson"

def fetch_overpass_data(query):
    for attempt in range(3):
        try:
            print(f"  -> Requesting data from Overpass (attempt {attempt + 1})...")
            response = requests.post(OVERPASS_URL, data={"data": query}, timeout=120)

            if response.status_code == 200:
                data = response.json()
                print(f"  ✅ Data downloaded! Overpass returned {len(data.get('elements', []))} raw elements.")
                return data

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

    elements = osm_data.get("elements", [])
    skipped_no_coords = 0
    
    for element in elements:
        tags = element.get("tags", {})

        # Nodes use lat/lon directly. Ways/Relations use center.
        lat = element.get("lat")
        lon = element.get("lon")
        
        if "center" in element:
            lat = element["center"].get("lat")
            lon = element["center"].get("lon")

        if lat is None or lon is None:
            skipped_no_coords += 1
            continue

        ind_type = (
            tags.get("works") or
            tags.get("plant:source") or 
            tags.get("product") or 
            tags.get("industrial") or 
            tags.get("man_made") or
            tags.get("power") or 
            "Heavy Industry"
        ).replace("_", " ").title()

        name = tags.get("name", "").strip()
        operator = (tags.get("operator", "") or tags.get("brand", "")).strip()

        # Fallback naming
        if not name:
            if operator:
                name = f"{operator} {ind_type} Facility"
            else:
                name = f"Unnamed {ind_type} Facility"

        # Prevent duplicates
        key = (round(lat, 4), round(lon, 4), name.lower())
        if key in seen:
            continue
        seen.add(key)

        # Calculate approximate area using the bounding box
        area_ha = 0
        bounds = element.get("bounds")
        if bounds:
            minlat, minlon = bounds["minlat"], bounds["minlon"]
            maxlat, maxlon = bounds["maxlat"], bounds["maxlon"]
            
            lat_dist = (maxlat - minlat) * 111000
            lon_dist = (maxlon - minlon) * 111000 * math.cos(math.radians((maxlat + minlat) / 2))
            
            area_sq_m = lat_dist * lon_dist
            area_ha = round(area_sq_m / 10000, 1)

        # Proxy Math: Base value of 50kt so nothing is lost, plus area scaling for the massive sites
        emissions_proxy = round(50 + (area_ha * 85), 1)

        feature = {
            "type": "Feature",
            "properties": {
                "name": name,
                "operator": operator if operator else "Unknown",
                "type": ind_type,
                "area_ha": area_ha,
                "emissions_kt": emissions_proxy
            },
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat]
            }
        }

        geojson_features.append(feature)
        
    print(f"  🔍 Processed {len(geojson_features)} valid features (Skipped {skipped_no_coords} missing coords).")

def fetch_heavy_industry():
    print("🚀 Fetching UK heavy emitters...")

    geojson = {
        "type": "FeatureCollection",
        "features": []
    }

    seen = set()

    # Bulletproof query: 
    # 1. Uses dynamic ISO code for the UK instead of a hardcoded area ID
    # 2. Uses nwr (nodes, ways, relations) to catch everything
    # 3. Uses `out tags center bb;` to absolutely force tags to be downloaded
    query_heavy_industry = """
    [out:json][timeout:180];
    area["ISO3166-1"="GB"][admin_level=2]->.uk;
    (
      nwr["man_made"="works"]["works"~"steel|cement|chemical|oil|refinery|glass"](area.uk);
      nwr["man_made"="petroleum_refinery"](area.uk);
      nwr["power"="plant"]["plant:source"~"gas|coal|oil"](area.uk);
      nwr["industrial"~"oil|refinery|chemical|steel|cement"](area.uk);
    );
    out tags center bb;
    """

    data = fetch_overpass_data(query_heavy_industry)
    process_osm_data(data, geojson["features"], seen)

    with open(OUTPUT_GEOJSON, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)

    print(f"🎉 Successfully saved {len(geojson['features'])} heavy emitters to {OUTPUT_GEOJSON}!")

if __name__ == "__main__":
    fetch_heavy_industry()
