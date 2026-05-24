from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
V1 = ROOT / 'uk_energy_tracking'
V2 = ROOT / 'uk_energy_tracking_v2'
SCRIPTS = ROOT / 'scripts'
WF = ROOT / '.github' / 'workflows'
REPORT = ROOT / 'gridbot_reports' / 'isolate_uk_energy_tracking_v2.md'

V2.mkdir(parents=True, exist_ok=True)
changes = []

# Clone current live JSON feeds so V2 has its own recovery independent state.
for name in ['live_grid_energy.json', 'live_grid_price.json', 'live_oil_prices.json', 'oil_price_history.geojson', 'live_uk_fuel_prices.json', 'ev_charging_prices.json']:
    src = V1 / name
    dst = V2 / name
    if src.exists() and not dst.exists():
        shutil.copy2(src, dst)
        changes.append(f'created V2 feed seed {dst.relative_to(ROOT)}')

# Clone updater scripts and retarget them to uk_energy_tracking_v2.
for src_name, dst_name in [
    ('update_uk_energy.py', 'update_uk_energy_v2.py'),
    ('update_uk_price.py', 'update_uk_price_v2.py'),
    ('update_oil_prices.py', 'update_oil_prices_v2.py'),
    ('update_uk_fuel_prices.py', 'update_uk_fuel_prices_v2.py'),
]:
    src = SCRIPTS / src_name
    dst = SCRIPTS / dst_name
    if src.exists():
        text = src.read_text(encoding='utf-8')
        text = text.replace('"uk_energy_tracking"', '"uk_energy_tracking_v2"')
        text = text.replace("'uk_energy_tracking'", "'uk_energy_tracking_v2'")
        text = text.replace('permalink: /uk_energy_tracking/', 'permalink: /uk_energy_tracking_v2/')
        text = text.replace('title: UK Live Grid Tracker', 'title: UK Live Grid Tracker V2')
        dst.write_text(text, encoding='utf-8')
        changes.append(f'created isolated script {dst.relative_to(ROOT)}')

# Repoint V2 page away from V1 feeds.
page = V2 / 'index.md'
if page.exists():
    text = page.read_text(encoding='utf-8')
    replacements = {
        '/uk_energy_tracking/live_grid_energy.json': '/uk_energy_tracking_v2/live_grid_energy.json',
        '/uk_energy_tracking/live_grid_price.json': '/uk_energy_tracking_v2/live_grid_price.json',
        '/uk_energy_tracking/live_oil_prices.json': '/uk_energy_tracking_v2/live_oil_prices.json',
        '/uk_energy_tracking/oil_price_history.geojson': '/uk_energy_tracking_v2/oil_price_history.geojson',
        './live_grid_energy.json': '/uk_energy_tracking_v2/live_grid_energy.json',
        './live_grid_price.json': '/uk_energy_tracking_v2/live_grid_price.json',
    }
    for old, new in replacements.items():
        if old in text:
            text = text.replace(old, new)
            changes.append(f'repointed V2 page feed {old} to {new}')
    page.write_text(text, encoding='utf-8')

# Create dedicated V2 live grid workflow.
workflow = '''name: fetch_uk_energy_and_prices_v2

on:
  workflow_dispatch:
    inputs:
      slice:
        description: Which slice to run
        required: true
        default: both
        type: choice
        options: [both, energy, price]

permissions:
  contents: write

concurrency:
  group: uk-energy-tracking-v2
  cancel-in-progress: true

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GRIDBOT_PAT }}
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install requests
      - name: Run V2 energy slice
        if: github.event.inputs.slice == 'energy' || github.event.inputs.slice == 'both'
        run: python scripts/update_uk_energy_v2.py
      - name: Run V2 price slice
        if: github.event.inputs.slice == 'price' || github.event.inputs.slice == 'both'
        run: FORCE_UK_PRICE=1 python scripts/update_uk_price_v2.py
      - name: Commit V2 grid feeds
        env:
          PAT: ${{ secrets.GRIDBOT_PAT }}
        run: |
          git config --global user.name "gridbot"
          git config --global user.email "bot@globalgrid2050.com"
          git add uk_energy_tracking_v2/live_grid_energy.json uk_energy_tracking_v2/live_grid_price.json
          if [ -n "$(git status --porcelain)" ]; then
            git commit -m "Automated UK grid update V2 (${{ github.event.inputs.slice }}): $(date -u +'%Y-%m-%d %H:%M UTC')"
            git push https://${PAT}@github.com/${{ github.repository }}.git HEAD:main
          else
            echo "No V2 grid feed changes to commit"
          fi
'''
(WF / 'fetch_uk_energy_and_prices_v2.yml').write_text(workflow, encoding='utf-8')
changes.append('created dedicated V2 grid workflow')

REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_text('# UK energy tracker V2 isolation report\n\n' + '\n'.join('- ' + c for c in changes) + '\n', encoding='utf-8')
print('V2 isolation complete')
