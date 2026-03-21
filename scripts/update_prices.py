import os
import re
import requests
from pathlib import Path
from datetime import datetime, timezone

# Target file path
FILE = Path(__file__).parent.parent / "33kv_uk_dap_price_estimator" / "index.md"

def get_data():
    try:
        # Fetch Live Metal Prices (USD/Tonne)
        m_r = requests.get("https://api.metals.live/v1/spot", timeout=20)
        m_r.raise_for_status()
        m_data = m_r.json()
        
        # Pull Copper and Aluminum, normalize to Tonne
        cu_usd = next(i["price"] for i in m_data if i["metal"] == "copper") * 1000
        al_usd = next(i["price"] for i in m_data if i["metal"] == "aluminum") * 1000
        
        return cu_usd, al_usd
    except Exception as e:
        print(f"Data fetch failed: {e}")
        return 12850, 3520 # Default fallbacks

def main():
    cu_usd, al_usd = get_data()
    tstamp = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")

    if not FILE.exists():
        print(f"Error: File not found at {FILE}")
        return

    content = FILE.read_text()

    # Update HTML input values for Copper and Aluminium
    content = re.sub(r'(id="cu" value=")[^"]*', f'\\g<1>{cu_usd:.0f}', content)
    content = re.sub(r'(id="al" value=")[^"]*', f'\\g<1>{al_usd:.0f}', content)

    FILE.write_text(content)
    print(f"Successfully automated updates at {tstamp}")

if __name__ == "__main__":
    main()
