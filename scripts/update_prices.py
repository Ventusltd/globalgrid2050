import requests
import os
from pathlib import Path
from datetime import datetime, timezone

FILE = Path(__file__).parent.parent / "33kv_uk_dap_price_estimator" / "index.md"


def get_market_data():
    data = {
        "gbp_usd": 1.3339,
        "cu_usd": 12850.0,
        "al_usd": 3520.0,
        "used_fallback": False
    }

    try:
        fx = requests.get("https://open.er-api.com/v6/latest/GBP", timeout=15).json()
        data["gbp_usd"] = fx["rates"]["USD"]
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

    cu_gbp = d["cu_usd"] / d["gbp_usd"]
    al_gbp = d["al_usd"] / d["gbp_usd"]

    CABLES = [
        (120, 35), (150, 35), (185, 35), (240, 35), (300, 35),
        (400, 35), (500, 35), (630, 35),
        (800, 50), (1000, 50), (1200, 50), (1400, 50),
        (1600, 50), (1800, 50), (2000, 50), (2500, 50)
    ]

    cable_rows = ""
    for cond_mm2, cws_mm2 in CABLES:
        al_kg = cond_mm2 * 2.92
        cu_kg = cws_mm2 * 9.6
        al_val = (al_kg / 1000) * al_gbp
        cu_val = (cu_kg / 1000) * cu_gbp
        total_metal = al_val + cu_val
        net_price = total_metal / 0.3
        cable_rows += (
            f"| {cond_mm2:,} | {cws_mm2} | {al_kg:,.1f} | {cu_kg:,.1f} | "
            f"{al_val:,.0f} | {cu_val:,.0f} | {total_metal:,.0f} | {round(net_price):,} |\n"
        )

    md​​​​​​​​​​​​​​​​
