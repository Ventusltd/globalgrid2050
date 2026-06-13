# V6 Transport Energy Sources Report

Updated UTC: `2026-06-13T08:41:00.223943+00:00`

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
  "updated": "2026-06-13T08:41:00.223943+00:00",
  "oil": {
    "live": {
      "updated": "2026-06-13T08:40:58.440301+00:00",
      "brentUSDperBarrel": 87.33,
      "wtiUSDperBarrel": 84.88,
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
      "week": "08/06/2026",
      "petrolPencePerLitre": 157.95,
      "dieselPencePerLitre": 181.79
    },
    "health": {
      "source": "DESNZ weekly road fuel prices",
      "page": "https://www.gov.uk/government/statistics/weekly-road-fuel-prices",
      "ok": true,
      "csv": "https://assets.publishing.service.gov.uk/media/6a26ab7256e988a798b38790/weekly_road_fuel_prices_080626.csv",
      "rows": 441
    }
  },
  "ev": {
    "operators": 3,
    "updated": "2026-06-13T08:41:00.223796+00:00"
  }
}
```
