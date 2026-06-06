import csv
from pathlib import Path

SOURCE = Path('data/generation/elexon_generation_sources_half_hourly.csv')
OUT_DIR = Path('data/generation')
FIELDS = ['source','periodStartUTC','fuelType','generationMW','publishTimeUTC','fetchedAtUTC']


def row_year(row):
    value = (row.get('periodStartUTC') or '').strip()
    return value[:4] if len(value) >= 4 and value[:4].isdigit() else None


def sort_key(row):
    return (row.get('periodStartUTC', ''), row.get('fuelType', ''))


def main():
    if not SOURCE.exists():
        raise SystemExit(f'Missing source file: {SOURCE}')
    by_year = {}
    with SOURCE.open('r', encoding='utf-8', newline='') as handle:
        for row in csv.DictReader(handle):
            year = row_year(row)
            if year:
                by_year.setdefault(year, []).append({field: row.get(field, '') for field in FIELDS})
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for year, rows in sorted(by_year.items()):
        path = OUT_DIR / f'elexon_generation_sources_{year}.csv'
        with path.open('w', encoding='utf-8', newline='') as handle:
            writer = csv.DictWriter(handle, fieldnames=FIELDS)
            writer.writeheader()
            writer.writerows(sorted(rows, key=sort_key))
        print(f'Wrote {len(rows)} rows to {path}')
    print(f'Split {sum(len(rows) for rows in by_year.values())} rows into {len(by_year)} annual files')


if __name__ == '__main__':
    main()
