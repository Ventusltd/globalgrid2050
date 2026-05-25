import requests
import os
import json
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Runs every 5 minutes. Fetches demand + generation mix (Elexon FUELINST)
# and national solar (Sheffield Solar). Writes ONLY the energy slice so a
# failure here never touches the half-hourly price slice.

FOLDER = Path(__file__).parent.parent / "uk_energy_tracking_v3"
JSON_FILE = FOLDER / "live_grid_energy.json"
MD_FILE = FOLDER / "index.md"

ELEXON = "https://data.elexon.co.uk/bmrs/api/v1"
PVLIVE = "https://api.solar.sheffield.ac.uk/pvlive/api/v4"
TIMEOUT = 12

FUEL_GROUPS = {
    "Wind": ["WIND"], "Hydro": ["NPSHYD"], "Gas": ["CCGT", "OCGT"],
    "Coal": ["COAL"], "Biomass": ["BIOMASS"], "Nuclear": ["NUCLEAR"],
    "Pumped Storage": ["PS"], "Imports & Exports": ["INT"],
}
ROW_ORDER = ["Solar", "Wind", "Hydro", "Gas", "Coal",
             "Biomass", "Nuclear", "Pumped Storage", "Imports & Exports"]
ROW_COLORS = {
    "Solar": "#f5c518", "Wind": "#00d0ff", "Hydro": "#0090c0",
    "Gas": "#c0399a", "Coal": "#888888", "Biomass": "#f59e2b",
    "Nuclear": "#5cb85c", "Pumped Storage": "#9b59b6", "Imports & Exports": "#e8615a",
}


def _iso_minutes_ago(mins):
    return (datetime.now(timezone.utc) - timedelta(minutes=mins)).strftime("%Y-%m-%dT%H:%MZ")


