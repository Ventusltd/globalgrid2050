import requests
import json
import sys

# We use the raw GitHub user content URLs to bypass any API limits.
# Primary: The official (archived) TeleGeography repository.
# Fallback: A permanent open-source fork in case the official repo is taken offline.
SOURCES = [
    "https://raw.githubusercontent.com/telegeography/www.submarinecablemap.com/master/public/api/v3/cable/cable-geo.json",
    "https://raw.githubusercontent.com/delusan/www.submarinecablemap.com/master/public/api/v3/cable/cable-geo.json",
    "https://raw.githubusercontent.com/telegeography/www.submarinecablemap.com/master/public/api/v2/cable/cable-geo.json"
]

def fetch_telegeography_data():
    for url in SOURCES:
        print(f"Attempting to fetch global telecom backbone from: {url}")
        try:
            res = requests.get(url, timeout=30)
            res.raise_for_status()
            print("Success! Hijacked the TeleGeography dataset.")
            return res.json()
        except requests.exceptions.RequestException as e:
            print(f"Failed to fetch from {url}: {e}")
            continue
            
    print("CRITICAL ERROR: All TeleGeography archives failed.")
    sys.exit(1)

def process_data(raw_data: dict) -> list:
    features = []
    
    # TeleGeography natively uses a GeoJSON FeatureCollection
    for feature in raw_data.get("features", []):
        props = feature.get("properties", {})
        geom = feature.get("geometry", {})
        
        # Extract the commercial name, default to "Global Telecom Route"
        name = props.get("name", "Global Telecom Route")
        
        # We enforce our Ventus OS standard properties so the map styling recognizes it
        features.append({
            "type": "Feature",
            "properties": {
                "name": name,
                "operator": "Commercial Telecom Backbone", 
                "source": "TeleGeography Archive",
                "type": "subsea_data_cable"
            },
            "geometry": geom
        })

    return features

def main():
    print("Initiating TeleGeography Archive Hijack...")
    
    # 1. Fetch the raw proprietary GeoJSON
    raw_data = fetch_telegeography_data()
    
    # 2. Process and standardize the data for Ventus OS
    features = process_data(raw_data)
    
    # 3. Compile and save
    geojson = {"type": "FeatureCollection", "features": features}
    with open("subsea_data_cables.geojson", "w", encoding="utf-8") as f:
        # Minify to ensure lightning-fast WebGL rendering
        json.dump(geojson, f, ensure_ascii=False, separators=(",", ":"))
        
    print(f"Saved {len(features)} massive trans-oceanic telecom routes to subsea_data_cables.geojson")

if __name__ == "__main__":
    main()
