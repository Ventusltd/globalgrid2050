import requests
import json
import os
import time

def fetch_uk_railways(rail_types, filename, timeout_secs=900):
    print(f"\n--- Fetching railway types: {', '.join(rail_types)} ---")
    
    # Dynamically build the way query for multiple railway tag values
    way_queries = "\n".join([f'  way["railway"="{rtype}"](area.uk);' for rtype in rail_types])
    
    query = f"""
    [out:json][timeout:{timeout_secs}];
    area(3600062149)->.uk;
    (
{way_queries}
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
        print(f"❌ Giving up on {', '.join(rail_types)} after {max_retries} attempts.")
        return

    try:
        osm_data = response.json()
    except ValueError:
        print(f"❌ Failed to parse JSON. Server returned:\n", response.text[:500])
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
        
    print(f"💾 Saved {len(geojson['features'])} rail segments to {filename}")

if __name__ == "__main__":
    # 🚂 Fetching mainline rail network (Massive dataset, requires 15m timeout)
    fetch_uk_railways(["rail"], "uk_mainline_railways.geojson", 900)
    
    print("⏳ Pausing for 60 seconds to respect Overpass rate limits...")
    time.sleep(60)
    
    # 🚇 Fetching underground, light rail, and trams
    fetch_uk_railways(["subway", "light_rail", "tram"], "uk_metros_trams.geojson", 300)
    
    # Optional: If you want sidings, yards, and narrow gauge, uncomment the below, 
    # but be aware these add significant weight to the payload.
    # print("⏳ Pausing for another 60 seconds...")
    # time.sleep(60)
    # fetch_uk_railways(["narrow_gauge", "preserved", "funicular", "monorail"], "uk_special_railways.geojson", 300)
