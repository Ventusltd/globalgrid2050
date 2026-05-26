import csv
from pathlib import Path

SOURCE = Path('data/electricity/elexon_system_prices_half_hourly.csv')
OUT_DIR = Path('data/electricity')
FIELDS = ['source','settlementDate','settlementPeriod','periodStartUTC','systemBuyPriceGBPperMWh','systemSellPriceGBPperMWh','netImbalanceVolumeMWh','fetchedAtUTC']

def row_year(row):
    value = (row.get('settlementDate') or row.get('periodStartUTC') or '').strip()
    return value[:4] if len(value) >= 4 and value[:4].isdigit() else None

def sort_key(row):
    try:
        period = int(row.get('settlementPeriod', '999'))
    except Exception:
        period = 999
    return (row.get('settlementDate', ''), period)

def main():
    if not SOURCE.exists():
        raise SystemExit(f'Missing source file: {SOURCE}')
    by_year = {}
    with SOURCE.open('r', encoding='utf-8', newline='') as handle:
        for row in csv.DictReader(handle):
            year = row_year(row)
            if year:
                by_year.setdefault(year, []).append({field: row.get(field, '') for field in FIELDS})
    for year, rows in sorted(by_year.items()):
        path = OUT_DIR / f'elexon_system_prices_{year}.csv'
        with path.open('w', encoding='utf-8', newline='') as handle:
            writer = csv.DictWriter(handle, fieldnames=FIELDS)
            writer.writeheader()
            writer.writerows(sorted(rows, key=sort_key))
        print(f'Wrote {len(rows)} rows to {path}')
    print(f'Split {sum(len(rows) for rows in by_year.values())} rows into {len(by_year)} annual files')

if __name__ == '__main__':
    main()
