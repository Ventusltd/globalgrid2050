import requests
import json
import time
import math
import sys

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OUTPUT_GEOJSON = "heaviest_consumers.geojson"
MIN_EXPECTED_FEATURES = 100

# Minimum site area (hectares) to be considered private-wire viable.
# Below this, the roof/land is too small to host meaningful behind-the-meter generation
# or the load is too small to justify the connection engineering.
MIN_AREA_HA = 2.0

def fetch_overpass_data(query):
    for attempt in range(3):
        try:
            print(f"  -> Requesting data from Overpass (attempt {attempt + 1})...")
            response = requests.post(OVERPASS_URL, data={"data": query}, timeout=300)

            if response.status_code == 200:
                data = response.json()
                print(f"  ✅ Overpass returned {len(data.get('elements', []))} raw elements.")
                return data

            if response.status_code == 429:
                print("  ⚠️ Server busy, sleeping 60s...")
                time.sleep(60)
                continue

            print(f"  ⚠️ Error: {response.status_code}")
            print(f"  Response: {response.text[:500]}")
            time.sleep(10)

        except Exception as e:
            print(f"  ⚠️ Connection error: {e}, retrying...")
            time.sleep(10)

    return None


def estimate_load_mw(category, area_ha, tags):
    """
    Rough load proxies (MW continuous-equivalent) calibrated for private-wire viability.
    These are intentionally conservative order-of-magnitude estimates — refine with
    real half-hourly data once a site is shortlisted.
    """
    if category == "data_centre":
        # Data centres: ~5–15 MW per hectare of building footprint is typical hyperscale density.
        # Use 8 MW/ha as midpoint.
        return round(max(5, area_ha * 8), 1)

    if category == "smelter_electrolysis":
        # Aluminium/electrolysis: massive continuous load, 20+ MW per ha of process area.
        return round(max(20, area_ha * 20), 1)

    if category == "steel_furnace":
        # EAF steel: highly variable but large. 10 MW/ha process area.
        return round(max(10, area_ha * 10), 1)

    if category == "cold_storage_logistics":
        # Refrigerated warehousing: ~0.3–0.8 MW per ha. Ambient warehousing much lower
        # but roof area is the private-wire asset (solar host).
        refrigerated = any(k in tags.get("name", "").lower()
                           for k in ["cold", "frozen", "chill", "ocado", "iceland"])
        mw_per_ha = 0.6 if refrigerated else 0.15
        return round(max(0.5, area_ha * mw_per_ha), 1)

    if category == "hospital":
        # Major hospitals: 5–20 MW. Scale by area as rough proxy for size.
        return round(max(3, area_ha * 1.5), 1)

    if category == "university":
        # Large campuses: 2–15 MW. Area is a decent proxy for estate size.
        return round(max(2, area_ha * 0.8), 1)

    if category == "water_treatment":
        # Large STWs / water works: 1–10 MW continuous pumping load.
        return round(max(1, area_ha * 0.5), 1)

    if category == "cement_kiln":
        # Cement: ~5–15 MW electrical (thermal is gas, not addressable by private wire).
        return round(max(5, area_ha * 2), 1)

    if category == "paper_glass_ceramics":
        # Paper mills, glass works, brick/ceramics: 2–20 MW.
        return round(max(2, area_ha * 1.5), 1)

    if category == "chemical_works":
        return round(max(3, area_ha * 2), 1)

    if category == "airport":
        # Airports: major ones are 20–130 MW. Area-scale.
        return round(max(5, area_ha * 0.3), 1)

    if category == "large_industrial":
        # Generic large industrial estate / unknown works. Conservative.
        return round(max(1, area_ha * 0.4), 1)

    return round(max(0.5, area_ha * 0.3), 1)


