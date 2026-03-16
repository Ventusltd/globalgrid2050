import requests
import re
from pathlib import Path

FILE = Path("33kv_uk_dap_price_estimator/index.md")

# --- Copper price ---
copper = requests.get(
    "https://api.metals.live/v1/spot/copper"
).json()[0]["price"]

# --- Aluminium price ---
aluminium = requests.get(
    "https://api.metals.live/v1/spot/aluminum"
).json()[0]["price"]

# --- FX rate ---
fx = requests.get(
    "https://api.exchangerate.host/latest?base=GBP&symbols=USD"
).json()

gbpusd = fx["rates"]["USD"]

# --- Update page ---
text = FILE.read_text()

text = re.sub(
    r"LME Copper price .*",
    f"LME Copper price ${copper} / tonne",
    text
)

text = re.sub(
    r"LME Aluminium price .*",
    f"LME Aluminium price ${aluminium} / tonne",
    text
)

text = re.sub(
    r"FX rate .*",
    f"FX rate 1 GBP = {gbpusd} USD",
    text
)

FILE.write_text(text)

print("Prices updated")
