import requests
import re
from pathlib import Path

FILE = Path("33kv_uk_dap_price_estimator/index.md")

metals = requests.get("https://api.metals.live/v1/spot").json()

copper = next(m["price"] for m in metals if m["metal"] == "copper")
aluminium = next(m["price"] for m in metals if m["metal"] == "aluminum")

fx = requests.get(
"https://api.exchangerate.host/latest?base=GBP&symbols=USD"
).json()

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

print("prices updated")
