import requests
import json
import time

def fetch_power_plants():
    print("🚀 Fetching UK Nuclear & Gas Plants from OpenStreetMap...")
    
    query = """
    [out:json][timeout:180];
    area(3600062149)->.uk;
    (
      node["power"="plant"]["plant:source"="nuclear"](area.uk);
      way["power"="plant"]["plant:source"="nuclear"](area.uk);
      relation["power"="plant"]["plant:source"="nuclear"](area.uk);
      
      node["power"="plant"]["plant:source"="gas"](area.uk);
      way["power"="plant"]["plant:source"="gas"](area.uk);
      relation["power"="plant"]["plant:source"="gas"](area.uk);
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
            source = tags.get('plant:source', 'unknown')
            feature = {
                "type": "Feature",
                "properties": {
                    "name": tags.get('name', f'Unknown {source.title()} Plant'),
                    "operator": tags.get('operator', 'Unknown Operator'),
                    "source": source
                },
                "geometry": {"type": "Point", "coordinates": [lon, lat]}
            }
            geojson['features'].append(feature)

    with open("power_plants.geojson", 'w', encoding='utf-8') as f:
        json.dump(geojson, f)
        
    print(f"🎉 Successfully saved {len(geojson['features'])} Power Plants!")

if __name__ == "__main__":
    fetch_power_plants()