def classify(tags):
    """Map OSM tags to a private-wire customer category, or None to skip."""
    man_made = tags.get("man_made", "")
    industrial = tags.get("industrial", "")
    works = tags.get("works", "").lower()
    product = tags.get("product", "").lower()
    plant_source = tags.get("plant:source", "")
    landuse = tags.get("landuse", "")
    amenity = tags.get("amenity", "")
    building = tags.get("building", "")
    telecom = tags.get("telecom", "")
    office = tags.get("office", "")
    power = tags.get("power", "")
    aeroway = tags.get("aeroway", "")
    name = tags.get("name", "").lower()

    # Exclude power plants — we don't want to private-wire a power station.
    if power == "plant" or plant_source:
        return None

    # Data centres (multiple tagging conventions in OSM)
    if (telecom == "data_center" or
        office == "data_center" or
        building == "data_center" or
        "data centre" in name or "data center" in name):
        return "data_centre"

    # Electrolysis / aluminium smelters
    if ("aluminium" in works or "aluminum" in works or
        "aluminium" in product or "smelter" in industrial or
        "electrolysis" in works):
        return "smelter_electrolysis"

    # Steel / EAF / furnaces
    if ("steel" in works or "steel" in industrial or
        "steel" in product or "furnace" in industrial or
        industrial == "rolling_mill"):
        return "steel_furnace"

    # Cement
    if "cement" in works or "cement" in industrial or "cement" in product:
        return "cement_kiln"

    # Chemical
    if ("chemical" in works or "chemical" in industrial or
        "petrochemical" in industrial or industrial == "oil"):
        return "chemical_works"

    # Paper / glass / ceramics
    if (industrial in ("paper_mill", "brickyard") or
        "paper" in works or "glass" in works or "brick" in works or
        "ceramic" in works):
        return "paper_glass_ceramics"

    # Cold storage / large logistics (roof-as-asset for solar PPA, BESS siting)
    if building in ("warehouse", "industrial") or landuse == "industrial":
        return "cold_storage_logistics"

    # Hospitals
    if amenity == "hospital":
        return "hospital"

    # Universities
    if amenity == "university":
        return "university"

    # Water treatment
    if man_made in ("water_works", "wastewater_plant", "pumping_station"):
        return "water_treatment"

    # Airports
    if aeroway == "aerodrome":
        return "airport"

    # Generic catch-all for large industrial works
    if man_made == "works" or industrial:
        return "large_industrial"

    return None


def process_osm_data(osm_data, geojson_features, seen):
    if not osm_data:
        return

    elements = osm_data.get("elements", [])
    skipped_small = 0
    skipped_no_coords = 0
    skipped_unclassified = 0

    for element in elements:
        tags = element.get("tags", {})
        if not tags:
            continue

        category = classify(tags)
        if category is None:
            skipped_unclassified += 1
            continue

        lat = element.get("lat")
        lon = element.get("lon")
        if "center" in element:
            lat = element["center"].get("lat")
            lon = element["center"].get("lon")

        if lat is None or lon is None:
            skipped_no_coords += 1
            continue

        # Calculate area from bounding box
        area_ha = 0
        bounds = element.get("bounds")
        if bounds:
            minlat, minlon = bounds["minlat"], bounds["minlon"]
            maxlat, maxlon = bounds["maxlat"], bounds["maxlon"]
            lat_dist = (maxlat - minlat) * 111000
            lon_dist = (maxlon - minlon) * 111000 * math.cos(math.radians((maxlat + minlat) / 2))
            area_ha = round((lat_dist * lon_dist) / 10000, 1)

        # Filter out sites too small for private-wire viability.
        # Hospitals/data centres are kept even if small because load density can be high.
        if category not in ("data_centre", "hospital") and area_ha < MIN_AREA_HA:
            skipped_small += 1
            continue

        name = tags.get("name", "").strip()
        operator = (tags.get("operator", "") or tags.get("brand", "")).strip()

        if not name:
            if operator:
                name = f"{operator} ({category.replace('_', ' ').title()})"
            else:
                name = f"Unnamed {category.replace('_', ' ').title()}"

        key = (round(lat, 4), round(lon, 4), name.lower())
        if key in seen:
            continue
        seen.add(key)

        load_mw = estimate_load_mw(category, area_ha, tags)

        # Private-wire viability score: combines load size with land/roof availability.
        # Higher = better candidate for co-located solar/wind/BESS.
        pw_score = round(load_mw * math.log1p(area_ha), 1)

        feature = {
            "type": "Feature",
            "properties": {
                "name": name,
                "operator": operator if operator else "Unknown",
                "category": category,
                "area_ha": area_ha,
                "load_mw_estimate": load_mw,
                "pw_score": pw_score,
                "osm_type": element.get("type"),
                "osm_id": element.get("id"),
            },
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat]
            }
        }
        geojson_features.append(feature)

    print(f"  🔍 Kept {len(geojson_features)} features "
          f"(skipped: {skipped_small} too small, {skipped_no_coords} no coords, "
          f"{skipped_unclassified} unclassified).")


