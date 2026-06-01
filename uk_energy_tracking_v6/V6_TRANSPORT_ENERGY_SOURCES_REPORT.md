# V6 Transport Energy Sources Report

Updated UTC: `2026-06-01T10:59:28.503318+00:00`

## Outputs

1. `uk_energy_tracking_v6/live_oil_prices.json`
2. `uk_energy_tracking_v6/oil_price_history.geojson`
3. `uk_energy_tracking_v6/live_uk_fuel_prices.json`
4. `uk_energy_tracking_v6/ev_charging_prices.json`

## Notes

Oil live prices use Yahoo Finance chart API. Oil history prefers FRED Brent and WTI daily spot price series, with Yahoo futures history as fallback.

Road fuel uses DESNZ weekly road fuel prices from GOV.UK.

EV charging values are curated public reference values and must not be treated as live tariff quotes.

```json
{
  "updated": "2026-06-01T10:59:28.503318+00:00",
  "oil": {
    "live": {
      "updated": "2026-06-01T10:59:26.915302+00:00",
      "brentUSDperBarrel": 94.16,
      "wtiUSDperBarrel": 90.68,
      "health": {
        "BZ=F": {
          "ok": true,
          "source": "Yahoo Finance chart API"
        },
        "CL=F": {
          "ok": true,
          "source": "Yahoo Finance chart API"
        }
      }
    },
    "history_features": 6279,
    "fresh_history": false
  },
  "fuel": {
    "latest": {
      "week": "25/05/2026",
      "petrolPencePerLitre": 158.78,
      "dieselPencePerLitre": 185.07
    },
    "health": {
      "source": "DESNZ weekly road fuel prices",
      "page": "https://www.gov.uk/government/statistics/weekly-road-fuel-prices",
      "ok": true,
      "csv": "https://assets.publishing.service.gov.uk/media/6a15a15c1eb143220d8d2878/weekly_road_fuel_prices_250526.csv",
      "rows": 439
    }
  },
  "ev": {
    "operators": 3,
    "updated": "2026-06-01T10:59:28.503145+00:00"
  }
}
```
