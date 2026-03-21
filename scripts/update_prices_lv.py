import requests
import re
from pathlib import Path
from datetime import datetime, timezone

# Point to the Markdown file
FILE = Path(__file__).parent.parent / "lv_ac_dc_price_estimator" / "index.md"

def get_data():
    gbpusd, gbpeur = 1.3341, 1.1529
    cu_usd, al_usd = 12022.0, 3329.0

    try:
        # Fetch FX Rates
        fx = requests.get("https://open.er-api.com/v6/latest/GBP", timeout=20).json()
        gbpusd = fx["rates"]["USD"]
        gbpeur = fx["rates"]["EUR"]

        # Fetch Metal Prices (USD per tonne)
        metals = requests.get("https://api.metals.live/v1/spot", timeout=20).json()
        for m in metals:
            if m.get("metal") == "copper":
                cu_usd = m.get("price") * 1000
            if m.get("metal") == "aluminum":
                al_usd = m.get("price") * 1000
    except Exception as e:
        print(f"Fallback used: {e}")

    return gbpusd, gbpeur, cu_usd, al_usd

def main():
    if not FILE.exists():
        print(f"File not found: {FILE}")
        return

    gbpusd, gbpeur, cu_usd, al_usd = get_data()
    timestamp = datetime.now(timezone.utc).strftime("%A %d %B %Y %H:%M UTC")
    
    content = FILE.read_text()

    # 1. Update the Markdown Table Text
    content = re.sub(r"\| LME Copper \(USD\) \| \$[\d,.]+ \/ tonne \|", f"| LME Copper (USD) | ${cu_usd:,.0f} / tonne |", content)
    content = re.sub(r"\| LME Aluminium \(USD\) \| \$[\d,.]+ \/ tonne \|", f"| LME Aluminium (USD) | ${al_usd:,.0f} / tonne |", content)
    content = re.sub(r"\| GBP/USD Rate \| 1 GBP = [\d.]+ USD \|", f"| GBP/USD Rate | 1 GBP = {gbpusd:.4f} USD |", content)
    content = re.sub(r"\| GBP/EUR Rate \| 1 GBP = [\d.]+ EUR \|", f"| GBP/EUR Rate | 1 GBP = {gbpeur:.4f} EUR |", content)
    content = re.sub(r"\| Last Update \| .*? \|", f"| Last Update | {timestamp} |", content)

    # 2. Update the hidden JavaScript Variables
    content = re.sub(r"let lme_cu_usd = [\d.]+;", f"let lme_cu_usd = {cu_usd:.2f};", content)
    content = re.sub(r"let lme_al_usd = [\d.]+;", f"let lme_al_usd = {al_usd:.2f};", content)
    content = re.sub(r"let gbp_usd = [\d.]+;", f"let gbp_usd = {gbpusd:.4f};", content)
    content = re.sub(r"let gbp_eur = [\d.]+;", f"let gbp_eur = {gbpeur:.4f};", content)

    # Save the file
    FILE.write_text(content)
    print(f"LV Table Updated Successfully at {timestamp}")

if __name__ == "__main__":
    main()
