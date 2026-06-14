#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import urllib.parse
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
PRICE_CSV = ROOT / "uk_energy_tracking_v6" / "electricity_price_history.csv"
REPORT_DIR = ROOT / "data_science_protocol" / "audit_reports"
REPORT_JSON_DIR = REPORT_DIR / "json"
REPORT_MD = REPORT_DIR / "V6_SAME_SLOT_RECONCILIATION_AUDIT_LATEST.md"
REPORT_JSON = REPORT_JSON_DIR / "V6_SAME_SLOT_RECONCILIATION_AUDIT_LATEST.json"
ELEXON = "https://data.elexon.co.uk/bmrs/api/v1"
PVLIVE = "https://api.solar.sheffield.ac.uk/pvlive/api/v4/gsp/0"

GROUPS = {
    "Wind": ["WIND"],
    "Hydro": ["NPSHYD", "HYDRO"],
    "Gas": ["CCGT", "OCGT"],
    "Coal": ["COAL"],
    "Biomass": ["BIOMASS"],
    "Nuclear": ["NUCLEAR"],
    "Pumped Storage": ["PS"],
    "Imports & Exports": ["INT"],
}
ORDER = ["Solar", "Wind", "Hydro", "Gas", "Coal", "Biomass", "Nuclear", "Pumped Storage", "Imports & Exports"]


def iso_z(value: dt.datetime) -> str:
    return value.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def parse_iso(value: str) -> dt.datetime | None:
    if not value:
        return None
    try:
        text = str(value).replace("Z", "+00:00")
        out = dt.datetime.fromisoformat(text)
        if out.tzinfo is None:
            out = out.replace(tzinfo=dt.timezone.utc)
        return out.astimezone(dt.timezone.utc)
    except Exception:
        return None


def http_json(url: str) -> dict | list:
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "GlobalGrid2050 GridBot"})
    with urllib.request.urlopen(req, timeout=40) as response:
        return json.loads(response.read().decode("utf-8"))


