import requests
from pathlib import Path
from datetime import datetime, timezone
import sys

# Target markdown file
FILE = Path(__file__).parent.parent / "33kv_uk_dap_price_estimator" / "index.md"

def get_data():
    # Fallback values
    gbpusd, cu_usd, al_usd = 1.3265, 12850, 3520

    try:
        # FX
        fx_r = requests.get("https://open.er-api.com/v6/latest/GBP", timeout=20)
        fx_r.raise_for_status()
        gbpusd = fx_r.json()["rates"]["USD"]

        # Metals
        m_r = requests.get("https://api.metals.live/v1/spot", timeout=20)
        m_r.raise_for_status()
        m_data = m_r.json()

        for item in m_data:
            if item.get("metal") == "copper":
                cu_usd = item.get("price") * 1000
            if item.get("metal") == "aluminum":
                al_usd = item.get("price") * 1000

    except Exception as e:
        print(f"Warning: Using fallback data. Error: {e}")

    return gbpusd, cu_usd, al_usd


def main():
    gbpusd, cu_usd, al_usd = get_data()

    cu_gbp = cu_usd / gbpusd
    al_gbp = al_usd / gbpusd

    tstamp_obj = datetime.now(timezone.utc)
    tstamp = tstamp_obj.strftime("%A %d %B %Y %H:%M UTC")

    if not FILE.exists():
        print(f"Error: Markdown file not found at {FILE}")
        return   # do NOT crash workflow

    lines = FILE.read_text().splitlines()
    new_lines = []

    for line in lines:
        parts = [x.strip() for x in line.split("|")]

        # Only process valid table rows
        if len(parts) >= 3:
            key = parts[1]

            # --- Market rows ---
            if "LME Copper (USD)" in key:
                line = f"| LME Copper (USD) | ${cu_usd:,.0f} / tonne |"

            elif "LME Aluminium (USD)" in key:
                line = f"| LME Aluminium (USD) | ${al_usd:,.0f} / tonne |"

            elif "GBP/USD Rate" in key:
                line = f"| GBP/USD Rate | 1 GBP = {gbpusd:.4f} USD |"

            elif "Copper (GBP)" in key:
                line = f"| Copper (GBP) | £{cu_gbp:,.0f} / tonne |"

            elif "Aluminium (GBP)" in key:
                line = f"| Aluminium (GBP) | £{al_gbp:,.0f} / tonne |"

            elif "Last Update" in key:
                line = f"| Last Update | {tstamp} |"

            else:
                # --- Try numeric rows safely ---
                try:
                    clean_key = key.replace(",", "").split()[0]

                    # Skip headers / separators
                    if not clean_key.replace(".", "").isdigit():
                        new_lines.append(line)
                        continue

                    cond_size = float(clean_key)

                    try:
                        cws_size = float(parts[2].replace(",", ""))
                    except:
                        new_lines.append(line)
                        continue

                    al_kg = cond_size * 2.92
                    cu_kg = cws_size * 9.6

                    al_val = (al_kg / 1000) * al_gbp
                    cu_val = (cu_kg / 1000) * cu_gbp

                    total = al_val + cu_val
                    net = total / 0.3

                    line = f"| {cond_size:.0f} | {cws_size:.0f} | {al_kg:,.1f} | {cu_kg:,.1f} | {al_val:,.0f} | {cu_val:,.0f} | {total:,.0f} | {net:,.0f} |"

                except Exception:
                    # Never crash
                    pass

        new_lines.append(line)

    # --- Force change to guarantee commit ---
    new_lines.append(f"\n<!-- update: {tstamp_obj.timestamp()} -->")

    FILE.write_text("\n".join(new_lines))

    print("33kV pricing updated successfully")
    print(f"Timestamp: {tstamp}")


if __name__ == "__main__":
    main()
