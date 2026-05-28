from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
UI = ROOT / "uk_energy_tracking_v5" / "price-history-ui.js"
FS = ROOT / "uk_energy_tracking_v5" / "price-history-fullscreen.js"
INDEX = ROOT / "uk_energy_tracking_v5" / "index.md"
REPORT = ROOT / "gridbot_reports" / "patch_v5_multi_year_loading.md"

LOADER_HELPERS = r'''
function periodIsLong(p){return ['12m','2y','5y','10y'].indexOf(p)>=0}
function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
function setLoader(show,pct,msg){
 var id='price-history-loader',el=document.getElementById(id);
 if(!el){
  el=document.createElement('div');el.id=id;
  el.innerHTML='<div class="ph-loader-card"><strong>Loading price history</strong><div class="ph-loader-text"></div><div class="ph-loader-track"><div class="ph-loader-bar"></div></div></div>';
  document.body.appendChild(el);
  var s=document.createElement('style');s.id='price-history-loader-style';
  s.textContent='#price-history-loader{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.58);display:none;align-items:center;justify-content:center;pointer-events:none}.ph-loader-card{width:min(360px,82vw);border:1px solid rgba(0,255,255,.45);border-radius:10px;background:rgba(5,7,12,.92);box-shadow:0 0 22px rgba(0,255,255,.18);padding:14px 16px;color:#f5f7fb;font:13px Courier New,monospace}.ph-loader-card strong{display:block;color:#00ffff;margin-bottom:8px;letter-spacing:.08em;text-transform:uppercase}.ph-loader-text{color:#9aa3b6;margin-bottom:9px}.ph-loader-track{height:8px;border:1px solid rgba(0,255,255,.32);border-radius:20px;overflow:hidden;background:rgba(255,255,255,.06)}.ph-loader-bar{height:100%;width:0%;background:#00ffff;box-shadow:0 0 12px #00ffff;transition:width .24s ease}';
  document.head.appendChild(s);
 }
 if(show){el.style.display='flex';el.querySelector('.ph-loader-bar').style.width=Math.max(0,Math.min(100,pct||0))+'%';el.querySelector('.ph-loader-text').textContent=msg||'Preparing data'}else{el.style.display='none'}
}
function slowLoadYears(years,period){
 var out=[],i=0,delay=periodIsLong(period)?260:0;
 setLoader(periodIsLong(period),4,'Preparing '+years.length+' annual file'+(years.length===1?'':'s'));
 function next(){
  if(i>=years.length){setLoader(periodIsLong(period),82,'Preparing chart points');return Promise.resolve(out)}
  var y=years[i],pct=8+Math.round((i/Math.max(1,years.length))*66);
  setLoader(periodIsLong(period),pct,'Loading '+y+' price file');
  return loadAnnual(y).then(function(rows){out.push(rows);i++;return sleep(delay)}).then(next);
 }
 return next();
}
function decimateRows(rows,limit){
 if(!rows||rows.length<=limit)return rows||[];
 var out=[],bucket=Math.ceil(rows.length/limit);
 for(var i=0;i<rows.length;i+=bucket){
  var slice=rows.slice(i,i+bucket),hi=slice[0],lo=slice[0];
  slice.forEach(function(r){if(Number(r.priceGBPperMWh)>Number(hi.priceGBPperMWh))hi=r;if(Number(r.priceGBPperMWh)<Number(lo.priceGBPperMWh))lo=r});
  if(new Date(lo.priceTimeUTC)<new Date(hi.priceTimeUTC)){out.push(lo);if(hi!==lo)out.push(hi)}else{out.push(hi);if(hi!==lo)out.push(lo)}
 }
 return out.sort(function(a,b){return new Date(a.priceTimeUTC)-new Date(b.priceTimeUTC)});
}
'''


