import requests
import re
from pathlib import Path

FILE = Path("33kv_uk_dap_price_estimator/index.md")

def get_json(url):
    r = requests.get(url, timeout=20)
    r.raise_for_status()
    return r.json()

# Copper price (USD/tonne)
copper = get_json(
    "https://api.allorigins.win/raw?url=https://www.lme.com/Metals/Non-ferrous/Copper#tabIndex=0"
)

# Aluminium price (USD/tonne)
aluminium = get_json(
    "https://api.allorigins.win/raw?url=https://www.lme.com/Metals/Non-ferrous/Aluminium#tabIndex=0"
)

# GBP USD FX
fx = get_json("https://api.exchangerate.host/latest?base=GBP&symbols=USD")
gbpusd = fx["rates"]["USD"]

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
