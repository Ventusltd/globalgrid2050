from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V6 = ROOT / "uk_energy_tracking_v6"

for rel in [
    "AI_START_HERE.md",
    "uk_energy_tracking_v6/V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
    "uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT.md",
    "uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js",
]:
    path = ROOT / rel
    if not path.exists():
        raise FileNotFoundError(f"Required file missing: {rel}")
    path.read_text(encoding="utf-8")

protocol = (V6 / "V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md").read_text(encoding="utf-8")
if "Full screen, period arrows, mobile portrait, mobile landscape and desktop" not in protocol:
    raise RuntimeError("V6 protocol fullscreen contract not recognised")

path = V6 / "price_history_chart/render_price_chart/render_price_chart.js"
text = path.read_text(encoding="utf-8")

old_summary = """  function drawSummary(g,s,q,w,h,pad,isFull){var boxH=(isFull?92:118)*q,y=h-pad.bottom+(isFull?44:64)*q,x=pad.left,bw=w-pad.left-pad.right;if(!isFull)y=h-128*q;g.save();g.fillStyle='rgba(5,7,12,.82)';g.strokeStyle='rgba(0,255,255,.35)';g.lineWidth=1*q;g.shadowColor='rgba(0,255,255,.18)';g.shadowBlur=8*q;g.beginPath();g.roundRect(x,y,bw,boxH,8*q);g.fill();g.stroke();g.shadowBlur=0;g.fillStyle='#f5f7fb';g.textAlign='center';var cx=x+bw/2;var small=(w/q)<720||isFull;g.font='900 '+(small?8.2:10.5)*q+'px Courier New';if(small){g.fillText('HIGH  '+pence(s.hiValue)+'p/kWh   £'+fmt(s.hiValue,2)+'/MWh',cx,y+20*q);g.fillText(s.hiDate+(s.hiClock?'  '+s.hiClock:''),cx,y+35*q);g.fillText('AVG   '+pence(s.avg)+'p/kWh   £'+fmt(s.avg,2)+'/MWh',cx,y+55*q);g.fillText(s.avgDate,cx,y+70*q);g.fillText('LOW   '+pence(s.loValue)+'p/kWh   £'+fmt(s.loValue,2)+'/MWh',cx,y+90*q);if(!isFull)g.fillText(s.loDate+(s.loClock?'  '+s.loClock:''),cx,y+105*q)}else{g.fillText('HIGH  '+pence(s.hiValue)+'p/kWh   £'+fmt(s.hiValue,2)+'/MWh   '+s.hiDate+(s.hiClock?' '+s.hiClock:''),cx,y+24*q);g.fillText('AVG   '+pence(s.avg)+'p/kWh   £'+fmt(s.avg,2)+'/MWh   '+s.avgDate,cx,y+58*q);g.fillText('LOW   '+pence(s.loValue)+'p/kWh   £'+fmt(s.loValue,2)+'/MWh   '+s.loDate+(s.loClock?' '+s.loClock:''),cx,y+92*q)}g.restore()}
"""

new_summary = """  function drawSummary(g,s,q,w,h,pad,isFull){var boxH=(isFull?92:118)*q,y=h-pad.bottom+(isFull?64:64)*q,x=pad.left,bw=w-pad.left-pad.right;if(isFull)y=h-pad.bottom+66*q;if(!isFull)y=h-128*q;g.save();g.fillStyle='rgba(5,7,12,.86)';g.strokeStyle='rgba(0,255,255,.42)';g.lineWidth=1*q;g.shadowColor='rgba(0,255,255,.20)';g.shadowBlur=8*q;g.beginPath();g.roundRect(x,y,bw,boxH,8*q);g.fill();g.stroke();g.shadowBlur=0;g.fillStyle='#f5f7fb';g.textAlign='center';var cx=x+bw/2;var small=(w/q)<720||isFull;function row(label,val,date,clock){return label+'  '+pence(val)+'p/kWh   £'+fmt(val,2)+'/MWh   '+date+(clock?'  '+clock:'')}g.font='900 '+(isFull?7.7:(small?8.2:10.5))*q+'px Courier New';if(isFull){g.fillText(row('High',s.hiValue,s.hiDate,s.hiClock),cx,y+24*q);g.fillText(row('Average',s.avg,s.avgDate,''),cx,y+53*q);g.fillText(row('Low',s.loValue,s.loDate,s.loClock),cx,y+82*q)}else if(small){g.fillText('HIGH  '+pence(s.hiValue)+'p/kWh   £'+fmt(s.hiValue,2)+'/MWh',cx,y+20*q);g.fillText(s.hiDate+(s.hiClock?'  '+s.hiClock:''),cx,y+35*q);g.fillText('AVG   '+pence(s.avg)+'p/kWh   £'+fmt(s.avg,2)+'/MWh',cx,y+55*q);g.fillText(s.avgDate,cx,y+70*q);g.fillText('LOW   '+pence(s.loValue)+'p/kWh   £'+fmt(s.loValue,2)+'/MWh',cx,y+90*q);g.fillText(s.loDate+(s.loClock?'  '+s.loClock:''),cx,y+105*q)}else{g.fillText(row('High',s.hiValue,s.hiDate,s.hiClock),cx,y+24*q);g.fillText(row('Average',s.avg,s.avgDate,''),cx,y+58*q);g.fillText(row('Low',s.loValue,s.loDate,s.loClock),cx,y+92*q)}g.restore()}
"""

old_pad = """var pad=isFull?{left:58*q,right:18*q,top:112*q,bottom:176*q}:{left:74*q,right:24*q,top:96*q,bottom:284*q};"""
new_pad = """var pad=isFull?{left:58*q,right:18*q,top:112*q,bottom:260*q}:{left:74*q,right:24*q,top:96*q,bottom:284*q};"""

if old_summary not in text:
    raise RuntimeError("Expected V6 drawSummary function not found. Refusing uncontrolled repair.")
if old_pad not in text:
    raise RuntimeError("Expected V6 fullscreen pad expression not found. Refusing uncontrolled repair.")

text = text.replace(old_summary, new_summary, 1)
text = text.replace(old_pad, new_pad, 1)

path.write_text(text, encoding="utf-8")

updated = path.read_text(encoding="utf-8")
for token in ["row('High'", "row('Average'", "row('Low'", "bottom:260*q", "isFull?7.7"]:
    if token not in updated:
        raise RuntimeError(f"Post repair assertion failed: {token}")

report = V6 / "V6_REPAIR_FULLSCREEN_SUMMARY_BOX_REPORT.md"
report.write_text("""# V6 Repair Report: Fullscreen Summary Box

Status: prepared by deterministic repair script.

## Scope

This repair improves the V6 electricity price fullscreen chart summary box.

## Behaviour changed

1. Moves the fullscreen summary box higher above the mobile browser bottom bar.
2. Increases fullscreen bottom chart padding so the axis date and summary box no longer collide.
3. Renders one clean line each for High, Average and Low.
4. Spells out High, Average and Low in the fullscreen summary box.

## Files changed by workflow execution

1. `uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js`
2. `uk_energy_tracking_v6/V6_REPAIR_FULLSCREEN_SUMMARY_BOX_REPORT.md`

## Explicit non scope

No data paths changed.
No forecast logic changed.
No V5 file changed.

## Required maintainer test

Open `/uk_energy_tracking_v6/`, enter fullscreen on mobile and verify that the bottom date, axis and summary box are readable without awkward clipping.
""", encoding="utf-8")

print("V6 fullscreen summary box repair completed locally by script.")
