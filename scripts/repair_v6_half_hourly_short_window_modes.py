from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]

FILES = {
    "ai_start": ROOT / "AI_START_HERE.md",
    "protocol": ROOT / "uk_energy_tracking_v6" / "V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
    "loader": ROOT / "uk_energy_tracking_v6" / "price_history_chart" / "load_price_history_data" / "load_price_history_data.js",
    "renderer": ROOT / "uk_energy_tracking_v6" / "price_history_chart" / "render_price_chart" / "render_price_chart.js",
    "index": ROOT / "uk_energy_tracking_v6" / "index.md",
    "article": ROOT / "data" / "grid_studies_public" / "great_britain_electricity_price_grid_constraint_trends_2016_2026.html",
    "report": ROOT / "uk_energy_tracking_v6" / "V6_REPAIR_HALF_HOURLY_SHORT_WINDOW_MODES_REPORT.md",
}

TOUCHED = []


def read(path):
    if not path.exists():
        raise SystemExit(f"Missing required file: {path}")
    return path.read_text(encoding="utf-8")


def write(path, text):
    old = read(path)
    if old != text:
        path.write_text(text, encoding="utf-8")
        TOUCHED.append(str(path.relative_to(ROOT)))


def must_contain(text, needle, label):
    if needle not in text:
        raise SystemExit(f"Missing expected marker in {label}: {needle}")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly 1 match in {label}, found {count}: {old[:120]}")
    return text.replace(old, new, 1)


def replace_all_expected(text, old, new, expected, label):
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"Expected {expected} matches in {label}, found {count}: {old[:120]}")
    return text.replace(old, new)


def patch_loader():
    path = FILES["loader"]
    text = read(path)
    must_contain(text, "function periodDays(p)", "loader")
    must_contain(text, "function isDaily(p){return ['12m','5y','10y'].indexOf(p)>=0}", "loader")

    old_days = "return {'12hday':0.5,'12hnight':0.5,'1d':1,'7d':7,'30d':30,'3m':92,'6m':183,'12m':366,'5y':1827,'10y':3653}[p]||7"
    new_days = "return {'12hday':0.5,'12hnight':0.5,'1d':1,'24h':1,'48h':2,'7d':7,'30d':30,'3m':92,'6m':183,'12m':366,'5y':1827,'10y':3653}[p]||7"
    if new_days not in text:
        text = replace_once(text, old_days, new_days, "loader periodDays")

    old_label = "return {'12hday':'12 hours day','12hnight':'12 hours night','1d':'1 day','7d':'1 week','30d':'1 month','3m':'3 months','6m':'6 months','12m':'12 months','5y':'5 years','10y':'10 years'}[p]||'1 week'"
    new_label = "return {'12hday':'12 hours day','12hnight':'12 hours night','1d':'1 day','24h':'24 hours','48h':'48 hours','7d':'1 week','30d':'1 month','3m':'3 months','6m':'6 months','12m':'12 months','5y':'5 years','10y':'10 years'}[p]||'1 week'"
    if new_label not in text:
        text = replace_once(text, old_label, new_label, "loader periodLabel")

    must_contain(text, "function isDaily(p){return ['12m','5y','10y'].indexOf(p)>=0}", "loader daily mode")
    write(path, text)


def patch_index():
    path = FILES["index"]
    text = read(path)
    old = "<option value=\"1d\">1 day</option>\n          <option value=\"7d\" selected>1 week</option>"
    new = "<option value=\"24h\">24 hours</option>\n          <option value=\"48h\">48 hours</option>\n          <option value=\"7d\" selected>1 week</option>"
    if new not in text:
        text = replace_all_expected(text, old, new, 2, "V6 index period controls")

    for marker in [
        '<option value="30d">1 month</option>',
        '<option value="3m">3 months</option>',
        '<option value="6m">6 months</option>',
        '<option value="12m">12 months</option>',
        '<option value="5y">5 years</option>',
        '<option value="10y">10 years</option>',
    ]:
        must_contain(text, marker, "V6 index long range option")
    write(path, text)


