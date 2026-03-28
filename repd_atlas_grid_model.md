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

def process_osm_data(osm_data, geojson_features, override_type=None):
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
            ind_type = override_type if override_type else tags.get('industrial', tags.get('man_made', 'Heavy Industry')).replace('_', ' ').title()
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
    print("🚀 Fetching UK Industrial Offtakers in small batches...")
    
    geojson = {"type": "FeatureCollection", "features": []}

    # 1. Standard Heavy Industry
    industries = ["steel", "metallurgical", "glass", "cement", "paper", "chemical"]
    
    for industry in industries:
        query = f"""
        [out:json][timeout:60];
        area(3600062149)->.uk;
        (
          node["industrial"="{industry}"](area.uk);
          way["industrial"="{industry}"](area.uk);
          relation["industrial"="{industry}"](area.uk);
        );
        out center;
        """
        data = fetch_overpass_data(query, industry.title())
        process_osm_data(data, geojson['features'])
        time.sleep(2) 

    # 2. TRUE Oil Refineries & Major Petrochemicals (Filtering out tiny depots)
    print("  -> Requesting True Oil Refineries...")
    query_oil = """
    [out:json][timeout:60];
    area(3600062149)->.uk;
    (
      node["industrial"="oil_refinery"](area.uk);
      way["industrial"="oil_refinery"](area.uk);
      relation["industrial"="oil_refinery"](area.uk);
      
      node["man_made"="petroleum_well"](area.uk);
      way["man_made"="petroleum_well"](area.uk);
      relation["man_made"="petroleum_well"](area.uk);
      
      node["industrial"="petrochemical"](area.uk);
      way["industrial"="petrochemical"](area.uk);
      relation["industrial"="petrochemical"](area.uk);
    );
    out center;
    """
    data_oil = fetch_overpass_data(query_oil, "Oil Refineries")
    # We force the type to 'Oil Refinery' so the HTML map knows exactly which layer to put it on
    process_osm_data(data_oil, geojson['features'], override_type="Oil Refinery")
    time.sleep(2)
    
    # 3. Massive Water Works
    query_water = """
    [out:json][timeout:60];
    area(3600062149)->.uk;
    (
      node["man_made"~"water_works|wastewater_plant"](area.uk);
      way["man_made"~"water_works|wastewater_plant"](area.uk);
      relation["man_made"~"water_works|wastewater_plant"](area.uk);
    );
    out center;
    """

    data_water = fetch_overpass_data(query_water, "Water Infrastructure")
    process_osm_data(data_water, geojson['features'])

    with open("industrial_offtakers.geojson", 'w', encoding='utf-8') as f:
        json.dump(geojson, f)
        
    print(f"🎉 Successfully saved {len(geojson['features'])} sites to industrial_offtakers.geojson!")

if __name__ == "__main__":
    fetch_heavy_industry()
