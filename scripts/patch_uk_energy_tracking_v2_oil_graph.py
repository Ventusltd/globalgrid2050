from pathlib import Path

ROOT = Path(__file__).parent.parent
TARGET = ROOT / "uk_energy_tracking_v2" / "index.md"
REPORT = ROOT / "gridbot_reports" / "patch_uk_energy_tracking_v2_oil_graph.md"

text = TARGET.read_text(encoding="utf-8")
changes = []

def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)
    changes.append(label)

replace_once(
    '<option value="25y">25 years</option>\n          <option value="all" selected>Since 1970s</option>',
    '<option value="25y" selected>25 years</option>',
    'remove misleading oil range option'
)

replace_once(
    'ctx.fillStyle="#a6adbb"; ctx.font="12px Courier New";\n    for(var g=0;g<5;g++){',
    'ctx.fillStyle="#f5f7fb"; ctx.font="16px Courier New";\n    for(var g=0;g<5;g++){',
    'make left axis values clearer'
)

replace_once(
    'ctx.beginPath();ctx.moveTo(pad,yy);ctx.lineTo(w-rightPad,yy);ctx.stroke();\n      ctx.fillText("$"+fmt(value,0), 8, yy+4);',
    'ctx.beginPath();ctx.moveTo(pad,yy);ctx.lineTo(w-rightPad,yy);ctx.stroke();\n      ctx.fillStyle="#f5f7fb"; ctx.fillText("$"+fmt(value,0), 8, yy+5); ctx.fillStyle="#f5f7fb";',
    'strengthen left axis label colour'
)

replace_once(
    'ctx.beginPath(); ctx.moveTo(xx, pad*0.72); ctx.lineTo(xx, h-pad); ctx.stroke();\n      var p=rows[idx];',
    'ctx.beginPath(); ctx.moveTo(xx, pad*0.72); ctx.lineTo(xx, h-pad); ctx.stroke();\n      var p=rows[idx];\n      ctx.setLineDash([5,5]);\n      ["brentUSDperBarrel","wtiUSDperBarrel"].forEach(function(field){ var v=p[field]; if(!v) return; var yy=y(v); ctx.strokeStyle = field==="brentUSDperBarrel" ? "rgba(255,153,0,.75)" : "rgba(0,255,255,.75)"; ctx.beginPath(); ctx.moveTo(pad, yy); ctx.lineTo(w-rightPad, yy); ctx.stroke(); });\n      ctx.setLineDash([]);',
    'add horizontal guide line for active point'
)

TARGET.write_text(text, encoding="utf-8")
REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_text('# UK energy tracking V2 oil graph patch\n\n' + '\n'.join('- ' + c for c in changes) + '\n', encoding='utf-8')
print('Patched UK energy tracking V2 oil graph')
