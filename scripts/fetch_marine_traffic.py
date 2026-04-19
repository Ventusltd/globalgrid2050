import requests
import json
import math
import os
import sys
import time

# Calculate the absolute path of the repository root
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Global marine traffic infrastructure: shipping lanes + anchorages
# Shipping lanes = Traffic Separation Schemes (TSS), fairways, recommended tracks
# Anchorages = designated vessel holding areas (hard constraint for subsea cables / windfarm export routes)

OVERPASS_QUERY = """[out:json][timeout:900][maxsize:2000000000];
(
  nwr["seamark:type"="separation_lane"];
  nwr["seamark:type"="separation_line"];
  nwr["seamark:type"="separation_zone"];
  nwr["seamark:type"="separation_boundary"];
  nwr["seamark:type"="separation_crossing"];
  nwr["seamark:type"="separation_roundabout"];
  nwr["seamark:type"="fairway"];
  nwr["seamark:type"="recommended_track"];
  nwr["seamark:type"="deep_water_route"];
  nwr["seamark:type"="two_way_route"];
  nwr["seamark:type"="anchorage"];
  nwr["seamark:type"="anchor_berth"];
);
out geom;"""

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1-a))

def classify_feature(seamark_type):
    """Classify into Ventus constraint taxonomy.
    Shipping lanes = corridor intelligence (cyan/white in SCADA UI).
    Anchorages = hard constraint (red/magenta in SCADA UI).
    """
    lane_types = {
        'separation_lane', 'separation_line', 'separation_zone',
        'separation_boundary', 'separation_crossing', 'separation_roundabout',
        'fairway', 'recommended_track', 'deep_water_route', 'two_way_route'
    }
    anchor_types = {'anchorage', 'anchor_berth'}

    if seamark_type in lane_types:
        return {
            'category': 'Shipping Lane',
            'constraint_type': 'corridor_intelligence',
            'severity': 'soft'
        }
    if seamark_type in anchor_types:
        return {
            'category': 'Anchorage',
            'constraint_type': 'hard_constraint',
            'severity': 'hard'
        }
    return {
        'category': 'Unclassified Marine',
        'constraint_type': 'reference',
        'severity': 'soft'
    }

def fetch_marine():
    print("Initiating global marine traffic extraction from Overpass API...")
    headers = {'User-Agent': 'GlobalGrid2050-Pipeline/5.1'}

    for attempt in range(3):
        try:
            response = requests.post(
                OVERPASS_URL,
                data={'data': OVERPASS_QUERY},
                headers=headers,
                timeout=900
            )

            if response.status_code == 200:
                print("SUCCESS: Data downloaded from Overpass!")
                return response.json()
            elif response.status_code == 429:
                print(f"WARNING: API Rate Limited (429). Retrying in 60s... (Attempt {attempt+1}/3)")
                time.sleep(60)
            else:
                print(f"OVERPASS API ERROR [{response.status_code}]:\n{response.text[:500]}")
                sys.exit(1)

        except requests.exceptions.RequestException as e:
            print(f"CRITICAL: Failed to fetch data: {e}")
            if attempt == 2:
                sys.exit(1)
            print("Retrying in 30 seconds...")
            time.sleep(30)

