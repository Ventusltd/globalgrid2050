import requests
import os
from pathlib import Path
from datetime import datetime, timezone

# Target file path
FILE = Path(__file__).parent.parent / "lv_ac_dc_price_estimator" / "index.md"

def get_market_data():
    # Fallback values
    data = {
        "gbp_usd": 1.3339,
        "eur_usd": 1.1586,
        "gbp_eur": 1.1510,
        "cu_usd": 12850.0,
        "al_usd": 3520.0
    }

    try:
        # FX Rates
        fx = requests.get("https://open.er-api.com/v6/latest/GBP", timeout=15).json()
        data["gbp_usd"] = fx["rates"]["USD"]
        data["gbp_eur"] = fx["rates"]["EUR"]
        data["eur_usd"] = data["gbp_usd"] / data["gbp_eur"]

        # Metals (USD per Tonne)
        m_api = requests.get("https://api.metals.live/v1/spot", timeout=15).json()
        for m in m_api:
            if m.get("metal") == "copper":
                data["cu_usd"] = m.get("price") * 1000
            if m.get("metal") == "aluminum":
                data["al_usd"] = m.get("price") * 1000

    except Exception as e:
        print(f"Connection error, using fallbacks: {e}")

    return data


def main():
    d = get_market_data()
    ts_obj = datetime.now(timezone.utc)
    ts = ts_obj.strftime("%A %d %B %Y %H:%M UTC")

    # Configuration
    AL_SIZES = [95, 120, 150, 185, 240, 300, 400, 500, 630]
    CU_SIZES = [10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630]

    # Generate Al Rows
    al_rows = ""
    for s in AL_SIZES:
        w = s * 2.92
        v_eur = ((w / 1000) * d["al_usd"]) / d["eur_usd"]
        p_eur = v_eur / 0.25
        al_rows += f"| {s} | {w:.1f} | €{v_eur:,.2f} | **€{round(p_eur):,}** |\n"

    # Generate Cu Rows
    cu_rows = ""
    for s in CU_SIZES:
        w = s * 9.6
        v_eur = ((w / 1000) * d["cu_usd"]) / d["eur_usd"]
        p_eur = v_eur / 0.40
        cu_rows += f"| {s} | {w:.1f} | €{v_eur:,.2f} | **€{round(p_eur):,}** |\n"

    # Assemble Markdown
    md_content = f"""---
layout: default
title: LV Price Estimator
---
# Pricing Estimator: Armoured Water-Blocked LV Distribution Single Cores
### For DC and AC Applications: High Current Solar & Distribution Power Collection Circuits (Rigid)
**Voltage Rating:** 1000/1000V AC | 1500/1500V DC

---

## ⚠️ Technical Compliance & Safety Notice
* **Tight Bend Radii:** The manufacturer MUST be consulted for applications requiring tight bends to ensure structural integrity.
* **Thermal Management:** Professional Power Systems Specialists must be engaged to perform thermal modeling. Incorrect configuration can lead to substation thermal runaway.
* **Margin for Error:** Bespoke considerations must be negotiated within the Employer’s Requirements for full indemnification.

---

## Integrated Procurement Parameters

| Category | Parameter | Value |
| :--- | :--- | :--- |
| **Market Data** | LME Aluminium (USD) | ${d['al_usd']:,.0f} / tonne |
| | LME Aluminium (EUR) | €{d['al_usd']/d['eur_usd']:,.0f} / tonne |
| | LME Copper (USD) | ${d['cu_usd']:,.0f} / tonne |
| | LME Copper (EUR) | €{d['cu_usd']/d['eur_usd']:,.0f} / tonne |
| **Forex Rates** | GBP / USD | {d['gbp_usd']:.4f} |
| | EUR / USD | {d['eur_usd']:.4f} |
| | GBP / EUR | {d['gbp_eur']:.4f} |
| **Pricing Rules** | Al Pricing Factor | Metal Value (EUR) / 0.25 |
| | Cu Pricing Factor | Metal Value (EUR) / 0.40 |
| **Update** | Last Market Sync | {ts} |

---

## LV Aluminium Cable Price Breakdown (EUR)

| Size (mm2) | Al Weight (kg/km) | Metal Value (EUR/km) | Net Price (EUR/km) |
| :--- | :--- | :--- | :--- |
{al_rows}
---

## LV Copper Cable Price Breakdown (EUR)

| Size (mm2) | Cu Weight (kg/km) | Metal Value (EUR/km) | Net Price (EUR/km) |
| :--- | :--- | :--- | :--- |
{cu_rows}
---

## Procurement Disclaimer
These figures are high-level budgeting estimates. Real procurement prices are subject to negotiation, engineering, and site-specific conditions.

"""

    # Write file
    os.makedirs(FILE.parent, exist_ok=True)
    FILE.write_text(md_content, encoding="utf-8")

    print("LV pricing updated")
    print(f"Timestamp: {ts}")


if __name__ == "__main__":
    main()
