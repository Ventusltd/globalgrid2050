import requests
from pathlib import Path
from datetime import datetime, timezone

FILE = Path("33kv_uk_dap_price_estimator/index.md")

# ---------------- FX (OPEN API) ----------------
def get_fx():
    try:
        r = requests.get(
            "https://open.er-api.com/v6/latest/GBP",
            timeout=20
        )
        data = r.json()
        return float(data["rates"]["USD"])
    except Exception as e:
        print("FX failed:", e)
        return 1.25


# ---------------- METALS (OPEN API) ----------------
def get_metals():
    try:
        r = requests.get("https://api.metals.live/v1/spot", timeout=20)
        data = r.json()

        copper = next(item["price"] for item in data if item["metal"] == "copper")
        aluminium = next(item["price"] for item in data if item["metal"] == "aluminum")

        return copper * 1000, aluminium * 1000

    except Exception as e:
        print("Metals failed:", e)
        return 12850, 3520


# ---------------- GET DATA ----------------
gbpusd = get_fx()
copper_usd, aluminium_usd = get_metals()

copper_gbp = copper_usd / gbpusd
aluminium_gbp = aluminium_usd / gbpusd

timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


# ---------------- READ FILE ----------------
text = FILE.read_text()
lines = text.splitlines()

new_lines = []


# ---------------- UPDATE TABLE ----------------
for line in lines:

    parts = line.split("|")

    if len(parts) >= 3:
        key = parts[1].strip()

        if key == "LME Copper price":
            line = f"| LME Copper price | ${copper_usd:,.0f} / tonne |"

        elif key == "LME Aluminium price":
            line = f"| LME Aluminium price | ${aluminium_usd:,.0f} / tonne |"

        elif key == "FX rate":
            line = f"| FX rate | 1 GBP = {gbpusd:.4f} USD |"

        elif key == "Copper price":
            line = f"| Copper price | £{copper_gbp:,.0f} / tonne |"

        elif key == "Aluminium price":
            line = f"| Aluminium price | £{aluminium_gbp:,.0f} / tonne |"

        elif key == "Last update":
            line = f"| Last update | {timestamp} |"

    new_lines.append(line)


# ---------------- WRITE FILE ----------------
FILE.write_text("\n".join(new_lines))


# ---------------- DEBUG ----------------
print("Updated successfully")
print("Timestamp:", timestamp)
print("FX:", gbpusd)
print("Copper USD:", copper_usd)
print("Aluminium USD:", aluminium_usd)
