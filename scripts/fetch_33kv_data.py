import requests
import json
import time

def fetch_33kv_data(filename="grid_33kv.geojson"):
    print("\n⚡ Fetching 33kV UK Network (Warning: Massive Dataset!)...")
    
    # We increase the timeout to 15 minutes and request max server memory
    query = """
    [out:json][timeout:900][maxsize:1073741824];
    area(3600062149)->.uk;
    (
      way["power"="line"]["voltage"~"33000"](area.uk);
      way["power"="cable"]["voltage"~"33000"](area.uk);
    );
    out geom;
    """
    
    url = "https://overpass-api.de/api/interpreter"
    
    for attempt in range(3):
        print(f"Attempt {attempt + 1} of 3...")
        response = requests.post(url, data={'data': query})
        
        if response.status_code == 200:
            print("✅ 33kV Data successfully downloaded!")
            break
        elif response.status_code == 429:
            print("⚠️ Server busy, sleeping 60s...")
            time.sleep(60)
        else:
            print(f"❌ Error: {response.text[:100]}")
            return

    try:
        osm_data = response.json()
    except ValueError:
        print("❌ Failed to parse JSON.")
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
        
    print(f"💾 Saved {len(geojson['features'])} 33kV cables/lines to {filename}")

if __name__ == "__main__":
    fetch_33kv_data()

