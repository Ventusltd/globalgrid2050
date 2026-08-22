#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
text = INDEX.read_text(encoding="utf-8")

v6_line = '    { name:"UK Solar + Storage Daily V6", url:"./uk_renewables_pipeline/dashboard_v6_live.html", note:"LIVE · REPD-bound · solar >1MWp · BESS >100MW · official Ref ID + update date" },\n'
v5_live = '    { name:"UK Solar + Storage Daily V5", url:"./uk_renewables_pipeline/dashboard_v5_live.html", note:"LIVE · daily newspaper · solar >49MWp · BESS >100MW" },'
v5_previous = '    { name:"UK Solar + Storage Daily V5", url:"./uk_renewables_pipeline/dashboard_v5_live.html", note:"previous live · daily newspaper · solar >49MWp · BESS >100MW" },'

if v6_line.strip() in text:
    # Keep the operation idempotent and normalize V5's label if needed.
    text = text.replace(v5_live, v5_previous)
else:
    if v5_live in text:
        text = text.replace(v5_live, v6_line + v5_previous, 1)
    elif v5_previous in text:
        text = text.replace(v5_previous, v6_line + v5_previous, 1)
    else:
        raise RuntimeError("Could not locate the V5 homepage entry; refusing to guess where V6 belongs")

if text.count('dashboard_v6_live.html') != 1:
    raise RuntimeError("V6 homepage entry must appear exactly once")
INDEX.write_text(text, encoding="utf-8")
print("Homepage V6 promotion PASS")
