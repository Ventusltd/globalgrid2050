import requests
import json
import time
import os

# Define the UK regions using Bounding Boxes [min_lat, min_lon, max_lat, max_lon]
REGIONS = {
    "Scotland_North": [56.5, -7.5, 59.0, -1.5],
    "Scotland_South": [54.8, -5.5, 56.5, -1.5],
    "North_East_England": [54.0, -2.0, 55.8, -0.0],
    "North_West_England": [53.0, -3.5, 55.0, -2.0],
    "Yorkshire": [53.0, -1.5, 54.5, 0.5],
    "Wales_North": [52.5, -5.0, 53.5, -2.8],
    "Wales_South": [51.3, -5.5, 52.5, -2.5],
    "Midlands": [52.0, -3.0, 53.0, 0.5],
    "East_of_England": [51.5, 0.0, 53.0, 1.8],
    "South_West_England": [50.0, -6.0, 51.5, -2.0],
    "South_East_England": [50.5, -1.5, 51.5, 0.5],
    "London_Area": [51.2, -0.5, 51.8, 0.3]
}

def fetch_region(name, bbox):
    filename = f"grid_33kv_{name}.geojson"
    print(f"\n⚡ Fetching 33kV Data for: {name}...")
    
    # The (bbox) tag tells Overpass to only look inside these coordinates
    query = f"""
    [out:json][timeout:180];
    (
      way["power"="line"]["voltage"~"33000"]({bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]});
      way["power"="cable"]["voltage"~"33000"]({bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]});
    );
    out geom;
    """
    
    url = "https://overpass-api.de/api/interpreter"
    
    for attempt in range(3):
        print(f"  Attempt {attempt + 1}...")
        try:
            response = requests.post(url, data={'data': query})
            if response.status_code == 200:
                print("  ✅ Download successful!")
                break
            elif response.status_code == 429:
                print("  ⚠️ Server busy, sleeping 60s...")
                time.sleep(60)
            else:
                print(f"  ❌ Error: {response.status_code}")
                return
        except Exception as e:
            print(f"  ❌ Connection Error: {e}")
            return

    try:
        osm_data = response.json()
    except ValueError:
        print("  ❌ Failed to parse JSON.")
        return

    geojson = {"type": "FeatureCollection", "features": []}
    
    for element in osm_data.get('elements', []):
        if element['type'] == 'way' and 'geometry' in element:
            coords = [[node['lon'], node['lat']] for node in element['geometry']]
            # Strip metadata to keep file tiny, just keep voltage
            feature = {
                "type": "Feature",
                "properties": {"voltage": "33000"},
                "geometry": {"type": "LineString", "coordinates": coords}
            }
            geojson['features'].append(feature)
            
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(geojson, f)
        
    print(f"  💾 Saved {len(geojson['features'])} lines to {filename}")
    
    # Crucial: Sleep so we don't get banned by the API
    print("  😴 Sleeping 30 seconds to respect server limits...")
    time.sleep(30)

if __name__ == "__main__":
    print("🚀 Starting 33kV Regional Scraper...")
    for region_name, bbox in REGIONS.items():
        fetch_region(region_name, bbox)
    print("\n🎉 All 33kV regions finished!")
