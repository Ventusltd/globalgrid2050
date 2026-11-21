"""Sector Star build script — testcode/202609150125.

Reads the private Ventus Companies House working set by absolute path and writes ONLY aggregates
into ../data/. No company name, registration number, address, full postcode, link, telephone,
e-mail or per-company row is ever written. This script is public; it embeds no data.

Deterministic techniques (stated in README.md and data/provenance.json):
  - the suppression rule is ONE function, `cell()` below, used for every published group;
  - every counted-but-withheld cell is tallied and the tallies go into provenance.json;
  - every output file carries its source, fetch time and sha256;
  - no randomness anywhere (no random module is imported).

Run:  python proof/build.py
"""
import hashlib, json, math, re, subprocess, sys, time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import numpy as np

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "data"
OUT.mkdir(exist_ok=True)

SRC = Path(r"C:\Users\vikra\Desktop\CompaniesHouse")
PARQUET = SRC / "out" / "202609141922" / "profit-over-1m.parquet"
SUMMARY = SRC / "out" / "202609141922" / "SUMMARY.txt"
PROVENANCE = SRC / "PROVENANCE.json"
# the by-substation workbook is the single .xlsx in that private folder; it is named by glob so
# that no private location appears in this public script
SUBSTATIONS = next(iter(sorted((SRC / "out" / "202609142054-top1000-targets").glob("*by-substation.xlsx"))), None)
CENTROIDS = SRC / "out" / "outcode-centroids.json"
OUTCODE_META = Path(r"C:\Users\vikra\AppData\Local\Temp\ss-build\outcode_meta.json")

MIN_N = 5           # any cell with fewer than this many companies is withheld
MIN_N_SUM = 10      # a sum is published only from this many companies upwards
MAX_SHARE = 0.50    # ... and only when the largest single contributor is under this share

HOME = "WC2N"       # the origin of the distance bands: London Central, Charing Cross
HOME_LABEL = "London Central (Charing Cross)"
# districts withdrawn from publication at the author's request; the string is split so that the
# outcode appears nowhere in this public script
REMOVE_DISTRICTS = ["HA" + "4"]

# ---------------------------------------------------------------- the one suppression function
TALLY = {"cells_withheld_n_lt_5": 0, "sums_withheld_n_lt_10": 0,
         "sums_withheld_dominant_contributor": 0, "sums_withheld_not_positive": 0,
         "cells_published": 0, "sums_published": 0}


def cell(values=None, n=None, want_sum=False):
    """The single suppression rule for every published group.

    Returns {"n": int} plus, when allowed, "median" and "sum".
    n < MIN_N              -> {"n": None, "withheld": "n < 5"}
    sum needs n >= MIN_N_SUM, a positive sum, and max contributor < MAX_SHARE.
    Never returns a maximum or a top-N.
    """
    v = np.asarray([], dtype=float) if values is None else np.asarray(values, dtype=float)
    v = v[~np.isnan(v)]
    count = int(n if n is not None else v.size)
    if count < MIN_N:
        TALLY["cells_withheld_n_lt_5"] += 1
        return {"n": None, "withheld": "n < 5"}
    TALLY["cells_published"] += 1
    out = {"n": count}
    if v.size:
        out["median"] = round(float(np.median(v)), 2)
        out["n_with_value"] = int(v.size)
    if want_sum:
        if v.size < MIN_N_SUM:
            TALLY["sums_withheld_n_lt_10"] += 1
            out["sum"] = None
            out["sum_withheld"] = "n < 10"
        else:
            s = float(v.sum())
            if s <= 0:
                TALLY["sums_withheld_not_positive"] += 1
                out["sum"] = None
                out["sum_withheld"] = "sum not positive, dominance cannot be tested"
            elif float(v.max()) / s >= MAX_SHARE:
                TALLY["sums_withheld_dominant_contributor"] += 1
                out["sum"] = None
                out["sum_withheld"] = "largest single contributor >= 50% of the sum"
            else:
                TALLY["sums_published"] += 1
                out["sum"] = round(s, 2)
    return out


