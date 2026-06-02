# V6 Transport Energy Sources Report

Updated UTC: `2026-06-02T10:00:21.545012+00:00`

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
  "updated": "2026-06-02T10:00:21.545012+00:00",
  "oil": {
    "live": {
      "updated": "2026-06-02T09:51:55.016131+00:00",
      "brentUSDperBarrel": 93.47,
      "wtiUSDperBarrel": 90.73,
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
    "history_features": 6278,
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
        "rows": 4689,
        "fallback": true
      },
      {
        "ok": true,
        "source": "Yahoo WTI futures history",
        "rows": 6277,
        "fallback": true
      }
    ]
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
    "updated": "2026-06-02T10:00:21.544853+00:00"
  }
}
```
