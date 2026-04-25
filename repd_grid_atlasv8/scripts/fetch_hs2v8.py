import requests
import json
import time

def fetch_hs2():
    print("🚀 Fetching UK HS2 Infrastructure from OpenStreetMap...")
    
    query = """
    [out:json][timeout:180];
    area(3600062149)->.uk;
    (
      node["name"~"HS2"]["railway"](area.uk);
      way["name"~"HS2"]["railway"](area.uk);
      relation["name"~"HS2"]["railway"](area.uk);
      
      node["network"="HS2"](area.uk);
      way["network"="HS2"](area.uk);
      relation["network"="HS2"](area.uk);
    );
    out center;
    """
    
    url = "https://overpass-api.de/api/interpreter"
    
    for attempt in range(3):
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

    osm_data = response.json()
    geojson = {"type": "FeatureCollection", "features": []}
    
    for element in osm_data.get('elements', []):
        tags = element.get('tags', {})
        if element['type'] == 'node':
            lat, lon = element.get('lat'), element.get('lon')
        elif 'center' in element:
            lat, lon = element['center'].get('lat'), element['center'].get('lon')
        else:
            continue
            
        if lat and lon:
            feature = {
                "type": "Feature",
                "properties": {
                    "name": tags.get('name', 'HS2 Infrastructure')
                },
                "geometry": {"type": "Point", "coordinates": [lon, lat]}
            }
            geojson['features'].append(feature)

    with open("hs2.geojson", 'w', encoding='utf-8') as f:
        json.dump(geojson, f)
        
    print(f"🎉 Successfully saved HS2 sites!")

if __name__ == "__main__":
    fetch_hs2()
