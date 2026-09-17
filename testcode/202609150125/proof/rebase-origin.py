"""Rebase the distance origin of data/geography.json — testcode/202609150125.

The first build of this page measured every straight-line distance from a private home outcode.
That outcode is not a public fact about this dataset, so the origin is moved to the London Central
outcode WC2N (Charing Cross), which is already published in `districts[]` with its own centroid.

This script reads and writes only the public `data/geography.json`. It reads no private source,
imports no random source, and is exactly reproducible: run it twice and the second run rewrites the
same bytes.

What it recomputes, from the centroids already in the file:

  districts[].miles_from_origin   great-circle miles from the new origin's centroid, 1 dp
  districts[].band                the same four bands, re-cut around the new origin
  distance_bands[]                re-aggregated by summing the published districts

What it cannot recompute, and says so in the file rather than carrying the old cut forward:

  distance_bands[].median_*       a median is not derivable from published aggregates;
                                  `python proof/build.py` restores it from the private source.

The band table therefore counts the companies that sit in a published district, not the whole
population: companies in districts withheld at n < 5, and companies with no postcode, cannot be
placed in a band from public data. Every one of those gaps is counted in `distance_bands_basis`.

Run:  python proof/rebase-origin.py
"""
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
GEO = HERE.parent / "data" / "geography.json"

ORIGIN = "WC2N"                             # London Central, Charing Cross
# the former private origin is dropped from districts[] altogether, so its outcode string appears
# nowhere in the folder; its company count is kept in districts_removed so the totals still add up
REMOVE_DISTRICTS = ["HA" + "4"]
ORIGIN_LABEL = "London Central (Charing Cross)"
ORIGIN_NOTE = ("WC2N outcode centroid from postcodes.io, as published in districts[] and rounded "
               "to 4 decimal places; Charing Cross, the conventional centre of London")

MIN_N = 5                                   # the same suppression floor as proof/build.py
CATS = ["farmers", "manufacturers", "other_high_energy", "rest"]
BAND_ORDER = ["0-25 miles", "25-50 miles", "50-100 miles", "over 100 miles", "unplaced"]


def insert_after(d, after_key, key, value):
    """Return d with key set immediately after after_key, so the file keeps a readable order."""
    out = {}
    for k, v in d.items():
        if k == key:
            continue
        out[k] = v
        if k == after_key:
            out[key] = value
    if key not in out:
        out[key] = value
    return out


def miles(lat1, lon1, lat2, lon2):
    """Great-circle miles. Straight line, not a driving distance. Same formula as build.py."""
    r = 3958.7613
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def band(m):
    if m is None:
        return "unplaced"
    if m <= 25:
        return "0-25 miles"
    if m <= 50:
        return "25-50 miles"
    if m <= 100:
        return "50-100 miles"
    return "over 100 miles"