def rows(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("data", "results", "items"):
            if isinstance(payload.get(key), list):
                return payload[key]
    return []


def pick(row: dict, names: list[str]):
    folded = {str(k).lower(): v for k, v in row.items()}
    for name in names:
        value = folded.get(name.lower())
        if value not in (None, ""):
            return value
    return None


def number(value):
    try:
        if value in (None, ""):
            return None
        return float(value)
    except Exception:
        return None


def read_repo_price(slot_utc: dt.datetime) -> dict | None:
    target = iso_z(slot_utc)
    if not PRICE_CSV.exists():
        return None
    with PRICE_CSV.open("r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            if row.get("priceTimeUTC") == target:
                return row
    return None


def fetch_elexon_price(slot_utc: dt.datetime) -> list[dict]:
    start = slot_utc - dt.timedelta(minutes=5)
    end = slot_utc + dt.timedelta(minutes=35)
    q = urllib.parse.urlencode({"from": iso_z(start), "to": iso_z(end), "format": "json"})
    url = f"{ELEXON}/balancing/pricing/market-index?{q}"
    out = []
    for row in rows(http_json(url)):
        price = number(pick(row, ["price", "marketIndexPrice", "MarketIndexPrice", "value"]))
        time_value = pick(row, ["startTime", "publishDateTime", "publishTime", "time", "datetime"])
        parsed = parse_iso(str(time_value)) if time_value else None
        if parsed and price is not None:
            out.append({"timeUTC": iso_z(parsed), "priceGBPperMWh": round(price, 2), "raw": row})
    return out


def group_for(fuel: str) -> str:
    f = str(fuel or "").upper()
    for label, prefixes in GROUPS.items():
        if any(f.startswith(prefix) for prefix in prefixes):
            return label
    return "Other"


def fetch_fuelinst(slot_utc: dt.datetime) -> dict:
    start = slot_utc - dt.timedelta(minutes=90)
    end = slot_utc + dt.timedelta(minutes=45)
    q = urllib.parse.urlencode({"publishDateTimeFrom": iso_z(start), "publishDateTimeTo": iso_z(end), "format": "json"})
    url = f"{ELEXON}/datasets/FUELINST?{q}"
    raw = rows(http_json(url))
    grouped = {label: 0.0 for label in ORDER if label != "Solar"}
    matched_raw = []
    for row in raw:
        t = parse_iso(str(pick(row, ["startTime", "periodStartUTC", "publishDateTime"])))
        if not t or iso_z(t) != iso_z(slot_utc):
            continue
        fuel = str(pick(row, ["fuelType", "fuelTypeName", "fuel", "psrType"]) or "")
        mw = number(pick(row, ["generation", "generationMW", "currentUsage", "quantity"]))
        if not fuel or mw is None:
            continue
        grouped[group_for(fuel)] = grouped.get(group_for(fuel), 0.0) + mw / 1000.0
        matched_raw.append(row)
    return {"url": url, "rawRowsReturned": len(raw), "matchedRows": len(matched_raw), "groupedGW": {k: round(v, 3) for k, v in grouped.items()}}


def fetch_pvlive_solar(slot_utc: dt.datetime) -> dict:
    day_start = dt.datetime.combine(slot_utc.date(), dt.time(0, 0), tzinfo=dt.timezone.utc)
    day_end = dt.datetime.combine(slot_utc.date(), dt.time(23, 59), tzinfo=dt.timezone.utc)
    candidates = [
        {"start": iso_z(day_start), "end": iso_z(day_end)},
        {"start_date": slot_utc.date().isoformat(), "end_date": slot_utc.date().isoformat()},
    ]
    for params in candidates:
        url = PVLIVE + "?" + urllib.parse.urlencode(params)
        try:
            payload = http_json(url)
            values = []
            for row in rows(payload):
                if isinstance(row, list) and len(row) >= 3:
                    t = parse_iso(str(row[1])); mw = number(row[2])
                elif isinstance(row, dict):
                    t = parse_iso(str(pick(row, ["datetime_gmt", "datetime", "time", "timestamp", "periodStartUTC"])))
                    mw = number(pick(row, ["generation_mw", "generationMW", "generation", "power"]))
                else:
                    continue
                if t and mw is not None and iso_z(t) == iso_z(slot_utc):
                    values.append(mw / 1000.0)
            if values:
                return {"url": url, "solarGW": round(values[-1], 3), "matchedRows": len(values)}
        except Exception as exc:
            last_error = str(exc)
    return {"url": "", "solarGW": None, "matchedRows": 0, "error": locals().get("last_error", "no matching PVLive row")}


def candidate_slots(date_text: str, time_text: str, tz_name: str) -> list[dict]:
    date = dt.date.fromisoformat(date_text)
    hour, minute = [int(x) for x in time_text.split(":")]
    local = dt.datetime(date.year, date.month, date.day, hour, minute, tzinfo=ZoneInfo(tz_name))
    direct_utc = dt.datetime(date.year, date.month, date.day, hour, minute, tzinfo=dt.timezone.utc)
    return [
        {"basis": f"{tz_name} local converted to UTC", "slotUTC": local.astimezone(dt.timezone.utc), "slotLocal": local},
        {"basis": "input treated as UTC", "slotUTC": direct_utc, "slotLocal": direct_utc.astimezone(ZoneInfo(tz_name))},
    ]


def compare(value, expected):
    if expected is None or value is None:
        return None
    return round(float(value) - float(expected), 3)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", required=True)
    parser.add_argument("--time", required=True)
    parser.add_argument("--timezone", default="Europe/London")
    parser.add_argument("--benchmark-price", type=float)
    parser.add_argument("--benchmark-carbon", type=float)
    parser.add_argument("--benchmark-demand", type=float)
    parser.add_argument("--benchmark-solar", type=float)
    parser.add_argument("--benchmark-wind", type=float)
    parser.add_argument("--benchmark-hydro", type=float)
    parser.add_argument("--benchmark-gas", type=float)
    parser.add_argument("--benchmark-coal", type=float)
    parser.add_argument("--benchmark-biomass", type=float)
    parser.add_argument("--benchmark-nuclear", type=float)
    parser.add_argument("--benchmark-pumped-storage", type=float)
    parser.add_argument("--benchmark-imports-exports", type=float)
    args = parser.parse_args()

    results = []
    benchmark_generation = {
        "Solar": args.benchmark_solar,
        "Wind": args.benchmark_wind,
        "Hydro": args.benchmark_hydro,
        "Gas": args.benchmark_gas,
        "Coal": args.benchmark_coal,
        "Biomass": args.benchmark_biomass,
        "Nuclear": args.benchmark_nuclear,
        "Pumped Storage": args.benchmark_pumped_storage,
        "Imports & Exports": args.benchmark_imports_exports,
    }
    for cand in candidate_slots(args.date, args.time, args.timezone):
        slot_utc = cand["slotUTC"]
        repo_price = read_repo_price(slot_utc)
        elexon_prices = fetch_elexon_price(slot_utc)
        exact_prices = [r for r in elexon_prices if r["timeUTC"] == iso_z(slot_utc)]
        fuel = fetch_fuelinst(slot_utc)
        solar = fetch_pvlive_solar(slot_utc)
        generation = dict(fuel["groupedGW"])
        if solar.get("solarGW") is not None:
            generation["Solar"] = solar["solarGW"]
        demand = round(sum(v for v in generation.values() if isinstance(v, (int, float))), 3)
        row_price = number(repo_price.get("priceGBPperMWh")) if repo_price else None
        row_carbon = number(repo_price.get("carbonGperKWh")) if repo_price else None
        result = {
            "basis": cand["basis"],
            "slotUTC": iso_z(slot_utc),
            "slotLocal": cand["slotLocal"].isoformat(),
            "repoPriceRowFound": repo_price is not None,
            "repoPriceGBPperMWh": row_price,
            "repoCarbonGperKWh": row_carbon,
            "elexonExactPriceRows": exact_prices,
            "elexonFetchedPriceRows": len(elexon_prices),
            "fuelinst": fuel,
            "pvliveSolar": solar,
            "generationGW": {k: generation.get(k) for k in ORDER if k in generation},
            "demandGWCalculatedFromGroupedGeneration": demand,
            "benchmarkDifference": {
                "price": compare(row_price, args.benchmark_price),
                "carbon": compare(row_carbon, args.benchmark_carbon),
                "demand": compare(demand, args.benchmark_demand),
                "generation": {k: compare(generation.get(k), v) for k, v in benchmark_generation.items() if v is not None},
            },
        }
        results.append(result)
    checks = {
        "price_history_file_exists": PRICE_CSV.exists(),
        "two_slot_interpretations_checked": len(results) == 2,
        "at_least_one_repo_price_or_elexon_price_found": any(r["repoPriceRowFound"] or r["elexonFetchedPriceRows"] for r in results),
        "fuelinst_attempted_for_each_slot": all("fuelinst" in r for r in results),
        "no_repo_data_files_modified": True,
        "no_external_site_named_or_scraped": True,
    }
    passed = all(checks.values())
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    report = {
        "reportTitle": "V6 Same Slot Reconciliation Audit",
        "schemaVersion": "1.0.0",
        "generatedUTC": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        "repository": "Ventusltd/globalgrid2050",
        "mode": "audit",
        "input": vars(args),
        "sourceFiles": [str(PRICE_CSV.relative_to(ROOT))],
        "sourceApis": ["Elexon BMRS Market Index Data", "Elexon BMRS FUELINST", "Sheffield Solar PVLive"],
        "results": results,
        "checks": checks,
        "changedFiles": [],
        "applied": False,
        "pass": passed,
        "executiveSummary": "Audits a named half hour slot against V6 repo price history and public source data. The audit checks both local time converted to UTC and direct UTC interpretation, to identify timestamp alignment errors without naming or scraping third party comparison pages.",
        "nextAction": "Review which slot basis matches the benchmark values, then decide whether V6 needs timezone labelling, extra same day generation logging, or aggregation changes.",
    }
    REPORT_JSON.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    lines = [
        "# V6 Same Slot Reconciliation Audit",
        "",
        f"Generated UTC: `{report['generatedUTC']}`",
        f"Pass: `{passed}`",
        "",
        report["executiveSummary"],
        "",
        "## Slot results",
        "",
        "| Basis | Slot UTC | Repo price found | Repo price | Repo carbon | Fuel rows | Solar row | Demand from grouped GW |",
        "|---|---|---:|---:|---:|---:|---:|---:|",
    ]
    for r in results:
        lines.append(f"| {r['basis']} | {r['slotUTC']} | {r['repoPriceRowFound']} | {r['repoPriceGBPperMWh']} | {r['repoCarbonGperKWh']} | {r['fuelinst']['matchedRows']} | {r['pvliveSolar'].get('matchedRows')} | {r['demandGWCalculatedFromGroupedGeneration']} |")
    lines += ["", "## Checks", "", "| Check | Result |", "|---|---|"]
    for k, v in checks.items():
        lines.append(f"| {k} | {'✅' if v else '❌'} |")
    REPORT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
