import requests
import json
import math
import os
import sys

# Calculate the absolute path of the repository root
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Added amenity=ferry_terminal to explicitly catch P&O/Stena Line style hubs
OVERPASS_QUERY = """[out:json][timeout:900];
(
  nwr["seamark:type"="harbour"];
  nwr["industrial"="port"];
  nwr["amenity"="ferry_terminal"];
);
out center bb;"""

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1-a))

def fetch_ports():
    print("Initiating global port & ferry extraction from Overpass API...")
    headers = {'User-Agent': 'GlobalGrid2050-Pipeline/5.0'}
    
    try:
        response = requests.post(OVERPASS_URL, data=OVERPASS_QUERY.encode('utf-8'), headers=headers)
        if response.status_code != 200:
            print(f"OVERPASS API ERROR [{response.status_code}]:\n{response.text}")
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"CRITICAL: Failed to fetch data: {e}")
        sys.exit(1)

def convert_to_geojson(osm_data):
    features = []
    elements = osm_data.get('elements', [])
    
    for el in elements:
        lon = el.get('lon') or el.get('center', {}).get('lon')
        lat = el.get('lat') or el.get('center', {}).get('lat')
        if not lon or not lat: continue
            
        tags = el.get('tags', {})
        name = tags.get('name', tags.get('name:en', 'Unnamed Port / Terminal'))
        
        # Strict logic for Deep Water, Containers, and Ro-Ro Ferries
        is_industrial = tags.get('industrial') == 'port'
        is_ferry_terminal = tags.get('amenity') == 'ferry_terminal'
        
        category = tags.get('seamark:harbour:category', '').lower()
        cargo_tags = ['cargo', 'container', 'industrial', 'ro-ro', 'commercial', 'military', 'ferry', 'passenger', 'cruise', 'deep_water']
        
        is_major = is_industrial or is_ferry_terminal or any(c in category for c in cargo_tags)
        port_class = 'Major Cargo/Container Port' if is_major else 'Minor/Local Harbour'
        
        area_ha = 1.0 
        bounds = el.get('bounds')
        
        if bounds:
            width_m = haversine_distance(lat, bounds['minlon'], lat, bounds['maxlon'])
            height_m = haversine_distance(bounds['minlat'], lon, bounds['maxlat'], lon)
            area_ha = (width_m * height_m) / 10000.0
        
        # If it's a major deep-water/ferry port but only mapped as a point, force a massive 80-hectare fallback
        if is_major and area_ha < 80.0:
            area_ha = 80.0
            
        feature = {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "name": name,
                "type": port_class,
                "operator": tags.get('operator', 'Unknown'),
                "area_ha": round(area_ha, 1),
                "osm_id": el['id']
            }
        }
        features.append(feature)
        
    return {"type": "FeatureCollection", "features": features}

def save_geojson(geojson_data, filename="global_ports.geojson"):
    filepath = os.path.join(REPO_ROOT, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(geojson_data, f, separators=(',', ':'))
    print(f"SUCCESS: Wrote {len(geojson_data['features'])} ports to {filepath}")

if __name__ == "__main__":
    raw_data = fetch_ports()
    if raw_data:
        geojson = convert_to_geojson(raw_data)
        save_geojson(geojson)
