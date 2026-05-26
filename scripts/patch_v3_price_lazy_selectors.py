from pathlib import Path

PAGE = Path('uk_energy_tracking_v3/index.md')
JS = Path('uk_energy_tracking_v3/price-history-ui.js')
FS = Path('uk_energy_tracking_v3/price-history-fullscreen.js')
DIARY = Path('uk_energy_tracking_v3/WORK_DIARY.md')


def patch_page():
    text = PAGE.read_text(encoding='utf-8')
    old = '''<h2 class="section-title">Electricity Price History</h2>'''
    text = text.replace(old, '<h2 class="section-title">Half Hourly Electricity Price Settlement History, £/MWh</h2>', 1)
    start = text.find('<select id="price-history-range">')
    end = text.find('</select>', start)
    if start != -1 and end != -1:
        end += len('</select>')
        new_controls = '''<select id="price-history-range">
          <option value="7d">1 week</option>
          <option value="1m" selected>1 month</option>
          <option value="3m">3 months</option>
          <option value="6m">6 months</option>
          <option value="12m">12 months</option>
        </select>
        <select id="price-history-year" aria-label="Price history year"></select>
        <select id="price-history-season" aria-label="Price history season">
          <option value="all" selected>All seasons</option>
          <option value="spring">Spring</option>
          <option value="summer">Summer</option>
          <option value="autumn">Autumn</option>
          <option value="winter">Winter</option>
        </select>'''
        text = text[:start] + new_controls + text[end:]
    desc = '''<div class="unit-panel"><strong>Unit:</strong> pounds per megawatt hour (£/MWh). <strong>Resolution:</strong> half hourly settlement period. <strong>Source:</strong> Elexon Balancing Mechanism Reporting Service (BMRS), System Prices. <strong>Attribution:</strong> Data provided by Elexon Limited via the Balancing Mechanism Reporting Service (BMRS). Official source: Elexon BMRS. <strong>Use:</strong> historical wholesale electricity settlement price reference for studying price volatility, negative pricing, seasonal behaviour and renewable generation effects.</div>'''
    import re
    text = re.sub(r'<div class="unit-panel"><strong>Unit:</strong> pounds per Megawatt hour\..*?</div>', desc, text, count=1)
    text = text.replace("price-history-ui.js?v=20260526d", "price-history-ui.js?v=20260526j")
    text = text.replace("price-history-fullscreen.js?v=20260526d", "price-history-fullscreen.js?v=20260526j")
    PAGE.write_text(text, encoding='utf-8')


