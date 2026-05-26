from pathlib import Path
import shutil

root = Path('.')
source = root / 'uk_energy_tracking_v3'
target = root / 'uk_energy_tracking_v4'
report = root / 'gridbot_reports' / 'clone_uk_energy_tracking_v3_to_v4.md'

text_suffixes = {'.md', '.html', '.css', '.js', '.json', '.csv', '.txt', '.yml', '.yaml', '.py'}

script_pairs = [
    ('scripts/update_uk_energy_v3.py', 'scripts/update_uk_energy_v4.py'),
    ('scripts/update_uk_price_v3.py', 'scripts/update_uk_price_v4.py'),
    ('scripts/update_oil_prices_v3.py', 'scripts/update_oil_prices_v4.py'),
    ('scripts/update_uk_fuel_prices_v3.py', 'scripts/update_uk_fuel_prices_v4.py'),
]

workflow_pairs = [
    ('.github/workflows/fetch_uk_energy_and_prices_v3.yml', '.github/workflows/fetch_uk_energy_and_prices_v4.yml'),
    ('.github/workflows/force_uk_energy_tracking_v3_price_history.yml', '.github/workflows/force_uk_energy_tracking_v4_price_history.yml'),
]


def v4_text(text):
    for old, new in [
        ('uk_energy_tracking_v3', 'uk_energy_tracking_v4'),
        ('/uk_energy_tracking_v3/', '/uk_energy_tracking_v4/'),
        ('UK Live Grid Tracker V3', 'UK Live Grid Tracker V4'),
        ('UK LIVE GRID TRACKER V3', 'UK LIVE GRID TRACKER V4'),
        ('V3 experimental clone', 'V4 experimental clone'),
        ('isolated V3 feeds', 'isolated V4 feeds'),
        ('V3 captured', 'V4 captured'),
        ('V3', 'V4'),
        ('_v3.py', '_v4.py'),
        ('v3', 'v4'),
    ]:
        text = text.replace(old, new)
    return text


def rewrite_file(path):
    if path.suffix.lower() not in text_suffixes:
        return
    try:
        text = path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        return
    path.write_text(v4_text(text), encoding='utf-8')


def copy_folder():
    if not source.exists():
        raise SystemExit('Missing uk_energy_tracking_v3')
    if target.exists():
        raise SystemExit('uk_energy_tracking_v4 already exists. Stop to avoid overwriting.')
    shutil.copytree(source, target)
    for item in target.rglob('*'):
        if item.is_file():
            rewrite_file(item)


def copy_pairs(pairs):
    made = []
    for src_name, dst_name in pairs:
        src = root / src_name
        dst = root / dst_name
        if not src.exists():
            continue
        text = v4_text(src.read_text(encoding='utf-8'))
        if dst.suffix in {'.yml', '.yaml'}:
            text = text.replace("  schedule:\n", "  # schedule disabled for V4 benchmark clone\n")
            text = text.replace("    - cron:", "    # - cron:")
        dst.write_text(text, encoding='utf-8')
        made.append(dst_name)
    return made


def append_v4_diary():
    diary = target / 'WORK_DIARY.md'
    if diary.exists():
        with diary.open('a', encoding='utf-8') as f:
            f.write('\n\n## Diary entry: V4 clone from V3 benchmark\n\n')
            f.write('V4 was cloned from the preserved V3 tracker. V3 is now the benchmark and should not be modified for the next UI experiments. Annual lazy loading, year selection, seasonal filters and further price explanation should be developed in V4 only.\n')


def write_report(scripts, workflows):
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text('\n'.join([
        '# Clone UK Energy Tracking V3 to V4',
        '',
        'Created V4 from the preserved V3 benchmark.',
        '',
        'New app:',
        '',
        '```text',
        'uk_energy_tracking_v4/',
        'https://globalgrid2050.com/uk_energy_tracking_v4/',
        '```',
        '',
        'Benchmark preserved:',
        '',
        '```text',
        'uk_energy_tracking_v3/',
        '```',
        '',
        'Copied scripts:',
        '',
        '```text',
        '\n'.join(scripts) if scripts else 'none',
        '```',
        '',
        'Copied workflows:',
        '',
        '```text',
        '\n'.join(workflows) if workflows else 'none',
        '```',
        '',
        'Rule: patch V4 only. Leave V3 as benchmark.',
        ''
    ]), encoding='utf-8')


def main():
    copy_folder()
    scripts = copy_pairs(script_pairs)
    workflows = copy_pairs(workflow_pairs)
    append_v4_diary()
    write_report(scripts, workflows)
    print('V4 clone created')


if __name__ == '__main__':
    main()
