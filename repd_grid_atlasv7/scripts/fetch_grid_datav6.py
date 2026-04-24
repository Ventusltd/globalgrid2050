import requests
import json
import os
import time

def fetch_and_convert(voltage, filename, timeout_secs=300):
    print(f"\n--- Fetching {voltage}V data ---")
    
    query = f"""
    [out:json][timeout:{timeout_secs}];
    area(3600062149)->.uk;
    (
      way["power"="line"]["voltage"~"{voltage}"](area.uk);
      way["power"="cable"]["voltage"~"{voltage}"](area.uk);
    );
    out geom;
    """
    
    url = "https://overpass-api.de/api/interpreter"
    
    max_retries = 3
    for attempt in range(max_retries):
        print(f"Attempt {attempt + 1} of {max_retries}...")
        response = requests.post(url, data={'data': query})
        
        if response.status_code == 429:
            print("⚠️ Overpass server is busy (Status 429: Too Many Requests).")
            print("😴 Sleeping for 3 minutes before retrying...")
            time.sleep(180)  # 3 minute nap
            continue
        elif response.status_code != 200:
            print(f"❌ Error (Status {response.status_code}):\n", response.text[:500])
            return
        else:
            print("✅ Data successfully downloaded from server!")
            break  # Success! Break out of the retry loop.
            
    if response.status_code != 200:
        print(f"❌ Giving up on {voltage}V after {max_retries} attempts.")
        return

    try:
        osm_data = response.json()
    except ValueError:
        print(f"❌ Failed to parse JSON for {voltage}V. Server returned:\n", response.text[:500])
        return

    geojson = {"type": "FeatureCollection", "features": []}
    
    for element in osm_data.get('elements', []):
        if element['type'] == 'way' and 'geometry' in element:
            coords = [[node['lon'], node['lat']] for node in element['geometry']]
            feature = {
                "type": "Feature",
                "properties": element.get('tags', {}),
                "geometry": {"type": "LineString", "coordinates": coords}
            }
            geojson['features'].append(feature)
            
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(geojson, f)
        
    print(f"💾 Saved {len(geojson['features'])} power lines to {filename}")

if __name__ == "__main__":
    # 400kV fetch
    fetch_and_convert("400000", "grid_400kv.geojson", 300)
    
    print("⏳ Pausing for 60 seconds...")
    time.sleep(60)
    
    # 275kV fetch
    fetch_and_convert("275000", "grid_275kv.geojson", 300)
    
    print("⏳ Pausing for another 60 seconds...")
    time.sleep(60)
    
    # ⚡ 132kV fetch (15 minute timeout)
    fetch_and_convert("132000", "grid_132kv.geojson", 900)
