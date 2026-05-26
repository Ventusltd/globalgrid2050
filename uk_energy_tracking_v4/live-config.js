// V4 live tracker config. Load first.
var ENERGY="/uk_energy_tracking_v4/live_grid_energy.json", PRICE="/uk_energy_tracking_v4/live_grid_price.json", OIL="/uk_energy_tracking_v4/live_oil_prices.json", OIL_HISTORY="/uk_energy_tracking_v4/oil_price_history.geojson", FUEL="/uk_energy_tracking_v4/live_uk_fuel_prices.json", EV_PRICES="/uk_energy_tracking_v4/ev_charging_prices.json", POLL=5*60*1000;
  var GAUGES={
    demand:{min:0,max:45,unit:"Gigawatts (GW)",colour:"#00ffff"},
    price:{min:-50,max:250,unit:"Pounds per Megawatt hour (£/MWh)",colour:"#ff00e6"},
    carbon:{min:0,max:400,unit:"Grams per Kilowatt hour (g/kWh)",colour:"#00ff88"}
  };
