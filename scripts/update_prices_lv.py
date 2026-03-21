import requests
import re
from pathlib import Path
from datetime import datetime, timezone

# Point to the Markdown file relative to the script location
FILE = Path(__file__).parent.parent / "lv_ac_dc_price_estimator" / "index.md"

def get_data():
    # Default Fallbacks (March 2026 Estimates)
    gbpusd, gbpeur, eurusd = 1.3341, 1.1529, 1.1586
    cu_usd, al_usd = 12850.0, 3520.0

    try:
        # Fetch FX Rates
        fx = requests.get("https://open.er-api.com/v6/latest/GBP", timeout=20).json()
        gbpusd = fx["rates"]["USD"]
        gbpeur = fx["rates"]["EUR"]
        eurusd = gbpusd / gbpeur # Derived EUR/USD rate

        # Fetch Metal Prices (USD per tonne)
        # Assuming API returns price per kg, multiplying by 1000 for tonne
        metals = requests.get("https://api.metals.live/v1/spot", timeout=20).json()
        for m in metals:
            if m.get("metal") == "copper":
                cu_usd = m.get("price") * 1000
            if m.get("metal") == "aluminum":
                al_usd = m.get("price") * 1000
    except Exception as e:
        print(f"Market Data Fallback used: {e}")

    return gbpusd, gbpeur, eurusd, cu_usd, al_usd

def main():
    if not FILE.exists():
        print(f"File not found: {FILE}")
        return

    gbpusd, gbpeur, eurusd, cu_usd, al_usd = get_data()
    timestamp = datetime.now(timezone.utc).strftime("%A %d %B %Y %H:%M UTC")
    
    # Calculate EUR values for the parameters table
    cu_eur = cu_usd / eurusd
    al_eur = al_usd / eurusd

    content = FILE.read_text(encoding="utf-8")

    # 1. Update the Markdown Parameter Table (Handling the USD/EUR combined strings)
    content = re.sub(r"\| LME Aluminium \(USD/EUR\) \| .*? \|", 
                     f"| LME Aluminium (USD/EUR) | **${al_usd:,.0f} / €{al_eur:,.0f} per tonne** |", content)
    
    content = re.sub(r"\| LME Copper \(USD/EUR\) \| .*? \|", 
                     f"| LME Copper (USD/EUR) | **${cu_usd:,.0f} / €{cu_eur:,.0f} per tonne** |", content)

    # 2. Update Forex Rates
    content = re.sub(r"\| GBP / USD Rate \| .*? \|", f"| GBP / USD Rate | **1 GBP = {gbpusd:.4f} USD** |", content)
    content = re.sub(r"\| EUR / USD Rate \| .*? \|", f"| EUR / USD Rate | **1 EUR = {eurusd:.4f} USD** |", content)
    content = re.sub(r"\| GBP / EUR Rate \| .*? \|", f"| GBP / EUR Rate | **1 GBP = {gbpeur:.4f} EUR** |", content)

    # 3. Update Timestamp
    content = re.sub(r"\| Last Market Update \| .*? \|", f"| Last Market Update | {timestamp} |", content)

    # 4. Update JavaScript Variables (For the interactive calculator if present)
    content = re.sub(r"let lme_cu_usd = [\d.]+;", f"let lme_cu_usd = {cu_usd:.2f};", content)
    content = re.sub(r"let lme_al_usd = [\d.]+;", f"let lme_al_usd = {al_usd:.2f};", content)
    content = re.sub(r"let gbp_usd = [\d.]+;", f"let gbp_usd = {gbpusd:.4f};", content)
    content = re.sub(r"let gbp_eur = [\d.]+;", f"let gbp_eur = {gbpeur:.4f};", content)
    content = re.sub(r"let eur_usd = [\d.]+;", f"let eur_usd = {eurusd:.4f};", content)

    FILE.write_text(content, encoding="utf-8")
    print(f"LV Estimator Parameters Updated Successfully at {timestamp}")

if __name__ == "__main__":
    main()
