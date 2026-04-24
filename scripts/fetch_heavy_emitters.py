import requests
import json
import time
import math
import sys

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OUTPUT_GEOJSON = "heaviest_emitters.geojson"
MIN_EXPECTED_FEATURES = 50
HEADERS = {"User-Agent": "GlobalGrid2050-Pipeline/1.0 (https://globalgrid2050.com)"}


def fetch_overpass_data(query):
    for attempt in range(3):
        try:
            print(f"  -> Requesting data from Overpass (attempt {attempt + 1})...")
            response = requests.post(
                OVERPASS_URL,
                data={"data": query},
                headers=HEADERS,
                timeout=300,
            )

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


def classify_emitter(tags):
    """
    Map OSM tags to an emitter category.
    Returns (category, emission_intensity) or None to skip.
    Emission intensity is a rough relative scale: higher = more CO2-intensive.
    """
    industrial = tags.get("industrial", "")
    man_made = tags.get("man_made", "")
    power = tags.get("power", "")
    plant_source = tags.get("plant:source", "").lower()
    product = tags.get("product", "").lower()
    works = tags.get("works", "").lower()
    name = tags.get("name", "").lower()

    # Fossil fuel power plants — highest emitters
    if power == "plant":
        if any(s in plant_source for s in ("coal", "oil")):
            return "power_plant_fossil", 10
        if "gas" in plant_source:
            return "power_plant_gas", 7
        if any(s in plant_source for s in ("biomass", "waste", "biogas")):
            return "power_plant_biomass_waste", 4
        # Unknown source — still map it
        return "power_plant_other", 3

    # Steel / iron / EAF — very high process emissions
    if ("steel" in industrial or "steel" in works or "steel" in product or
            industrial in ("iron_works", "rolling_mill") or
            "blast furnace" in name or "steel" in name):
        return "steel_ironworks", 9

    # Cement / lime kilns — very high process CO2 (calcination)
    if ("cement" in industrial or "cement" in works or "cement" in product or
            "lime" in product or industrial == "quarry"):
        return "cement_lime", 8

    # Aluminium smelters / electrolysis — very high electrical + process emissions
    if ("aluminium" in industrial or "aluminium" in works or "aluminium" in product or
            "aluminum" in works or "smelter" in industrial or "electrolysis" in works):
        return "smelter_electrolysis", 8

    # Oil refineries and petrochemical plants
    if (industrial in ("oil", "refinery", "petrochemical") or
            "refinery" in works or "petrochemical" in works or
            "refinery" in name):
        return "refinery_petrochemical", 8

    # Chemical works
    if ("chemical" in industrial or "chemical" in works or
            industrial == "chemical"):
        return "chemical_works", 6

    # Glass and ceramics — high-temperature kilns
    if ("glass" in industrial or "glass" in works or
            "ceramic" in works or industrial == "brickyard"):
        return "glass_ceramics", 5

    # Paper and pulp mills
    if industrial == "paper_mill" or "paper" in works or "pulp" in works:
        return "paper_pulp", 4

    # Waste-to-energy / incineration
    if (man_made in ("waste_incinerator",) or
            industrial == "waste" or "incinerator" in name or
            "waste" in plant_source):
        return "waste_incineration", 5

    # Generic heavy industry — works with no specific classification
    if man_made == "works" and (industrial or product or works):
        return "heavy_industry", 3

    return None


