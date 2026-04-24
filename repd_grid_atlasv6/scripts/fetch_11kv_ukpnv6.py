import requests
import json
import time

OUTPUT_FILE = "grid_11kv_ukpn.geojson"

# UKPN coverage (London + South East + East)
UKPN_BBOX = [-1.5, 50.5, 1.8, 52.8]

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

def fetch_11kv_substations():
    print("🚀 Fetching UKPN 11kV substations...")

    query = f"""
    [out:json][timeout:60];
    (
      node["power"="substation"]({UKPN_BBOX[1]},{UKPN_BBOX[0]},{UKPN_BBOX[3]},{UKPN_BBOX[2]});
      way["power"="substation"]({UKPN_BBOX[1]},{UKPN_BBOX[0]},{UKPN_BBOX[3]},{UKPN_BBOX[2]});
    );
    out center;
    """

    for attempt in range(3):
        try:
            response = requests.post(OVERPASS_URL, data=query, timeout=120)
            if response.status_code == 200:
                print("  ✅ Download successful")
                break
            else:
                print(f"  ⚠️ Attempt {attempt+1}: {response.status_code}")
                time.sleep(10)
        except Exception as e:
            print(f"  ❌ Error: {e}")
            time.sleep(10)
    else:
        print("  ❌ Failed after retries")
        return

    data = response.json()
    elements = data.get("elements", [])
    print(f"  📦 Raw elements: {len(elements)}")

    geojson = {"type": "FeatureCollection", "features": []}
    skipped = 0

    for el in elements:
        try:
            tags = el.get("tags", {})

            # STRICT: substations only
            if tags.get("power") != "substation":
                skipped += 1
                continue

            # Exclude transmission-level sites
            voltage = tags.get("voltage", "")
            if voltage and any(v in voltage for v in ["400000", "275000"]):
                skipped += 1
                continue

            lat = el.get("lat") or el.get("center", {}).get("lat")
            lon = el.get("lon") or el.get("center", {}).get("lon")

            if not lat or not lon:
                skipped += 1
                continue

            feature = {
                "type": "Feature",
                "properties": {
                    "name": tags.get("name", "Substation"),
                    "operator": tags.get("operator", "UKPN (est)"),
                    "voltage": voltage if voltage else "11kV (est)",
                    "type": "substation"
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(lon, 6), round(lat, 6)]
                }
            }

            geojson["features"].append(feature)

        except:
            skipped += 1
            continue

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(geojson, f)

    print(f"  ⏭️ Skipped: {skipped}")
    print(f"🎉 Saved: {len(geojson['features'])} substations")

if __name__ == "__main__":
    fetch_11kv_substations()
