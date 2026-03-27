import requests
import json
import time

def fetch_airports():
    print("🚀 Fetching UK Airports from OpenStreetMap...")
    
    query = """
    [out:json][timeout:180];
    area(3600062149)->.uk;
    (
      node["aeroway"="aerodrome"](area.uk);
      way["aeroway"="aerodrome"](area.uk);
      relation["aeroway"="aerodrome"](area.uk);
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
            # Filter out tiny private helipads/grass strips if they don't have a name
            if 'name' in tags or 'iata' in tags or 'icao' in tags:
                feature = {
                    "type": "Feature",
                    "properties": {
                        "name": tags.get('name', 'Unknown Airport'),
                        "iata": tags.get('iata', 'N/A'),
                        "icao": tags.get('icao', 'N/A')
                    },
                    "geometry": {"type": "Point", "coordinates": [lon, lat]}
                }
                geojson['features'].append(feature)

    with open("airports.geojson", 'w', encoding='utf-8') as f:
        json.dump(geojson, f)
        
    print(f"🎉 Successfully saved {len(geojson['features'])} Airports to airports.geojson!")

if __name__ == "__main__":
    fetch_airports()

