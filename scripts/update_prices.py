import requests
from pathlib import Path
from datetime import datetime, timezone

# Targets the markdown file relative to this script's location
FILE = Path(__file__).parent.parent / "33kv_uk_dap_price_estimator" / "index.md"

def get_data():
    try:
        # Fetch FX Rate (GBP to USD)
        fx_r = requests.get("https://open.er-api.com/v6/latest/GBP", timeout=20)
        fx_r.raise_for_status()
        gbpusd = fx_r.json()["rates"]["USD"]
        
        # Fetch Metal Prices (USD/Tonne)
        m_r = requests.get("https://api.metals.live/v1/spot", timeout=20)
        m_r.raise_for_status()
        m_data = m_r.json()
        
        # API returns per lb or gram; we normalize to Tonne (multiply by 1000)
        cu_usd = next(i["price"] for i in m_data if i["metal"] == "copper") * 1000
        al_usd = next(i["price"] for i in m_data if i["metal"] == "aluminum") * 1000
        
        return gbpusd, cu_usd, al_usd
    except Exception as e:
        print(f"Data fetch failed: {e}")
        # Fallbacks based on your original data
        return 1.3265, 12850, 3520

def main():
    gbpusd, cu_usd, al_usd = get_data()
    cu_gbp = cu_usd / gbpusd
    al_gbp = al_usd / gbpusd
    tstamp = datetime.now(timezone.utc).strftime("%A %d %B %Y %H:%M UTC")

    if not FILE.exists():
        print(f"Error: Markdown file not found at {FILE}")
        return

    lines = FILE.read_text().splitlines()
    new_lines = []

    for line in lines:
        p = [x.strip() for x in line.split("|")]
        if len(p) >= 3:
            key = p[1]
            
            # Update Table 1: Market Inputs
            if key == "LME Copper (USD)": 
                line = f"| LME Copper (USD) | ${cu_usd:,.0f} / tonne |"
            elif key == "LME Aluminium (USD)": 
                line = f"| LME Aluminium (USD) | ${al_usd:,.0f} / tonne |"
            elif key == "GBP/USD Rate": 
                line = f"| GBP/USD Rate | 1 GBP = {gbpusd:.4f} USD |"
            elif key == "Copper (GBP)": 
                line = f"| Copper (GBP) | £{cu_gbp:,.0f} / tonne |"
            elif key == "Aluminium (GBP)": 
                line = f"| Aluminium (GBP) | £{al_gbp:,.0f} / tonne |"
            elif key == "Last Update": 
                line = f"| Last Update | {tstamp} |"
            
            # Update Table 2: Cable Estimator Math
            else:
                try:
                    cond_size = float(key) # Identifies row as cable data (e.g. 120, 150)
                    cws_size = float(p[2])
                    
                    al_kg = cond_size * 2.92
                    cu_kg = cws_size * 9.6
                    al_val = (al_kg / 1000) * al_gbp
                    cu_val = (cu_kg / 1000) * cu_gbp
                    total = al_val + cu_val
                    net = total / 0.3 # Net Price Rule
                    
                    line = f"| {cond_size:.0f} | {cws_size:.0f} | {al_kg:,.1f} | {cu_kg:,.1f} | {al_val:,.0f} | {cu_val:,.0f} | {total:,.0f} | {net:,.0f} |"
                except ValueError:
                    pass # Keep headers/dividers as they are

        new_lines.append(line)

    FILE.write_text("\n".join(new_lines))
    print(f"Successfully updated at {tstamp}")

if __name__ == "__main__":
    main()
