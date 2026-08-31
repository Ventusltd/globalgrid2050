"""Derive a compact decade summary from the tracker's own official series.

WHY THIS EXISTS
---------------
The tracker holds a decade of GB daily system prices from Elexon and a decade
of daily solar from Sheffield Solar PVLive. Together they are about 1.9 MB.
That is the right size for a dashboard someone has chosen to open on a desktop
and the wrong size for a panel inside a map on a phone, which is where most
readers arrive from a shared link.

So this reduces them, once, to yearly aggregates: roughly five kilobytes that
answer the questions a map of generation projects actually raises. What has a
megawatt hour been worth. How often was it worth less than nothing. What does
GB solar do across a year.

WHAT IT DOES NOT DO
-------------------
It does not resample, smooth, model or forecast. Every figure is an arithmetic
aggregate of days that are already in the published series, and the count of
days behind each one is carried with it, so a partial year is visible as a
partial year rather than quietly averaged in with the rest.

The daily series remain the source of truth and the tracker remains the place
the analysis lives. This is an index card, not a replacement.

    python make_decade_summary.py
"""

import io
import json
import os
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)

PRICE = os.path.join(APP, "electricity_price_history_daily_decade.json")
SOLAR = os.path.join(APP, "generation_history", "pvlive_solar_daily_browser.json")


def read(path):
    return json.loads(io.open(path, encoding="utf-8").read())


def mean(values):
    return sum(values) / len(values) if values else None


def main():
    price = read(PRICE)
    solar = read(SOLAR)

    # ---- price, by calendar year ----------------------------------------
    by_year = defaultdict(list)
    negative_days = defaultdict(int)
    lowest = None
    highest = None
    for row in price.get("rows", []):
        date = row.get("date") or ""
        avg = row.get("average")
        if len(date) < 4 or not isinstance(avg, (int, float)):
            continue
        year = date[:4]
        by_year[year].append(float(avg))
        # A day whose LOW went below zero is a day the system paid to be
        # relieved of energy. For a solar developer that is the export
        # limitation and curtailment question, so it is counted separately
        # from the daily average, which can hide it entirely.
        low = row.get("low")
        if isinstance(low, (int, float)) and float(low) < 0:
            negative_days[year] += 1
        if lowest is None or (isinstance(low, (int, float)) and float(low) < lowest["value"]):
            if isinstance(low, (int, float)):
                lowest = {"value": float(low), "date": date, "at": row.get("lowAt")}
        high = row.get("high")
        if isinstance(high, (int, float)) and (highest is None or float(high) > highest["value"]):
            highest = {"value": float(high), "date": date, "at": row.get("highAt")}

    price_years = []
    for year in sorted(by_year):
        values = by_year[year]
        price_years.append({
            "year": year,
            "days": len(values),
            "mean_gbp_per_mwh": round(mean(values), 2),
            "min_daily_mean": round(min(values), 2),
            "max_daily_mean": round(max(values), 2),
            "days_with_a_negative_half_hour": negative_days.get(year, 0),
        })

    # ---- solar, by calendar year and by month ---------------------------
    solar_year = defaultdict(list)
    solar_month = defaultdict(list)
    for row in solar.get("rows", []):
        date = row.get("date") or ""
        avg = row.get("averageMW")
        if len(date) < 7 or not isinstance(avg, (int, float)):
            continue
        solar_year[date[:4]].append(float(avg))
        solar_month[date[5:7]].append(float(avg))

    solar_years = [{
        "year": year,
        "days": len(values),
        "mean_mw": round(mean(values), 1),
        "max_daily_mean_mw": round(max(values), 1),
    } for year, values in sorted(solar_year.items())]

    # The seasonal shape is the single most useful thing a solar developer can
    # read off a decade: it is why a nameplate figure and a yield are different
    # conversations.
    solar_months = [{
        "month": month,
        "days": len(values),
        "mean_mw": round(mean(values), 1),
    } for month, values in sorted(solar_month.items())]

    all_price = [v for values in by_year.values() for v in values]
    all_solar = [v for values in solar_year.values() for v in values]

    summary = {
        "schema": "globalgrid2050.decade-summary.v1",
        "what_this_is": (
            "Yearly aggregates derived from the tracker's own daily series, so "
            "that a map can carry the decade without carrying 1.9 MB. No "
            "resampling, smoothing, modelling or forecasting: every figure is "
            "an arithmetic aggregate of published days, and the day count "
            "behind each one is stated so a partial year reads as one."),
        "not_a_forecast": (
            "Historic system conditions. Nothing here is a projection, a price "
            "expectation, or a statement about the economics of any project."),
        "derived_from": {
            "price": {
                "file": "electricity_price_history_daily_decade.json",
                "source": price.get("source"),
                "generated_utc": price.get("generated_utc"),
                "schema": price.get("schema"),
                "days": len(all_price),
            },
            "solar": {
                "file": "generation_history/pvlive_solar_daily_browser.json",
                "source": solar.get("source"),
                "attribution": solar.get("sourceAttribution"),
                "note": solar.get("sourceNote"),
                "generated_utc": solar.get("generatedUTC"),
                "days": len(all_solar),
            },
        },
        "price": {
            "unit": "GBP per MWh, GB system price, daily mean of half hours",
            "span": [price_years[0]["year"], price_years[-1]["year"]] if price_years else None,
            "decade_mean": round(mean(all_price), 2) if all_price else None,
            "lowest_half_hour": lowest,
            "highest_half_hour": highest,
            "by_year": price_years,
        },
        "solar": {
            "unit": "MW, GB solar generation estimated by Sheffield Solar PVLive",
            "estimated_not_metered": True,
            "decade_mean_mw": round(mean(all_solar), 1) if all_solar else None,
            "by_year": solar_years,
            "by_month": solar_months,
        },
    }

    out = os.path.join(HERE, "decade-summary.json")
    io.open(out, "w", encoding="utf-8", newline="\n").write(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n")
    size = os.path.getsize(out)
    print("wrote %s (%.1f kB)" % (os.path.relpath(out, APP), size / 1024.0))
    print("  price  %s-%s, %d days, decade mean %.2f GBP/MWh"
          % (price_years[0]["year"], price_years[-1]["year"], len(all_price),
             mean(all_price)))
    print("  solar  %d days, decade mean %.1f MW" % (len(all_solar), mean(all_solar)))
    neg = sum(y["days_with_a_negative_half_hour"] for y in price_years)
    print("  %d days had at least one half hour below zero" % neg)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
