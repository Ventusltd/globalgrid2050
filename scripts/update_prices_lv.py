# scripts/update_prices_lv.py

import requests
from pathlib import Path
from datetime import datetime, timezone

FILE = Path(__file__).parent.parent / "lv_ac_dc_price_estimator" / "index.md"

SUPPLY_FACTOR = 0.3

def get_data():
    gbpusd, cu_usd, al_usd = 1.3341, 12021.5, 3329.0

    try:
        fx = requests.get("https://open.er-api.com/v6/latest/GBP", timeout=20).json()
        gbpusd = fx["rates"]["USD"]

        metals = requests.get("https://api.metals.live/v1/spot", timeout=20).json()

        for m in metals:
            if m.get("metal") == "copper":
                cu_usd = m.get("price") * 1000
            if m.get("metal") == "aluminum":
                al_usd = m.get("price") * 1000

    except Exception as e:
        print(f"Fallback used: {e}")

    return gbpusd, cu_usd, al_usd


def main():
    gbpusd, cu_usd, al_usd = get_data()

    cu_usd_per_kg = cu_usd / 1000
    al_usd_per_kg = al_usd / 1000

    gbp_per_usd = 1 / gbpusd
    eur_per_gbp = 1.1529
    chf_per_gbp = 1.0513

    timestamp = datetime.now(timezone.utc).strftime("%A %d %B %Y %H:%M UTC")

    lines = FILE.read_text().splitlines()
    new_lines = []

    for line in lines:
        p = [x.strip() for x in line.split("|")]

        if len(p) >= 3:
            key = p[1]

            if "LME Copper (USD)" in key:
                line = f"| LME Copper (USD) | ${cu_usd:,.0f} per tonne |"

            elif "LME Aluminium (USD)" in key:
                line = f"| LME Aluminium (USD) | ${al_usd:,.0f} per tonne |"

            elif "GBP/USD Rate" in key:
                line = f"| GBP/USD Rate | 1 GBP = {gbpusd:.4f} USD |"

            elif "Last Update" in key:
                line = f"| Last Update | {timestamp} |"

            else:
                try:
                    mm2 = float(key.replace(",", ""))

                    cu_kg = mm2 * 9.6
                    al_kg = mm2 * 2.92

                    cu_usd_km = cu_kg * cu_usd_per_kg
                    al_usd_km = al_kg * al_usd_per_kg

                    cu_net_usd = cu_usd_km / SUPPLY_FACTOR
                    al_net_usd = al_usd_km / SUPPLY_FACTOR

                    cu_gbp = cu_net_usd * gbp_per_usd
                    al_gbp = al_net_usd * gbp_per_usd

                    cu_eur = cu_gbp * eur_per_gbp
                    al_eur = al_gbp * eur_per_gbp

                    cu_chf = cu_gbp * chf_per_gbp
                    al_chf = al_gbp * chf_per_gbp

                    line = (
                        f"| {int(mm2)} | {p[2]} | {p[3]} | "
                        f"{cu_kg:,.0f} | {al_kg:,.0f} | "
                        f"{cu_usd_km:,.0f} | {al_usd_km:,.0f} | "
                        f"{cu_net_usd:,.0f} | {al_net_usd:,.0f} | "
                        f"{cu_eur:,.0f} | {al_eur:,.0f} | "
                        f"{cu_chf:,.0f} | {al_chf:,.0f} | "
                        f"{cu_gbp:,.0f} | {al_gbp:,.0f} |"
                    )

                except:
                    pass

        new_lines.append(line)

    FILE.write_text("\n".join(new_lines))
    print(f"LV table updated: {timestamp}")


if __name__ == "__main__":
    main()
