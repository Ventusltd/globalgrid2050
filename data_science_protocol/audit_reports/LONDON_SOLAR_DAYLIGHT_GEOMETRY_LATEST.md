# London Solar Daylight Geometry

Generated UTC: `2026-06-14T00:09:30.645215Z`
Mode: `audit`
Pass: `True`

Calculates 365 or 366 daily London sunrise and sunset rows without calling an external sunrise API. Output includes GMT/UTC times, Europe/London civil clock times, daylight duration, solar noon, equation of time and solar declination. The report fully attributes formula origins and explains how the data should replace the existing Day versus Night panel in a later UI workflow.

## Location and time standards

Location: `London, United Kingdom`
Latitude: `51.5072`
Longitude: `-0.1276`
Primary output time standard: `GMT/UTC`
Secondary display time standard: `Europe/London civil clock, including BST where applicable`

## Method

NOAA style equation of time and solar declination approximation, USNO apparent sunrise/sunset horizon convention, London reference coordinates, GMT/UTC primary output, Europe/London civil display output.

## Formula and convention attribution

The workflow does not call a third party sunrise API. It calculates the daily times directly from solar geometry. The formulae are attributed as follows:

- `U.S. Naval Observatory Astronomical Applications Department`: Rise, set and twilight definitions. Sunrise and sunset use the upper limb of the solar disk at the horizon, with geometric zenith distance 90.8333 degrees for the Sun centre under average atmospheric conditions. Source: https://aa.usno.navy.mil/faq/RST_defs
- `NREL Solar Position Algorithm for Solar Radiation Applications, Reda and Andreas, NREL/TP-560-34302`: Solar position reference for solar radiation applications, time scales, equation of time, solar transit, sunrise and sunset method context. Source: https://www.nrel.gov/docs/fy08osti/34302.pdf
- `NOAA style approximate solar calculation`: The implemented equation of time and solar declination approximations follow the commonly published NOAA solar calculator form. Source: https://gml.noaa.gov/grad/solcalc/

## UI application contract

Replace `Day versus Night MWh` with `Sunrise and Sunset Times`.
Draw day 1 to day 365 or 366 on the x axis.
Draw clock time on the y axis.
Draw `sunriseGMT` and `sunsetGMT` as the primary lines.
Optionally allow `sunriseUKClock` and `sunsetUKClock` for civil UK display.
Fill the daylight window between sunrise and sunset.
Use daylight hours for correlation against solar daily MWh, other technology ramps and electricity price shape.

## Summary

Rows: `365`
Shortest day: `2026-12-22` `7.828` hours
Longest day: `2026-06-22` `16.643` hours
Earliest UK clock sunrise: `2026-06-13` `04:42`
Latest UK clock sunrise: `2026-01-01` `08:06`
Earliest UK clock sunset: `2026-12-12` `15:51`
Latest UK clock sunset: `2026-06-21` `21:21`

## Cross check against previous API layer