def _get_json(url):
    last = None
    for _ in range(2):
        try:
            r = requests.get(url, timeout=TIMEOUT,
                             headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"})
            r.raise_for_status()
            return r.json()
        except Exception as e:  # noqa: BLE001
            last = e
    raise last


def fetch_generation_mix():
    url = (f"{ELEXON}/datasets/FUELINST?publishDateTimeFrom={_iso_minutes_ago(30)}"
           f"&publishDateTimeTo={_iso_minutes_ago(0)}&format=json")
    data = _get_json(url).get("data", [])
    if not data:
        return {}
    latest = max(row["startTime"] for row in data)
    snap = [r for r in data if r["startTime"] == latest]
    return {r["fuelType"]: float(r.get("generation") or 0) for r in snap}


def fetch_solar_gw():
    rows = _get_json(f"{PVLIVE}/gsp/0").get("data", [])
    if not rows:
        return 0.0
    mw = rows[0][2]
    return (float(mw) / 1000.0) if mw is not None else 0.0


MD_SHELL = """---
layout: page
title: UK Live Grid Tracker V2
permalink: /uk_energy_tracking_v3/
---
<style>
.scada-grid { font-family: "Courier New", monospace; }
.scada-metrics { display:flex; flex-wrap:wrap; gap:18px; margin:18px 0; }
.scada-card { flex:1 1 160px; border:1px solid #00ffff; border-radius:4px;
  background:rgba(0,255,255,0.05); padding:14px 16px; }
.scada-card .val { font-size:30px; font-weight:bold; color:#00ffff; letter-spacing:-1px; }
.scada-card .val .u { font-size:15px; color:#7fdfff; font-weight:normal; }
.scada-card .lab { font-size:13px; color:#a6adbb; margin-top:4px; text-transform:uppercase; }
.scada-bar-name { display:flex; justify-content:space-between; font-size:14px; margin:10px 0 4px; }
.scada-bar-name b { color:#e8e8f0; font-weight:normal; }
.scada-bar-name span { color:#7fdfff; font-variant-numeric:tabular-nums; }
.scada-track { height:7px; border-radius:4px; background:rgba(255,255,255,0.08); overflow:hidden; }
.scada-fill { height:100%; border-radius:4px; transition:width .6s ease; }
.scada-status { font-size:12px; color:#a6adbb; margin-top:14px; }
.scada-status.stale { color:#ffb020; }
.scada-credit { font-size:12px; color:#a6adbb; margin-top:10px; line-height:1.5; }
.scada-credit a { color:#7fdfff; }
</style>

# UK Live Grid Tracker

Near-real-time GB electricity demand, market price, carbon intensity and generation mix.
Generation mix refreshes every 5 minutes; price and carbon update every half hour (their native cadence).

<div class="scada-grid" id="scada-grid">
  <div class="scada-metrics">
    <div class="scada-card"><div class="val" id="m-demand">—<span class="u"> GW</span></div><div class="lab">Electricity demand</div></div>
    <div class="scada-card"><div class="val" id="m-price">£—<span class="u">/MWh</span></div><div class="lab">Electricity price</div></div>
    <div class="scada-card"><div class="val" id="m-carbon">—<span class="u"> g/kWh</span></div><div class="lab">Carbon emissions</div></div>
  </div>
  <div id="scada-mix"></div>
  <div class="scada-status" id="scada-status">Loading live feed…</div>
</div>

<script>
(function(){
  var ENERGY="./live_grid_energy.json", PRICE="./live_grid_price.json", POLL=5*60*1000;
  function fmt(n,dp){return (n===null||n===undefined||isNaN(n))?"\\u2014":Number(n).toFixed(dp==null?2:dp);}
  function renderMix(mix){
    var w=document.getElementById("scada-mix"); if(!Array.isArray(mix)){return;}
    w.innerHTML=mix.map(function(r){
      var width=Math.max(0,Math.min(100,Math.abs(r.pct)));
      return '<div class="scada-bar-name"><b>'+r.label+'</b><span>'+fmt(r.gw)+' GW &nbsp; '+fmt(r.pct)+'%</span></div>'+
        '<div class="scada-track"><div class="scada-fill" style="width:'+width+'%;background:'+r.color+'"></div></div>';
    }).join("");
  }
  function ageMin(iso){return iso?(Date.now()-new Date(iso).getTime())/60000:Infinity;}
  function getJSON(u){return fetch(u+"?t="+Date.now(),{cache:"no-store"}).then(function(r){if(!r.ok)throw 0;return r.json();}).catch(function(){return null;});}
  function refresh(){
    Promise.all([getJSON(ENERGY),getJSON(PRICE)]).then(function(res){
      var e=res[0]||{}, p=res[1]||{};
      if(e.demandGW!=null) document.getElementById("m-demand").innerHTML=fmt(e.demandGW)+'<span class="u"> GW</span>';
      document.getElementById("m-price").innerHTML='£'+(p.priceGBPperMWh==null?"\\u2014":fmt(p.priceGBPperMWh))+'<span class="u">/MWh</span>';
      document.getElementById("m-carbon").innerHTML=(p.carbonGperKWh==null?"\\u2014":Math.round(p.carbonGperKWh))+'<span class="u"> g/kWh</span>';
      if(e.mix) renderMix(e.mix);
      var s=document.getElementById("scada-status"), mins=ageMin(e.updated);
      if(mins>20){s.textContent="Mix feed is "+Math.round(mins)+" min old \\u2014 may be stale.";s.className="scada-status stale";}
      else if(e.updated){s.textContent="Mix updated "+new Date(e.updated).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})+" \\u00b7 price/carbon updated "+(p.updated?new Date(p.updated).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}):"\\u2014");s.className="scada-status";}
      else{s.textContent="Live feed unavailable \\u2014 awaiting first data write.";s.className="scada-status stale";}
    });
  }
  refresh(); setInterval(refresh, POLL);
})();
</script>

## Data sources & attribution

This tracker uses three free public sources. We gratefully acknowledge them:

- **Generation mix & demand** — Elexon BMRS Insights (Balancing Mechanism Reporting Service), used under the BMRS Data Licence Terms.
- **Carbon intensity** — National Energy System Operator [Carbon Intensity API](https://carbonintensity.org.uk/), developed with the Environmental Defense Fund, University of Oxford and WWF. Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Solar generation** — [Sheffield Solar PV_Live](https://www.solar.sheffield.ac.uk/api/), University of Sheffield.

Indicative near-real-time values for screening and situational awareness only. No representation is made that the data is accurate or complete.
"""


def write_shell_if_missing():
    FOLDER.mkdir(parents=True, exist_ok=True)
    if not MD_FILE.exists():
        MD_FILE.write_text(MD_SHELL, encoding="utf-8")
        print(f"Wrote markdown shell: {MD_FILE}")


def main():
    write_shell_if_missing()
    health = {}
    try:
        raw_mw = fetch_generation_mix(); health["generation"] = "ok"
    except Exception as e:  # noqa: BLE001
        raw_mw = {}; health["generation"] = f"error: {e}"
    try:
        solar_gw = fetch_solar_gw(); health["solar"] = "ok"
    except Exception as e:  # noqa: BLE001
        solar_gw = 0.0; health["solar"] = f"error: {e}"

    groups = {}
    for label, codes in FUEL_GROUPS.items():
        groups[label] = sum(mw for c, mw in raw_mw.items()
                            if any(c.startswith(p) for p in codes)) / 1000.0
    groups["Solar"] = solar_gw
    demand = sum(groups.values())

    mix = [{
        "label": l, "gw": round(groups.get(l, 0.0), 2),
        "pct": round((groups.get(l, 0.0) / demand * 100), 2) if demand else 0,
        "color": ROW_COLORS[l],
    } for l in ROW_ORDER]

    out = {
        "updated": datetime.now(timezone.utc).isoformat(),
        "demandGW": round(demand, 2),
        "solarGW": round(solar_gw, 2),
        "mix": mix,
        "health": health,
    }
    FOLDER.mkdir(parents=True, exist_ok=True)
    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    if any(v != "ok" for v in health.values()):
        print(f"::warning::Energy source issue: {health}")
    print(f"✅ Energy slice | demand {out['demandGW']} GW | solar {out['solarGW']} GW | {health}")


if __name__ == "__main__":
    main()
