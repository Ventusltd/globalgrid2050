import os
import re
import requests
from pathlib import Path
from datetime import datetime, timezone

# Target file path (Updated to target index.html)
FILE = Path(__file__).parent.parent / "33kv_uk_dap_price_estimator" / "index.html"

def get_data():
    try:
        # Fetch Live Metal Prices (USD/Tonne)
        # --- Make sure this URL is exactly what you had in your original file ---
        m_r = requests.get("https://api.metals.dev/v1/latest") 
        m_r.raise_for_status()
        m_data = m_r.json()

        # Pull Copper and Aluminum, normalize to whole numbers
        cu_usd = next(i["price"] for i in m_data if "copper" in str(i).lower())
        al_usd = next(i["price"] for i in m_data if "aluminum" in str(i).lower())

        return int(cu_usd), int(al_usd)
    except Exception as e:
        print(f"Data fetch failed: {e}")
        return 12850, 3520 # Default fallbacks

def main():
    # 1. Get the latest prices
    cu_usd, al_usd = get_data()
    print(f"Fetched Prices -> Copper: ${cu_usd}, Aluminium: ${al_usd}")
    
    # 2. Open the HTML file
    try:
        content = FILE.read_text(encoding="utf-8")
    except FileNotFoundError:
        print(f"Error: Could not find {FILE}. Check the file path.")
        return

    # 3. Replace Copper price in the HTML
    content = re.sub(
        r'(<input id="cu" type="number" value=")\d+(")', 
        rf'\g<1>{cu_usd}\g<2>', 
        content
    )

    # 4. Replace Aluminium price in the HTML
    content = re.sub(
        r'(<input id="al" type="number" value=")\d+(")', 
        rf'\g<1>{al_usd}\g<2>', 
        content
    )

    # 5. Save the updated HTML back to the file
    FILE.write_text(content, encoding="utf-8")
    print("HTML file successfully updated with new prices.")

if __name__ == "__main__":
    main()
