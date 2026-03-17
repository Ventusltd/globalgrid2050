import requests
import re
from pathlib import Path
from datetime import datetime, timezone

FILE = Path("33kv_uk_dap_price_estimator/index.md")

# --- FX SOURCE (stable) ---
def get_fx():
    try:
        r = requests.get(
            "https://api.exchangerate.host/latest?base=GBP&symbols=USD",
            timeout=20
        )
        data = r.json()
        return float(data["rates"]["USD"])

    except Exception as e:
        print(f"FX fetch failed: {e}")
        return 1.25


# --- METALS (optional, safe fallback) ---
def get_metals():
    try:
        r = requests.get("https://api.metals.live/v1/spot", timeout=20)
        data = r.json()

        cu = next(item['price'] for item in data if item['metal'] == 'copper')
        al = next(item['price'] for item in data if item['metal'] == 'aluminum')

        return cu * 1000, al * 1000

    except Exception as e:
        print("Metal fetch failed:", e)
        return 12850, 3520


# --- SAFE EXECUTION ---
try:
    gbpusd = get_fx()
except:
    gbpusd = 1.25

try:
    copper_usd, aluminium_usd = get_metals()
except:
    copper_usd, aluminium_usd = 12850, 3520


# convert to GBP
copper_gbp = copper_usd / gbpusd
aluminium_gbp = aluminium_usd / gbpusd


# timestamp (always changes → forces commit)
timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


# read file
text = FILE.read_text()


# --- UPDATE ROWS (robust regex) ---

text, _ = re.subn(
    r"\|\s*LME Copper price\s*\|\s*.*?\|",
    f"| LME Copper price | ${copper_usd:,.0f} / tonne |",
    text
)

text, _ = re.subn(
    r"\|\s*LME Aluminium price\s*\|\s*.*?\|",
    f"| LME Aluminium price | ${aluminium_usd:,.0f} / tonne |",
    text
)

text, _ = re.subn(
    r"\|\s*FX rate\s*\|\s*.*?\|",
    f"| FX rate | 1 GBP = {gbpusd:.4f} USD |",
    text
)

text, _ = re.subn(
    r"\|\s*Copper price\s*\|\s*.*?\|",
    f"| Copper price | £{copper_gbp:,.0f} / tonne |",
    text
)

text, _ = re.subn(
    r"\|\s*Aluminium price\s*\|\s*.*?\|",
    f"| Aluminium price | £{aluminium_gbp:,.0f} / tonne |",
    text
)

text, _ = re.subn(
    r"\|\s*Last update\s*\|\s*.*?\|",
    f"| Last update | {timestamp} |",
    text
)


# write file
FILE.write_text(text)


# debug output (visible in Actions logs)
print("FX:", gbpusd)
print("Copper USD:", copper_usd)
print("Aluminium USD:", aluminium_usd)
print("Updated successfully")
