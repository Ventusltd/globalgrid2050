import requests
import re
from pathlib import Path

FILE = Path("33kv_uk_dap_price_estimator/index.md")

# fetch GBPUSD from Yahoo Finance
data = requests.get(
"https://query1.finance.yahoo.com/v7/finance/quote?symbols=GBPUSD=X"
).json()

gbpusd = data["quoteResponse"]["result"][0]["regularMarketPrice"]

# update the FX line in the estimator page
text = FILE.read_text()

text = re.sub(
r"FX rate .*",
f"FX rate 1 GBP = {gbpusd} USD",
text
)

FILE.write_text(text)

print("FX updated successfully")
