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
