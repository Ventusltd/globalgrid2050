from datetime import datetime, timezone
from pathlib import Path

DIARY = Path('uk_energy_tracking_v3/WORK_DIARY.md')

PURPOSES = {
    'merge_system': 'prepare merged historical Elexon System Price and captured Market Index view',
    'date_window': 'prepare date window controls for chart and dropdown table',
    'fullscreen': 'prepare full screen electricity price history chart',
    'correctness': 'prepare price history correctness patch',
    'all_safe': 'prepare all safe V3 price history UI patches in order',
}


def main():
    feature = Path('gridbot_feature_choice.txt').read_text(encoding='utf-8').strip() if Path('gridbot_feature_choice.txt').exists() else 'manual'
    text = DIARY.read_text(encoding='utf-8')
    stamp = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    title = f'## Diary preflight: {stamp} GridBot V3 workflow start'
    purpose = PURPOSES.get(feature, feature)
    entry = f'''\n\n{title}\n\n```text\nfeature: {feature}\npurpose: {purpose}\nrule: read WORK_DIARY before changing files, commit diary preflight first, then run the selected V3 patch\nstable tracker: do not touch uk_energy_tracking/\n```\n'''
    DIARY.write_text(text.rstrip() + entry, encoding='utf-8')
    print(f'Diary preflight written for {feature}')


if __name__ == '__main__':
    main()
