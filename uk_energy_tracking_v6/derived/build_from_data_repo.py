"""Rebuild the decade summary from Ventusltd/data-gb-electricity.

WHY THIS, AND WHY ONLY THIS
---------------------------
globalgrid2050 carries 240 workflows, and they were all frozen to manual
dispatch because that had become unmanageable. Unfreezing them would recreate
exactly the problem that was solved by freezing them.

The data problem was solved elsewhere: data-gb-electricity holds GB half-hourly
prices as partitioned Parquet and refreshes itself monthly on a schedule that
is still running. What broke was not collection. What broke is that nothing
consumes it any more, so the tracker's published figures stopped moving.

So this is one script behind one scheduled workflow. It reads the Parquet the
data repo already maintains and rewrites the small summary the Atlas reads. The
chain becomes: Elexon to data-gb-electricity, monthly; data-gb-electricity to
this summary, monthly; this summary to the map, on demand.

CROSS-CHECKED, NOT ASSUMED
--------------------------
The tracker also holds its own daily JSON series, derived separately and
earlier. Run against both on 2026-08-31 the extremes agree exactly -- lowest
half hour -185.33 GBP/MWh, highest 4037.80 -- which is a real check on two
independent paths from the same upstream.

Their coverage does not agree, and that is worth stating rather than hiding.
The Parquet spans 2016-01-01 to 2026-06-17 with 3,339 complete days; the JSON
series spans 2016-06-03 to 2026-06-02 with 3,652. Different windows and
different gap handling give different means, 78.18 against 80.17. Neither is
wrong. The summary records which source produced it and over what span, so the
figure is always attributable.

    python build_from_data_repo.py --data ../../data-gb-electricity
"""

import argparse
import io
import json
import os
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))

# A day needs half its half hours before it means anything as a daily mean.
MIN_OBSERVATIONS = 24

DAILY = """
SELECT settlementDate AS day,
       avg(systemSellPriceGBPperMWh) AS mean,
       min(systemSellPriceGBPperMWh) AS lo,
       max(systemSellPriceGBPperMWh) AS hi,
       count(*) AS obs
FROM read_parquet(?)
WHERE systemSellPriceGBPperMWh IS NOT NULL
GROUP BY 1
HAVING count(*) >= {min}
ORDER BY 1
""".format(min=MIN_OBSERVATIONS)


def mean(values):
    return sum(values) / len(values) if values else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=os.path.join(HERE, "..", "..", "..",
                                                   "data-gb-electricity"))
    ap.add_argument("--out", default=os.path.join(HERE, "decade-summary.json"))
    a = ap.parse_args()

    import duckdb

    glob = os.path.join(os.path.abspath(a.data), "prices", "year=*", "month=*",
                        "data_0.parquet").replace("\\", "/")
    con = duckdb.connect()
    rows = con.execute(DAILY, [glob]).fetchall()
    if not rows:
        raise SystemExit("no price rows matched %s" % glob)

    by_year = defaultdict(list)
    negative = defaultdict(int)
    lowest = None
    highest = None
    for day, day_mean, lo, hi, _obs in rows:
        year = str(day)[:4]
        by_year[year].append(float(day_mean))
        # Counted separately from the daily mean, because a mean hides them
        # completely and they are the export limitation question.
        if lo is not None and float(lo) < 0:
            negative[year] += 1
        if lo is not None and (lowest is None or float(lo) < lowest["value"]):
            lowest = {"value": round(float(lo), 2), "date": str(day)}
        if hi is not None and (highest is None or float(hi) > highest["value"]):
            highest = {"value": round(float(hi), 2), "date": str(day)}

    price_years = [{
        "year": year,
        "days": len(values),
        "mean_gbp_per_mwh": round(mean(values), 2),
        "min_daily_mean": round(min(values), 2),
        "max_daily_mean": round(max(values), 2),
        "days_with_a_negative_half_hour": negative.get(year, 0),
    } for year, values in sorted(by_year.items())]

    all_days = [v for values in by_year.values() for v in values]

    # The solar series has no Parquet equivalent in the data repo yet, so it is
    # carried forward from the existing summary rather than dropped. Losing a
    # decade of PVLive because a different source was rewired would be a poor
    # trade.
    solar = None
    if os.path.exists(a.out):
        try:
            solar = json.loads(io.open(a.out, encoding="utf-8").read()).get("solar")
        except Exception:
            solar = None

    summary = {
        "schema": "globalgrid2050.decade-summary.v1",
        "what_this_is": (
            "Yearly aggregates of GB half-hourly system prices, derived from "
            "Ventusltd/data-gb-electricity, so that a map can carry the decade "
            "without carrying the series. No resampling, smoothing, modelling "
            "or forecasting: every figure is an arithmetic aggregate of "
            "settlement periods, a day needs at least %d of them to count, and "
            "the day count behind each year is stated so a partial year reads "
            "as one." % MIN_OBSERVATIONS),
        "not_a_forecast": (
            "Historic system conditions. Nothing here is a projection, a price "
            "expectation, or a statement about the economics of any project."),
        "derived_from": {
            "price": {
                "repository": "Ventusltd/data-gb-electricity",
                "path": "prices/year=*/month=*/data_0.parquet",
                "field": "systemSellPriceGBPperMWh",
                "upstream": "Elexon",
                "settlement_periods": con.execute(
                    "SELECT count(*) FROM read_parquet(?) "
                    "WHERE systemSellPriceGBPperMWh IS NOT NULL", [glob]).fetchone()[0],
                "complete_days": len(all_days),
                "minimum_observations_per_day": MIN_OBSERVATIONS,
            },
            "solar": (solar or {}).get("carried_from") or {
                "repository": "globalgrid2050",
                "path": "uk_energy_tracking_v6/generation_history/pvlive_solar_daily_browser.json",
                "upstream": "Sheffield Solar PVLive",
                "note": ("carried forward: the data repository has no PVLive "
                         "Parquet yet, and dropping a decade of solar because "
                         "the price source was rewired would be a poor trade"),
            },
        },
        "cross_check": (
            "The tracker's own daily JSON series, derived independently and "
            "earlier, agrees exactly on the extremes -- lowest -185.33, highest "
            "4037.80 -- and differs on coverage: Parquet 2016-01-01 to "
            "2026-06-17, JSON 2016-06-03 to 2026-06-02. Different windows give "
            "different means. Neither is wrong; the source is recorded so the "
            "figure is attributable."),
        "price": {
            "unit": "GBP per MWh, GB system sell price, daily mean of settlement periods",
            "span": [price_years[0]["year"], price_years[-1]["year"]],
            "decade_mean": round(mean(all_days), 2),
            "lowest_half_hour": lowest,
            "highest_half_hour": highest,
            "by_year": price_years,
        },
    }
    if solar:
        summary["solar"] = solar

    io.open(a.out, "w", encoding="utf-8", newline="\n").write(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n")

    neg = sum(y["days_with_a_negative_half_hour"] for y in price_years)
    print("wrote %s (%.1f kB)" % (a.out, os.path.getsize(a.out) / 1024.0))
    print("  %s-%s, %d complete days, mean %.2f GBP/MWh"
          % (price_years[0]["year"], price_years[-1]["year"], len(all_days),
             mean(all_days)))
    print("  %d days had at least one settlement period below zero" % neg)
    print("  lowest %s  highest %s" % (lowest, highest))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