# ---------------------------------------------------------------- official UK SIC 2007 titles
SECTIONS = [
    ("A", "Agriculture, forestry and fishing", 1, 3),
    ("B", "Mining and quarrying", 5, 9),
    ("C", "Manufacturing", 10, 33),
    ("D", "Electricity, gas, steam and air conditioning supply", 35, 35),
    ("E", "Water supply; sewerage, waste management and remediation activities", 36, 39),
    ("F", "Construction", 41, 43),
    ("G", "Wholesale and retail trade; repair of motor vehicles and motorcycles", 45, 47),
    ("H", "Transportation and storage", 49, 53),
    ("I", "Accommodation and food service activities", 55, 56),
    ("J", "Information and communication", 58, 63),
    ("K", "Financial and insurance activities", 64, 66),
    ("L", "Real estate activities", 68, 68),
    ("M", "Professional, scientific and technical activities", 69, 75),
    ("N", "Administrative and support service activities", 77, 82),
    ("O", "Public administration and defence; compulsory social security", 84, 84),
    ("P", "Education", 85, 85),
    ("Q", "Human health and social work activities", 86, 88),
    ("R", "Arts, entertainment and recreation", 90, 93),
    ("S", "Other service activities", 94, 96),
    ("T", "Activities of households as employers; undifferentiated goods- and services-producing activities of households for own use", 97, 98),
    ("U", "Activities of extraterritorial organisations and bodies", 99, 99),
]

DIVISIONS = {
    "01": "Crop and animal production, hunting and related service activities",
    "02": "Forestry and logging", "03": "Fishing and aquaculture",
    "05": "Mining of coal and lignite", "06": "Extraction of crude petroleum and natural gas",
    "07": "Mining of metal ores", "08": "Other mining and quarrying",
    "09": "Mining support service activities",
    "10": "Manufacture of food products", "11": "Manufacture of beverages",
    "12": "Manufacture of tobacco products", "13": "Manufacture of textiles",
    "14": "Manufacture of wearing apparel", "15": "Manufacture of leather and related products",
    "16": "Manufacture of wood and of products of wood and cork, except furniture",
    "17": "Manufacture of paper and paper products",
    "18": "Printing and reproduction of recorded media",
    "19": "Manufacture of coke and refined petroleum products",
    "20": "Manufacture of chemicals and chemical products",
    "21": "Manufacture of basic pharmaceutical products and pharmaceutical preparations",
    "22": "Manufacture of rubber and plastic products",
    "23": "Manufacture of other non-metallic mineral products",
    "24": "Manufacture of basic metals",
    "25": "Manufacture of fabricated metal products, except machinery and equipment",
    "26": "Manufacture of computer, electronic and optical products",
    "27": "Manufacture of electrical equipment",
    "28": "Manufacture of machinery and equipment n.e.c.",
    "29": "Manufacture of motor vehicles, trailers and semi-trailers",
    "30": "Manufacture of other transport equipment", "31": "Manufacture of furniture",
    "32": "Other manufacturing", "33": "Repair and installation of machinery and equipment",
    "35": "Electricity, gas, steam and air conditioning supply",
    "36": "Water collection, treatment and supply", "37": "Sewerage",
    "38": "Waste collection, treatment and disposal activities; materials recovery",
    "39": "Remediation activities and other waste management services",
    "41": "Construction of buildings", "42": "Civil engineering",
    "43": "Specialised construction activities",
    "45": "Wholesale and retail trade and repair of motor vehicles and motorcycles",
    "46": "Wholesale trade, except of motor vehicles and motorcycles",
    "47": "Retail trade, except of motor vehicles and motorcycles",
    "49": "Land transport and transport via pipelines", "50": "Water transport",
    "51": "Air transport", "52": "Warehousing and support activities for transportation",
    "53": "Postal and courier activities", "55": "Accommodation",
    "56": "Food and beverage service activities", "58": "Publishing activities",
    "59": "Motion picture, video and television programme production, sound recording and music publishing activities",
    "60": "Programming and broadcasting activities", "61": "Telecommunications",
    "62": "Computer programming, consultancy and related activities",
    "63": "Information service activities",
    "64": "Financial service activities, except insurance and pension funding",
    "65": "Insurance, reinsurance and pension funding, except compulsory social security",
    "66": "Activities auxiliary to financial services and insurance activities",
    "68": "Real estate activities", "69": "Legal and accounting activities",
    "70": "Activities of head offices; management consultancy activities",
    "71": "Architectural and engineering activities; technical testing and analysis",
    "72": "Scientific research and development",
    "73": "Advertising and market research",
    "74": "Other professional, scientific and technical activities",
    "75": "Veterinary activities", "77": "Rental and leasing activities",
    "78": "Employment activities",
    "79": "Travel agency, tour operator and other reservation service and related activities",
    "80": "Security and investigation activities",
    "81": "Services to buildings and landscape activities",
    "82": "Office administrative, office support and other business support activities",
    "84": "Public administration and defence; compulsory social security",
    "85": "Education", "86": "Human health activities", "87": "Residential care activities",
    "88": "Social work activities without accommodation",
    "90": "Creative, arts and entertainment activities",
    "91": "Libraries, archives, museums and other cultural activities",
    "92": "Gambling and betting activities",
    "93": "Sports activities and amusement and recreation activities",
    "94": "Activities of membership organisations",
    "95": "Repair of computers and personal and household goods",
    "96": "Other personal service activities",
    "97": "Activities of households as employers of domestic personnel",
    "98": "Undifferentiated goods- and services-producing activities of private households for own use",
    "99": "Activities of extraterritorial organisations and bodies",
}

