import csv
from pathlib import Path

OUT_DIR = Path('data/generation')
MASTER = OUT_DIR / 'elexon_generation_sources_half_hourly.csv'
FIELDS = ['source','periodStartUTC','fuelType','generationMW','publishTimeUTC','fetchedAtUTC']


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows_by_key = {}
    for path in sorted(OUT_DIR.glob('elexon_generation_sources_[0-9][0-9][0-9][0-9].csv')):
        with path.open('r', encoding='utf-8', newline='') as handle:
            for row in csv.DictReader(handle):
                key = (row.get('periodStartUTC', ''), row.get('fuelType', ''))
                if key[0] and key[1]:
                    rows_by_key[key] = {field: row.get(field, '') for field in FIELDS}
    rows = [rows_by_key[key] for key in sorted(rows_by_key, key=lambda x: (x[0], x[1]))]
    with MASTER.open('w', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    print(f'Wrote {len(rows)} rows to {MASTER}')


if __name__ == '__main__':
    main()
