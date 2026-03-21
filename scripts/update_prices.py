import os
import re
import requests
from datetime import datetime, timezone
from pathlib import Path

# Updated path to match your repository structure
FILE = Path(__file__).parent.parent / "33kv_uk_dap_price_estimator" / "index.md"

def get_data():
    try:
        # Fetch FX Rate (GBP to USD)
        fx_r = requests.get("https://open.er-api.com/v6/latest/GBP", timeout=20)
        fx_r.raise_for_status()
        gbpusd = fx_r.json()["rates"]["USD"]
        
        # Fetch Metal Prices (USD/Tonne)
        # Note: Using your existing API logic from the repository
        m_r = requests.get("https://api.metals.live/v1/spot", timeout=20)
        m_r.raise_for_status()
        m_data = m_r.json()
        
        cu_usd = next(i["price"] for i in m_data if i["metal"] == "copper") * 1000
        al_usd = next(i["price"] for i in m_data if i["metal"] == "aluminum") * 1000
        
        return gbpusd, cu_usd, al_usd
    except Exception as e:
        print(f"Data fetch failed: {e}")
        return 1.3265, 12850, 3520

def main():
    gbpusd, cu_usd, al_usd = get_data()
    tstamp = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")

    if not FILE.exists():
        print(f"Error: File not found at {FILE}")
        return

    content = FILE.read_text()

    # 1. Update the HTML Input values for Copper and Aluminium
    content = re.sub(r'(id="cu" value=")[^"]*', f'\\g<1>{cu_usd:.0f}', content)
    content = re.sub(r'(id="al" value=")[^"]*', f'\\g<1>{al_usd:.0f}', content)

    # 2. Update the FX Rates in the Input values
    content = re.sub(r'(id="fx_gbp" value=")[^"]*', f'\\g<1>{(1/gbpusd):.4f}', content)
    
    # 3. Update the Last Update timestamp if it exists in the JS or HTML
    # This targets the 'Last Update: ' string in your updateFXTime function
    content = re.sub(r'(Last Update: )[^"]+', f'\\g<1>{tstamp}', content)

    FILE.write_text(content)
    print(f"Successfully updated {FILE} at {tstamp}")

if __name__ == "__main__":
    main()