def build_queries(bbox):
    """
    Return a list of targeted Overpass queries.
    Splitting by category keeps each query well within the 300 s timeout.
    The broad "industrial" wildcard is replaced with an explicit regex that
    only matches heavy-load categories, avoiding the millions of minor
    industrial=* tags that caused previous timeouts.
    """
    return [
        # ── Heavy process industry ──────────────────────────────────────────
        f"""
        [out:json][timeout:180];
        (
          nwr["man_made"="works"]({bbox});
          nwr["industrial"~"aluminium|aluminum|steel|cement|chemical|petrochemical|oil|
              paper_mill|glass|ceramics|smelter|foundry|rolling_mill|brickyard|copper|
              zinc|refinery|rubber|fertiliser|fertilizer|explosives|dye|paint|
              resin|plastics|pharmaceutical|distillery|brewery|sugar|
              lime|plasterboard|mineral_wool|insulation"]({bbox});
        );
        out tags center bb;
        """,
        # ── Data centres ───────────────────────────────────────────────────
        f"""
        [out:json][timeout:120];
        (
          nwr["telecom"="data_center"]({bbox});
          nwr["office"="data_center"]({bbox});
          nwr["building"="data_center"]({bbox});
        );
        out tags center bb;
        """,
        # ── Named logistics / cold storage ─────────────────────────────────
        # Require ["name"] to exclude the vast number of un-named sheds that
        # would otherwise cause a timeout.
        f"""
        [out:json][timeout:180];
        (
          way["building"="warehouse"]["name"]({bbox});
          way["landuse"="industrial"]["name"]({bbox});
        );
        out tags center bb;
        """,
        # ── Hospitals & universities ────────────────────────────────────────
        f"""
        [out:json][timeout:120];
        (
          nwr["amenity"="hospital"]["name"]({bbox});
          nwr["amenity"="university"]["name"]({bbox});
        );
        out tags center bb;
        """,
        # ── Water / wastewater & airports ──────────────────────────────────
        f"""
        [out:json][timeout:120];
        (
          nwr["man_made"="water_works"]({bbox});
          nwr["man_made"="wastewater_plant"]({bbox});
          nwr["man_made"="pumping_station"]["name"]({bbox});
          nwr["aeroway"="aerodrome"]["name"]({bbox});
        );
        out tags center bb;
        """,
    ]


def fetch_heavy_consumers():
    print("🚀 Fetching UK private-wire customer candidates...")

    geojson = {"type": "FeatureCollection", "features": []}
    seen = set()

    # UK bounding box: South, West, North, East
    bbox = "49.8,-8.5,60.9,1.8"

    queries = build_queries(bbox)
    for i, query in enumerate(queries, 1):
        print(f"\n📡 Query {i}/{len(queries)}...")
        data = fetch_overpass_data(query)
        if data is None:
            print(f"  ⚠️ Query {i} returned nothing — continuing with remaining queries.")
            time.sleep(15)
            continue
        process_osm_data(data, geojson["features"], seen)
        # Brief pause between queries to be polite to the Overpass server.
        if i < len(queries):
            time.sleep(10)

    # Sort by private-wire score descending — biggest opportunities first
    geojson["features"].sort(key=lambda f: f["properties"]["pw_score"], reverse=True)

    count = len(geojson["features"])
    if count < MIN_EXPECTED_FEATURES:
        print(f"❌ Only {count} features (expected >= {MIN_EXPECTED_FEATURES}). "
              f"Refusing to overwrite. Investigate query or API.")
        sys.exit(1)

    with open(OUTPUT_GEOJSON, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)

    # Summary by category
    from collections import Counter
    cats = Counter(f["properties"]["category"] for f in geojson["features"])
    print(f"\n🎉 Saved {count} private-wire candidates to {OUTPUT_GEOJSON}")
    print("   Breakdown by category:")
    for cat, n in cats.most_common():
        print(f"     {cat}: {n}")

    # Top 10 by score
    print("\n   Top 10 by private-wire score:")
    for f in geojson["features"][:10]:
        p = f["properties"]
        print(f"     {p['pw_score']:>7.1f}  {p['load_mw_estimate']:>6.1f} MW  "
              f"{p['category']:<25s}  {p['name'][:50]}")


if __name__ == "__main__":
    fetch_heavy_consumers()
