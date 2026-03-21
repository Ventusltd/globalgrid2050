import os
import re
import requests
from pathlib import Path
from datetime import datetime, timezone

# Target file path relative to repository root
FILE = Path(__file__).parent.parent / "33kv_uk_dap_price_estimator" / "index.md"

def get_data():
    try:
        # Fetch FX Rate for fallback/logging
        fx_r = requests.get("https://open.er-api.com/v6/latest/GBP", timeout=20)
        fx_r.raise_for_status()
        gbpusd = fx_r.json()["rates"]["USD"]
        
        # Fetch Live Metal Prices (USD/Tonne)
        m_r = requests.get("https://api.metals.live/v1/spot", timeout=20)
        m_r.raise_for_status()
        m_data = m_r.json()
        
        # Normalize to Tonne
        cu_usd = next(i["price"] for i in m_data if i["metal"] == "copper") * 1000
        al_usd = next(i["price"] for i in m_data if i["metal"] == "aluminum") * 1000
        
        return gbpusd, cu_usd, al_usd
    except Exception as e:
        print(f"Data fetch failed: {e}")
        return 1.3265, 12850, 3520 # Conservative fallbacks

def main():
    gbpusd, cu_usd, al_usd = get_data()
    tstamp = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")

    if not FILE.exists():
        print(f"Error: index.md not found at {FILE}")
        return

    content = FILE.read_text()

    # Regex update for HTML input fields
    content = re.sub(r'(id="cu" value=")[^"]*', f'\\g<1>{cu_usd:.0f}', content)
    content = re.sub(r'(id="al" value=")[^"]*', f'\\g<1>{al_usd:.0f}', content)
    content = re.sub(r'(id="fx_gbp" value=")[^"]*', f'\\g<1>{(1/gbpusd):.4f}', content)

    FILE.write_text(content)
    print(f"Automated update successful at {tstamp}")

if __name__ == "__main__":
    main()
