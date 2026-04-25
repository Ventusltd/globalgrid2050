import requests
import os
from pathlib import Path
from datetime import datetime, timezone

FILE = Path(__file__).parent.parent / "lv_ac_dc_price_estimator" / "index.md"


def get_market_data():
    data = {
        "gbp_usd": 1.3339,
        "eur_usd": 1.1586,
        "gbp_eur": 1.1510,
        "cu_usd": 12850.0,
        "al_usd": 3520.0,
        "used_fallback": False
    }

    try:
        fx = requests.get("https://open.er-api.com/v6/latest/GBP", timeout=15).json()
        data["gbp_usd"] = fx["rates"]["USD"]
        data["gbp_eur"] = fx["rates"]["EUR"]
        data["eur_usd"] = data["gbp_usd"] / data["gbp_eur"]
    except Exception as e:
        print(f"::warning::FX fetch failed, using fallback rates: {e}")
        data["used_fallback"] = True

    try:
        r = requests.get(
            "https://query1.finance.yahoo.com/v8/finance/chart/HG=F",
            timeout=10,
            headers={"User-Agent": "Mozilla/5.0"}
        )
        cu_lb = r.json()["chart"]["result"][0]["meta"]["regularMarketPrice"]
        data["cu_usd"] = cu_lb * 2204.62
    except Exception as e:
        print(f"::warning::Copper fetch failed, using fallback: {e}")
        data["used_fallback"] = True

    try:
        r = requests.get(
            "https://query1.finance.yahoo.com/v8/finance/chart/ALI=F",
            timeout=10,
            headers={"User-Agent": "Mozilla/5.0"}
        )
        data["al_usd"] = r.json()["chart"]["result"][0]["meta"]["regularMarketPrice"]
    except Exception as e:
        print(f"::warning::Aluminium fetch failed, using fallback: {e}")
        data["used_fallback"] = True

    return data


def main():
    d = get_market_data()
    ts_obj = datetime.now(timezone.utc)
    ts = ts_obj.strftime("%A %d %B %Y %H:%M UTC")

    if d["used_fallback"]:
        print("::warning::One or more prices are fallback values - verify API sources")

    # Currency Math
    cu_gbp = d["cu_usd"] / d["gbp_usd"]
    al_gbp = d["al_usd"] / d["gbp_usd"]
    
    cu_eur = cu_gbp * d["gbp_eur"]
    al_eur = al_gbp * d["gbp_eur"]

    # --- UPDATED: Cable Size Definitions (DC Strings Removed) ---
    LV_AL_CABLES = [95, 120, 150, 185, 240, 300, 400, 500, 630]
    LV_CU_CABLES = [16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400]

    # --- UPDATED: Calculation Engine (EUR added, Al changed to 20%) ---
    lv_al_rows = ""
    for mm2 in LV_AL_CABLES:
        weight = mm2 * 2.92
        metal_val = (weight / 1000) * al_gbp
        net_price_gbp = metal_val / 0.20  # Aluminium changed to 20%
        net_price_eur = net_price_gbp * d["gbp_eur"]
        lv_al_rows += f"| {mm2} | {weight:,.1f} | {metal_val:,.0f} | {net_price_gbp:,.0f} | {net_price_eur:,.0f} |\n"

    lv_cu_rows = ""
    for mm2 in LV_CU_CABLES:
        weight = mm2 * 9.6
        metal_val = (weight / 1000) * cu_gbp
        net_price_gbp = metal_val / 0.30  # Copper stays at 30%
        net_price_eur = net_price_gbp * d["gbp_eur"]
        lv_cu_rows += f"| {mm2} | {weight:,.1f} | {metal_val:,.0f} | {net_price_gbp:,.0f} | {net_price_eur:,.0f} |\n"

    # --- UPDATED: Markdown Generation ---
    md_content = f"""---
layout: page
title: LV AC and DC Distribution Cables Price Estimator
permalink: /lv_ac_dc_price_estimator/
---
# LV AC and DC Distribution Cables Price Estimator

Large scale price estimator for Low Voltage (LV) Alternating Current (AC) and Direct Current (DC) cables. These form the electrical backbone of Solar PV arrays, BESS installations, and standard distribution networks.

---

## Market Inputs

| Parameter | Value |
|---|---|
| LME Copper (USD) | USD {d['cu_usd']:,.0f} / tonne |
| LME Aluminium (USD) | USD {d['al_usd']:,.0f} / tonne |
| Exchange Rates | 1 GBP = {d['gbp_usd']:.4f} USD <br> 1 GBP = {d['gbp_eur']:.4f} EUR |
| Copper (GBP) | GBP {cu_gbp:,.0f} / tonne |
| Aluminium (GBP) | GBP {al_gbp:,.0f} / tonne |
| Copper (EUR) | EUR {cu_eur:,.0f} / tonne |
| Aluminium (EUR) | EUR {al_eur:,.0f} / tonne |
| Last Update | {ts} |

---

## Weight Formulas & Pricing Rule

- **Copper kg per km:** Area (mm²) × 9.6
- **Aluminium kg per km:** Area (mm²) × 2.92
- **Copper Net Price:** Metal value ÷ 0.30 (Assuming raw metal constitutes 30% of the final delivered cost)
- **Aluminium Net Price:** Metal value ÷ 0.20 (Assuming raw metal constitutes 20% of the final delivered cost)

---

## LV / DC Main Cables (Aluminium)
Typical single core aluminium distribution cables.

| Conductor (mm²) | Aluminium (kg/km) | Metal Value (GBP/km) | Net Price (GBP/km) | Net Price (EUR/km) |
|---|---|---|---|---|
{lv_al_rows}
---

## LV Distribution Cables (Copper)
Typical single core copper distribution cables.

| Conductor (mm²) | Copper (kg/km) | Metal Value (GBP/km) | Net Price (GBP/km) | Net Price (EUR/km) |
|---|---|---|---|---|
{lv_cu_rows}
---
## Notes
Estimates are DAP (Delivered at Place) for large-scale utility procurement. Values do not represent small-batch wholesale counter prices.
Final prices vary based on formal manufacturer negotiations and hedging contracts against copper, aluminium, polymers, energy costs, shipping, currency exchange rates and engineering sign off on appropriate materials selection.
Price is inflated slightly to counter procurement risks but nothing is guaranteed until contract signature and payment terms agreement with suppliers and appropriate insurance against force majeure.
"""

    FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(FILE, "w", encoding="utf-8") as f:
        f.write(md_content)

    print(f"✅ Successfully updated LV AC/DC Price Estimator at: {FILE}")


if __name__ == "__main__":
    main()
