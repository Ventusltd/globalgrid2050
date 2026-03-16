import requests
import re
from pathlib import Path

FILE = Path("33kv_uk_dap_price_estimator/index.md")

headers = {
    "User-Agent": "Mozilla/5.0"
}

r = requests.get(
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=GBPUSD=X",
    headers=headers,
    timeout=20
)

data = r.json()

gbpusd = data["quoteResponse"]["result"][0]["regularMarketPrice"]

text = FILE.read_text()

text = re.sub(
    r"FX rate .*",
    f"FX rate 1 GBP = {gbpusd} USD",
    text
)

FILE.write_text(text)

print("FX updated successfully")