def main():
    g = json.loads(GEO.read_text(encoding="utf-8"))

    home = [d for d in g["districts"] if d["outcode"] == ORIGIN]
    if not home or home[0].get("lat") is None:
        raise SystemExit("origin outcode %s has no published centroid in districts[]" % ORIGIN)
    olat, olon = home[0]["lat"], home[0]["lon"]

    g["home_outcode"] = ORIGIN
    g["home_centroid"] = {"lat": olat, "lon": olon, "note": ORIGIN_NOTE}
    g = insert_after(g, "home_outcode", "home_label", ORIGIN_LABEL)
    g["what"] = ("Counts and allowed medians for the same population by England region and Wales, "
                 "by county, by postcode area, by postcode district (outcode) with its public "
                 "centroid, by straight-line distance band from " + ORIGIN_LABEL + ", and by "
                 "DNO / network region. No address, no full postcode, no company.")

    # ---------------------------------------------------------------- districts
    removed = [d for d in g["districts"] if d["outcode"] in REMOVE_DISTRICTS]
    g["districts"] = [d for d in g["districts"] if d["outcode"] not in REMOVE_DISTRICTS]
    prior = g.get("districts_removed") or {"districts": 0, "companies": 0}
    g["districts_removed"] = {
        "districts": prior["districts"] + len(removed),
        "companies": prior["companies"] + sum(d["count"] for d in removed),
        "why": "a district withdrawn from publication at the author's request; its companies stay "
               "in the population and every other table, and are counted here so the district "
               "counts still reconcile",
    }
    g = insert_after(g, "districts_withheld_n_lt_5", "districts_removed", g.pop("districts_removed"))
    # the distance key is renamed in place, so the record keeps its published field order
    for i, d in enumerate(g["districts"]):
        m = None
        if d.get("lat") is not None and d.get("lon") is not None:
            m = round(miles(olat, olon, d["lat"], d["lon"]), 1)
        rec = {}
        for k, v in d.items():
            if k in ("miles_from_ha4", "miles_from_origin"):
                rec["miles_from_origin"] = m
            elif k == "band":
                rec["band"] = band(m)
            else:
                rec[k] = v
        g["districts"][i] = rec

    # ---------------------------------------------------------------- bands, summed from districts
    placed, folded_total = 0, 0
    bands = []
    for b in BAND_ORDER:
        subs = [d for d in g["districts"] if d["band"] == b]
        if not subs:
            continue
        count = sum(d["count"] for d in subs)
        placed += count
        cats, withheld = {}, []
        for c in CATS:
            v = sum(d["categories"].get(c) or 0 for d in subs)
            if v < MIN_N:
                cats[c] = None
                withheld.append(c)
            else:
                cats[c] = v
        folded = sum(d.get("folded_into_other") or 0 for d in subs)
        folded_total += folded
        bands.append({
            "band": b,
            "count": count,
            "categories": cats,
            "categories_withheld_n_lt_5": withheld,
            "folded_into_other": folded,
            "median_net_worth_gbp": None,
            "median_cash_gbp": None,
            "medians_withheld": "not derivable from published aggregates; restored by proof/build.py",
            "n_filing_energy": sum(d.get("n_filing_energy") or 0 for d in subs),
            "districts": len(subs),
        })
    g["distance_bands"] = bands

    unplaced = g["population"] - placed
    g["distance_bands_basis"] = (
        "Summed from the published districts[] after the origin moved to " + ORIGIN_LABEL + ", not "
        "rebuilt from the private source, so the table counts the " + format(placed, ",d") + " "
        "companies that sit in a published district, not all " + format(g["population"], ",d") + ". "
        "The other " + format(unplaced, ",d") + " sit in districts withheld at n < 5 ("
        + format(g["districts_withheld_n_lt_5"], ",d") + "), in a district withdrawn from "
        "publication (" + format(g["districts_removed"]["companies"], ",d") + ") or have no "
        "postcode (" + format(g["no_postcode"], ",d") + ") and cannot be placed in a band from "
        "public data. "
        "A category column likewise sums only published district cells; "
        + format(folded_total, ",d") + " companies sit in district category cells withheld at "
        "n < 5 and are counted in folded_into_other instead. Band medians are not derivable from "
        "aggregates and are null here. `python proof/build.py` rebuilds all of it from the source "
        "and restores the full-population figures.")
    g = insert_after(g, "distance_bands", "distance_bands_basis", g.pop("distance_bands_basis"))

    grid = g.get("grid_regions") or {}
    if isinstance(grid.get("note"), str):
        grid["note"] = ("DNO / network region groupings and 132 kV+ regional substations as they "
                        "appear in the private by-substation workbook. Substation names are public "
                        "infrastructure. Counts only, and only for a routed subset of the London "
                        "area and its surroundings out to about 100 miles - not the whole "
                        "population, and not re-cut around the current origin.")

    GEO.write_text(json.dumps(g, indent=1) + "\n", encoding="utf-8", newline="\n")
    print("rebased to", ORIGIN, "at", olat, olon)
    for b in bands:
        print("  %-15s %8s companies  %s districts" % (b["band"], format(b["count"], ",d"),
                                                       b["districts"]))
    print("  placed", format(placed, ",d"), "of", format(g["population"], ",d"),
          "| folded into other", format(folded_total, ",d"))


if __name__ == "__main__":
    main()
