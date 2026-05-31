# V6 Transport Energy Sources Report

Updated UTC: `2026-05-31T22:54:34.109908+00:00`

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
  "updated": "2026-05-31T22:54:34.109908+00:00",
  "oil": {
    "live": {
      "updated": "2026-05-31T22:46:02.024349+00:00",
      "brentUSDperBarrel": 92.92,
      "wtiUSDperBarrel": 89.47,
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
    "fresh_history": true,
    "health": [
      {
        "ok": false,
        "source": "FRED Brent Europe daily spot price",
        "error": "HTTPSConnectionPool(host='fred.stlouisfed.org', port=443): Max retries exceeded with url: /graph/fredgraph.csv?id=DCOILBRENTEU (Caused by ReadTimeoutError(\"HTTPSConnectionPool(host='fred.stlouisfed.org', port=443): Read timed out. (read timeout=60)\"))"
      },
      {
        "ok": false,
        "source": "FRED WTI Cushing daily spot price",
        "error": "HTTPSConnectionPool(host='fred.stlouisfed.org', port=443): Max retries exceeded with url: /graph/fredgraph.csv?id=DCOILWTICO (Caused by ReadTimeoutError(\"HTTPSConnectionPool(host='fred.stlouisfed.org', port=443): Read timed out. (read timeout=60)\"))"
      },
      {
        "ok": true,
        "source": "Yahoo Brent futures history",
        "rows": 4688,
        "fallback": true
      },
      {
        "ok": true,
        "source": "Yahoo WTI futures history",
        "rows": 6278,
        "fallback": true
      }
    ]
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
    "updated": "2026-05-31T22:54:34.109795+00:00"
  }
}
```
