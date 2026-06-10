# Solar Peak Integrity Audit

```json
{
  "generatedUTC": "2026-06-10T08:17:25Z",
  "purpose": "Read only integrity audit of stored Sheffield Solar PVLive daily and recent Solar output numbers from 2016 to present.",
  "sourceExpected": "Sheffield Solar PVLive",
  "targetCoverage": {
    "startMonth": "2016-01",
    "endMonth": "2026-06",
    "targetFields": [
      "highMW",
      "averageMW",
      "lowMW",
      "mwh",
      "sampleCount",
      "completeness"
    ]
  },
  "files": {
    "dailyBrowser": {
      "path": "uk_energy_tracking_v6/generation_history/pvlive_solar_daily_browser.json",
      "exists": true,
      "sha256": "71f6bc93a129fbc00808ea60063c4135ca31bdac8f4d98c5ac13498f6a6ba2b0",
      "rows": 3812,
      "schemaVersion": "0.3.0-pvlive-solar-daily-browser",
      "generatedUTC": "2026-06-10T00:53:10Z"
    },
    "dailyCandidate": {
      "path": "data/confirmed/pvlive_solar_daily_candidate.json",
      "exists": true,
      "sha256": "a736f593f5819ab6837b60d485c34bf7a128c15d095596b1f49d2063a53ed459",
      "rows": 3812,
      "schemaVersion": "0.3.0-pvlive-solar-daily-candidate",
      "generatedUTC": "2026-06-10T00:53:10Z"
    },
    "recentBrowser": {
      "path": "uk_energy_tracking_v6/generation_history/pvlive_solar_recent_30d_30min_browser.json",
      "exists": true,
      "sha256": "2a0a3d9432770ed389eff77ef7fd634c26b6eb90235b86a27eb75dc1b8486d07",
      "rows": 1443,
      "schemaVersion": "0.3.0-pvlive-solar-recent-30min-browser",
      "generatedUTC": "2026-06-09T23:10:55Z"
    },
    "progress": {
      "path": "data/confirmed/pvlive_solar_daily_BACKFILL_PROGRESS.json",
      "exists": true,
      "sha256": "c6ae17a6febe46191eb0d623cdb4c2f07cf409f4e4c4da5b1b431944b367329c",
      "completeMonths": [
        "2016-01",
        "2016-02",
        "2016-03",
        "2016-04",
        "2016-05",
        "2016-06",
        "2016-07",
        "2016-08",
        "2016-09",
        "2016-10",
        "2016-11",
        "2016-12",
        "2017-01",
        "2017-02",
        "2017-03",
        "2017-04",
        "2017-05",
        "2017-06",
        "2017-07",
        "2017-08",
        "2017-09",
        "2017-10",
        "2017-11",
        "2017-12",
        "2018-01",
        "2018-02",
        "2018-03",
        "2018-04",
        "2018-05",
        "2018-06",
        "2018-07",
        "2018-08",
        "2018-09",
        "2018-10",
        "2018-11",
        "2018-12",
        "2019-01",
        "2019-02",
        "2019-03",
        "2019-04",
        "2019-05",
        "2019-06",
        "2019-07",
        "2019-08",
        "2019-09",
        "2019-10",
        "2019-11",
        "2019-12",
        "2020-01",
        "2020-02",
        "2020-03",
        "2020-04",
        "2020-05",
        "2020-06",
        "2020-07",
        "2020-08",
        "2020-09",
        "2020-10",
        "2020-11",
        "2020-12",
        "2021-01",
        "2021-02",
        "2021-03",
        "2021-04",
        "2021-05",
        "2021-06",
        "2021-07",
        "2021-08",
        "2021-09",
        "2021-10",
        "2021-11",
        "2021-12",
        "2022-01",
        "2022-02",
        "2022-03",
        "2022-04",
        "2022-05",
        "2022-06",
        "2022-07",
        "2022-08",
        "2022-09",
        "2022-10",
        "2022-11",
        "2022-12",
        "2023-01",
        "2023-02",
        "2023-03",
        "2023-04",
        "2023-05",
        "2023-06",
        "2023-07",
        "2023-08",
        "2023-09",
        "2023-10",
        "2023-11",
        "2023-12",
        "2024-01",
        "2024-02",
        "2024-03",
        "2024-04",
        "2024-05",
        "2024-06",
        "2024-07",
        "2024-08",
        "2024-09",
        "2024-10",
        "2024-11",
        "2024-12",
        "2025-01",
        "2025-02",
        "2025-03",
        "2025-04",
        "2025-05",
        "2025-06",
        "2025-07",
        "2025-08",
        "2025-09",
        "2025-10",
        "2025-11",
        "2025-12",
        "2026-01",
        "2026-02",
        "2026-03",
        "2026-04",
        "2026-05"
      ],
      "failedMonths": []
    }
  },
  "coverage": {
    "byYear": {
      "2016": 366,
      "2017": 365,
      "2018": 365,
      "2019": 365,
      "2020": 366,
      "2021": 365,
      "2022": 365,
      "2023": 365,
      "2024": 366,
      "2025": 365,
      "2026": 159
    },
    "monthTable": [
      {
        "month": "2016-01",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2016-02",
        "storedDays": 29,
        "expectedDays": 29,
        "state": "complete"
      },
      {
        "month": "2016-03",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2016-04",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2016-05",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2016-06",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2016-07",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2016-08",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2016-09",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2016-10",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2016-11",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2016-12",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2017-01",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2017-02",
        "storedDays": 28,
        "expectedDays": 28,
        "state": "complete"
      },
      {
        "month": "2017-03",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2017-04",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2017-05",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2017-06",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2017-07",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2017-08",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2017-09",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2017-10",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2017-11",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2017-12",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2018-01",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2018-02",
        "storedDays": 28,
        "expectedDays": 28,
        "state": "complete"
      },
      {
        "month": "2018-03",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2018-04",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2018-05",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2018-06",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2018-07",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2018-08",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2018-09",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2018-10",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2018-11",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2018-12",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2019-01",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2019-02",
        "storedDays": 28,
        "expectedDays": 28,
        "state": "complete"
      },
      {
        "month": "2019-03",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2019-04",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2019-05",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2019-06",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2019-07",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2019-08",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2019-09",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2019-10",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2019-11",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2019-12",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2020-01",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2020-02",
        "storedDays": 29,
        "expectedDays": 29,
        "state": "complete"
      },
      {
        "month": "2020-03",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2020-04",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2020-05",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2020-06",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2020-07",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2020-08",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2020-09",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2020-10",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2020-11",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2020-12",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2021-01",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2021-02",
        "storedDays": 28,
        "expectedDays": 28,
        "state": "complete"
      },
      {
        "month": "2021-03",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2021-04",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2021-05",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2021-06",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2021-07",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2021-08",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2021-09",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2021-10",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2021-11",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2021-12",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2022-01",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2022-02",
        "storedDays": 28,
        "expectedDays": 28,
        "state": "complete"
      },
      {
        "month": "2022-03",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2022-04",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2022-05",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2022-06",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2022-07",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2022-08",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2022-09",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2022-10",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2022-11",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2022-12",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2023-01",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2023-02",
        "storedDays": 28,
        "expectedDays": 28,
        "state": "complete"
      },
      {
        "month": "2023-03",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2023-04",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2023-05",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2023-06",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2023-07",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2023-08",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2023-09",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2023-10",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2023-11",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2023-12",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2024-01",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2024-02",
        "storedDays": 29,
        "expectedDays": 29,
        "state": "complete"
      },
      {
        "month": "2024-03",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2024-04",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2024-05",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2024-06",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2024-07",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2024-08",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2024-09",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2024-10",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2024-11",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2024-12",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2025-01",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2025-02",
        "storedDays": 28,
        "expectedDays": 28,
        "state": "complete"
      },
      {
        "month": "2025-03",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2025-04",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2025-05",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2025-06",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2025-07",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2025-08",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2025-09",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2025-10",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2025-11",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2025-12",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2026-01",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2026-02",
        "storedDays": 28,
        "expectedDays": 28,
        "state": "complete"
      },
      {
        "month": "2026-03",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2026-04",
        "storedDays": 30,
        "expectedDays": 30,
        "state": "complete"
      },
      {
        "month": "2026-05",
        "storedDays": 31,
        "expectedDays": 31,
        "state": "complete"
      },
      {
        "month": "2026-06",
        "storedDays": 8,
        "expectedDays": 30,
        "state": "partial"
      }
    ],
    "completeMonths": [
      "2016-01",
      "2016-02",
      "2016-03",
      "2016-04",
      "2016-05",
      "2016-06",
      "2016-07",
      "2016-08",
      "2016-09",
      "2016-10",
      "2016-11",
      "2016-12",
      "2017-01",
      "2017-02",
      "2017-03",
      "2017-04",
      "2017-05",
      "2017-06",
      "2017-07",
      "2017-08",
      "2017-09",
      "2017-10",
      "2017-11",
      "2017-12",
      "2018-01",
      "2018-02",
      "2018-03",
      "2018-04",
      "2018-05",
      "2018-06",
      "2018-07",
      "2018-08",
      "2018-09",
      "2018-10",
      "2018-11",
      "2018-12",
      "2019-01",
      "2019-02",
      "2019-03",
      "2019-04",
      "2019-05",
      "2019-06",
      "2019-07",
      "2019-08",
      "2019-09",
      "2019-10",
      "2019-11",
      "2019-12",
      "2020-01",
      "2020-02",
      "2020-03",
      "2020-04",
      "2020-05",
      "2020-06",
      "2020-07",
      "2020-08",
      "2020-09",
      "2020-10",
      "2020-11",
      "2020-12",
      "2021-01",
      "2021-02",
      "2021-03",
      "2021-04",
      "2021-05",
      "2021-06",
      "2021-07",
      "2021-08",
      "2021-09",
      "2021-10",
      "2021-11",
      "2021-12",
      "2022-01",
      "2022-02",
      "2022-03",
      "2022-04",
      "2022-05",
      "2022-06",
      "2022-07",
      "2022-08",
      "2022-09",
      "2022-10",
      "2022-11",
      "2022-12",
      "2023-01",
      "2023-02",
      "2023-03",
      "2023-04",
      "2023-05",
      "2023-06",
      "2023-07",
      "2023-08",
      "2023-09",
      "2023-10",
      "2023-11",
      "2023-12",
      "2024-01",
      "2024-02",
      "2024-03",
      "2024-04",
      "2024-05",
      "2024-06",
      "2024-07",
      "2024-08",
      "2024-09",
      "2024-10",
      "2024-11",
      "2024-12",
      "2025-01",
      "2025-02",
      "2025-03",
      "2025-04",
      "2025-05",
      "2025-06",
      "2025-07",
      "2025-08",
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05"
    ],
    "partialMonths": [
      {
        "month": "2026-06",
        "storedDays": 8,
        "expectedDays": 30,
        "state": "partial"
      }
    ],
    "missingMonths": [],
    "badRows": 0
  },
  "fieldIntegrity": {
    "requiredFieldCounts": {
      "date": 3812,
      "technology": 3812,
      "averageMW": 3812,
      "highMW": 3812,
      "lowMW": 3812,
      "mwh": 3804,
      "sampleCount": 3812,
      "completeness": 3804,
      "source": 3812,
      "sourceAttribution": 3804,
      "methodState": 3812,
      "status": 3812
    },
    "badNumericSamples": []
  },
  "progressVsStored": {
    "completeMonthsInProgress": [
      "2016-01",
      "2016-02",
      "2016-03",
      "2016-04",
      "2016-05",
      "2016-06",
      "2016-07",
      "2016-08",
      "2016-09",
      "2016-10",
      "2016-11",
      "2016-12",
      "2017-01",
      "2017-02",
      "2017-03",
      "2017-04",
      "2017-05",
      "2017-06",
      "2017-07",
      "2017-08",
      "2017-09",
      "2017-10",
      "2017-11",
      "2017-12",
      "2018-01",
      "2018-02",
      "2018-03",
      "2018-04",
      "2018-05",
      "2018-06",
      "2018-07",
      "2018-08",
      "2018-09",
      "2018-10",
      "2018-11",
      "2018-12",
      "2019-01",
      "2019-02",
      "2019-03",
      "2019-04",
      "2019-05",
      "2019-06",
      "2019-07",
      "2019-08",
      "2019-09",
      "2019-10",
      "2019-11",
      "2019-12",
      "2020-01",
      "2020-02",
      "2020-03",
      "2020-04",
      "2020-05",
      "2020-06",
      "2020-07",
      "2020-08",
      "2020-09",
      "2020-10",
      "2020-11",
      "2020-12",
      "2021-01",
      "2021-02",
      "2021-03",
      "2021-04",
      "2021-05",
      "2021-06",
      "2021-07",
      "2021-08",
      "2021-09",
      "2021-10",
      "2021-11",
      "2021-12",
      "2022-01",
      "2022-02",
      "2022-03",
      "2022-04",
      "2022-05",
      "2022-06",
      "2022-07",
      "2022-08",
      "2022-09",
      "2022-10",
      "2022-11",
      "2022-12",
      "2023-01",
      "2023-02",
      "2023-03",
      "2023-04",
      "2023-05",
      "2023-06",
      "2023-07",
      "2023-08",
      "2023-09",
      "2023-10",
      "2023-11",
      "2023-12",
      "2024-01",
      "2024-02",
      "2024-03",
      "2024-04",
      "2024-05",
      "2024-06",
      "2024-07",
      "2024-08",
      "2024-09",
      "2024-10",
      "2024-11",
      "2024-12",
      "2025-01",
      "2025-02",
      "2025-03",
      "2025-04",
      "2025-05",
      "2025-06",
      "2025-07",
      "2025-08",
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05"
    ],
    "completeMonthsInStoredRows": [
      "2016-01",
      "2016-02",
      "2016-03",
      "2016-04",
      "2016-05",
      "2016-06",
      "2016-07",
      "2016-08",
      "2016-09",
      "2016-10",
      "2016-11",
      "2016-12",
      "2017-01",
      "2017-02",
      "2017-03",
      "2017-04",
      "2017-05",
      "2017-06",
      "2017-07",
      "2017-08",
      "2017-09",
      "2017-10",
      "2017-11",
      "2017-12",
      "2018-01",
      "2018-02",
      "2018-03",
      "2018-04",
      "2018-05",
      "2018-06",
      "2018-07",
      "2018-08",
      "2018-09",
      "2018-10",
      "2018-11",
      "2018-12",
      "2019-01",
      "2019-02",
      "2019-03",
      "2019-04",
      "2019-05",
      "2019-06",
      "2019-07",
      "2019-08",
      "2019-09",
      "2019-10",
      "2019-11",
      "2019-12",
      "2020-01",
      "2020-02",
      "2020-03",
      "2020-04",
      "2020-05",
      "2020-06",
      "2020-07",
      "2020-08",
      "2020-09",
      "2020-10",
      "2020-11",
      "2020-12",
      "2021-01",
      "2021-02",
      "2021-03",
      "2021-04",
      "2021-05",
      "2021-06",
      "2021-07",
      "2021-08",
      "2021-09",
      "2021-10",
      "2021-11",
      "2021-12",
      "2022-01",
      "2022-02",
      "2022-03",
      "2022-04",
      "2022-05",
      "2022-06",
      "2022-07",
      "2022-08",
      "2022-09",
      "2022-10",
      "2022-11",
      "2022-12",
      "2023-01",
      "2023-02",
      "2023-03",
      "2023-04",
      "2023-05",
      "2023-06",
      "2023-07",
      "2023-08",
      "2023-09",
      "2023-10",
      "2023-11",
      "2023-12",
      "2024-01",
      "2024-02",
      "2024-03",
      "2024-04",
      "2024-05",
      "2024-06",
      "2024-07",
      "2024-08",
      "2024-09",
      "2024-10",
      "2024-11",
      "2024-12",
      "2025-01",
      "2025-02",
      "2025-03",
      "2025-04",
      "2025-05",
      "2025-06",
      "2025-07",
      "2025-08",
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05"
    ],
    "progressMonthsMissingFromStoredRows": [],
    "storedMonthsMissingFromProgress": []
  },
  "maxStoredDailyHighMW": {
    "date": "2026-04-23",
    "highMW": 16289.2,
    "averageMW": 5214.021,
    "lowMW": 0.0,
    "mwh": 125136.501,
    "sampleCount": 48,
    "completeness": 1.0,
    "source": "Sheffield Solar PVLive",
    "methodState": "PVLIVE EMBEDDED ESTIMATE",
    "status": "candidate"
  },
  "topStoredDailyHighs": [
    {
      "date": "2026-04-23",
      "highMW": 16289.2,
      "averageMW": 5214.021,
      "lowMW": 0.0,
      "mwh": 125136.501,
      "sampleCount": 48,
      "completeness": 1.0,
      "source": "Sheffield Solar PVLive",
      "methodState": "PVLIVE EMBEDDED ESTIMATE",
      "status": "candidate"
    },
    {
      "date": "2026-04-24",
      "highMW": 16227.4,
      "averageMW": 5265.584,
      "lowMW": 0.0,
      "mwh": 126374.007,
      "sampleCount": 48,
      "completeness": 1.0,
      "source": "Sheffield Solar PVLive",
      "methodState": "PVLIVE EMBEDDED ESTIMATE",
      "status": "candidate"
    },
    {
      "date": "2026-04-29",
      "highMW": 16095.2,
      "averageMW": 5311.829,
      "lowMW": 0.0,
      "mwh": 127483.897,
      "sampleCount": 48,
      "completeness": 1.0,
      "source": "Sheffield Solar PVLive",
      "methodState": "PVLIVE EMBEDDED ESTIMATE",
      "status": "candidate"
    },
    {
      "date": "2026-04-30",
      "highMW": 16009.6,
      "averageMW": 5336.467,
      "lowMW": 0.0,
      "mwh": 128075.198,
      "sampleCount": 48,
      "completeness": 1.0,
      "source": "Sheffield Solar PVLive",
      "methodState": "PVLIVE EMBEDDED ESTIMATE",
      "status": "candidate"
    },
    {
      "date": "2026-04-22",
      "highMW": 15653.6,
      "averageMW": 5013.536,
      "lowMW": 0.0,
      "mwh": 120324.861,
      "sampleCount": 48,
      "completeness": 1.0,
      "source": "Sheffield Solar PVLive",
      "methodState": "PVLIVE EMBEDDED ESTIMATE",
      "status": "candidate"
    },
    {
      "date": "2026-04-25",
      "highMW": 15413.9,
      "averageMW": 5003.824,
      "lowMW": 0.0,
      "mwh": 120091.773,
      "sampleCount": 48,
      "completeness": 1.0,
      "source": "Sheffield Solar PVLive",
      "methodState": "PVLIVE EMBEDDED ESTIMATE",
      "status": "candidate"
    },
    {
      "date": "2026-05-24",
      "highMW": 15167.3,
      "averageMW": 5287.748,
      "lowMW": 0.0,
      "mwh": 126905.957,
      "sampleCount": 48,
      "completeness": 1.0,
      "source": "Sheffield Solar PVLive",
      "methodState": "PVLIVE EMBEDDED ESTIMATE",
      "status": "candidate"
    },
    {
      "date": "2026-05-25",
      "highMW": 15088.4,
      "averageMW": 5271.734,
      "lowMW": 0.0,
      "mwh": 126521.622,
      "sampleCount": 48,
      "completeness": 1.0,
      "source": "Sheffield Solar PVLive",
      "methodState": "PVLIVE EMBEDDED ESTIMATE",
      "status": "candidate"
    },
    {
      "date": "2026-04-07",
      "highMW": 14862.9,
      "averageMW": 4463.227,
      "lowMW": 0.0,
      "mwh": 107117.458,
      "sampleCount": 48,
      "completeness": 1.0,
      "source": "Sheffield Solar PVLive",
      "methodState": "PVLIVE EMBEDDED ESTIMATE",
      "status": "candidate"
    },
    {
      "date": "2026-05-23",
      "highMW": 14715.1,
      "averageMW": 4896.693,
      "lowMW": 0.0,
      "mwh": 117520.641,
      "sampleCount": 48,
      "completeness": 1.0,
      "source": "Sheffield Solar PVLive",
      "methodState": "PVLIVE EMBEDDED ESTIMATE",
      "status": "candidate"
    },
    {
      "date": "2026-05-22",
      "highMW": 14604.9,
      "averageMW": 5005.98,
      "lowMW": 0.0,
      "mwh": 120143.523,
      "sampleCount": 48,
      "completeness": 1.0,
      "source": "Sheffield Solar PVLive",
      "methodState": "PVLIVE EMBEDDED ESTIMATE",
      "status": "candidate"
    },
    {
      "date": "2026-05-26",
      "highMW": 14478.6,
      "averageMW": 4974.537,
      "lowMW": 0.0,
      "mwh": 119388.892,
      "sampleCount": 48,
      "completeness": 1.0,
      "source": "Sheffield Solar PVLive",
      "methodState": "PVLIVE EMBEDDED ESTIMATE",
      "status": "candidate"
    },
    {
      "date": "2026-05-30",
      "highMW": 14458.9,
      "averageMW": 5001.859,
      "lowMW": 0.0,
      "mwh": 120044.605,
      "sampleCount": 48,
      "completeness": 1.0,
      "source": "Sheffield Solar PVLive",
      "methodState": "PVLIVE EMBEDDED ESTIMATE",
      "status": "candidate"
    },
    {
      "date": "2026-04-06",
      "highMW": 14385.4,
      "averageMW": 4383.438,
      "lowMW": 0.0,
      "mwh": 105202.516,
      "sampleCount": 48,
      "completeness": 1.0,
      "source": "Sheffield Solar PVLive",
      "methodState": "PVLIVE EMBEDDED ESTIMATE",
      "status": "candidate"
    },
    {
      "date": "2026-05-27",
      "highMW": 14300.0,
      "averageMW": 5076.305,
      "lowMW": 0.0,
      "mwh": 121831.321,
      "sampleCount": 48,
      "completeness": 1.0,
      "source": "Sheffield Solar PVLive",
      "methodState": "PVLIVE EMBEDDED ESTIMATE",
      "status": "candidate"
    },
    {
      "date": "2025-07-08",
      "highMW": 13897.6,
      "averageMW": 4860.616,
      "lowMW": 0.0,
      "mwh": 116654.791,
      "sampleCount": 48,
      "completeness": 1.0,
      "source": "Sheffield Solar PVLive",
      "methodState": "PVLIVE EMBEDDED ESTIMATE",
      "status": "candidate"
    },
    {
      "date": "2025-07-12",
      "highMW": 13860.4,
      "averageMW": 4817.88,
      "lowMW": 0.0,
      "mwh": 115629.109,
      "sampleCount": 48,
      "completeness": 1.0,
      "source": "Sheffield Solar PVLive",
      "methodState": "PVLIVE EMBEDDED ESTIMATE",
      "status": "candidate"
    },
    {
      "date": "2026-04-26",
      "highMW": 13773.6,
      "averageMW": 4239.186,
      "lowMW": 0.0,
      "mwh": 101740.476,
      "sampleCount": 48,
      "completeness": 1.0,
      "source": "Sheffield Solar PVLive",
      "methodState": "PVLIVE EMBEDDED ESTIMATE",
      "status": "candidate"
    },
    {
      "date": "2026-04-27",
      "highMW": 13767.4,
      "averageMW": 4297.257,
      "lowMW": 0.0,
      "mwh": 103134.174,
      "sampleCount": 48,
      "completeness": 1.0,
      "source": "Sheffield Solar PVLive",
      "methodState": "PVLIVE EMBEDDED ESTIMATE",
      "status": "candidate"
    },
    {
      "date": "2025-04-06",
      "highMW": 13640.0,
      "averageMW": 4250.394,
      "lowMW": 0.0,
      "mwh": 102009.463,
      "sampleCount": 48,
      "completeness": 1.0,
      "source": "Sheffield Solar PVLive",
      "methodState": "PVLIVE EMBEDDED ESTIMATE",
      "status": "candidate"
    }
  ],
  "recentHalfHourlyPeak": {
    "time": "2026-05-24T12:30:00Z",
    "generationMW": 15167.3,
    "technology": "Solar",
    "source": "Sheffield Solar PVLive"
  },
  "dateChecks": {
    "2026-04-23": {
      "presentInStored": true,
      "stored": {
        "date": "2026-04-23",
        "technology": "Solar",
        "averageMW": 5214.021,
        "highMW": 16289.2,
        "lowMW": 0.0,
        "sampleCount": 48,
        "mwh": 125136.501,
        "source": "Sheffield Solar PVLive",
        "sourceAttribution": "Sheffield Solar PVLive, solar.sheffield.ac.uk",
        "methodState": "PVLIVE EMBEDDED ESTIMATE",
        "status": "candidate",
        "completeness": 1.0
      },
      "fetched": {
        "date": "2026-04-23",
        "url": "https://api.solar.sheffield.ac.uk/pvlive/api/v4/gsp/0?start=2026-04-23T00%3A00%3A00Z&end=2026-04-23T23%3A59%3A00Z",
        "sampleCount": 48,
        "averageMW": 5214.021,
        "highMW": 16289.2,
        "highTimeUTC": "2026-04-23T12:30:00Z",
        "lowMW": 0.0,
        "lowTimeUTC": "2026-04-23T23:30:00Z",
        "mwh": 125136.501,
        "completeness": 1.0
      },
      "comparison": {
        "averageMW": {
          "stored": 5214.021,
          "fetched": 5214.021,
          "delta": 0.0
        },
        "highMW": {
          "stored": 16289.2,
          "fetched": 16289.2,
          "delta": 0.0
        },
        "lowMW": {
          "stored": 0.0,
          "fetched": 0.0,
          "delta": 0.0
        },
        "mwh": {
          "stored": 125136.501,
          "fetched": 125136.501,
          "delta": 0.0
        },
        "sampleCount": {
          "stored": 48.0,
          "fetched": 48.0,
          "delta": 0.0
        },
        "completeness": {
          "stored": 1.0,
          "fetched": 1.0,
          "delta": 0.0
        }
      }
    },
    "2026-05-24": {
      "presentInStored": true,
      "stored": {
        "date": "2026-05-24",
        "technology": "Solar",
        "averageMW": 5287.748,
        "highMW": 15167.3,
        "lowMW": 0.0,
        "sampleCount": 48,
        "mwh": 126905.957,
        "source": "Sheffield Solar PVLive",
        "sourceAttribution": "Sheffield Solar PVLive, solar.sheffield.ac.uk",
        "methodState": "PVLIVE EMBEDDED ESTIMATE",
        "status": "candidate",
        "completeness": 1.0
      },
      "fetched": {
        "date": "2026-05-24",
        "url": "https://api.solar.sheffield.ac.uk/pvlive/api/v4/gsp/0?start=2026-05-24T00%3A00%3A00Z&end=2026-05-24T23%3A59%3A00Z",
        "sampleCount": 48,
        "averageMW": 5287.748,
        "highMW": 15167.3,
        "highTimeUTC": "2026-05-24T12:30:00Z",
        "lowMW": 0.0,
        "lowTimeUTC": "2026-05-24T23:30:00Z",
        "mwh": 126905.957,
        "completeness": 1.0
      },
      "comparison": {
        "averageMW": {
          "stored": 5287.748,
          "fetched": 5287.748,
          "delta": 0.0
        },
        "highMW": {
          "stored": 15167.3,
          "fetched": 15167.3,
          "delta": 0.0
        },
        "lowMW": {
          "stored": 0.0,
          "fetched": 0.0,
          "delta": 0.0
        },
        "mwh": {
          "stored": 126905.957,
          "fetched": 126905.957,
          "delta": 0.0
        },
        "sampleCount": {
          "stored": 48.0,
          "fetched": 48.0,
          "delta": 0.0
        },
        "completeness": {
          "stored": 1.0,
          "fetched": 1.0,
          "delta": 0.0
        }
      }
    }
  },
  "integrityFlags": {
    "has20260423": true,
    "has20260524": true,
    "hasHighMW": true,
    "hasAverageMW": true,
    "hasLowMW": true,
    "hasMwh": false,
    "missingMonthCount": 0,
    "partialMonthCount": 1
  },
  "decisionRule": "Fill missing months before using Solar peak UI as authoritative. Do not claim a 2016 to present Solar series unless coverage shows complete or justified partial months.",
  "pass": true
}
```
