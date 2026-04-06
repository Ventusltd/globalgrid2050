import requests
import json
import math
import os
import sys
import csv

# Calculate the absolute path of the repository root
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
GEM_CSV_FILENAME = "gem_hydrocarbons_master.csv"  
DEDUPLICATION_RADIUS_M = 3000.0  

OVERPASS_QUERY = """[out:json][timeout:900];
(
  way["man_made"="petroleum_works"];
  relation["man_made"="petroleum_works"];
  way["industrial"="oil_refinery"];
  relation["industrial"="oil_refinery"];
  way["industrial"="oil"];
  relation["industrial"="oil"];
  way["industrial"="gas"];
  relation["industrial"="gas"];
  way["industrial"="lng"];
  relation["industrial"="lng"];
  way["product"="lng"];
  relation["product"="lng"];
  way["industrial"="gas_field"];
  relation["industrial"="gas_field"];
  way["industrial"="oil_field"];
  relation["industrial"="oil_field"];
  node["man_made"="offshore_platform"];
  way["man_made"="offshore_platform"];
  relation["man_made"="offshore_platform"];
);
out center bb;"""

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1-a))

def parse_gem_data():
    gem_features = []
    filepath = os.path.join(REPO_ROOT, GEM_CSV_FILENAME)
    
    if not os.path.exists(filepath):
        print(f"WARNING: Gold Standard file '{GEM_CSV_FILENAME}' not found in root. Defaulting strictly to OSM.")
        return gem_features
        
    print(f"Ingesting Gold Standard data from {filepath}...")
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        headers = [h.lower() for h in reader.fieldnames]
        
        lat_col = next((h for h in headers if 'lat' in h), None)
        lon_col = next((h for h in headers if 'lon' in h or 'lng' in h), None)
        name_col = next((h for h in headers if 'name' in h or 'project' in h), None)
        type_col = next((h for h in headers if 'type' in h or 'category' in h), None)
        
        if not lat_col or not lon_col:
            print("CRITICAL: Could not identify Latitude/Longitude columns in GEM CSV.")
            return gem_features

        for row in reader:
            try:
                lat_key = reader.fieldnames[headers.index(lat_col)]
                lon_key = reader.fieldnames[headers.index(lon_col)]
                name_key = reader.fieldnames[headers.index(name_col)] if name_col else None
                type_key = reader.fieldnames[headers.index(type_col)] if type_col else None
                
                lat = float(row[lat_key])
                lon = float(row[lon_key])
                name = row[name_key] if name_key else "GEM Tracked Facility"
                facility_type = row[type_key] if type_key else "Hydrocarbon Asset"
                
                gem_features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [lon, lat]
                    },
                    "properties": {
                        "name": name,
                        "type": facility_type,
                        "source": "Global Energy Monitor",
                        "area_ha": 30.0
                    }
                })
            except (ValueError, TypeError):
                continue
                
    print(f"SUCCESS: Ingested {len(gem_features)} Gold Standard assets.")
    return gem_features

def fetch_osm_data():
    print("Initiating global Overpass API extraction for secondary infrastructure...")
    
    headers = {
        'User-Agent': 'GlobalGrid2050-Pipeline/5.0 (Automated Spatial Extraction)'
    }
    
    try:
        response = requests.post(OVERPASS_URL, data=OVERPASS_QUERY.encode('utf-8'), headers=headers)
        
        if response.status_code != 200:
            print(f"OVERPASS API ERROR [{response.status_code}]:\n{response.text}")
            
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"CRITICAL: Failed to fetch data: {e}")
        sys.exit(1)

def deduplicate_and_merge(gem_features, osm_raw):
    final_features = list(gem_features)
    if not osm_raw:
        return {"type": "FeatureCollection", "features": final_features}
        
    elements = osm_raw.get('elements', [])
    
    print(f"Cross-referencing {len(elements)} OSM assets against Gold Standard data...")
    
    osm_kept = 0
    osm_dropped = 0
    
    for el in elements:
        lon = el.get('lon') or el.get('center', {}).get('lon')
        lat = el.get('lat') or el.get('center', {}).get('lat')
        
        if not lon or not lat:
            continue

        is_duplicate = False
        for gem in gem_features:
            gem_lon, gem_lat = gem['geometry']['coordinates']
            distance = haversine_distance(lat, lon, gem_lat, gem_lon)
            if distance <= DEDUPLICATION_RADIUS_M:
                is_duplicate = True
                break
                
        if is_duplicate:
            osm_dropped += 1
            continue

        tags = el.get('tags', {})
        is_offshore_platform = tags.get('man_made') == 'offshore_platform'
        is_field = tags.get('industrial') in ['gas_field', 'oil_field']
        is_lng = tags.get('industrial') == 'lng' or tags.get('product') == 'lng'
        
        area_ha = 0.0
        bounds = el.get('bounds')
        
        if bounds:
            minlat, minlon = bounds['minlat'], bounds['minlon']
            maxlat, maxlon = bounds['maxlat'], bounds['maxlon']
            width_m = haversine_distance(lat, minlon, lat, maxlon)
            height_m = haversine_distance(minlat, lon, maxlat, lon)
            area_ha = (width_m * height_m) / 10000.0
            
            if area_ha < 5.0 and not is_field and not is_lng:
                continue
        elif not is_offshore_platform:
            continue

        name = tags.get('name', tags.get('name:en', 'Unnamed Hydrocarbon Facility'))
        
        if is_lng: facility_type = 'LNG Terminal / Plant'
        elif tags.get('industrial') == 'gas_field': facility_type = 'Gas Field'
        elif tags.get('industrial') == 'oil_field': facility_type = 'Oil Field'
        elif is_offshore_platform: facility_type = 'Offshore Platform'
        elif tags.get('industrial') == 'gas': facility_type = 'Gas Processing'
        else: facility_type = 'Oil Refinery'
        
        if is_offshore_platform: area_ha = max(area_ha, 30.0)
        elif is_lng: area_ha = max(area_ha, 10.0)
        
        final_features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat]
            },
            "properties": {
                "name": name,
                "type": facility_type,
                "source": "OSM",
                "area_ha": round(area_ha, 1),
                "osm_id": el['id']
            }
        })
        osm_kept += 1
        
    print(f"Deduplication Complete: Kept {osm_kept} OSM assets, Dropped {osm_dropped} duplicates.")
    return {
        "type": "FeatureCollection",
        "features": final_features
    }

def save_geojson(geojson_data, filename="global_hydrocarbons.geojson"):
    filepath = os.path.join(REPO_ROOT, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(geojson_data, f, separators=(',', ':'))
    print(f"SUCCESS: Wrote {len(geojson_data['features'])} unified facilities to {filepath}")

if __name__ == "__main__":
    gem_data = parse_gem_data()
    osm_raw = fetch_osm_data()
    final_geojson = deduplicate_and_merge(gem_data, osm_raw)
    save_geojson(final_geojson)