def patch_article():
    path = FILES["article"]
    text = read(path)
    old = '<button type="button" data-start="2022-12-01" data-period="6m">2023 negative prices</button>\n                    <button type="button" data-dynamic="latest" data-period="7d" class="active">Latest 1 week</button>'
    new = '<button type="button" data-start="2022-12-01" data-period="6m">2023 negative prices</button>\n                    <button type="button" data-dynamic="latest" data-period="24h">Latest 24 hours</button>\n                    <button type="button" data-dynamic="latest" data-period="48h">Latest 48 hours</button>\n                    <button type="button" data-dynamic="latest" data-period="7d" class="active">Latest 1 week</button>'
    if new not in text:
        text = replace_once(text, old, new, "main article chart controls")
    write(path, text)


def patch_renderer():
    path = FILES["renderer"]
    text = read(path)

    old_date_label = "function dateLabel(t,span){return span>45*86400000?new Date(t).toLocaleDateString('en-GB',{month:'long',year:'numeric'}):new Date(t).toLocaleDateString('en-GB')}"
    new_date_label = "function dateLabel(t,span){return span>45*86400000?new Date(t).toLocaleDateString('en-GB',{month:'long',year:'numeric'}):new Date(t).toLocaleDateString('en-GB')}\n  function shortTickLabel(t,span){var d=new Date(t);if(span<=2.1*86400000)return d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false});return d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}\n  function drawShortWindowTicks(g,w,h,q,pad,t0,t1,span){if(span>7.1*86400000)return;var interval=span<=1.1*86400000?3*3600000:span<=2.1*86400000?6*3600000:86400000;var first=Math.ceil(t0/interval)*interval;g.save();g.font=10*q+'px Courier New';g.textAlign='center';for(var t=first;t<t1;t+=interval){var x=pad.left+((t-t0)/(t1-t0))*(w-pad.left-pad.right);g.strokeStyle='rgba(255,255,255,.10)';g.beginPath();g.moveTo(x,pad.top);g.lineTo(x,h-pad.bottom);g.stroke();g.fillStyle='#9aa3b6';g.fillText(shortTickLabel(t,span),x,h-pad.bottom+40*q)}g.restore()}"
    if new_date_label not in text:
        text = replace_once(text, old_date_label, new_date_label, "renderer date label helpers")

    old_axes = "function drawAxes(g,w,h,q,mm,pad,t0,t1){var st=step(mm.hi-mm.lo),start=Math.ceil(mm.lo/st)*st,span=t1-t0;g.font=11*q+'px Courier New';for(var v=start;v<=mm.hi+st*.5;v+=st){var y=pad.top+((mm.hi-v)/(mm.hi-mm.lo))*(h-pad.top-pad.bottom);g.fillStyle='#f5f7fb';g.textAlign='left';g.fillText('£'+fmt(v,0).replace('-0','0'),8*q,y+4*q)}g.save();g.strokeStyle='rgba(255,255,255,.26)';g.lineWidth=1*q;g.beginPath();g.moveTo(pad.left,h-pad.bottom);g.lineTo(w-pad.right,h-pad.bottom);g.stroke();g.fillStyle='#f5f7fb';g.font=11*q+'px Courier New';g.textAlign='left';g.fillText(dateLabel(t0,span),pad.left,h-pad.bottom+24*q);g.textAlign='right';g.fillText(dateLabel(t1,span),w-pad.right,h-pad.bottom+24*q);g.restore();g.textAlign='left'}"
    new_axes = "function drawAxes(g,w,h,q,mm,pad,t0,t1){var st=step(mm.hi-mm.lo),start=Math.ceil(mm.lo/st)*st,span=t1-t0;g.font=11*q+'px Courier New';for(var v=start;v<=mm.hi+st*.5;v+=st){var y=pad.top+((mm.hi-v)/(mm.hi-mm.lo))*(h-pad.top-pad.bottom);g.fillStyle='#f5f7fb';g.textAlign='left';g.fillText('£'+fmt(v,0).replace('-0','0'),8*q,y+4*q)}g.save();g.strokeStyle='rgba(255,255,255,.26)';g.lineWidth=1*q;g.beginPath();g.moveTo(pad.left,h-pad.bottom);g.lineTo(w-pad.right,h-pad.bottom);g.stroke();g.fillStyle='#f5f7fb';g.font=11*q+'px Courier New';g.textAlign='left';g.fillText(dateLabel(t0,span),pad.left,h-pad.bottom+24*q);g.textAlign='right';g.fillText(dateLabel(t1,span),w-pad.right,h-pad.bottom+24*q);g.restore();drawShortWindowTicks(g,w,h,q,pad,t0,t1,span);g.textAlign='left'}"
    if new_axes not in text:
        text = replace_once(text, old_axes, new_axes, "renderer short window ticks")

    must_contain(text, "function decimateRows(rows,limit)", "renderer decimation")
    write(path, text)


