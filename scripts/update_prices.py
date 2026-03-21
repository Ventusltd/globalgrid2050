import requests
from datetime import datetime

# --- API SOURCES ---
METALS_URL = "https://api.metals.live/v1/spot"
FX_URL = "https://api.exchangerate.host/latest?base=GBP&symbols=USD"

# --- FETCH DATA ---
metals = requests.get(METALS_URL).json()
fx = requests.get(FX_URL).json()

# metals.live returns list of dicts like [{"gold":...}, {"silver":...}, ...]
metal_dict = {list(item.keys())[0]: list(item.values())[0] for item in metals}

copper_usd_per_lb = metal_dict.get("copper")
aluminium_usd_per_lb = metal_dict.get("aluminium")

# convert lb → tonne
LB_TO_TONNE = 2204.62

copper_usd_per_tonne = copper_usd_per_lb * LB_TO_TONNE
aluminium_usd_per_tonne = aluminium_usd_per_lb * LB_TO_TONNE

gbp_usd = fx["rates"]["USD"]

# convert to GBP
copper_gbp_per_tonne = copper_usd_per_tonne / gbp_usd
aluminium_gbp_per_tonne = aluminium_usd_per_tonne / gbp_usd

# --- FUNCTIONS ---
def aluminium_kg_per_km(mm2):
    return mm2 * 2.92

def copper_kg_per_km(mm2):
    return mm2 * 9.6

# conductor sizes
rows = [
    (120,35),(150,35),(185,35),(240,35),(300,35),(400,35),(500,35),(630,35),
    (800,50),(1000,50),(1200,50),(1400,50),(1600,50),(1800,50),(2000,50),(2500,50)
]

# --- BUILD TABLE ---
table_rows = []

for conductor, cws in rows:
    al_kg = aluminium_kg_per_km(conductor)
    cu_kg = copper_kg_per_km(cws)

    al_cost = al_kg * aluminium_gbp_per_tonne / 1000
    cu_cost = cu_kg * copper_gbp_per_tonne / 1000

    total_metal = al_cost + cu_cost
    net_price = total_metal / 0.3

    table_rows.append({
        "conductor": conductor,
        "cws": cws,
        "al_kg": round(al_kg,1),
        "cu_kg": round(cu_kg,1),
        "al_cost": round(al_cost),
        "cu_cost": round(cu_cost),
        "total": round(total_metal),
        "net": round(net_price)
    })

# --- TIMESTAMP ---
timestamp = datetime.utcnow().strftime("%A %d %B %Y %H:%M UTC")

# --- WRITE HTML ---
html = f"""
<h1>33 kV Aluminium XLPE Cable Price Estimator</h1>

<p>Single core 19/33 kV aluminium conductor XLPE insulated cable with copper wire screen and MDPE oversheath to BS 7870.</p>

<h2>Market Inputs</h2>
<ul>
<li>LME Copper: £{round(copper_gbp_per_tonne):,} / tonne</li>
<li>LME Aluminium: £{round(aluminium_gbp_per_tonne):,} / tonne</li>
<li>GBP/USD: {gbp_usd:.4f}</li>
<li>Last Update: {timestamp}</li>
</ul>

<h2>Estimator</h2>
<table border="1" cellpadding="5" cellspacing="0">
<tr>
<th>Conductor mm²</th>
<th>CWS mm²</th>
<th>Al kg/km</th>
<th>Cu kg/km</th>
<th>Al £/km</th>
<th>Cu £/km</th>
<th>Total £/km</th>
<th>Net £/km</th>
</tr>
"""

for r in table_rows:
    html += f"""
<tr>
<td>{r['conductor']}</td>
<td>{r['cws']}</td>
<td>{r['al_kg']}</td>
<td>{r['cu_kg']}</td>
<td>{r['al_cost']}</td>
<td>{r['cu_cost']}</td>
<td>{r['total']}</td>
<td>{r['net']}</td>
</tr>
"""

html += "</table>"

# --- OUTPUT FILE ---
with open("33kv_uk_dap_price_estimator/index.html", "w") as f:
    f.write(html)
