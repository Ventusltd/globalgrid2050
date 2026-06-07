import json
from datetime import datetime, timezone
from pathlib import Path

OUT = Path('uk_energy_tracking_v6/generation_history/mwh_energy_use/ons_mwh_energy_use_placeholder.json')


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        'generatedUTC': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'status': 'placeholder',
        'source': 'ONS Energy use by industry, source and fuel workbook or future API connector',
        'conversion': {
            'mtoeToTwh': 11.63,
            'twhToMwh': 1000000,
            'formula': 'MWh = Mtoe * 11.63 * 1000000'
        },
        'purpose': 'Annual MWh energy accounting layer for GlobalGrid2050 generation and electrification education.',
        'rows': [],
        'plannedFields': [
            'year',
            'economicSector',
            'sourceName',
            'activityName',
            'fuel',
            'mtoe',
            'twh',
            'mwh'
        ]
    }, indent=2), encoding='utf-8')
    print(f'Wrote {OUT}')


if __name__ == '__main__':
    main()
