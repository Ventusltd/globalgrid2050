#!/usr/bin/env python3
"""
Fix CSV export for UK Renewables Pipeline dashboard.

Current issue:
- Sidebar contains EXPORT CSV link, but no JavaScript export function is wired.

Fix:
- Give the export link an id.
- Track the currently filtered dataset.
- Add a safe CSV generator with escaping.
- Download the filtered rows as a CSV file.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DASHBOARD = ROOT / "uk_renewables_pipeline" / "dashboard.html"
REPORTS = ROOT / "gridbot_reports"
REPORT = REPORTS / "fix_uk_renewables_pipeline_csv_export.md"

OLD_EXPORT_LINK = '<a href="#" class="nav-item">EXPORT CSV</a>'
NEW_EXPORT_LINK = '<a href="#" class="nav-item" id="btn-export-csv">EXPORT CSV</a>'

OLD_DATA_STATE = "        let allData = [];\n"
NEW_DATA_STATE = "        let allData = [];\n        let currentFilteredData = [];\n"

OLD_APPLY_SNIPPET = """            updateGauges(filtered);
            updateTable(filtered);
        }
"""
NEW_APPLY_SNIPPET = """            currentFilteredData = filtered;
            updateGauges(filtered);
            updateTable(filtered);
        }
"""

LISTENERS_MARKER = "        // Listeners\n"
EXPORT_FUNCTION = r'''
        function csvEscape(value) {
            if (value === null || value === undefined) return '""';
            const text = String(value).replace(/"/g, '""');
            return `"${text}"`;
        }

        function exportFilteredCSV(event) {
            if (event) event.preventDefault();

            const rows = currentFilteredData && currentFilteredData.length ? currentFilteredData : allData;
            const headers = ["Site Name", "County", "Operator", "Technology", "Status", "Capacity MW"];
            const csvRows = [headers.map(csvEscape).join(",")];

            rows.forEach(item => {
                csvRows.push([
                    item["Site Name"],
                    item["County"],
                    item["Operator"],
                    item["Tech Category"],
                    item["Status"],
                    Number(item.Capacity_MW || 0).toFixed(3)
                ].map(csvEscape).join(","));
            });

            const csv = "\ufeff" + csvRows.join("\n");
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            const date = new Date().toISOString().slice(0, 10);
            const tech = String(currentTech || "All").replace(/[^a-z0-9]+/gi, "_").toLowerCase();
            const status = String(currentStatus || "All").replace(/[^a-z0-9]+/gi, "_").toLowerCase();
            link.href = url;
            link.download = `globalgrid2050_uk_renewables_pipeline_${tech}_${status}_${date}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }

'''

EXPORT_LISTENER_MARKER = "        document.getElementById('county-dropdown').addEventListener('change', (e) => {"
EXPORT_LISTENER = "        document.getElementById('btn-export-csv')?.addEventListener('click', exportFilteredCSV);\n\n"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def main() -> int:
    if not DASHBOARD.exists():
        raise SystemExit(f"Missing dashboard: {DASHBOARD.relative_to(ROOT)}")

    html = read(DASHBOARD)
    actions: list[str] = []

    if OLD_EXPORT_LINK in html:
        html = html.replace(OLD_EXPORT_LINK, NEW_EXPORT_LINK, 1)
        actions.append("added id to EXPORT CSV sidebar link")
    elif NEW_EXPORT_LINK in html:
        actions.append("EXPORT CSV sidebar link already has id")
    else:
        raise SystemExit("Could not find EXPORT CSV sidebar link")

    if "let currentFilteredData = [];" not in html:
        if OLD_DATA_STATE not in html:
            raise SystemExit("Could not find allData state declaration")
        html = html.replace(OLD_DATA_STATE, NEW_DATA_STATE, 1)
        actions.append("added currentFilteredData state")
    else:
        actions.append("currentFilteredData state already present")

    if "currentFilteredData = filtered;" not in html:
        if OLD_APPLY_SNIPPET not in html:
            raise SystemExit("Could not find applyFilters update snippet")
        html = html.replace(OLD_APPLY_SNIPPET, NEW_APPLY_SNIPPET, 1)
        actions.append("stored currently filtered data before rendering")
    else:
        actions.append("filtered data is already stored")

    if "function exportFilteredCSV" not in html:
        if LISTENERS_MARKER not in html:
            raise SystemExit("Could not find listeners marker")
        html = html.replace(LISTENERS_MARKER, EXPORT_FUNCTION + LISTENERS_MARKER, 1)
        actions.append("added CSV export function")
    else:
        actions.append("CSV export function already present")

    if "btn-export-csv')?.addEventListener('click', exportFilteredCSV" not in html:
        if EXPORT_LISTENER_MARKER not in html:
            raise SystemExit("Could not find export listener insertion marker")
        html = html.replace(EXPORT_LISTENER_MARKER, EXPORT_LISTENER + EXPORT_LISTENER_MARKER, 1)
        actions.append("wired EXPORT CSV click handler")
    else:
        actions.append("EXPORT CSV click handler already wired")

    write(DASHBOARD, html)

    REPORTS.mkdir(parents=True, exist_ok=True)
    timestamp = dt.datetime.now(dt.timezone.utc).isoformat()
    report = "\n".join([
        "# Fix UK Renewables Pipeline CSV Export",
        "",
        f"UTC created: {timestamp}",
        "",
        "## Purpose",
        "",
        "Fix the dead EXPORT CSV link on the UK Renewables Pipeline dashboard so it downloads the currently filtered table data.",
        "",
        "## Actions",
        "",
        *[f"- {a}" for a in actions],
        "",
        "## Manual acceptance test",
        "",
        "1. Open `/uk_renewables_pipeline/dashboard.html`.",
        "2. Apply a technology or status filter.",
        "3. Click `EXPORT CSV` in the sidebar.",
        "4. Confirm a CSV downloads with the filtered rows only.",
        "5. Open the CSV and confirm columns: Site Name, County, Operator, Technology, Status, Capacity MW.",
        "",
    ])
    write(REPORT, report)
    print(f"CSV export fix complete. Report: {REPORT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
