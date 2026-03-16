import requests
import re
from pathlib import Path

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


gbpusd = get_fx()

text = FILE.read_text()

text = re.sub(
    r"\| FX rate \| .*",
    f"| FX rate | 1 GBP = {gbpusd:.4f} USD |",
    text
)

FILE.write_text(text)

print("FX updated successfully")
