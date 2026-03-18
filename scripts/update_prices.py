import requests
from pathlib import Path
from datetime import datetime, timezone

# Target the markdown file relative to this script's location
FILE = Path(__file__).parent.parent / "33kv_uk_dap_price_estimator" / "index.md"

def get_data():
    try:
        # FX Rate
        fx_r = requests.get("https://open.er-api.com/v6/latest/GBP", timeout=20)
        gbpusd = fx_r.json()["rates"]["USD"]
        
        # Metal Prices
        m_r = requests.get("https://api.metals.live/v1/spot", timeout=20)
        m_data = m_r.json()
        cu_usd = next(i["price"] for i in m_data if i["metal"] == "copper") * 1000
        al_usd = next(i["price"] for i in m_data if i["metal"] == "aluminum") * 1000
        
        return gbpusd, cu_usd, al_usd
    except Exception as e:
        print(f"Data fetch failed: {e}")
        return 1.32, 12850, 3520 # Conservative fallbacks

def main():
    gbpusd, cu_usd, al_usd = get_data()
    cu_gbp, al_gbp = cu_usd / gbpusd, al_usd / gbpusd
    tstamp = datetime.now(timezone.utc).strftime("%A %d %B %Y %H:%M UTC")

    if not FILE.exists():
        print("Markdown file not found at expected path.")
        return

    lines = FILE.read_text().splitlines()
    new_lines = []

    for line in lines:
        p = [x.strip() for x in line.split("|")]
        if len(p) >= 3:
            key = p[1]
            # Table 1 Updates
            if key == "LME Copper (USD)": line = f"| LME Copper (USD) | ${cu_usd:,.0f} / tonne |"
            elif key == "LME Aluminium (USD)": line = f"| LME Aluminium (USD) | ${al_usd:,.0f} / tonne |"
            elif key == "GBP/USD Rate": line = f"| GBP/USD Rate | 1 GBP = {gbpusd:.4f} USD |"
            elif key == "Copper (GBP)": line = f"| Copper (GBP) | £{cu_gbp:,.0f} / tonne |"
            elif key == "Aluminium (GBP)": line = f"| Aluminium (GBP) | £{al_gbp:,.0f} / tonne |"
            elif key == "Last Update": line = f"| Last Update | {tstamp} |"
            else:
                # Table 2 Math
                try:
                    size = float(key)
                    cws = float(p[2])
                    al_k, cu_k = size * 2.92, cws * 9.6
                    al_val, cu_val = (al_k/1000)*al_gbp, (cu_k/1000)*cu_gbp
                    total = al_val + cu_val
                    net = total / 0.3
                    line = f"| {size:.0f} | {cws:.0f} | {al_k:,.1f} | {cu_k:,.1f} | {al_val:,.0f} | {cu_val:,.0f} | {total:,.0f} | {net:,.0f} |"
                except: pass
        new_lines.append(line)

    FILE.write_text("\n".join(new_lines))

if __name__ == "__main__":
    main()
