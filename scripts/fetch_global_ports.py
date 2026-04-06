import requests
import json
import os
import sys

# Define the Overpass API endpoint
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Stripped the leading newline just in case the Overpass parser gets tripped up
OVERPASS_QUERY = """[out:json][timeout:900];
(
  nwr["seamark:type"="harbour"];
  nwr["industrial"="port"];
);
out center;"""

def fetch_ports():
    print("Initiating global port extraction from Overpass API...")
    
    # 1. Provide a custom User-Agent so Overpass doesn't block the request as a generic bot
    headers = {
        'User-Agent': 'GlobalGrid2050-Pipeline/5.0 (Automated Spatial Extraction)'
    }
    
    try:
        # 2. Send the query as raw UTF-8 bytes to prevent URL-encoding corruption
        response = requests.post(OVERPASS_URL, data=OVERPASS_QUERY.encode('utf-8'), headers=headers)
        
        # 3. Intercept API errors to print the EXACT reason Overpass rejected it
        if response.status_code != 200:
            print(f"OVERPASS API ERROR [{response.status_code}]:\n{response.text}")
            
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"CRITICAL: Failed to fetch data from Overpass API: {e}")
        sys.exit(1)

def convert_to_geojson(osm_data):
    features = []
    elements = osm_data.get('elements', [])
    
    print(f"Processing {len(elements)} raw spatial nodes...")
    
    for el in elements:
        # Extract coordinates depending on whether it's a node or the center of a way/relation
        if el['type'] == 'node':
            lon, lat = el.get('lon'), el.get('lat')
        else:
            center = el.get('center', {})
            lon, lat = center.get('lon'), center.get('lat')
            
        if not lon or not lat:
            continue
            
        tags = el.get('tags', {})
        name = tags.get('name', tags.get('name:en', 'Unnamed Port / Facility'))
        port_type = tags.get('seamark:type', tags.get('industrial', 'Unknown'))
        
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat]
            },
            "properties": {
                "name": name,
                "type": port_type,
                "operator": tags.get('operator', 'Unknown'),
                "osm_id": el['id']
            }
        }
        features.append(feature)
        
    return {
        "type": "FeatureCollection",
        "features": features
    }

def save_geojson(geojson_data, filename="global_ports.geojson"):
    filepath = os.path.join(os.getcwd(), filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(geojson_data, f, separators=(',', ':'))
    print(f"SUCCESS: Wrote {len(geojson_data['features'])} ports to {filepath}")

if __name__ == "__main__":
    raw_data = fetch_ports()
    # Safely convert and save only if data was actually returned
    if raw_data:
        geojson = convert_to_geojson(raw_data)
        save_geojson(geojson)
