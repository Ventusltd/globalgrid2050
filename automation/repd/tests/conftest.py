"""Synthetic official-style REPD fixtures for the cleaning step.  No network, no real data."""
from __future__ import annotations

import csv
import io
import sys
from datetime import date, datetime
from pathlib import Path

import openpyxl
import pytest

PKG = Path(__file__).resolve().parents[1]          # automation/repd
sys.path.insert(0, str(PKG))

# Official header order in miniature, keeping the real quirks: a trailing space and a
# double space inside two headers.
COLUMNS = [
    "Old Ref ID", "Ref ID", "Record Last Updated (dd/mm/yyyy)", "Operator (or Applicant)",
    "Site Name", "Technology Type", "Storage Co-location REPD Ref ID", "Installed Capacity (MWelec)",
    "Development Status (short)", "Are they re-applying (Old REPD Ref) ", "Post Code",
    "Planning Authority", "Planning Application Reference", "Judicial Review", "Offshore Wind Round",
    "Planning Application Submitted", "Planning Application Withdrawn", "Planning Permission Refused",
    "Appeal Lodged", "Appeal Withdrawn", "Appeal Refused", "Appeal Granted",
    "Planning Permission  Granted", "Secretary of State - Intervened", "Secretary of State - Refusal",
    "Secretary of State - Granted", "Planning Permission Expired", "Under Construction", "Operational",
]
LOCALE_SHORT_DATE = "mm-dd-yy"   # built-in format 14: what almost every official date cell carries
MONTH_FIRST = "m/d/yyyy"         # explicit custom format carried by the 25 October cells


def base_rows(n: int = 6) -> list[dict]:
    rows = []
    for i in range(1, n + 1):
        rows.append({
            "Old Ref ID": "", "Ref ID": 100 + i,
            "Record Last Updated (dd/mm/yyyy)": date(2026, 10, 8),
            "Operator (or Applicant)": f"Operator {i} Ltd", "Site Name": f"Site {i}",
            "Technology Type": "Solar Photovoltaics" if i % 2 else "Battery",
            "Storage Co-location REPD Ref ID": "",
            "Installed Capacity (MWelec)": 49.9 if i % 2 else 120,
            "Development Status (short)": "Application Submitted",
            "Are they re-applying (Old REPD Ref) ": "", "Post Code": f"SY{i} 1AA",
            "Planning Authority": "Shropshire",
            "Planning Application Reference": f"26/0{i}/FUL",
            "Planning Application Submitted": date(2026, 8, 20 + i),
            "Appeal Lodged": date(2026, 9, 13 + i) if i == 2 else None,
        })
    return rows


def _csv_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, (date, datetime)):
        return value.strftime("%d/%m/%Y")
    return str(value)


def make_csv(rows: list[dict], overrides: dict | None = None, columns: list[str] | None = None,
             newline: str = "\r\n", encoding: str = "cp1252") -> bytes:
    """Official-style CSV: cp1252, CRLF.  overrides[(ref, column)] = literal CSV text."""
    overrides = overrides or {}
    columns = columns or COLUMNS
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator=newline)
    writer.writerow(columns)
    for row in rows:
        writer.writerow([overrides.get((row["Ref ID"], c), _csv_text(row.get(c))) for c in columns])
    return buffer.getvalue().encode(encoding)


def make_xlsx(rows: list[dict], formats: dict | None = None, overrides: dict | None = None,
              columns: list[str] | None = None) -> bytes:
    """Workbook with a notes sheet first and typed date cells.
    formats[(ref, column)] = number format; overrides[(ref, column)] = raw cell value."""
    formats, overrides = formats or {}, overrides or {}
    columns = columns or COLUMNS
    book = openpyxl.Workbook()
    book.active.title = "Definition Sheet"
    book.active.append(["notes"])
    sheet = book.create_sheet("REPD")
    sheet.append(columns)
    for r, row in enumerate(rows, start=2):
        for c, name in enumerate(columns, start=1):
            key = (row["Ref ID"], name)
            value = overrides.get(key, row.get(name))
            if isinstance(value, date) and not isinstance(value, datetime):
                value = datetime(value.year, value.month, value.day)
            if value is None or value == "":
                continue
            cell = sheet.cell(row=r, column=c, value=value)
            if isinstance(value, datetime):
                cell.number_format = formats.get(key, LOCALE_SHORT_DATE)
            elif key in formats:
                cell.number_format = formats[key]
    out = io.BytesIO()
    book.save(out)
    return out.getvalue()


@pytest.fixture(scope="session")
def rule():
    import date_rule
    return date_rule


@pytest.fixture(scope="session")
def cl():
    import clean
    return clean
