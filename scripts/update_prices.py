import requests
from pathlib import Path
from datetime import datetime, timezone

FILE = Path("33kv_uk_dap_price_estimator/index.md")

# --- FX SOURCE ---
def get_fx():
    try:
        r = requests.get(
            "https://api.exchangerate.host/latest?base=GBP&symbols=USD",
            timeout=20
        )
        data = r.json()
        return float(data["rates"]["USD"])
    except Exception as e:
        print("FX failed:", e)
        return 1.25


# --- METALS SOURCE ---
def get_metals():
    try:
        r = requests.get("https://api.metals.live/v1/spot", timeout=20)
        data = r.json()

        copper = next(item['price'] for item in data if item['metal'] == 'copper')
        aluminium = next(item['price'] for item in data if item['metal'] == 'aluminum')

        return copper * 1000, aluminium * 1000

    except Exception as e:
        print("Metals failed:", e)
        return 12850, 3520


# --- GET DATA ---
gbpusd = get_fx()
copper_usd, aluminium_usd = get_metals()

copper_gbp = copper_usd / gbpusd
aluminium_gbp = aluminium_usd / gbpusd

timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


# --- READ FILE ---
text = FILE.read_text()
lines = text.splitlines()


# --- UPDATE CONTENT ---
new_lines = []

for line in lines:

    if "| LME Copper price" in line:
        line = f"| LME Copper price | ${copper_usd:,.0f} / tonne |"

    elif "| LME Aluminium price" in line:
        line = f"| LME Aluminium price | ${aluminium_usd:,.0f} / tonne |"

    elif "| FX rate" in line:
        line = f"| FX rate | 1 GBP = {gbpusd:.4f} USD |"

    elif "| Copper price" in line:
        line = f"| Copper price | £{copper_gbp:,.0f} / tonne |"

    elif "| Aluminium price" in line:
        line = f"| Aluminium price | £{aluminium_gbp:,.0f} / tonne |"

    elif "| Last update" in line:
        line = f"| Last update | {timestamp} |"

    new_lines.append(line)


# --- WRITE FILE ---
FILE.write_text("\n".join(new_lines))


# --- DEBUG OUTPUT ---
print("FX:", gbpusd)
print("Copper USD:", copper_usd)
print("Aluminium USD:", aluminium_usd)
print("Updated successfully")
