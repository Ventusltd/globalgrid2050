import requests
import json
import time

def fetch_overpass_data(query, name):
    url = "https://overpass-api.de/api/interpreter"
    for attempt in range(3):
        try:
            print(f"  -> Requesting {name}...")
            response = requests.post(url, data={'data': query})
            if response.status_code == 200:
                print(f"  ✅ {name} downloaded!")
                return response.json()
            elif response.status_code == 429:
                print("  ⚠️ Server busy, sleeping 60s...")
                time.sleep(60)
            else:
                print(f"  ❌ Error for {name}: {response.status_code}")
                return None
        except Exception as e:
            print(f"  ❌ Connection Error for {name}: {e}")
            return None
    return None

def process_osm_data(osm_data, geojson_features):
    if not osm_data:
        return
    
    for element in osm_data.get('elements', []):
        tags = element.get('tags', {})
        if element['type'] == 'node':
            lat, lon = element.get('lat'), element.get('lon')
        elif 'center' in element:
            lat, lon = element['center'].get('lat'), element['center'].get('lon')
        else:
            continue
            
        if lat and lon:
            ind_type = tags.get('industrial', tags.get('man_made', 'Heavy Industry')).replace('_', ' ').title()
            name = tags.get('name')
            operator = tags.get('operator', tags.get('brand', 'Unknown Operator'))
            
            if name or operator != 'Unknown Operator':
                feature = {
                    "type": "Feature",
                    "properties": {
                        "name": name if name else f"Unnamed {ind_type} Facility",
                        "operator": operator,
                        "type": ind_type
                    },
                    "geometry": {"type": "Point", "coordinates": [lon, lat]}
                }
                geojson_features.append(feature)

def fetch_heavy_industry():
    print("🚀 Fetching UK Industrial Offtakers in batches...")
    
    geojson = {"type": "FeatureCollection", "features": []}

    # Query 1: Heavy Manufacturing
    query_manufacturing = """
    [out:json][timeout:180];
    area(3600062149)->.uk;
    (
      node["industrial"~"steel|metallurgical|glass|cement|paper|chemical|oil"](area.uk);
      way["industrial"~"steel|metallurgical|glass|cement|paper|chemical|oil"](area.uk);
      relation["industrial"~"steel|metallurgical|glass|cement|paper|chemical|oil"](area.uk);
    );
    out center;
    """
    
    # Query 2: Massive Water Works
    query_water = """
    [out:json][timeout:180];
    area(3600062149)->.uk;
    (
      node["man_made"~"water_works|wastewater_plant"](area.uk);
      way["man_made"~"water_works|wastewater_plant"](area.uk);
      relation["man_made"~"water_works|wastewater_plant"](area.uk);
    );
    out center;
    """

    data_mfg = fetch_overpass_data(query_manufacturing, "Manufacturing")
    process_osm_data(data_mfg, geojson['features'])
    
    # Sleep to respect rate limits between large requests
    time.sleep(10)
    
    data_water = fetch_overpass_data(query_water, "Water Infrastructure")
    process_osm_data(data_water, geojson['features'])

    with open("industrial_offtakers.geojson", 'w', encoding='utf-8') as f:
        json.dump(geojson, f)
        
    print(f"🎉 Successfully saved {len(geojson['features'])} sites to industrial_offtakers.geojson!")

if __name__ == "__main__":
    fetch_heavy_industry()
