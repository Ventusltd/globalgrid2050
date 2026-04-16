import requests
import json
import time

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

HEAVY_OPERATORS = [
    "tata",
    "british steel",
    "cemex",
    "heidelberg",
    "tarmac",
    "aggregate industries",
    "ineos",
    "shell",
    "bp",
    "total",
    "phillips 66",
    "sabic",
    "dow"
]

def fetch_overpass_data(query, name):
    for attempt in range(3):
        try:
            print(f"  -> Requesting {name} (attempt {attempt + 1})...")
            response = requests.post(
                OVERPASS_URL,
                data={"data": query},
                timeout=120
            )

            if response.status_code == 200:
                print(f"  ✅ {name} downloaded!")
                return response.json()

            if response.status_code == 429:
                print("  ⚠️ Server busy, sleeping 60s...")
                time.sleep(60)
                continue

            print(f"  ⚠️ Error for {name}: {response.status_code}, retrying...")
            time.sleep(10)

        except Exception as e:
            print(f"  ⚠️ Connection error for {name}: {e}, retrying...")
            time.sleep(10)

    print(f"  ❌ Failed to fetch {name}")
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

        searchable_text = f"{name} {operator}".lower()
        if not any(op in searchable_text for op in HEAVY_OPERATORS):
            continue

        key = (round(lat, 4), round(lon, 4), name.lower())
        if key in seen:
            continue
        seen.add(key)

        ind_type = (
            tags.get("industrial")
            or tags.get("man_made")
            or tags.get("landuse")
            or tags.get("power")
            or "Industrial Site"
        ).replace("_", " ").title()

        feature = {
            "type": "Feature",
            "properties": {
                "name": name,
                "operator": operator if operator else "Unknown",
                "type": ind_type
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

      way["power"="plant"]["plant:source"~"gas|coal|oil"](area.uk);
      relation["power"="plant"]["plant:source"~"gas|coal|oil"](area.uk);
    );
    out center;
    """

    data = fetch_overpass_data(query_heavy_industry, "Heavy Industry")
    process_osm_data(data, geojson["features"], seen)

    with open("industrial_offtakers.geojson", "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)

    print(f"🎉 Successfully saved {len(geojson['features'])} sites to industrial_offtakers.geojson!")

if __name__ == "__main__":
    fetch_heavy_industry()
