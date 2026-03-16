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

    r = requests.get(url, headers=headers, timeout=20)
    r.raise_for_status()

    data = r.json()

    return float(data["quoteResponse"]["result"][0]["regularMarketPrice"])


# get FX rate
gbpusd = get_fx()

# create British formatted UTC timestamp
timestamp = datetime.now(timezone.utc).strftime("%A %d %B %Y %H:%M UTC")

# read page
text = FILE.read_text()

# update FX table row
text = re.sub(
    r"\| FX rate \| .*",
    f"| FX rate | 1 GBP = {gbpusd:.4f} USD |",
    text
)

# update timestamp row
text = re.sub(
    r"\| Last update \| .*",
    f"| Last update | {timestamp} |",
    text
)

# write updated page
FILE.write_text(text)

print("FX rate and timestamp updated successfully")
