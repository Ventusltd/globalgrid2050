import requests
import re
from pathlib import Path
from datetime import datetime, timezone

FILE = Path("33kv_uk_dap_price_estimator/index.md")

def get_fx():
    url = "https://query1.finance.yahoo.com/v7/finance/quote?symbols=GBPUSD=X"

    headers = {
        "User-Agent": "Mozilla/5.0"
    }

    try:
        r = requests.get(url, headers=headers, timeout=20)

        if r.status_code != 200:
            print(f"Bad response: {r.status_code}")
            return 1.25

        data = r.json()

        result = data.get("quoteResponse", {}).get("result", [])

        if not result:
            print("No FX data returned")
            return 1.25

        return float(result[0]["regularMarketPrice"])

    except Exception as e:
        print(f"FX fetch failed: {e}")
        return 1.25


# ALWAYS resolve FX safely
gbpusd = get_fx()

# timestamp
timestamp = datetime.now(timezone.utc).strftime("%A %d %B %Y %H:%M UTC")

# read file
text = FILE.read_text()

# update FX row (robust)
text, fx_count = re.subn(
    r"\| FX rate \| .*?\|",
    f"| FX rate | 1 GBP = {gbpusd:.4f} USD |",
    text
)

# update timestamp (robust)
text, ts_count = re.subn(
    r"\| Last update \| .*?\|",
    f"| Last update | {timestamp} |",
    text
)

# safety check
if fx_count == 0:
    print("WARNING: FX row not updated")

if ts_count == 0:
    print("WARNING: Timestamp row not updated")

# write file
FILE.write_text(text)

print("FX rate and timestamp updated successfully")
