import requests
import json
import time

def fetch_data_centres():
    print("🚀 Fetching UK Data Centres from OpenStreetMap...")
    
    # We look for both telecom=data_center and building=data_center tags
    query = """
    [out:json][timeout:180];
    area(3600062149)->.uk;
    (
      node["telecom"="data_center"](area.uk);
      way["telecom"="data_center"](area.uk);
      relation["telecom"="data_center"](area.uk);
      
      node["building"="data_center"](area.uk);
      way["building"="data_center"](area.uk);
      relation["building"="data_center"](area.uk);
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
        
        # Get coordinates whether it's a node or the center of a building polygon
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
                    "name": tags.get('name', 'Unknown Data Centre'),
                    "operator": tags.get('operator', tags.get('brand', 'Unknown Operator')),
                },
                "geometry": {"type": "Point", "coordinates": [lon, lat]}
            }
            geojson['features'].append(feature)

    # Save the file
    with open("datacentres.geojson", 'w', encoding='utf-8') as f:
        json.dump(geojson, f)
        
    print(f"🎉 Successfully saved {len(geojson['features'])} Data Centres to datacentres.geojson!")

if __name__ == "__main__":
    fetch_data_centres()

