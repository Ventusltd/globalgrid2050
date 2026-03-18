import requests
from pathlib import Path
from datetime import datetime, timezone

# ---------------- CONFIGURATION ----------------
# Ensure this matches your folder structure in GitHub
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
        return 1.3265  # Updated fallback to match your current sheet

# ---------------- METALS (OPEN API) ----------------
def get_metals():
    try:
        r = requests.get("https://api.metals.live/v1/spot", timeout=20)
        data = r.json()

        # Extract prices (API returns price per gram/lb, we multiply by 1000 for tonnes)
        copper = next(item["price"] for item in data if item["metal"] == "copper")
        aluminium = next(item["price"] for item in data if item["metal"] == "aluminum")

        return copper * 1000, aluminium * 1000

    except Exception as e:
        print("Metals failed:", e)
        return 12850, 3520  # Updated fallback to match your current sheet


# ---------------- DATA CALCULATIONS ----------------
gbpusd = get_fx()
copper_usd, aluminium_usd = get_metals()

copper_gbp = copper_usd / gbpusd
aluminium_gbp = aluminium_usd / gbpusd

# Format timestamp to match your Markdown style
timestamp = datetime.now(timezone.utc).strftime("%A %d %B %Y %H:%M UTC")


# ---------------- READ & UPDATE FILE ----------------
if not FILE.exists():
    print(f"Error: {FILE} not found!")
    exit(1)

text = FILE.read_text()
lines = text.splitlines()
new_lines = []

for line in lines:
    parts = line.split("|")

    if len(parts) >= 3:
        key = parts[1].strip()

        # --- Update Table 1: Market Inputs ---
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

        # --- Update Table 2: Cable Estimator (Math Logic) ---
        else:
            try:
                # If the first column is a number, it's a conductor size (mm²)
                cond_size = float(key)
                cws_size = float(parts[2].strip())
                
                # Formulas from your markdown
                al_kg = cond_size * 2.92
                cu_kg = cws_size * 9.6
                
                al_gbp_km = (al_kg / 1000) * aluminium_gbp
                cu_gbp_km = (cu_kg / 1000) * copper_gbp
                total_metal = al_gbp_km + cu_gbp_km
                net_price = total_metal / 0.3  # Metal content is 30%
                
                # Rebuild the table row with updated pricing
                line = (f"| {cond_size:.0f} | {cws_size:.0f} | {al_kg:,.1f} | {cu_kg:,.1f} | "
                        f"{al_gbp_km:,.0f} | {cu_gbp_km:,.0f} | {total_metal:,.0f} | {net_price:,.0f} |")
            except ValueError:
                # This wasn't a data row (likely a header or divider), leave it as is
                pass

    new_lines.append(line)


# ---------------- WRITE FILE ----------------
FILE.write_text("\n".join(new_lines))


# ---------------- DEBUG ----------------
print("Updated successfully")
print("Timestamp:", timestamp)
print(f"FX: {gbpusd:.4f} | Cu GBP: {copper_gbp:,.0f} | Al GBP: {aluminium_gbp:,.0f}")