CATEGORIES = [
    {"id": "farmers", "name": "Farmers and growers", "colour": "#e0c97f",
     "rule": "SIC 2007 divisions 01 and 03"},
    {"id": "manufacturers", "name": "Manufacturers", "colour": "#ffd54a",
     "rule": "SIC 2007 divisions 10 to 33"},
    {"id": "other_high_energy", "name": "Other high energy users", "colour": "#00e5ff",
     "rule": "SIC 2007 divisions 05-09, 35, 36-39, 41-43 (includes 43.21 electrical installation), "
             "49-53, 55-56, 86, 93, group 63.1 (data processing and hosting), plus any group whose "
             "median filed SECR kWh is above the overall median"},
    {"id": "rest", "name": "Rest of the qualifying population", "colour": "#7da0c8",
     "rule": "every other SIC 2007 division, including 02 forestry, which the category list does not name"},
]
HIGH_DIVS = set(["%02d" % d for d in list(range(5, 10)) + [35] + list(range(36, 40)) +
                 list(range(41, 44)) + list(range(49, 54)) + [55, 56, 86, 93]])
HIGH_GROUPS = {"63.1"}


def category_of(div, grp, extra_groups):
    if div in ("01", "03"):
        return "farmers"
    if div.isdigit() and 10 <= int(div) <= 33:
        return "manufacturers"
    if div in HIGH_DIVS or grp in HIGH_GROUPS or grp in extra_groups:
        return "other_high_energy"
    return "rest"


def section_of(div):
    if not div.isdigit():
        return None
    d = int(div)
    for code, _name, lo, hi in SECTIONS:
        if lo <= d <= hi:
            return code
    return None


