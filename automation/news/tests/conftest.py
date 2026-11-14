"""Shared fixtures for automation/news tests. Synthetic REPD releases; no network."""
from __future__ import annotations

import csv
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

COLUMNS = [
    "Old Ref ID", "Ref ID", "Record Last Updated (dd/mm/yyyy)", "Operator (or Applicant)", "Site Name",
    "Technology Type", "Storage Co-location REPD Ref ID", "Installed Capacity (MWelec)",
    "Development Status", "Development Status (short)", "County", "Region", "Country", "Planning Authority",
    "Planning Application Reference", "Planning Application Submitted", "Planning Application Withdrawn",
    "Planning Permission Refused", "Appeal Lodged", "Appeal Withdrawn", "Appeal Refused", "Appeal Granted",
    "Planning Permission  Granted", "Secretary of State - Refusal", "Secretary of State - Granted",
    "Planning Permission Expired", "Under Construction", "Operational",
]


def row(ref, site, tech, mw, status, *, operator="Example Energy Ltd", county="Lincolnshire",
        region="East Midlands", country="England", authority="North Kesteven", pref="", coloc="",
        updated="01/10/2026", **dates):
    r = {c: "" for c in COLUMNS}
    r.update({"Ref ID": str(ref), "Site Name": site, "Technology Type": tech,
              "Installed Capacity (MWelec)": "" if mw is None else str(mw), "Development Status (short)": status,
              "Development Status": status, "Operator (or Applicant)": operator, "County": county,
              "Region": region, "Country": country, "Planning Authority": authority,
              "Planning Application Reference": pref, "Storage Co-location REPD Ref ID": coloc,
              "Record Last Updated (dd/mm/yyyy)": updated})
    key = {"granted": "Planning Permission  Granted", "submitted": "Planning Application Submitted",
           "refused": "Planning Permission Refused", "uc": "Under Construction", "op": "Operational",
           "withdrawn": "Planning Application Withdrawn", "appeal": "Appeal Lodged"}
    for k, v in dates.items():
        r[key[k]] = v
    return r


def write_csv(path: Path, rows) -> Path:
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        for r in rows:
            w.writerow(r)
    return path


PREVIOUS = [
    row(1, "Alpha Fen Solar Farm", "Solar Photovoltaics", 400, "Application Submitted", submitted="01/02/2025",
        authority="The Planning Inspectorate - National Infrastructure", pref="EN010999", coloc="2"),
    row(2, "Alpha Fen Solar Farm", "Battery", 600, "Application Submitted", coloc="1"),
    row(3, "Bravo Lane - Battery Storage", "Battery", 100, "Awaiting Construction", granted="01/01/2026"),
    row(4, "Charlie Moor Solar", "Solar Photovoltaics", 49.9, "Under Construction", uc="01/03/2026"),
    row(5, "Delta Hill Wind", "Wind Onshore", 30, "Application Submitted"),
    row(6, "Echo Park Solar", "Solar Photovoltaics", 20, "Application Submitted", operator="Foo Power / Bar Ltd"),
    row(7, "Foxtrot Offshore Wind Farm", "Wind Offshore", 3600, "Awaiting Construction", region="Offshore", county=""),
    row(8, "Golf Battery", "Battery", 50, "Application Submitted", operator="Old Owner Ltd"),
    row(9, "Hotel Road Solar", "Solar Photovoltaics", 10, "Application Submitted"),
    row(10, "India Solar", "Solar Photovoltaics", None, "Awaiting Construction"),
    row(11, "Juliet Solar", "Solar Photovoltaics", 5, "Operational"),
    row(12, "Kilo Biomass", "Biomass (dedicated)", 12, "Awaiting Construction"),
]
NEW = [
    row(1, "Alpha Fen Solar Farm", "Solar Photovoltaics", 400, "Awaiting Construction", submitted="01/02/2025",
        granted="15/09/2026", authority="The Planning Inspectorate - National Infrastructure", pref="EN010999", coloc="2"),
    row(2, "Alpha Fen Solar Farm", "Battery", 600, "Awaiting Construction", granted="15/09/2026", coloc="1"),
    row(3, "Bravo Lane - Battery Storage", "Battery", 100, "Under Construction", granted="01/01/2026", uc="20/09/2026"),
    row(4, "Charlie Moor Solar", "Solar Photovoltaics", 49.9, "Operational", uc="01/03/2026", op="01/10/2026"),
    row(5, "Delta Hill Wind", "Wind Onshore", 30, "Application Refused", refused="01/08/2026"),
    row(6, "Echo Park Solar", "Solar Photovoltaics", 20, "Application Withdrawn", operator="Foo Power & Bar Limited",
        withdrawn="01/09/2026"),
    row(7, "Foxtrot Offshore Wind Farm", "Wind Offshore", 3600, "Application Submitted", region="Offshore", county=""),
    row(8, "Golf Battery", "Battery", 57, "Application Submitted", operator="New Owner Plc"),
    row(10, "India Solar", "Solar Photovoltaics", 30, "Awaiting Construction"),
    row(11, "Juliet Solar", "Battery", 5, "Operational"),
    row(12, "Kilo Biomass", "Biomass (dedicated)", 12, "Abandoned"),
    row(20, "Lima Solar Farm", "Solar Photovoltaics", 750, "Application Submitted", submitted="01/10/2026"),
    row(21, "Mike Battery", "Battery", 5, "Application Submitted"),
    row(22, "November Solar", "Solar Photovoltaics", 60, "Awaiting Construction", granted="01/07/2026"),
    row(23, "Oscar Solar", "Solar Photovoltaics", 1, "No Application Required"),
]


@pytest.fixture
def releases(tmp_path):
    prev = write_csv(tmp_path / "prev.csv", PREVIOUS)
    new = write_csv(tmp_path / "new.csv", NEW)
    return prev, new
