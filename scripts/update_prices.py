import requests
import re
from pathlib import Path

FILE = Path("./33kv_uk_dap_price_estimator/index.md")

# --- get metals ---
metals = requests.get("https://api.metals.live/v1/spot").json()

copper = None
aluminium = None

for m in metals:
    if "copper" in m:
        copper = m["copper"]
    if "aluminum" in m or "aluminium" in m:
        aluminium = m.get("aluminum") or m.get("aluminium")

if copper is None or aluminium is None:
    raise Exception("Metal prices not found")

# --- get FX ---
fx = requests.get(
"https://api.exchangerate.host/latest?base=GBP&symbols=USD"
).json()

gbpusd = fx["rates"]["USD"]

# --- update file ---
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
