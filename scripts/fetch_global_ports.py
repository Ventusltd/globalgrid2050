import requests
import json
import os
import sys

# Define the Overpass API endpoint
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# We query globally for seamark harbours and industrial ports.
# The [timeout:900] ensures the API doesn't drop the connection for this global pull.
# Using 'out center;' guarantees we get a single mathematical point (geodesic node) 
# even if the port is mapped as a complex polygon.
OVERPASS_QUERY = """
[out:json][timeout:900];
(
  nwr["seamark:type"="harbour"];
  nwr["industrial"="port"];
);
out center;
"""

def fetch_ports():
    print("Initiating global port extraction from Overpass API...")
    try:
        response = requests.post(OVERPASS_URL, data={'data': OVERPASS_QUERY})
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
    # Ensure it saves to the root directory where the HTML expects it
    filepath = os.path.join(os.getcwd(), filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(geojson_data, f, separators=(',', ':'))
    print(f"SUCCESS: Wrote {len(geojson_data['features'])} ports to {filepath}")

if __name__ == "__main__":
    raw_data = fetch_ports()
    geojson = convert_to_geojson(raw_data)
    save_geojson(geojson)