def assert_final_state():
    loader = read(FILES["loader"])
    index = read(FILES["index"])
    renderer = read(FILES["renderer"])
    article = read(FILES["article"])

    for needle in ["'24h':1", "'48h':2", "'7d':7"]:
        must_contain(loader, needle, "loader short periods")
    must_contain(loader, "function isDaily(p){return ['12m','5y','10y'].indexOf(p)>=0}", "loader long range preserved")

    must_contain(index, '<option value="24h">24 hours</option>', "V6 index 24h")
    must_contain(index, '<option value="48h">48 hours</option>', "V6 index 48h")
    must_contain(index, '<option value="7d" selected>1 week</option>', "V6 index 7d")

    must_contain(article, 'data-period="24h">Latest 24 hours</button>', "article 24h")
    must_contain(article, 'data-period="48h">Latest 48 hours</button>', "article 48h")
    must_contain(article, 'data-period="7d" class="active">Latest 1 week</button>', "article 7d")

    must_contain(renderer, "function drawShortWindowTicks", "renderer short tick helper")
    must_contain(renderer, "span>7.1*86400000", "renderer one week guard")

    must_contain(loader, "window.V6LiveConfig.annualBase+year+'.csv", "loader annual CSV path")
    must_contain(loader, "window.V6LiveConfig.dailyPriceHistory", "loader daily JSON path")


def write_report():
    report = f"""# V6 Repair Report: Half Hourly Short Window Modes

Generated UTC: {datetime.now(timezone.utc).isoformat()}

## Scope

Only short chart windows up to 1 week were touched.

## Intended behaviour

1. 24 hours uses raw half hourly Elexon settlement data and should show up to 48 points.
2. 48 hours uses raw half hourly Elexon settlement data and should show up to 96 points.
3. 1 week uses raw half hourly Elexon settlement data and should show up to 336 points.
4. Periods beyond 1 week are not changed by this repair.

## Files touched by script

{chr(10).join('- ' + x for x in TOUCHED) if TOUCHED else '- No file content changes were required'}

## Guardrails checked

- AI_START_HERE.md present.
- V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md present.
- Long range daily aggregation remains 12m, 5y and 10y only.
- Annual CSV path remains unchanged.
- Daily aggregate JSON path remains unchanged.
- Renderer short window tick logic is guarded to 7.1 days maximum.

## Maintainer test checklist

1. Open /uk_energy_tracking_v6/.
2. Test 24 hours, 48 hours and 1 week.
3. Confirm 1 week shows roughly 336 visible records when a complete week is available.
4. Open /data/grid_studies_public/great_britain_electricity_price_grid_constraint_trends_2016_2026.html.
5. Test Latest 24 hours, Latest 48 hours and Latest 1 week.
6. Confirm 1 month, 3 months, 6 months, 12 months, 5 years and 10 years behave as before.
"""
    FILES["report"].write_text(report, encoding="utf-8")
    if str(FILES["report"].relative_to(ROOT)) not in TOUCHED:
        TOUCHED.append(str(FILES["report"].relative_to(ROOT)))


def main():
    ai = read(FILES["ai_start"])
    protocol = read(FILES["protocol"])
    must_contain(ai, "Do not directly rewrite large HTML, CSS or JavaScript files", "AI_START_HERE")
    must_contain(protocol, "All V6 changes", "V6 protocol")

    patch_loader()
    patch_index()
    patch_article()
    patch_renderer()
    assert_final_state()
    write_report()
    print("V6 half hourly short window repair completed.")
    for item in TOUCHED:
        print("touched:", item)


if __name__ == "__main__":
    main()
