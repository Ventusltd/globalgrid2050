# V6 Transport Energy Sources Report

Updated UTC: `2026-06-05T08:57:41.995291+00:00`

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
  "updated": "2026-06-05T08:57:41.995291+00:00",
  "oil": {
    "live": {
      "updated": "2026-06-05T08:57:40.877497+00:00",
      "brentUSDperBarrel": 94.42,
      "wtiUSDperBarrel": 92.37,
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
    "history_features": 6280,
    "fresh_history": false
  },
  "fuel": {
    "latest": {
      "week": "01/06/2026",
      "petrolPencePerLitre": 158.74,
      "dieselPencePerLitre": 184.11
    },
    "health": {
      "source": "DESNZ weekly road fuel prices",
      "page": "https://www.gov.uk/government/statistics/weekly-road-fuel-prices",
      "ok": true,
      "csv": "https://assets.publishing.service.gov.uk/media/6a1d7dd659fb7a60f827f59d/weekly_road_fuel_prices_010626.csv",
      "rows": 440
    }
  },
  "ev": {
    "operators": 3,
    "updated": "2026-06-05T08:57:41.995103+00:00"
  }
}
```
