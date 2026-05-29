from pathlib import Path
import shutil

ROOT = Path(__file__).parent.parent
src = ROOT / 'uk_energy_tracking_v5' / 'electricity_price_history_daily_decade.json'
dst = ROOT / 'uk_energy_tracking_v6' / 'electricity_price_history_daily_decade.json'
dst.parent.mkdir(parents=True, exist_ok=True)
if src.exists():
    shutil.copyfile(src, dst)
else:
    dst.write_text('{"rows": []}\n', encoding='utf-8')
print(f'V6 daily aggregate prepared: {dst}')
