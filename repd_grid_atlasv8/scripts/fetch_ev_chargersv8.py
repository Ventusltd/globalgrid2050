import requests
import json
import time

MIN_KW = 100
OUTPUT_FILE = "ev_chargers.geojson"
API_URL = "https://api.openchargemap.io/v3/poi/"

def fetch_ev_chargers():
    print("🚀 Fetching UK EV Rapid Chargers (100kW+) from Open Charge Map...")

    params = {
        'output': 'json',
        'countrycode': 'GB',
        'minpowerkw': MIN_KW,
        'maxresults': 10000,
        'compact': True,
        'verbose': False,
        'key': ''  # Works without key but rate limited — add OCM_API_KEY env var
    }

    import os
    api_key = os.environ.get('OCM_API_KEY', '')
    if api_key:
        params['key'] = api_key

    for attempt in range(3):
        try:
            response = requests.get(API_URL, params=params, timeout=60)
            if response.status_code == 200:
                print("  ✅ Download successful!")
                break
            elif response.status_code == 429:
                print("  ⚠️ Rate limited, sleeping 60s...")
                time.sleep(60)
            else:
                print(f"  ❌ Error: {response.status_code}")
                return
        except Exception as e:
            print(f"  ❌ Connection Error: {e}")
            return

    raw = response.json()
    print(f"  📦 Received {len(raw)} raw records")

    geojson = {"type": "FeatureCollection", "features": []}
    skipped = 0

    for item in raw:
        try:
            addr = item.get('AddressInfo', {})
            lat = addr.get('Latitude')
            lon = addr.get('Longitude')

            if not lat or not lon:
                skipped += 1
                continue

            # UK bounding box
            if not (-9.0 <= lon <= 2.5 and 49.0 <= lat <= 61.0):
                skipped += 1
                continue

            # Max power across all connections
            connections = item.get('Connections', [])
            max_kw = 0
            connector_types = set()
            for conn in connections:
                kw = conn.get('PowerKW') or 0
                if kw > max_kw:
                    max_kw = kw
                ct = conn.get('ConnectionType', {})
                if ct and ct.get('Title'):
                    connector_types.add(ct['Title'])

            if max_kw < MIN_KW:
                skipped += 1
                continue

            name = addr.get('Title', 'Unknown Charger')
            operator_info = item.get('OperatorInfo') or {}
            operator = operator_info.get('Title', 'Unknown Operator')
            status_type = item.get('StatusType') or {}
            status = status_type.get('Title', 'Unknown')

            feature = {
                "type": "Feature",
                "properties": {
                    "name": name,
                    "operator": operator,
                    "power_kw": round(max_kw, 1),
                    "connectors": ', '.join(sorted(connector_types)),
                    "status": status,
                    "type": "EV Rapid"
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(lon, 6), round(lat, 6)]
                }
            }
            geojson['features'].append(feature)

        except Exception as e:
            skipped += 1
            continue

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(geojson, f)

    print(f"  ⏭️ Skipped {skipped} invalid records")
    print(f"🎉 Successfully saved {len(geojson['features'])} EV rapid chargers!")

if __name__ == "__main__":
    fetch_ev_chargers()