def patch_js():
    text = JS.read_text(encoding='utf-8')
    if 'function populateYears()' not in text:
        insert_before = 'function customWindow(){'
        helper = "function populateYears(){var y=$('price-history-year');if(!y||y.options.length)return;var cur=new Date().getUTCFullYear();for(var yr=cur;yr>=2016;yr--){var o=document.createElement('option');o.value=String(yr);o.textContent=String(yr);y.appendChild(o)}}\nfunction selectedYear(){var y=$('price-history-year'),cur=new Date().getUTCFullYear(),v=y&&y.value?Number(y.value):cur;return(!v||v<2016||v>cur)?cur:v}\nfunction seasonWindow(year,season){if(!season||season==='all')return null;if(season==='spring')return{start:new Date(Date.UTC(year,2,1)),end:new Date(Date.UTC(year,4,31,23,59,59)),label:'Spring '+year};if(season==='summer')return{start:new Date(Date.UTC(year,5,1)),end:new Date(Date.UTC(year,7,31,23,59,59)),label:'Summer '+year};if(season==='autumn')return{start:new Date(Date.UTC(year,8,1)),end:new Date(Date.UTC(year,10,30,23,59,59)),label:'Autumn '+year};if(season==='winter')return{start:new Date(Date.UTC(year,0,1)),end:new Date(Date.UTC(year,1,29,23,59,59)),label:'Winter '+year};return null}\n"
        text = text.replace(insert_before, helper + insert_before, 1)
    text = text.replace("function loadCsv(){return fetch(CSV_URL+'?t='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.text():'').then(parseCsv).catch(()=>[])}", "function loadCsv(){var y=selectedYear();return fetch('/data/electricity/elexon_system_prices_'+y+'.csv?t='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.text():'').then(parseCsv).catch(()=>[])}")
    import re
    text = re.sub(r"function rangeWindow\(range,all\)\{.*?return\{start:new Date\(now.getTime\(\)-days\*86400000\),end:now,label:range,custom:false\}\}", "function rangeWindow(range,all){var y=selectedYear(),cw=customWindow();if(cw)return cw;var se=$('price-history-season'),sw=seasonWindow(y,se?se.value:'all');if(sw)return sw;var end=(y===new Date().getUTCFullYear())?new Date():new Date(Date.UTC(y,11,31,23,59,59));var days={'7d':7,'1m':31,'3m':92,'6m':183,'12m':366}[range]||31;var start=new Date(end.getTime()-days*86400000),floor=new Date(Date.UTC(y,0,1));if(start<floor)start=floor;return{start:start,end:end,label:range+' '+y,custom:false}}", text)
    if 'function drawZero(' not in text:
        text = text.replace("function draw(rows,meta){", "function drawZero(g,y,w,p,rp,q){g.save();g.strokeStyle='rgba(255,255,255,.55)';g.lineWidth=2*q;g.setLineDash([7*q,5*q]);g.beginPath();g.moveTo(p,y);g.lineTo(w-rp,y);g.stroke();g.setLineDash([]);g.fillStyle='#ffffff';g.fillText('£0',8*q,y-6*q);g.restore()}\nfunction draw(rows,meta){", 1)
        text = text.replace("g.strokeStyle='#00ffff';g.lineWidth=2.2*q;", "if(mm.lo<0&&mm.hi>0)drawZero(g,Y(0),w,p,rp,q);g.strokeStyle='#00ffff';g.lineWidth=2.2*q;", 1)
    text = text.replace("function load(){var rangeEl=$('price-history-range'),range=rangeEl?rangeEl.value:'7d';", "function load(){populateYears();var rangeEl=$('price-history-range'),range=rangeEl?rangeEl.value:'1m';")
    text = text.replace("document.addEventListener('DOMContentLoaded',function(){var r=$('price-history-range'),f=$('price-history-from'),t=$('price-history-to'),cl=$('price-history-clear-dates');if(r)r.addEventListener('change',load);", "document.addEventListener('DOMContentLoaded',function(){populateYears();var r=$('price-history-range'),y=$('price-history-year'),s=$('price-history-season'),f=$('price-history-from'),t=$('price-history-to'),cl=$('price-history-clear-dates');if(r)r.addEventListener('change',load);if(y)y.addEventListener('change',load);if(s)s.addEventListener('change',load);")
    text = text.replace("var av=all.length?dlab(all[0].priceTimeUTC)+' to '+dlab(all[all.length-1].priceTimeUTC):'no source data';s.textContent='Selected range: '", "var av=all.length?dlab(all[0].priceTimeUTC)+' to '+dlab(all[all.length-1].priceTimeUTC):'no annual source data';s.textContent='Snapshot year: '+selectedYear()+' | Selected range: '")
    JS.write_text(text, encoding='utf-8')


def patch_fs():
    text = FS.read_text(encoding='utf-8')
    if 'function drawZero(' not in text:
        text = text.replace("function draw(){", "function drawZero(g,y,w,p,rp,q){g.save();g.strokeStyle='rgba(255,255,255,.55)';g.lineWidth=2*q;g.setLineDash([7*q,5*q]);g.beginPath();g.moveTo(p,y);g.lineTo(w-rp,y);g.stroke();g.setLineDash([]);g.fillStyle='#ffffff';g.fillText('£0',10*q,y-6*q);g.restore()}function draw(){", 1)
        text = text.replace("g.strokeStyle='#00ffff';g.lineWidth=2.2*q;", "if(m.lo<0&&m.hi>0)drawZero(g,Y(0),w,p,rp,q);g.strokeStyle='#00ffff';g.lineWidth=2.2*q;", 1)
    FS.write_text(text, encoding='utf-8')


def patch_diary():
    text = DIARY.read_text(encoding='utf-8')
    marker = '## Diary entry: 2026-05-26 V3 annual lazy loading UI and attribution'
    if marker not in text:
        text += '\n\n' + marker + '\n\nAdded annual lazy loading controls for V3 electricity price history. The browser should now load one annual Elexon System Price CSV at a time through the year selector, rather than attempting to render the full 2016 to present archive. Period choices are 1 week, 1 month, 3 months, 6 months and 12 months. Seasonal filters were added for spring, summer, autumn and winter. The page title and unit panel now clearly state Half Hourly Electricity Price Settlement History, pounds per megawatt hour, Elexon Balancing Mechanism Reporting Service BMRS System Prices and Elexon Limited attribution. A dashed zero price reference line is drawn when the selected snapshot crosses zero.\n'
    DIARY.write_text(text, encoding='utf-8')


def main():
    patch_page(); patch_js(); patch_fs(); patch_diary(); print('patched V3 annual lazy selectors, attribution and zero line')

if __name__ == '__main__':
    main()