def process_osm_data(osm_data, geojson_features, seen):
    if not osm_data:
        return

    elements = osm_data.get("elements", [])
    skipped_no_coords = 0
    skipped_unclassified = 0

    for element in elements:
        tags = element.get("tags", {})
        if not tags:
            continue

        result = classify_emitter(tags)
        if result is None:
            skipped_unclassified += 1
            continue

        category, intensity = result

        lat = element.get("lat")
        lon = element.get("lon")
        if "center" in element:
            lat = element["center"].get("lat")
            lon = element["center"].get("lon")

        if lat is None or lon is None:
            skipped_no_coords += 1
            continue

        # Calculate area from bounding box
        area_ha = 0.0
        bounds = element.get("bounds")
        if bounds:
            minlat, minlon = bounds["minlat"], bounds["minlon"]
            maxlat, maxlon = bounds["maxlat"], bounds["maxlon"]
            lat_dist = (maxlat - minlat) * 111000
            lon_dist = (maxlon - minlon) * 111000 * math.cos(math.radians((maxlat + minlat) / 2))
            area_ha = round((lat_dist * lon_dist) / 10000, 1)

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

        # Emission proxy score: intensity * log(area+1) — larger high-intensity sites score highest
        emission_score = round(intensity * math.log1p(area_ha), 2)

        feature = {
            "type": "Feature",
            "properties": {
                "name": name,
                "operator": operator if operator else "Unknown",
                "category": category,
                "emission_intensity": intensity,
                "area_ha": area_ha,
                "emission_score": emission_score,
                "plant_source": tags.get("plant:source", ""),
                "osm_type": element.get("type"),
                "osm_id": element.get("id"),
            },
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat],
            },
        }
        geojson_features.append(feature)

    print(
        f"  🔍 Kept {len(geojson_features)} features "
        f"(skipped: {skipped_no_coords} no coords, {skipped_unclassified} unclassified)."
    )


def fetch_heavy_emitters():
    print("🚀 Fetching UK heavy industrial emitters...")

    geojson = {"type": "FeatureCollection", "features": []}
    seen = set()

    # UK bounding box: South, West, North, East
    bbox = "49.8,-8.5,60.9,1.8"

    query = f"""
    [out:json][timeout:300];
    (
      // Fossil fuel and thermal power plants
      nwr["power"="plant"]({bbox});

      // Steel, iron and metalworks
      nwr["industrial"~"steel|iron|smelter|rolling_mill|iron_works"]({bbox});
      nwr["man_made"="works"]["product"~"steel|iron|aluminium|aluminum"]({bbox});
      nwr["works"~"steel|aluminium"]({bbox});

      // Cement, lime and quarry operations
      nwr["industrial"~"cement|lime|quarry"]({bbox});
      nwr["man_made"="works"]["product"~"cement|lime"]({bbox});

      // Oil refineries and petrochemical plants
      nwr["industrial"~"oil|refinery|petrochemical"]({bbox});
      nwr["man_made"="works"]["works"~"refinery|petrochemical"]({bbox});

      // Chemical works
      nwr["industrial"="chemical"]({bbox});

      // Glass, ceramics, brickworks
      nwr["industrial"~"glass|brickyard|ceramics"]({bbox});

      // Paper and pulp mills
      nwr["industrial"="paper_mill"]({bbox});

      // Waste incineration
      nwr["man_made"="waste_incinerator"]({bbox});
      nwr["industrial"="waste"]({bbox});
    );
    out tags center bb;
    """

    data = fetch_overpass_data(query)
    if data is None:
        print("❌ Overpass returned nothing. Refusing to overwrite existing file.")
        sys.exit(1)

    process_osm_data(data, geojson["features"], seen)

    # Sort by emission score descending — highest-impact sites first
    geojson["features"].sort(
        key=lambda f: f["properties"]["emission_score"], reverse=True
    )

    count = len(geojson["features"])
    if count < MIN_EXPECTED_FEATURES:
        print(
            f"❌ Only {count} features (expected >= {MIN_EXPECTED_FEATURES}). "
            f"Refusing to overwrite. Investigate query or API."
        )
        sys.exit(1)

    with open(OUTPUT_GEOJSON, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)

    from collections import Counter
    cats = Counter(f["properties"]["category"] for f in geojson["features"])
    print(f"\n🎉 Saved {count} heavy emitter sites to {OUTPUT_GEOJSON}")
    print("   Breakdown by category:")
    for cat, n in cats.most_common():
        print(f"     {cat}: {n}")

    print("\n   Top 10 by emission score:")
    for f in geojson["features"][:10]:
        p = f["properties"]
        print(
            f"     {p['emission_score']:>7.2f}  intensity={p['emission_intensity']}  "
            f"{p['category']:<30s}  {p['name'][:50]}"
        )


if __name__ == "__main__":
    fetch_heavy_emitters()