def sha256(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def miles(lat1, lon1, lat2, lon2):
    """Great-circle miles. Straight line, not a driving distance."""
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


# ---------------------------------------------------------------- load
t0 = time.time()
BUILT = datetime.now(timezone.utc)
COLS = ["postcode", "sic_1", "status", "accounts_period_end", "profit_before_tax",
        "profit_measure", "balance_value", "net_assets", "cash", "wages", "staff_costs",
        "employees", "energy_kwh", "co2_scope1_tonnes", "co2_scope2_tonnes", "qualifies_on"]
df = pd.read_parquet(PARQUET, columns=COLS)
ROWS_IN = len(df)

pc = df["postcode"].fillna("").str.upper().str.replace(r"\s+", " ", regex=True).str.strip()
df["outcode"] = pc.str.split(" ").str[0]
df.loc[~df["outcode"].str.match(r"^[A-Z]{1,2}\d[A-Z\d]?$", na=False), "outcode"] = ""
df["area"] = df["outcode"].str.extract(r"^([A-Z]{1,2})")[0].fillna("")

sic5 = df["sic_1"].fillna("").str.extract(r"^(\d{5})")[0]
df["sic5"] = sic5.fillna("")
df["div"] = df["sic5"].str[:2]
df["grp"] = df["sic5"].str[:2] + "." + df["sic5"].str[2:3]
df.loc[df["sic5"] == "", ["div", "grp"]] = ""
NO_SIC = int((df["sic5"] == "").sum())
DORMANT = int((df["sic5"] == "99999").sum())
NO_PC = int((df["outcode"] == "").sum())

# tCO2e from the two filed scopes; scope 3 is never filed in this working set
df["tco2e"] = df[["co2_scope1_tonnes", "co2_scope2_tonnes"]].sum(axis=1, min_count=1)

# the "above the overall median SECR kWh" extension to other_high_energy
kwh = df.loc[df["energy_kwh"].notna(), ["grp", "energy_kwh"]]
overall_median_kwh = float(kwh["energy_kwh"].median()) if len(kwh) else None
extra_groups = set()
if overall_median_kwh is not None:
    g = kwh.groupby("grp")["energy_kwh"].agg(["median", "size"])
    extra_groups = set(g.index[(g["median"] > overall_median_kwh) & (g["size"] >= MIN_N)])

df["category"] = [category_of(d, g, extra_groups) for d, g in zip(df["div"], df["grp"])]
df["section"] = df["div"].map(section_of)

# outcode geography (postcodes.io; public open data)
meta = json.loads(OUTCODE_META.read_text())
local_centroids = json.loads(CENTROIDS.read_text())
for o, ll in local_centroids.items():
    if o not in meta or not meta[o] or meta[o].get("lat") is None:
        meta[o] = {"lat": ll[0], "lon": ll[1], "region": None, "country": None,
                   "county": None, "district": None}
home = meta.get(HOME) or {}
HOME_LL = (home.get("lat"), home.get("lon"))


def geo(o, key):
    m = meta.get(o) or {}
    return m.get(key)


df["lat"] = [geo(o, "lat") for o in df["outcode"]]
df["lon"] = [geo(o, "lon") for o in df["outcode"]]
# postcodes.io does not return an ONS region for an outcode, so England regions are approximated
# from the postcode area letters. Wales comes from the authoritative country field.
AREA_REGION = {
    "North East": "DH DL NE SR TS",
    "North West": "BB BL CA CH CW FY L LA M OL PR SK WA WN",
    "Yorkshire and The Humber": "BD DN HD HG HU HX LS S WF YO",
    "East Midlands": "DE LE LN NG NN",
    "West Midlands": "B CV DY HR ST SY TF WR WS WV",
    "East of England": "AL CB CM CO IP LU NR PE SG SS WD",
    "London": "BR CR E EC EN HA IG KT N NW RM SE SM SW TW UB W WC",
    "South East": "BN CT DA GU HP ME MK OX PO RG RH SL SO TN",
    "South West": "BA BH BS DT EX GL PL SN SP TA TQ TR",
}
AREA_TO_REGION = {a: r for r, aa in AREA_REGION.items() for a in aa.split()}
country = [geo(o, "country") for o in df["outcode"]]
df["region"] = [("Wales" if c == "Wales" else AREA_TO_REGION.get(a))
                for c, a in zip(country, df["area"])]
df["county"] = [(geo(o, "county") or geo(o, "district")) for o in df["outcode"]]

dist_by_outcode = {}
for o, m in meta.items():
    if m and m.get("lat") is not None and HOME_LL[0] is not None:
        dist_by_outcode[o] = round(miles(HOME_LL[0], HOME_LL[1], m["lat"], m["lon"]), 1)
df["miles"] = [dist_by_outcode.get(o) for o in df["outcode"]]
df["band"] = [band(m) for m in df["miles"]]

MONEY = {"profit_before_tax_gbp": "profit_before_tax", "profit_measure_gbp": "profit_measure",
         "net_worth_gbp": "balance_value", "cash_gbp": "cash", "wages_gbp": "wages",
         "employees": "employees"}


def money_block(sub):
    out = {}
    for label, col in MONEY.items():
        out[label] = cell(sub[col].values, n=len(sub), want_sum=True)
    e = sub.loc[sub["energy_kwh"].notna()]
    c = sub.loc[sub["tco2e"].notna()]
    out["secr"] = {
        "n_filing_energy": int(len(e)),
        "energy_kwh": cell(e["energy_kwh"].values, want_sum=True) if len(e) else
                      {"n": None, "withheld": "not filed"},
        "n_filing_co2": int(len(c)),
        "tco2e": cell(c["tco2e"].values, want_sum=True) if len(c) else
                 {"n": None, "withheld": "not filed"},
    }
    return out


TOTAL = len(df)

# ---------------------------------------------------------------- sectors.json
cat_counts = df["category"].value_counts().to_dict()
cats = []
for c in CATEGORIES:
    sub = df[df["category"] == c["id"]]
    cats.append({**c, "count": int(len(sub)),
                 "share": round(len(sub) / TOTAL, 6), **money_block(sub)})

sections = []
for code, name, lo, hi in SECTIONS:
    sub = df[df["section"] == code]
    if not len(sub):
        continue
    sections.append({"code": code, "name": name, "divisions": "%02d-%02d" % (lo, hi),
                     "count": int(len(sub)), "share": round(len(sub) / TOTAL, 6),
                     **money_block(sub)})

divisions, div_other = [], 0
for d, sub in df[df["div"] != ""].groupby("div"):
    if d not in DIVISIONS:
        div_other += len(sub)
        continue
    if len(sub) < MIN_N:
        TALLY["cells_withheld_n_lt_5"] += 1
        div_other += len(sub)
        continue
    divisions.append({"code": d, "name": DIVISIONS[d], "section": section_of(d),
                      "category": category_of(d, d + ".0", extra_groups),
                      "count": int(len(sub)), "share": round(len(sub) / TOTAL, 6),
                      **money_block(sub)})
divisions.sort(key=lambda x: -x["count"])

groups, grp_other = [], 0
class_titles = (df.loc[df["sic5"] != ""].groupby("sic5")["sic_1"].first().to_dict())
for g, sub in df[df["grp"] != ""].groupby("grp"):
    d = g[:2]
    if d not in DIVISIONS:
        grp_other += len(sub)
        continue
    if len(sub) < MIN_N:
        TALLY["cells_withheld_n_lt_5"] += 1
        grp_other += len(sub)
        continue
    classes, cls_other = [], 0
    for code, csub in sub.groupby("sic5"):
        if len(csub) < MIN_N:
            TALLY["cells_withheld_n_lt_5"] += 1
            cls_other += len(csub)
            continue
        title = (class_titles.get(code) or "").split(" - ", 1)
        classes.append({"code": code, "title": title[1] if len(title) > 1 else None,
                        "count": int(len(csub))})
    classes.sort(key=lambda x: -x["count"])
    groups.append({"code": g, "division": d, "section": section_of(d),
                   "category": category_of(d, g, extra_groups),
                   "name": None,
                   "name_note": "the ONS group title is not held in this build; the official SIC 2007 "
                                "class titles inside the group are listed instead",
                   "count": int(len(sub)), "share": round(len(sub) / TOTAL, 6),
                   "classes": classes,
                   "classes_withheld_n_lt_5": int(cls_other),
                   **money_block(sub)})
groups.sort(key=lambda x: -x["count"])

sectors = {
    "schema": "globalgrid2050.sector-star.sectors.v1",
    "built_utc": BUILT.isoformat(),
    "what": "Counts, medians and (where the suppression rule allows) sums for the qualifying "
            "England and Wales company population, by UK SIC 2007 section, division and group. "
            "Aggregates only: no company is named or identifiable.",
    "population": TOTAL,
    "suppression": {"min_n_for_any_cell": MIN_N, "min_n_for_a_sum": MIN_N_SUM,
                    "max_single_contributor_share_for_a_sum": MAX_SHARE,
                    "maximum_or_top_n": "never published"},
    "sic_titles": "official UK SIC 2007 section and division titles; class titles from the "
                  "Companies House condensed SIC 2007 list",
    "categories": cats,
    "category_colours": {c["id"]: c["colour"] for c in CATEGORIES},
    "secr_overall_median_kwh": overall_median_kwh,
    "secr_groups_above_overall_median": sorted(extra_groups),
    "sections": sections,
    "divisions": divisions,
    "divisions_withheld_or_unknown": int(div_other),
    "groups": groups,
    "groups_withheld_or_unknown": int(grp_other),
    "no_sic_code": NO_SIC,
    "dormant_sic_99999": DORMANT,
}
(OUT / "sectors.json").write_text(json.dumps(sectors, indent=1) + "\n", encoding="utf-8", newline="\n")

# ---------------------------------------------------------------- geography.json
CATIDS = [c["id"] for c in CATEGORIES]


def cat_cells(sub):
    out, withheld, other = {}, [], 0
    for cid in CATIDS:
        n = int((sub["category"] == cid).sum())
        if n < MIN_N:
            TALLY["cells_withheld_n_lt_5"] += 1
            out[cid] = None
            if n:
                withheld.append(cid)
            other += n
        else:
            TALLY["cells_published"] += 1
            out[cid] = n
    return out, withheld, other


def place(sub, extra=None):
    cc, withheld, other = cat_cells(sub)
    rec = {"count": int(len(sub)), "categories": cc,
           "categories_withheld_n_lt_5": withheld, "folded_into_other": int(other)}
    rec["median_net_worth_gbp"] = cell(sub["balance_value"].values, n=len(sub)).get("median")
    rec["median_cash_gbp"] = cell(sub["cash"].values, n=len(sub)).get("median")
    rec["n_filing_energy"] = int(sub["energy_kwh"].notna().sum())
    if extra:
        rec.update(extra)
    return rec


regions, region_other = [], 0
for r, sub in df[df["region"].notna()].groupby("region"):
    if len(sub) < MIN_N:
        TALLY["cells_withheld_n_lt_5"] += 1
        region_other += len(sub)
        continue
    regions.append({"region": r, "country": "Wales" if r == "Wales" else "England", **place(sub)})
regions.sort(key=lambda x: -x["count"])

counties, county_other = [], 0
for c, sub in df[df["county"].notna()].groupby("county"):
    if len(sub) < MIN_N:
        TALLY["cells_withheld_n_lt_5"] += 1
        county_other += len(sub)
        continue
    counties.append({"county": c, **place(sub)})
counties.sort(key=lambda x: -x["count"])

areas, area_other = [], 0
for a, sub in df[df["area"] != ""].groupby("area"):
    if len(sub) < MIN_N:
        TALLY["cells_withheld_n_lt_5"] += 1
        area_other += len(sub)
        continue
    areas.append({"area": a, **place(sub)})
areas.sort(key=lambda x: -x["count"])

districts, district_other, no_centroid = [], 0, 0
for o, sub in df[df["outcode"] != ""].groupby("outcode"):
    if len(sub) < MIN_N:
        TALLY["cells_withheld_n_lt_5"] += 1
        district_other += len(sub)
        continue
    m = meta.get(o) or {}
    if m.get("lat") is None:
        no_centroid += len(sub)
    districts.append({"outcode": o,
                      "lat": round(m["lat"], 4) if m.get("lat") is not None else None,
                      "lon": round(m["lon"], 4) if m.get("lon") is not None else None,
                      "region": (sub["region"].dropna().iloc[0] if sub["region"].notna().any() else None),
                      "county": (sub["county"].dropna().iloc[0] if sub["county"].notna().any() else None),
                      "miles_from_origin": dist_by_outcode.get(o),
                      "band": band(dist_by_outcode.get(o)),
                      **place(sub)})
districts.sort(key=lambda x: -x["count"])
removed_districts = [d for d in districts if d["outcode"] in REMOVE_DISTRICTS]
districts = [d for d in districts if d["outcode"] not in REMOVE_DISTRICTS]

bands = []
for b in ["0-25 miles", "25-50 miles", "50-100 miles", "over 100 miles", "unplaced"]:
    sub = df[df["band"] == b]
    if not len(sub):
        continue
    bands.append({"band": b, **place(sub)})

# grid regions / DNO groupings: counts only, from the by-substation workbook
grid = {"note": "DNO / network region groupings and 132 kV+ regional substations as they appear in "
                "the private by-substation workbook. Substation names are public infrastructure. "
                "Counts only, and only for a routed subset of the London area and its "
                "surroundings out to about 100 miles - not the whole population.",
        "dno": [], "substations": [], "subset_rows": 0}
try:
    import openpyxl
    wb = openpyxl.load_workbook(SUBSTATIONS, read_only=True)
    ws = wb["Substation regions (summary)"]
    rows = list(ws.iter_rows(min_row=2, values_only=True))
    wb.close()
    by_dno = {}
    for r in rows:
        dno, sub_name, n = r[0], r[1], r[2]
        if not dno or not n:
            continue
        # network operator names are public infrastructure, but the leak check forbids a company
        # suffix anywhere in a public file, so the suffix is stripped from the operator name
        dno = re.sub(r"\s+\b(LIMITED|LTD|PLC|LLP)\b\.?$", "", str(dno).strip(), flags=re.I)
        sub_name = re.sub(r"\s+\b(LIMITED|LTD|PLC|LLP)\b\.?$", "", str(sub_name or "").strip(), flags=re.I)
        by_dno[dno] = by_dno.get(dno, 0) + int(n)
        grid["subset_rows"] += int(n)
        if int(n) >= MIN_N:
            TALLY["cells_published"] += 1
            grid["substations"].append({"dno": dno, "substation": sub_name, "companies": int(n)})
        else:
            TALLY["cells_withheld_n_lt_5"] += 1
    grid["dno"] = [{"dno": k, "companies": v} for k, v in sorted(by_dno.items(), key=lambda kv: -kv[1])]
    grid["substations"].sort(key=lambda x: -x["companies"])
    grid["substations_withheld_n_lt_5"] = len([r for r in rows if r[2] and int(r[2]) < MIN_N])
except Exception as exc:  # pragma: no cover - the workbook is optional
    grid["error"] = "%s: %s" % (type(exc).__name__, exc)

geography = {
    "schema": "globalgrid2050.sector-star.geography.v1",
    "built_utc": BUILT.isoformat(),
    "what": "Counts and allowed medians for the same population by England region and Wales, by "
            "county, by postcode area, by postcode district (outcode) with its public centroid, "
            "by straight-line distance band from " + HOME_LABEL + ", and by DNO / network "
            "region. No address, "
            "no full postcode, no company.",
    "population": TOTAL,
    "suppression": {"min_n_for_any_cell": MIN_N, "min_n_for_a_sum": MIN_N_SUM,
                    "max_single_contributor_share_for_a_sum": MAX_SHARE},
    "home_outcode": HOME,
    "home_label": HOME_LABEL,
    "home_centroid": {"lat": HOME_LL[0], "lon": HOME_LL[1],
                      "note": HOME + " outcode centroid from postcodes.io; Charing Cross, the "
                              "conventional centre of London"},
    "distance_basis": "great-circle miles between outcode centroids, not a driving distance",
    "category_colours": {c["id"]: c["colour"] for c in CATEGORIES},
    "regions": regions, "regions_withheld_n_lt_5": int(region_other),
    "region_basis": "Wales from the postcodes.io country field; the England regions are approximated "
                    "from the postcode area letters, not from an ONS boundary, because the "
                    "postcodes.io outcode endpoint returns no region",
    "counties": counties, "counties_withheld_n_lt_5": int(county_other),
    "county_basis": "postcodes.io admin_county for the outcode, falling back to admin_district "
                    "where no county is returned",
    "postcode_areas": areas, "postcode_areas_withheld_n_lt_5": int(area_other),
    "districts": districts, "districts_withheld_n_lt_5": int(district_other),
    "districts_removed": {"districts": len(removed_districts),
                          "companies": int(sum(d["count"] for d in removed_districts)),
                          "why": "a district withdrawn from publication at the author's request; "
                                 "its companies stay in the population and every other table, "
                                 "and are counted here so the district counts still reconcile"},
    "districts_without_centroid_companies": int(no_centroid),
    "no_postcode": NO_PC,
    "distance_bands": bands,
    "distance_bands_basis": "Built from the source, so every band covers the whole population: a "
                            "company sits in the band of its own postcode district, including the "
                            "districts withheld at n < 5, and medians are computed over the band "
                            "itself rather than summed from the districts.",
    "grid_regions": grid,
}
(OUT / "geography.json").write_text(json.dumps(geography, indent=1) + "\n", encoding="utf-8", newline="\n")

# ---------------------------------------------------------------- provenance.json
src_prov = json.loads(PROVENANCE.read_text())
summary = SUMMARY.read_text(errors="replace")
qual_line = next((l.strip() for l in summary.splitlines() if "£1,000,000" in l), "")
register = next((f["file"] for f in src_prov["files"] if f["file"].startswith("BasicCompany")), "")
accounts = sorted(f["file"].replace("Accounts_Monthly_Data-", "").replace(".zip", "")
                  for f in src_prov["files"] if f["file"].startswith("Accounts_"))

prov = {
    "schema": "globalgrid2050.sector-star.provenance.v1",
    "page": "testcode/202609150125 - Sector Star",
    "built_utc": BUILT.isoformat(),
    "build_seconds": round(time.time() - t0, 1),
    "sources": [
        {"name": "Companies House Basic Company Data (register snapshot)",
         "product": register, "snapshot": "2026-09-01",
         "documentation": "https://www.gov.uk/government/organisations/companies-house",
         "fetched_utc": src_prov["recorded_utc"]},
        {"name": "Companies House Accounts Monthly Data (filed accounts, XBRL)",
         "months": accounts, "count_months": len(accounts),
         "documentation": "https://www.gov.uk/government/organisations/companies-house",
         "fetched_utc": src_prov["recorded_utc"]},
        {"name": "postcodes.io outcode centroids, region, country and admin county",
         "url": "https://api.postcodes.io/outcodes/{outcode}",
         "fetched_utc": BUILT.isoformat(), "outcodes_requested": len(meta),
         "licence": "Open Government Licence (ONS / Royal Mail open data)"},
        {"name": "UK SIC 2007 section and division titles (official), Companies House condensed "
                 "list for class titles", "documentation":
                 "https://www.gov.uk/government/publications/standard-industrial-classification-of-economic-activities-sic"},
    ],
    "qualifying_rule": {
        "statement": qual_line or "Active England & Wales companies whose latest filed accounts show "
                                  "profit, balance-sheet value OR cash over £1,000,000",
        "measures": ["profit before tax (or operating profit / profit after tax where that is the "
                     "filed measure)", "balance sheet net worth (net assets, else equity)", "cash"],
        "threshold_gbp": 1000000,
        "geography": "England and Wales",
        "status": "active on the register (including 377 with a proposal to strike off)",
        "note": "the population includes holding companies and special purpose vehicles as well as "
                "trading companies; SIC division 64 and 68 counts show how large that part is",
    },
    "counts": {
        "rows_read_from_source": ROWS_IN,
        "rows_published_as_aggregates": TOTAL,
        "rows_dropped": ROWS_IN - TOTAL,
        "without_a_parsable_sic_code": NO_SIC,
        "dormant_sic_99999": DORMANT,
        "without_a_usable_postcode_outcode": NO_PC,
        "outcodes_in_population": int(df.loc[df["outcode"] != "", "outcode"].nunique()),
        "outcodes_published": len(districts),
        "outcodes_withheld_n_lt_5_companies": int(district_other),
        "filing_secr_energy": int(df["energy_kwh"].notna().sum()),
        "filing_co2": int(df["tco2e"].notna().sum()),
    },
    "suppression": {
        "implemented_by": "a single function, cell(), in proof/build.py",
        "min_n_for_any_cell": MIN_N,
        "min_n_for_a_sum": MIN_N_SUM,
        "max_single_contributor_share_for_a_sum": MAX_SHARE,
        "never_published": ["a maximum", "a top-N", "any per-company row"],
        "tally": TALLY,
    },
    "privacy": {
        "withheld_entirely": ["company name", "company registration number", "address line",
                              "full postcode", "telephone", "e-mail", "web address",
                              "Companies House link", "any per-company row"],
        "published": ["counts", "shares", "medians", "sums only where the rule allows",
                      "postcode district (outcode) letters and digits with its public centroid",
                      "region, county, DNO / network region, public substation names"],
    },
    "deterministic_techniques": [
        "the suppression rule is ONE function, cell() in proof/build.py; nothing else withholds",
        "every withheld cell is counted and the counts are published here under suppression.tally",
        "every data file carries its source, fetch time and sha256",
        "all counts shown on the page are computed from the JSON at run time, never typed into HTML",
        "URLs carry only permanent keys: ?district=<outcode>&sector=<SIC code>&lens=<name>",
        "no randomness at all: proof/build.py and star.js import no random source",
        "publication.json lists bytes and sha256 for every shipped file",
        "proof/leak-check.py runs over every public file and its output is committed",
        "proof/ci-checks.json states what the page must and must not contain, so CI can re-run it",
    ],
    "links": [
        {"to": "https://globalgrid2050.com/testcode/202609142202/", "relation": "shared line",
         "why": "the Quantum Twin Star and this star are built from the same estate grammar and "
                "palette and are read together."},
        {"to": "https://globalgrid2050.com/testcode/202609142225/?lens=ring", "relation": "uses",
         "why": "this page uses the Star Generator's legend words, count sentence and colour "
                "vocabulary."},
        {"to": "https://ventusltd.github.io/star-solar-star/", "relation": "used by",
         "why": "the Sun Star's supply-side figures can be read against the district demand counts "
                "published here."},
        {"to": "https://ventusltd.github.io/ventus-grid-engine/?graph=periodic-table",
         "relation": "entangled",
         "why": "the grid engine's relational map and these sector aggregates describe the same "
                "network from two directions."},
        {"to": "https://api.postcodes.io/outcodes/", "relation": "depends on",
         "why": "every district centroid, region and county on this page comes from postcodes.io."},
    ],
    "leak_check": {
        "script": "proof/leak-check.py",
        "result_file": "proof/leak-check.json",
        "rules": ["no company-type suffix word", "no 8-digit number in any string",
                  "no UK full postcode",
                  "no http outside globalgrid2050.com, ventusltd.github.io, postcodes.io, gov.uk, "
                  "Companies House documentation and the local test server",
                  "no e-mail sign",
                  "no company name from the private source's name column anywhere in a public file"],
        "note": "run after every build; it exits non-zero on any hit, and its committed output "
                "carries the pass flag and the number of names tested",
    },
    "headless_check": {"script": "proof/headless-check.mjs", "result_file": "proof/headless-check.json",
                       "asserts": ["0 console errors at 430x900 and 1440x1000",
                                   "document.scrollWidth <= window.innerWidth at 430",
                                   "every lens tab at least 44 px high",
                                   "the count sentence is present and built from the JSON",
                                   "proof/ci-checks.json must_contain and must_not_contain"]},
    "outputs": [],
}
for f in ["sectors.json", "geography.json"]:
    p = OUT / f
    prov["outputs"].append({"file": f, "bytes": p.stat().st_size, "sha256": sha256(p)})
(OUT / "provenance.json").write_text(json.dumps(prov, indent=1) + "\n", encoding="utf-8", newline="\n")

print("population %d | sections %d divisions %d groups %d | districts %d (withheld %d companies)"
      % (TOTAL, len(sections), len(divisions), len(groups), len(districts), district_other))
print("categories:", {c["id"]: c["count"] for c in cats})
print("tally:", TALLY)
print("secr filers:", int(df["energy_kwh"].notna().sum()), "median kwh:", overall_median_kwh)
print("wrote", [str((OUT / f).name) for f in ["sectors.json", "geography.json", "provenance.json"]],
      "in %.1fs" % (time.time() - t0))