def patch_ui(txt):
    txt = txt.replace("var MAX_VISIBLE_ROWS=19000;", "var MAX_VISIBLE_ROWS=90000;")
    txt = txt.replace("{'7d':7,'30d':30,'3m':92,'6m':183,'12m':366}", "{'7d':7,'30d':30,'3m':92,'6m':183,'12m':366,'2y':732,'5y':1830,'10y':3653}")
    txt = txt.replace("{'7d':'1 week','30d':'1 month','3m':'3 months','6m':'6 months','12m':'12 months'}", "{'7d':'1 week','30d':'1 month','3m':'3 months','6m':'6 months','12m':'12 months','2y':'2 years','5y':'5 years','10y':'10 years'}")
    txt = txt.replace("[['7d','1 week'],['30d','1 month'],['3m','3 months'],['6m','6 months'],['12m','12 months']]", "[['7d','1 week'],['30d','1 month'],['3m','3 months'],['6m','6 months'],['12m','12 months'],['2y','2 years'],['5y','5 years'],['10y','10 years']]")
    if "function periodIsLong" not in txt:
        txt = txt.replace("function loadAnnual(year){", LOADER_HELPERS + "\nfunction loadAnnual(year){")
    txt = txt.replace("Promise.all([loadJson()].concat(years.map(loadAnnual))).then(function(parts){", "slowLoadYears(years,meta.period).then(function(yearParts){return loadJson().then(function(jsonRows){return [jsonRows].concat(yearParts)})}).then(function(parts){")
    txt = txt.replace("if(rows.length>MAX_VISIBLE_ROWS)rows=rows.slice(rows.length-MAX_VISIBLE_ROWS);", "if(rows.length>MAX_VISIBLE_ROWS)rows=rows.slice(rows.length-MAX_VISIBLE_ROWS);setLoader(periodIsLong(meta.period),88,'Rendering '+rows.length.toLocaleString('en-GB')+' price points');")
    txt = txt.replace("table(rows,meta);draw(rows,meta)}).catch(function(){", "table(rows,meta);draw(rows,meta);setLoader(false,100,'Ready')}).catch(function(){setLoader(false,0,'Failed');")
    txt = txt.replace("if(!(count===3&&i===1))drawDateTick(g,x,h-74*q,ts,q", "if(i===0||i===count-1)drawDateTick(g,x,h-74*q,ts,q")
    txt = txt.replace("if(!(count===3&&i===1))drawDateTick(g,x,h-70*q,ts,q", "if(i===0||i===count-1)drawDateTick(g,x,h-70*q,ts,q")
    # Line decimation for normal chart.
    txt = txt.replace("drawAxes(g,w,h,q,mm,t0,t1,pad);g.strokeStyle='#00ffff';", "drawAxes(g,w,h,q,mm,t0,t1,pad);var lineRows=decimateRows(rows,Math.max(900,Math.floor((w/q)*1.8)));g.strokeStyle='#00ffff';")
    txt = txt.replace("rows.forEach(function(r,i){var xx=X(r),yy=Y(Number(r.priceGBPperMWh));if(i)g.lineTo(xx,yy);else g.moveTo(xx,yy)});g.stroke();", "lineRows.forEach(function(r,i){var xx=X(r),yy=Y(Number(r.priceGBPperMWh));if(i)g.lineTo(xx,yy);else g.moveTo(xx,yy)});g.stroke();")
    return txt


def patch_fs(txt):
    # Use start and end only for axis labels, no crowded middle ticks.
    txt = re.sub(r"if\(!\(count===3&&i===1\)\)\{g\.fillStyle='#f5f7fb';g\.font=10\*q\+'px Courier New';g\.textAlign=i===0\?'left':\(i===count-1\?'right':'center'\);g\.fillText\(axisLabel\(ts,span\),x,h-52\*q\)\}", "if(i===0||i===count-1){g.fillStyle='#f5f7fb';g.font=10*q+'px Courier New';g.textAlign=i===0?'left':'right';g.fillText(axisLabel(ts,span),x,h-52*q)}", txt)
    txt = txt.replace("g.strokeStyle='#00ffff';g.lineWidth=2.2*q;", "var lineRows=window.decimateRows?window.decimateRows(rows,Math.max(900,Math.floor((w/q)*1.8))):rows;g.strokeStyle='#00ffff';g.lineWidth=2.2*q;")
    txt = txt.replace("rows.forEach(function(x,i){var xx=X(x),yy=Y(Number(x.priceGBPperMWh));if(i)g.lineTo(xx,yy);else g.moveTo(xx,yy)});g.stroke();", "lineRows.forEach(function(x,i){var xx=X(x),yy=Y(Number(x.priceGBPperMWh));if(i)g.lineTo(xx,yy);else g.moveTo(xx,yy)});g.stroke();")
    return txt


def main():
    ui = patch_ui(UI.read_text())
    # expose decimator for fullscreen file
    if "window.decimateRows=decimateRows" not in ui:
        ui = ui.replace("function decimateRows(rows,limit){", "function decimateRows(rows,limit){")
        ui = ui.replace("function drawDateTick", "window.decimateRows=decimateRows;\nfunction drawDateTick", 1)
    UI.write_text(ui)

    FS.write_text(patch_fs(FS.read_text()))

    idx = INDEX.read_text()
    for old in ["20260527b","20260527c","20260527d","20260527e","20260527f","20260527g","20260527h","20260527i","20260527j","20260527k","20260527l","20260527m","20260527n"]:
        idx = idx.replace(f"price-history-ui.js?v={old}", "price-history-ui.js?v=20260527o")
        idx = idx.replace(f"price-history-fullscreen.js?v={old}", "price-history-fullscreen.js?v=20260527o")
    INDEX.write_text(idx)

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        "# V5 multi year loading patch\n\n"
        "Implemented 2 year, 5 year and 10 year price history windows. Added a deliberately paced loader for 12 month, 2 year, 5 year and 10 year windows so Safari has breathing time while annual files load. Added draw decimation to reduce canvas overload while preserving true HIGH and LOW event detection from the full filtered row set. Simplified x axis labelling to full start date and full end date only, preventing bottom label clashes. Updated cache keys to 20260527o.\n"
    )


if __name__ == "__main__":
    main()
