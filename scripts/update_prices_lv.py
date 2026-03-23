import requests
import os
from pathlib import Path
from datetime import datetime, timezone

# Target file path

FILE = Path(**file**).parent.parent / “lv_ac_dc_price_estimator” / “index.md”

def get_market_data():
data = {
“gbp_usd”: 1.3339,
“eur_usd”: 1.1586,
“gbp_eur”: 1.1510,
“cu_usd”: 12850.0,
“al_usd”: 3520.0,
“used_fallback”: False
}

```
try:
    # FX Rates
    fx = requests.get("https://open.er-api.com/v6/latest/GBP", timeout=15).json()
    data["gbp_usd"] = fx["rates"]["USD"]
    data["gbp_eur"] = fx["rates"]["EUR"]
    data["eur_usd"] = data["gbp_usd"] / data["gbp_eur"]
except Exception as e:
    print(f"::warning::FX fetch failed, using fallback rates: {e}")
    data["used_fallback"] = True

try:
    # Copper: HG=F quoted in USD/lb → convert to USD/tonne
    r = requests.get(
        "https://query1.finance.yahoo.com/v8/finance/chart/HG=F",
        timeout=10,
        headers={"User-Agent": "Mozilla/5.0"}
    )
    cu_lb = r.json()["chart"]["result"][0]["meta"]["regularMarketPrice"]
    data["cu_usd"] = cu_lb * 2204.62
except Exception as e:
    print(f"::warning::Copper fetch failed, using fallback: {e}")
    data["used_fallback"] = True

try:
    # Aluminium: ALI=F quoted in USD/tonne
    r = requests.get(
        "https://query1.finance.yahoo.com/v8/finance/chart/ALI=F",
        timeout=10,
        headers={"User-Agent": "Mozilla/5.0"}
    )
    data["al_usd"] = r.json()["chart"]["result"][0]["meta"]["regularMarketPrice"]
except Exception as e:
    print(f"::warning::Aluminium fetch failed, using fallback: {e}")
    data["used_fallback"] = True

return data
```

def main():
d = get_market_data()
ts_obj = datetime.now(timezone.utc)
ts = ts_obj.strftime(”%A %d %B %Y %H:%M UTC”)

```
if d["used_fallback"]:
    print("::warning::One or more prices are fallback values — verify API sources")

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
```

## layout: default
title: LV Price Estimator

# Pricing Estimator: Armoured Water-Blocked LV Distribution Single Cores

### For DC and AC Applications: High Current Solar & Distribution Power Collection Circuits (Rigid)

**Voltage Rating:** 1000/1000V AC | 1500/1500V DC

-----

## ⚠️ Technical Compliance & Safety Notice

- **Tight Bend Radii:** The manufacturer MUST be consulted for applications requiring tight bends to ensure structural integrity.
- **Thermal Management:** Professional Power Systems Specialists must be engaged to perform thermal modeling. Incorrect configuration can lead to substation thermal runaway.
- **Margin for Error:** Bespoke considerations must be negotiated within the Employer’s Requirements for full indemnification.

-----

## Integrated Procurement Parameters

|Category         |Parameter          |Value                                   |
|:----------------|:------------------|:---------------------------------------|
|**Market Data**  |LME Aluminium (USD)|${d[‘al_usd’]:,.0f} / tonne             |
|                 |LME Aluminium (EUR)|€{d[‘al_usd’]/d[‘eur_usd’]:,.0f} / tonne|
|                 |LME Copper (USD)   |${d[‘cu_usd’]:,.0f} / tonne             |
|                 |LME Copper (EUR)   |€{d[‘cu_usd’]/d[‘eur_usd’]:,.0f} / tonne|
|**Forex Rates**  |GBP / USD          |{d[‘gbp_usd’]:.4f}                      |
|                 |EUR / USD          |{d[‘eur_usd’]:.4f}                      |
|                 |GBP / EUR          |{d[‘gbp_eur’]:.4f}                      |
|**Pricing Rules**|Al Pricing Factor  |Metal Value (EUR) / 0.25                |
|                 |Cu Pricing Factor  |Metal Value (EUR) / 0.40                |
|**Update**       |Last Market Sync   |{ts}                                    |

-----

## LV Aluminium Cable Price Breakdown (EUR)

|Size (mm2)|Al Weight (kg/km)|Metal Value (EUR/km)|Net Price (EUR/km)|
|:---------|:----------------|:-------------------|:-----------------|
|{al_rows} |                 |                    |                  |

-----

## LV Copper Cable Price Breakdown (EUR)

|Size (mm2)|Cu Weight (kg/km)|Metal Value (EUR/km)|Net Price (EUR/km)|
|:---------|:----------------|:-------------------|:-----------------|
|{cu_rows} |                 |                    |                  |

-----

## Procurement Disclaimer

These figures are high-level budgeting estimates. Real procurement prices are subject to negotiation, engineering, and site-specific conditions.
“””

```
os.makedirs(FILE.parent, exist_ok=True)
FILE.write_text(md_content, encoding="utf-8")

print("LV pricing updated")
print(f"  Cu: ${d['cu_usd']:,.0f}/t | Al: ${d['al_usd']:,.0f}/t | EUR/USD: {d['eur_usd']:.4f}")
print(f"  Timestamp: {ts}")
```

if **name** == “**main**”:
main()
