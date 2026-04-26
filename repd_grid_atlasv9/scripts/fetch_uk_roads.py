import requests
import json
import time
import sys

def fetch_uk_roads(highway_types, filename, timeout_secs=900):
    print(f"\n--- Fetching road types: {', '.join(highway_types)} ---")
    
    # Dynamically build the way query for multiple highway tag values
    way_queries = "\n".join([f'  way["highway"="{htype}"](area.uk);' for htype in highway_types])
    
    query = f"""
    [out:json][timeout:{timeout_secs}];
    area(3600062149)->.uk;
    (
{way_queries}
    );
    out geom;
    """
    
    url = "https://overpass-api.de/api/interpreter"
    
    headers = {
        'User-Agent': 'GlobalGrid2050-Bot/1.0 (bot@globalgrid2050.com)',
        'Accept': '*/*'
    }
    
    max_retries = 3
    for attempt in range(max_retries):
        print(f"Attempt {attempt + 1} of {max_retries}...")
        response = requests.post(url, data={'data': query}, headers=headers)
        
        if response.status_code == 429:
            print("⚠️ Overpass server is busy (Status 429). Sleeping for 3 minutes...")
            time.sleep(180)
            continue
        elif response.status_code != 200:
            print(f"❌ Error (Status {response.status_code}):\n", response.text[:500])
            sys.exit(1)
        else:
            print("✅ Data successfully downloaded from server!")
            break
            
    if response.status_code != 200:
        print(f"❌ Giving up on {', '.join(highway_types)} after {max_retries} attempts.")
        sys.exit(1)

    try:
        osm_data = response.json()
    except ValueError:
        print(f"❌ Failed to parse JSON. Server returned:\n", response.text[:500])
        sys.exit(1)

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
        
    print(f"💾 Saved {len(geojson['features'])} road segments to {filename}")

if __name__ == "__main__":
    # 🛣️ Motorways & Slip Roads
    fetch_uk_roads(["motorway", "motorway_link"], "uk_motorways.geojson", 900)
    
    print("⏳ Pausing for 60 seconds...")
    time.sleep(60)
    
    # 🟢 Major A-Roads (Trunk)
    fetch_uk_roads(["trunk", "trunk_link"], "uk_trunk_roads.geojson", 900)
    
    print("⏳ Pausing for 60 seconds...")
    time.sleep(60)
    
    # 🔴 Standard A-Roads (Primary) - This will be massive
    fetch_uk_roads(["primary", "primary_link"], "uk_primary_roads.geojson", 900)
