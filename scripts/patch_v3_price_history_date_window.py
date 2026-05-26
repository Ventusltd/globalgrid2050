from pathlib import Path

PAGE = Path('uk_energy_tracking_v3/index.md')
CSS = Path('uk_energy_tracking_v3/price-history-ui.css')
JS = Path('uk_energy_tracking_v3/price-history-ui.js')
DIARY = Path('uk_energy_tracking_v3/WORK_DIARY.md')

DATE_HTML = '''
        <label class="price-history-date-label">From <input type="date" id="price-history-from"></label>
        <label class="price-history-date-label">To <input type="date" id="price-history-to"></label>
        <button type="button" id="price-history-apply-dates" class="price-history-date-apply">Apply dates</button>'''

CSS_ADD = '''

/* V3 price history date window controls */
#electricity-price-history-panel .price-history-date-label{display:flex;align-items:center;gap:6px;color:#9aa3b6;text-transform:uppercase;letter-spacing:.08em;font-size:11px}
#electricity-price-history-panel .price-history-date-label input{background:#050505!important;color:#00ffff!important;border:1px solid #252b36!important;border-radius:4px;padding:7px 9px;font-family:"Courier New",monospace}
#electricity-price-history-panel .price-history-date-apply{border:1px solid #252b36!important;border-radius:4px;padding:7px 9px;color:#00ffff!important;background:rgba(0,255,255,.05)!important;font-family:"Courier New",monospace;cursor:pointer}
'''

DIARY_MARKER = '## Diary entry: 2026-05-26 V3 price history date window controls patch'


def patch_page():
    text = PAGE.read_text(encoding='utf-8')
    if 'id="price-history-from"' not in text:
        text = text.replace('        <a href="/uk_energy_tracking_v3/electricity_price_history.csv" download>Download CSV</a>', DATE_HTML + '\n        <a href="/uk_energy_tracking_v3/electricity_price_history.csv" download>Download CSV</a>', 1)
    PAGE.write_text(text, encoding='utf-8')


def patch_css():
    text = CSS.read_text(encoding='utf-8')
    if 'price-history-date-window controls' not in text and 'price-history-date-label' not in text:
        text = text.rstrip() + CSS_ADD
    CSS.write_text(text, encoding='utf-8')


def patch_js():
    text = JS.read_text(encoding='utf-8')
    if 'function customDateWindow' not in text:
        anchor = '  function cutoff(range){\n'
        insert = '''  function customDateWindow(){
    var fromEl = document.getElementById("price-history-from");
    var toEl = document.getElementById("price-history-to");
    if(!fromEl || !toEl || !fromEl.value || !toEl.value) return null;
    var start = new Date(fromEl.value + "T00:00:00Z");
    var end = new Date(toEl.value + "T23:59:59Z");
    if(isNaN(start) || isNaN(end) || end < start) return null;
    var maxMs = 60 * 24 * 60 * 60 * 1000;
    if(end - start > maxMs){
      end = new Date(start.getTime() + maxMs);
    }
    return {start:start, end:end, label:fromEl.value + " to " + end.toISOString().slice(0,10)};
  }
'''
        text = text.replace(anchor, insert + anchor, 1)
    old = '      var cut = cutoff(range);\n      var rows = cut ? allRows.filter(function(r){ return new Date(r.priceTimeUTC) >= cut; }) : allRows;'
    new = '      var custom = customDateWindow();\n      var cut = cutoff(range);\n      var rows = custom ? allRows.filter(function(r){ var t = new Date(r.priceTimeUTC); return t >= custom.start && t <= custom.end; }) : (cut ? allRows.filter(function(r){ return new Date(r.priceTimeUTC) >= cut; }) : allRows);\n      var activeRangeLabel = custom ? custom.label : range;'
    text = text.replace(old, new)
    text = text.replace('      renderTable(rows, range);\n      draw(rows, range);', '      renderTable(rows, activeRangeLabel);\n      draw(rows, activeRangeLabel);')
    if 'price-history-apply-dates' not in text:
        old2 = '    if(rangeEl) rangeEl.addEventListener("change", load);\n    load();'
        new2 = '    if(rangeEl) rangeEl.addEventListener("change", load);\n    var applyDates = document.getElementById("price-history-apply-dates");\n    if(applyDates) applyDates.addEventListener("click", load);\n    var fromEl = document.getElementById("price-history-from");\n    var toEl = document.getElementById("price-history-to");\n    if(fromEl) fromEl.addEventListener("change", load);\n    if(toEl) toEl.addEventListener("change", load);\n    load();'
        text = text.replace(old2, new2)
    JS.write_text(text, encoding='utf-8')


def patch_diary():
    text = DIARY.read_text(encoding='utf-8')
    if DIARY_MARKER not in text:
        text += '\n\n' + DIARY_MARKER + '\n\nAdded browser date inputs above the V3 price history chart so users can inspect any retained date window without rendering the entire half hourly table at once. Custom date windows are capped to 60 days for chart and table usability. The dropdown ranges remain available for quick views and All captured data remains available for broad context.\n'
    DIARY.write_text(text, encoding='utf-8')


def main():
    patch_page(); patch_css(); patch_js(); patch_diary()
    print('patched V3 price history date window controls')

if __name__ == '__main__':
    main()