{
  "available": true,
  "comparisonRows": 12,
  "maxAbsoluteDifferenceMinutes": 5,
  "sample": [
    {
      "date": "2026-01-15",
      "currentSunriseUKClock": "07:59",
      "previousApiSunrise": "07:57",
      "sunriseDeltaMinutes": 2,
      "currentSunsetUKClock": "16:18",
      "previousApiSunset": "16:22",
      "sunsetDeltaMinutes": -4
    },
    {
      "date": "2026-02-15",
      "currentSunriseUKClock": "07:16",
      "previousApiSunrise": "07:12",
      "sunriseDeltaMinutes": 4,
      "currentSunsetUKClock": "17:13",
      "previousApiSunset": "17:16",
      "sunsetDeltaMinutes": -3
    },
    {
      "date": "2026-03-15",
      "currentSunriseUKClock": "06:17",
      "previousApiSunrise": "06:12",
      "sunriseDeltaMinutes": 5,
      "currentSunsetUKClock": "18:03",
      "previousApiSunset": "18:06",
      "sunsetDeltaMinutes": -3
    },
    {
      "date": "2026-04-15",
      "currentSunriseUKClock": "06:06",
      "previousApiSunrise": "06:02",
      "sunriseDeltaMinutes": 4,
      "currentSunsetUKClock": "19:54",
      "previousApiSunset": "19:58",
      "sunsetDeltaMinutes": -4
    },
    {
      "date": "2026-05-15",
      "currentSunriseUKClock": "05:09",
      "previousApiSunrise": "05:06",
      "sunriseDeltaMinutes": 3,
      "currentSunsetUKClock": "20:43",
      "previousApiSunset": "20:47",
      "sunsetDeltaMinutes": -4
    },
    {
      "date": "2026-06-15",
      "currentSunriseUKClock": "04:42",
      "previousApiSunrise": "04:40",
      "sunriseDeltaMinutes": 2,
      "currentSunsetUKClock": "21:18",
      "previousApiSunset": "21:21",
      "sunsetDeltaMinutes": -3
    },
    {
      "date": "2026-07-15",
      "currentSunriseUKClock": "04:59",
      "previousApiSunrise": "04:59",
      "sunriseDeltaMinutes": 0,
      "currentSunsetUKClock": "21:12",
      "previousApiSunset": "21:13",
      "sunsetDeltaMinutes": -1
    },
    {
      "date": "2026-08-15",
      "currentSunriseUKClock": "05:44",
      "previousApiSunrise": "05:44",
      "sunriseDeltaMinutes": 0,
      "currentSunsetUKClock": "20:26",
      "previousApiSunset": "20:25",
      "sunsetDeltaMinutes": 1
    },
    {
      "date": "2026-09-15",
      "currentSunriseUKClock": "06:33",
      "previousApiSunrise": "06:33",
      "sunriseDeltaMinutes": 0,
      "currentSunsetUKClock": "19:18",
      "previousApiSunset": "19:17",
      "sunsetDeltaMinutes": 1
    },
    {
      "date": "2026-10-15",
      "currentSunriseUKClock": "07:22",
      "previousApiSunrise": "07:22",
      "sunriseDeltaMinutes": 0,
      "currentSunsetUKClock": "18:09",
      "previousApiSunset": "18:09",
      "sunsetDeltaMinutes": 0
    },
    {
      "date": "2026-11-15",
      "currentSunriseUKClock": "07:17",
      "previousApiSunrise": "07:16",
      "sunriseDeltaMinutes": 1,
      "currentSunsetUKClock": "16:13",
      "previousApiSunset": "16:13",
      "sunsetDeltaMinutes": 0
    },
    {
      "date": "2026-12-15",
      "currentSunriseUKClock": "07:59",
      "previousApiSunrise": "07:57",
      "sunriseDeltaMinutes": 2,
      "currentSunsetUKClock": "15:51",
      "previousApiSunset": "15:53",
      "sunsetDeltaMinutes": -2
    }
  ]
}

## Planned changed files

- `uk_energy_tracking_v6/generation_history/london_solar_daylight_geometry_2026.json`

## Checks

| Check | Result |
|---|---|
| has_expected_daily_rows | ✅ |
| has_sunrise_and_sunset_for_each_day | ✅ |
| has_gmt_sunrise_and_sunset_fields | ✅ |
| has_uk_clock_sunrise_and_sunset_fields | ✅ |
| uses_london_reference | ✅ |
| uses_gmt_utc_primary_standard | ✅ |
| uses_europe_london_secondary_standard | ✅ |
| attributes_usno_convention | ✅ |
| attributes_formula_sources | ✅ |
| contains_ui_application_contract | ✅ |
| output_under_1mb | ✅ |
| no_external_api_fetch_required | ✅ |
| generation_data_not_touched | ✅ |

## Rollback

Delete `uk_energy_tracking_v6/generation_history/london_solar_daylight_geometry_2026.json` or revert the apply commit. Reports can also be reverted.
