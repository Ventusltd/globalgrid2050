#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
text = INDEX.read_text(encoding="utf-8")

v6_line = '    { name:"UK Solar + Storage Daily V6", url:"./uk_renewables_pipeline/dashboard_v6_live.html", note:"LIVE · DESNZ Q2 2026 validated snapshot · solar >1MW · BESS >100MW · canonical GlobalGrid/REPD IDs" },\n'
v5_live = '    { name:"UK Solar + Storage Daily V5", url:"./uk_renewables_pipeline/dashboard_v5_live.html", note:"LIVE · daily newspaper · solar >49MWp · BESS >100MW" },'
v5_previous = '    { name:"UK Solar + Storage Daily V5", url:"./uk_renewables_pipeline/dashboard_v5_live.html", note:"previous live · daily newspaper · solar >49MWp · BESS >100MW" },'

if v6_line.strip() in text:
    text = text.replace(v5_live, v5_previous)
else:
    # If an older V6 note exists from a prior partial attempt, replace it rather than duplicate it.
    lines = text.splitlines(keepends=True)
    replaced_existing_v6 = False
    for i, line in enumerate(lines):
        if 'name:"UK Solar + Storage Daily V6"' in line and 'dashboard_v6_live.html' in line:
            lines[i] = v6_line
            replaced_existing_v6 = True
            break
    text = ''.join(lines)
    if not replaced_existing_v6:
        if v5_live in text:
            text = text.replace(v5_live, v6_line + v5_previous, 1)
        elif v5_previous in text:
            text = text.replace(v5_previous, v6_line + v5_previous, 1)
        else:
            raise RuntimeError("Could not locate the V5 homepage entry; refusing to guess where V6 belongs")
    text = text.replace(v5_live, v5_previous)

if text.count('dashboard_v6_live.html') != 1:
    raise RuntimeError("V6 homepage entry must appear exactly once")
INDEX.write_text(text, encoding="utf-8")
print("Homepage V6 promotion PASS")
