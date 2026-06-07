import csv
import sys
from pathlib import Path

DATA_DIR = Path('data/generation')
FIELDS = ['source', 'periodStartUTC', 'fuelType', 'generationMW', 'publishTimeUTC', 'fetchedAtUTC']


def month_from_row(row):
    t = row.get('periodStartUTC', '')
    if len(t) >= 7:
        return t[:7]
    return None


def split_year(year):
    src = DATA_DIR / f'elexon_generation_sources_{year}.csv'
    archive_dir = DATA_DIR / 'archive' / str(year)
    if not src.exists():
        print(f'Missing annual source: {src}')
        return []

    archive_dir.mkdir(parents=True, exist_ok=True)
    buckets = {}
    counts = {}
    with src.open('r', encoding='utf-8', newline='') as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            month = month_from_row(row)
            if not month:
                continue
            path = archive_dir / f'elexon_generation_sources_{month}.csv'
            if path not in buckets:
                fh = path.open('w', encoding='utf-8', newline='')
                writer = csv.DictWriter(fh, fieldnames=FIELDS)
                writer.writeheader()
                buckets[path] = (fh, writer)
                counts[path] = 0
            buckets[path][1].writerow({field: row.get(field, '') for field in FIELDS})
            counts[path] += 1

    for fh, _writer in buckets.values():
        fh.close()

    outputs = sorted(counts)
    for path in outputs:
        print(f'Wrote {counts[path]} rows to {path}')
    return outputs


def main():
    year = sys.argv[1] if len(sys.argv) > 1 else None
    if not year:
        raise SystemExit('Usage: python scripts/split_generation_sources_year_to_months_v6.py YEAR')
    split_year(year)


if __name__ == '__main__':
    main()
