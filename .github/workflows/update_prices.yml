import requests
from pathlib import Path
from datetime import datetime, timezone
import sys

# Targets the markdown file relative to this script's location
FILE = Path(__file__).parent.parent / "33kv_uk_dap_price_estimator" / "index.md"

def get_data():
    # Default fallbacks from your validated reference data
    gbpusd, cu_usd, al_usd = 1.3265, 12850, 3520
    
    try:
        # Fetch FX Rate (GBP to USD)
        fx_r = requests.get("https://open.er-api.com/v6/latest/GBP", timeout=20)
        fx_r.raise_for_status()
        gbpusd = fx_r.json()["rates"]["USD"]
        
        # Fetch Metal Prices (USD/Tonne)
        m_r = requests.get("https://api.metals.live/v1/spot", timeout=20)
        m_r.raise_for_status()
        m_data = m_r.json()
        
        # Safer extraction to prevent "Exit Code 1" if API structure changes
        for item in m_data:
            if item.get("metal") == "copper":
                cu_usd = item.get("price") * 1000
            if item.get("metal") == "aluminum":
                al_usd = item.get("price") * 1000
                
    except Exception as e:
        print(f"Warning: Live fetch failed, using fallbacks. Error: {e}")
        
    return gbpusd, cu_usd, al_usd

def main():
    gbpusd, cu_usd, al_usd = get_data()
    cu_gbp = cu_usd / gbpusd
    al_gbp = al_usd / gbpusd
    tstamp = datetime.now(timezone.utc).strftime("%A %d %B %Y %H:%M UTC")

    if not FILE.exists():
        print(f"Error: Markdown file not found at {FILE}")
        sys.exit(1)

    lines = FILE.read_text().splitlines()
    new_lines = []

    for line in lines:
        p = [x.strip() for x in line.split("|")]
        if len(p) >= 3:
            key = p[1]
            
            if "LME Copper (USD)" in key: 
                line = f"| LME Copper (USD) | ${cu_usd:,.0f} / tonne |"
            elif "LME Aluminium (USD)" in key: 
                line = f"| LME Aluminium (USD) | ${al_usd:,.0f} / tonne |"
            elif "GBP/USD Rate" in key: 
                line = f"| GBP/USD Rate | 1 GBP = {gbpusd:.4f} USD |"
            elif "Copper (GBP)" in key: 
                line = f"| Copper (GBP) | £{cu_gbp:,.0f} / tonne |"
            elif "Aluminium (GBP)" in key: 
                line = f"| Aluminium (GBP) | £{al_gbp:,.0f} / tonne |"
            elif "Last Update" in key: 
                line = f"| Last Update | {tstamp} |"
            else:
                try:
                    # Clean the key and check if it's a numeric conductor size
                    clean_key = key.replace(',', '').split()[0]
                    cond_size = float(clean_key)
                    cws_size = float(p[2].replace(',', ''))
                    
                    al_kg = cond_size * 2.92
                    cu_kg = cws_size * 9.6
                    al_val = (al_kg / 1000) * al_gbp
                    cu_val = (cu_kg / 1000) * cu_gbp
                    total = al_val + cu_val
                    net = total / 0.3
                    
                    line = f"| {cond_size:.0f} | {cws_size:.0f} | {al_kg:,.1f} | {cu_kg:,.1f} | {al_val:,.0f} | {cu_val:,.0f} | {total:,.0f} | {net:,.0f} |"
                except (ValueError, IndexError):
                    pass 

        new_lines.append(line)

    FILE.write_text("\n".join(new_lines))
    print(f"Successfully updated at {tstamp}")

if __name__ == "__main__":
    main()