def build_geometry(el):
    """Build GeoJSON geometry from OSM element. Returns (geometry, length_m, area_ha)."""
    etype = el.get('type')

    if etype == 'node':
        lon, lat = el.get('lon'), el.get('lat')
        if lon is None or lat is None:
            return None, 0.0, 0.0
        return {"type": "Point", "coordinates": [lon, lat]}, 0.0, 0.0

    if etype == 'way' and 'geometry' in el:
        coords = [[n['lon'], n['lat']] for n in el['geometry']]
        if len(coords) < 2:
            return None, 0.0, 0.0

        # Geodesic length via Haversine
        length_m = 0.0
        for i in range(len(coords) - 1):
            length_m += haversine_distance(coords[i][1], coords[i][0],
                                           coords[i+1][1], coords[i+1][0])

        # Closed way = polygon (anchorage area), else linestring (lane)
        is_closed = coords[0] == coords[-1] and len(coords) >= 4
        if is_closed:
            # Shoelace area in planar projection, corrected by latitude cosine
            mean_lat = sum(c[1] for c in coords) / len(coords)
            lat_m = 111320.0
            lon_m = 111320.0 * math.cos(math.radians(mean_lat))
            area_m2 = 0.0
            for i in range(len(coords) - 1):
                x1, y1 = coords[i][0] * lon_m, coords[i][1] * lat_m
                x2, y2 = coords[i+1][0] * lon_m, coords[i+1][1] * lat_m
                area_m2 += (x1 * y2) - (x2 * y1)
            area_ha = abs(area_m2) / 2.0 / 10000.0
            return {"type": "Polygon", "coordinates": [coords]}, length_m, area_ha
        return {"type": "LineString", "coordinates": coords}, length_m, 0.0

    if etype == 'relation' and 'members' in el:
        # Multi-part anchorage or separation scheme — emit MultiLineString of member ways
        lines = []
        total_len = 0.0
        for m in el['members']:
            if m.get('type') == 'way' and 'geometry' in m:
                coords = [[n['lon'], n['lat']] for n in m['geometry']]
                if len(coords) >= 2:
                    lines.append(coords)
                    for i in range(len(coords) - 1):
                        total_len += haversine_distance(coords[i][1], coords[i][0],
                                                       coords[i+1][1], coords[i+1][0])
        if not lines:
            return None, 0.0, 0.0
        return {"type": "MultiLineString", "coordinates": lines}, total_len, 0.0

    return None, 0.0, 0.0

def convert_to_geojson(osm_data):
    features = []
    elements = osm_data.get('elements', [])
    print(f"Processing {len(elements)} marine elements with geodesic metre calculations...")

    # Deduplicate by osm_id + type (relations can re-reference ways)
    seen = set()
    dropped = 0

    for el in elements:
        key = (el.get('type'), el.get('id'))
        if key in seen:
            dropped += 1
            continue
        seen.add(key)

        geometry, length_m, area_ha = build_geometry(el)
        if geometry is None:
            dropped += 1
            continue

        tags = el.get('tags', {})
        seamark_type = tags.get('seamark:type', 'unknown')
        classification = classify_feature(seamark_type)

        name = (tags.get('name')
                or tags.get('name:en')
                or tags.get('seamark:name')
                or f"Unnamed {classification['category']}")

        props = {
            "name": name,
            "category": classification['category'],
            "seamark_type": seamark_type,
            "constraint_type": classification['constraint_type'],
            "severity": classification['severity'],
            "confidence_level": "reference",
            "source_origin": "OpenStreetMap/Overpass",
            "osm_type": el.get('type'),
            "osm_id": el.get('id')
        }

        if length_m > 0:
            props["length_m"] = round(length_m, 1)
            props["length_km"] = round(length_m / 1000.0, 2)
        if area_ha > 0:
            props["area_ha"] = round(area_ha, 1)

        features.append({
            "type": "Feature",
            "geometry": geometry,
            "properties": props
        })

    print(f"Emitted {len(features)} features. Dropped {dropped} (duplicate or geometry-less).")
    return {"type": "FeatureCollection", "features": features}

def save_geojson(geojson_data, filename="marine_traffic.geojson"):
    filepath = os.path.join(REPO_ROOT, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(geojson_data, f, separators=(',', ':'))

    lanes = sum(1 for f in geojson_data['features']
                if f['properties']['category'] == 'Shipping Lane')
    anchors = sum(1 for f in geojson_data['features']
                  if f['properties']['category'] == 'Anchorage')
    print(f"SUCCESS: Wrote {len(geojson_data['features'])} features to {filepath}")
    print(f"         Shipping Lanes: {lanes} | Anchorages: {anchors}")

if __name__ == "__main__":
    raw_data = fetch_marine()
    if raw_data:
        geojson = convert_to_geojson(raw_data)
        save_geojson(geojson)
