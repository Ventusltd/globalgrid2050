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

        # We need the center coordinates to place the point on the map
        if "center" not in element:
            continue

        lat = element["center"].get("lat")
        lon = element["center"].get("lon")

        if lat is None or lon is None:
            continue

        # Extract the specific type of industry or power source
        ind_type = (
            tags.get("plant:source") or 
            tags.get("product") or 
            tags.get("industrial") or 
            tags.get("power") or 
            "Heavy Industry"
        ).replace("_", " ").title()

        name = tags.get("name", "").strip()
        operator = (tags.get("operator", "") or tags.get("brand", "")).strip()

        # Fallback naming: If the OSM user didn't provide a name, generate one
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
            
            # 1 degree of latitude is ~111,000 meters
            lat_dist = (maxlat - minlat) * 111000
            lon_dist = (maxlon - minlon) * 111000 * math.cos(math.radians((maxlat + minlat) / 2))
            
            area_sq_m = lat_dist * lon_dist
            area_ha = round(area_sq_m / 10000, 1) # Convert to Hectares

        # Strict area filter: Only keep sites larger than 2 hectares
        # This acts as our primary filter for "Heavy" industry, discarding small sheds
        if area_ha < 2.0:
            continue

        # Proxy Math: Multiply hectares by an intensity factor to simulate emissions (kt CO2)
        # We bump the multiplier up slightly so the biggest sites hit the 10,000+ kt range
        emissions_proxy = round(area_ha * 65, 1)

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

def fetch_heavy_industry():
    print("🚀 Fetching UK heavy industry sites...")

    geojson = {
        "type": "FeatureCollection",
        "features": []
    }

    seen = set()

    # The query includes Steel, Cement, Chemical, Oil, Glass, and Fossil Fuel Power Plants
    query_heavy_industry = """
    [out:json][timeout:180];
    area(3600062149)->.uk;
    (
      way["industrial"~"steel|cement|chemical|oil|refinery|glass"](area.uk);
      relation["industrial"~"steel|cement|chemical|oil|refinery|glass"](area.uk);

      way["man_made"="works"]["product"~"steel|cement|chemical"](area.uk);
      relation["man_made"="works"]["product"~"steel|cement|chemical"](area.uk);

      way["power"="plant"]["plant:source"~"gas|coal|oil"](area.uk);
      relation["power"="plant"]["plant:source"~"gas|coal|oil"](area.uk);
    );
    out center bb;
    """

    data = fetch_overpass_data(query_heavy_industry)
    process_osm_data(data, geojson["features"], seen)

    with open(OUTPUT_GEOJSON, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)

    print(f"🎉 Successfully saved {len(geojson['features'])} heavy emitters to {OUTPUT_GEOJSON}!")

if __name__ == "__main__":
    fetch_heavy_industry()
