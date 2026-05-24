from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / 'uk_energy_tracking_v2' / 'index.md'
REPORT = ROOT / 'gridbot_reports' / 'v2_safe_patch.md'

text = PAGE.read_text(encoding='utf-8')
changes = []

# Remove the misleading oldest oil range option and make 25 years the default.
lines = text.splitlines()
out = []
removed = False
selected = False
for line in lines:
    if 'option value="all"' in line:
        removed = True
        continue
    if 'option value="25y"' in line and 'selected' not in line:
        line = line.replace('value="25y"', 'value="25y" selected')
        selected = True
    out.append(line)
text = '\n'.join(out) + '\n'
if removed:
    changes.append('removed old all range option from V2 oil selector')
if selected:
    changes.append('made 25 year oil range the default')

# Make first oil chart axis font larger for mobile readability.
old_font = 'ctx.font="12px Courier New";'
new_font = 'ctx.font="16px Courier New";'
if old_font in text:
    text = text.replace(old_font, new_font, 1)
    changes.append('increased oil graph axis font size')

# Keep original tracker untouched. This script only writes the V2 clone.
PAGE.write_text(text, encoding='utf-8')
REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_text('# V2 safe patch report\n\n' + '\n'.join('- ' + c for c in changes) + '\n', encoding='utf-8')
print('V2 safe patch complete')
