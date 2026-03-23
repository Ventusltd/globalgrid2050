import requests
import json
import os

def fetch_and_convert(voltage, filename):
    print(f"Fetching {voltage}V data from Overpass API...")
    
    query = f"""
    [out:json][timeout:300];
    area(3600062149)->.uk;
    (
      way["power"="line"]["voltage"~"{voltage}"](area.uk);
      way["power"="cable"]["voltage"~"{voltage}"](area.uk);
    );
    out geom;
    """
    
    url = "https://overpass-api.de/api/interpreter"
    response = requests.post(url, data={'data': query})
    
    if response.status_code != 200:
        print(f"❌ Error fetching {voltage}V data:", response.text)
        return
        
    osm_data = response.json()
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
        
    print(f"✅ Saved {len(geojson['features'])} power lines to {filename}")

if __name__ == "__main__":
    # Fetching ONLY the 400kV data for now to ensure stability
    fetch_and_convert("400000", "grid_400kv.geojson")
