from pathlib import Path

PAGE = Path("uk_energy_tracking_v3/index.md")
CSS = Path("uk_energy_tracking_v3/price-history-ui.css")
JS = Path("uk_energy_tracking_v3/price-history-ui.js")
DIARY = Path("uk_energy_tracking_v3/WORK_DIARY.md")

CSS_LINK = '<link rel="stylesheet" href="/uk_energy_tracking_v3/price-history-ui.css">'
IMPORT_LINE = "@import url('/uk_energy_tracking_v3/price-history-ui.css');"
JS_LINK = "<script src='/uk_energy_tracking_v3/price-history-ui.js'></script>"

CSS_TEXT = r'''
#electricity-price-history-panel,
#electricity-price-history-panel * {
  box-sizing: border-box;
}

#electricity-price-history-panel {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

#electricity-price-history-panel .trend-panel {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  background: #070a10 !important;
  border: 1px solid #252b36 !important;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.02), 0 0 22px rgba(0,255,255,.05);
}

#electricity-price-history-panel .price-history-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

#electricity-price-history-panel .price-history-actions strong {
  color: #00ffff !important;
  letter-spacing: .12em;
  text-transform: uppercase;
}

#electricity-price-history-panel .price-history-actions select {
  background: #050505 !important;
  color: #00ffff !important;
  border: 1px solid #252b36 !important;
  border-radius: 4px;
  padding: 7px 9px;
  font-family: "Courier New", monospace;
}

#electricity-price-history-panel .price-history-actions a {
  border: 1px solid #252b36 !important;
  border-radius: 4px;
  padding: 7px 9px;
  color: #7fdfff !important;
  text-decoration: none !important;
  background: rgba(255,255,255,.03) !important;
}

#electricity-price-history-panel #price-history-canvas {
  width: 100% !important;
  max-width: 100% !important;
  height: clamp(200px, 32vw, 320px) !important;
  display: block;
  border: 1px solid #252b36 !important;
  background: #05070c !important;
  border-radius: 6px;
  touch-action: none;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.02);
}

#electricity-price-history-panel .price-history-grid {
  display: grid;
  grid-template-columns: repeat(4,minmax(0,1fr));
  gap: 10px;
  margin-top: 12px;
}

#electricity-price-history-panel .price-history-card {
  border: 1px solid #252b36 !important;
  background: #0b0f17 !important;
  border-radius: 6px;
  padding: 12px;
  min-width: 0;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.02);
}

#electricity-price-history-panel .price-history-label {
  color: #9aa3b6 !important;
  text-transform: uppercase;
  letter-spacing: .12em;
  font-size: 10px;
}

#electricity-price-history-panel .price-history-value {
  color: #00ffff !important;
  font-size: 18px;
  font-weight: 800;
  margin-top: 5px;
  overflow-wrap: anywhere;
}

#electricity-price-history-panel .price-history-table-toggle {
  margin-top: 12px;
  border: 1px solid #252b36 !important;
  border-radius: 6px;
  background: #0b0f17 !important;
  overflow: hidden;
}

#electricity-price-history-panel .price-history-table-toggle summary {
  cursor: pointer;
  list-style: none;
  padding: 10px 12px;
  color: #00ffff !important;
  background: #05070c !important;
  text-transform: uppercase;
  letter-spacing: .1em;
  font-size: 11px;
  border-bottom: 1px solid #252b36 !important;
}

#electricity-price-history-panel .price-history-table-toggle summary::-webkit-details-marker {
  display: none;
}

#electricity-price-history-panel .price-history-table-toggle summary::after {
  content: "Open";
  float: right;
  color: #9aa3b6;
  letter-spacing: .08em;
}

#electricity-price-history-panel .price-history-table-toggle[open] summary::after {
  content: "Close";
}

#electricity-price-history-panel .price-history-table-wrap {
  overflow-x: auto;
  overflow-y: auto;
  border: 0 !important;
  border-radius: 0;
  margin-top: 0;
  max-height: 320px;
  max-width: 100%;
  background: #070a10 !important;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.02);
}

#electricity-price-history-panel table.price-history-table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
  border-spacing: 0;
  font-size: 12px;
  color: #f5f7fb !important;
  background: #070a10 !important;
  font-family: "Courier New", monospace;
}

#electricity-price-history-panel table.price-history-table thead,
#electricity-price-history-panel table.price-history-table tbody,
#electricity-price-history-panel table.price-history-table tr {
  background: transparent !important;
}

#electricity-price-history-panel table.price-history-table th,
#electricity-price-history-panel table.price-history-table td {
  border: 0 !important;
  border-bottom: 1px solid #252b36 !important;
  border-right: 1px solid rgba(255,255,255,.045) !important;
  padding: 9px 10px;
  text-align: left;
  white-space: nowrap;
  background: #0b0f17 !important;
  color: #f5f7fb !important;
}

#electricity-price-history-panel table.price-history-table tbody tr:nth-child(even) td {
  background: #0f1520 !important;
}

#electricity-price-history-panel table.price-history-table tbody tr:hover td {
  background: #111b29 !important;
}

#electricity-price-history-panel table.price-history-table th {
  color: #00ffff !important;
  text-transform: uppercase;
  letter-spacing: .08em;
  background: #05070c !important;
  position: sticky;
  top: 0;
  z-index: 2;
}

#electricity-price-history-panel table.price-history-table td:nth-child(2) {
  color: #00ffff !important;
  font-weight: 800;
}

#electricity-price-history-panel table.price-history-table td:nth-child(5) {
  color: #9aa3b6 !important;
}

@media (max-width: 850px) {
  #electricity-price-history-panel .price-history-grid { grid-template-columns: 1fr 1fr; }
  #electricity-price-history-panel #price-history-canvas { height: 220px !important; }
  #electricity-price-history-panel table.price-history-table { font-size: 11px; min-width: 700px; }
}

@media (max-width: 560px) {
  #electricity-price-history-panel .price-history-grid { grid-template-columns: 1fr; }
  #electricity-price-history-panel .price-history-value { font-size: 22px; }
  #electricity-price-history-panel #price-history-canvas { height: 205px !important; }
}
'''.strip() + "\n"

JS_TEXT = r'''(function(){
  var JSON_URL = "/uk_energy_tracking_v3/electricity_price_history.json";
  var ENABLE_CSV_FEED = false;
  var CSV_URL = "/uk_energy_tracking_v3/elexon_system_prices_half_hourly.csv";

  function fmt(n, dp){
    if(n === null || n === undefined || isNaN(n)) return "—";
    return Number(n).toLocaleString("en-GB", {minimumFractionDigits: dp, maximumFractionDigits: dp});
  }
  function setText(id, value){
    var el = document.getElementById(id);
    if(el) el.textContent = value;
  }
  function timeLabel(iso){
    return iso ? new Date(iso).toLocaleTimeString("en-GB", {hour:"2-digit", minute:"2-digit"}) : "—";
  }
  function dateLabel(iso){
    return iso ? new Date(iso).toLocaleDateString("en-GB", {day:"2-digit", month:"short", year:"numeric"}) : "";
  }
  function rangeLabel(range){
    var labels = {"24h":"24 hours", "7d":"7 days", "30d":"30 days", "3m":"3 months", "6m":"6 months", "12m":"12 months", "10y":"10 years", "all":"all captured data"};
    return labels[range] || range;
  }
  function cutoff(range){
    if(range === "all") return null;
    var d = new Date();
    if(range === "24h") d.setDate(d.getDate() - 1);
    else if(range === "7d") d.setDate(d.getDate() - 7);
    else if(range === "30d") d.setDate(d.getDate() - 30);
    else if(range === "3m") d.setMonth(d.getMonth() - 3);
    else if(range === "6m") d.setMonth(d.getMonth() - 6);
    else if(range === "12m") d.setFullYear(d.getFullYear() - 1);
    else d.setFullYear(d.getFullYear() - 10);
    return d;
  }
  function parseCsvLine(line){
    var out = [];
    var value = "";
    var inQuotes = false;
    for(var i = 0; i < line.length; i++){
      var ch = line[i];
      if(ch === '"'){
        if(inQuotes && line[i + 1] === '"'){
          value += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if(ch === "," && !inQuotes){
        out.push(value);
        value = "";
      } else {
        value += ch;
      }
    }
    out.push(value);
    return out;
  }
  function parseCsv(text){
    var trimmed = (text || "").trim();
    if(!trimmed) return [];
    var lines = trimmed.split(/\r?\n/);
    if(lines.length < 2) return [];
    var heads = parseCsvLine(lines[0]).map(function(h){ return h.trim(); });
    return lines.slice(1).map(function(line){
      var cols = parseCsvLine(line);
      var row = {};
      heads.forEach(function(h, i){ row[h] = (cols[i] || "").trim(); });
      var price = row.systemBuyPriceGBPperMWh || row.systemSellPriceGBPperMWh || row.priceGBPperMWh || "";
      return {
        source: row.source || "Elexon BMRS",
        priceTimeUTC: row.periodStartUTC || row.priceTimeUTC || "",
        capturedAtUTC: row.fetchedAtUTC || row.capturedAtUTC || "",
        settlementDate: row.settlementDate || "",
        settlementPeriod: row.settlementPeriod || "",
        priceGBPperMWh: price,
        carbonGperKWh: row.carbonGperKWh || "",
        carbonIndex: row.carbonIndex || "",
        priceHealth: row.priceHealth || "",
        carbonHealth: row.carbonHealth || "",
        netImbalanceVolumeMWh: row.netImbalanceVolumeMWh || ""
      };
    }).filter(function(r){ return r.priceTimeUTC && r.priceGBPperMWh !== "" && !isNaN(Number(r.priceGBPperMWh)); });
  }
  function loadJsonRows(){
    return fetch(JSON_URL + "?t=" + Date.now(), {cache:"no-store"})
      .then(function(r){ return r.ok ? r.json() : {rows:[]}; })
      .then(function(data){ return data.rows || []; })
      .catch(function(){ return []; });
  }
  function loadCsvRows(){
    if(!ENABLE_CSV_FEED) return Promise.resolve([]);
    return fetch(CSV_URL + "?t=" + Date.now(), {cache:"no-store"})
      .then(function(r){ return r.ok ? r.text() : ""; })
      .then(parseCsv)
      .catch(function(){ return []; });
  }
  function carbonHealthCell(r){
    if(r.carbonGperKWh !== "" && r.carbonGperKWh != null) return r.carbonGperKWh + " g/kWh";
    if(r.carbonIndex) return String(r.carbonIndex);
    if(r.priceHealth && r.priceHealth !== "ok") return "price: " + r.priceHealth;
    if(r.carbonHealth && r.carbonHealth !== "ok") return "carbon: " + r.carbonHealth;
    return "—";
  }
  function minMax(vals){
    if(!vals.length) return null;
    var min = vals[0], max = vals[0];
    for(var i = 1; i < vals.length; i++){
      if(vals[i] < min) min = vals[i];
      if(vals[i] > max) max = vals[i];
    }
    return {min:min, max:max};
  }
  function draw(rows, range){
    var canvas = document.getElementById("price-history-canvas");
    if(!canvas) return;
    var ratio = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    if(rect.width){
      canvas.width = Math.max(320, Math.floor(rect.width * ratio));
      canvas.height = Math.max(190, Math.floor((rect.height || 240) * ratio));
    }
    var ctx = canvas.getContext("2d");
    var w = canvas.width, h = canvas.height, pad = 62 * ratio, rightPad = 22 * ratio;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#05070c";
    ctx.fillRect(0, 0, w, h);
    ctx.font = (12 * ratio) + "px Courier New";
    if(rows.length < 2){
      ctx.fillStyle = "#00ffff";
      ctx.font = (14 * ratio) + "px Courier New";
      ctx.fillText(rows.length ? "Only one captured value in selected range" : "No records in selected range: " + rangeLabel(range), pad, 42 * ratio);
      return;
    }
    var vals = rows.map(function(r){ return Number(r.priceGBPperMWh); });
    var mm = minMax(vals);
    var min = mm.min, max = mm.max;
    if(max === min) max = min + 1;
    var margin = (max - min) * 0.10;
    min -= margin;
    max += margin;
    var t0 = new Date(rows[0].priceTimeUTC).getTime();
    var t1 = new Date(rows[rows.length - 1].priceTimeUTC).getTime();
    var span = (t1 - t0) || 1;
    function x(r){
      var t = new Date(r.priceTimeUTC).getTime();
      return pad + ((t - t0) / span) * (w - pad - rightPad);
    }
    function y(v){ return h - pad - ((v - min) / (max - min)) * (h - pad * 1.65); }
    ctx.strokeStyle = "rgba(0,255,255,0.16)";
    ctx.lineWidth = ratio;
    ctx.fillStyle = "#c8d4e8";
    for(var g = 0; g < 5; g++){
      var value = max - (g * (max - min) / 4);
      var yy = y(value);
      ctx.beginPath();
      ctx.moveTo(pad, yy);
      ctx.lineTo(w - rightPad, yy);
      ctx.stroke();
      ctx.fillText("£" + fmt(value, 0), 8 * ratio, yy + 4 * ratio);
    }
    ctx.strokeStyle = "#00ffff";
    ctx.lineWidth = 2.4 * ratio;
    ctx.shadowColor = "#00ffff";
    ctx.shadowBlur = 8 * ratio;
    ctx.beginPath();
    rows.forEach(function(r, i){
      var xx = x(r), yy = y(Number(r.priceGBPperMWh));
      if(i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;
    var first = rows[0], last = rows[rows.length - 1];
    ctx.fillStyle = "#c8d4e8";
    ctx.fillText(dateLabel(first.priceTimeUTC), pad, h - 18 * ratio);
    ctx.textAlign = "right";
    ctx.fillText(dateLabel(last.priceTimeUTC), w - rightPad, h - 18 * ratio);
    ctx.textAlign = "left";
  }
  function renderTable(rows, range){
    var body = document.getElementById("price-history-table-body");
    if(!body) return;
    if(!rows.length){
      body.innerHTML = '<tr><td colspan="5">No captured price records in selected range: ' + rangeLabel(range) + '.</td></tr>';
      return;
    }
    var ordered = rows.slice().reverse();
    body.innerHTML = ordered.map(function(r){
      return '<tr><td>' + dateLabel(r.priceTimeUTC) + ' ' + timeLabel(r.priceTimeUTC) + '</td><td>£' + fmt(Number(r.priceGBPperMWh), 2) + '</td><td>' + (r.settlementPeriod || '—') + '</td><td>' + dateLabel(r.capturedAtUTC) + ' ' + timeLabel(r.capturedAtUTC) + '</td><td>' + carbonHealthCell(r) + '</td></tr>';
    }).join("");
  }
  function normaliseRows(rows){
    var seen = {};
    return (rows || []).filter(function(r){
      return r.priceTimeUTC && r.priceGBPperMWh !== "" && !isNaN(Number(r.priceGBPperMWh));
    }).map(function(r){
      var out = Object.assign({}, r);
      out.priceGBPperMWh = Number(out.priceGBPperMWh);
      return out;
    }).sort(function(a,b){ return new Date(a.priceTimeUTC) - new Date(b.priceTimeUTC); })
      .filter(function(r){
        var key = r.priceTimeUTC + "|" + r.priceGBPperMWh;
        if(seen[key]) return false;
        seen[key] = true;
        return true;
      });
  }
  function load(){
    var rangeEl = document.getElementById("price-history-range");
    var range = rangeEl ? rangeEl.value : "7d";
    Promise.all([loadJsonRows(), loadCsvRows()]).then(function(pair){
      var jsonRows = normaliseRows(pair[0]);
      var csvRows = normaliseRows(pair[1]);
      var allRows = csvRows.length ? csvRows : jsonRows;
      var cut = cutoff(range);
      var rows = cut ? allRows.filter(function(r){ return new Date(r.priceTimeUTC) >= cut; }) : allRows;
      var latest = allRows.length ? allRows[allRows.length - 1] : null;
      setText("ph-latest-price", latest ? "£" + fmt(Number(latest.priceGBPperMWh), 2) : "—");
      setText("ph-latest-time", latest ? dateLabel(latest.priceTimeUTC) + " " + timeLabel(latest.priceTimeUTC) : "—");
      setText("ph-row-count", String(allRows.length));
      setText("ph-source", latest && latest.source ? latest.source : "Elexon BMRS");
      renderTable(rows, range);
      draw(rows, range);
    }).catch(function(){ draw([], range); renderTable([], range); });
  }
  document.addEventListener("DOMContentLoaded", function(){
    var rangeEl = document.getElementById("price-history-range");
    if(rangeEl) rangeEl.addEventListener("change", load);
    load();
    setInterval(load, 5 * 60 * 1000);
    window.addEventListener("resize", load);
  });
})();
'''

DIARY_MARKER = "## Diary entry: 2026-05-25 V3 price history correctness patch"
DIARY_ENTRY = f'''

{DIARY_MARKER}

Purpose:

```text
correct V3 price history graph and table behaviour without touching the stable tracker
```

Patch method:

```text
keep /uk_energy_tracking_v3/electricity_price_history.json as the active captured history source
disable the planned future CSV feed until deliberately built
add an All captured data range option
make the graph use timestamp based x axis spacing
show no data in selected range instead of silently falling back to all data
render all rows in the selected range inside the dropdown table, newest first
align the table to 5 columns: settlement time, price, settlement period, captured UTC and carbon or health
make canvas sizing responsive to the displayed CSS size
scope all table and chart CSS under #electricity-price-history-panel
```

Files intentionally changed by GridBot workflow:

```text
uk_energy_tracking_v3/index.md
uk_energy_tracking_v3/price-history-ui.js
uk_energy_tracking_v3/price-history-ui.css
uk_energy_tracking_v3/WORK_DIARY.md
```

Stable tracker rule:

```text
No changes to uk_energy_tracking/.
```
'''


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_if_changed(path: Path, text: str) -> bool:
    old = path.read_text(encoding="utf-8") if path.exists() else ""
    if old == text:
        return False
    path.write_text(text, encoding="utf-8")
    return True


def ensure_linked_css(text: str) -> str:
    text = text.replace(IMPORT_LINE + "\n", "")
    text = text.replace(IMPORT_LINE, "")
    if CSS_LINK in text:
        return text
    style_pos = text.find("<style>")
    if style_pos == -1:
        raise RuntimeError("Could not locate opening style block")
    return text[:style_pos] + CSS_LINK + "\n" + text[style_pos:]


def ensure_js_link(text: str) -> str:
    if JS_LINK in text:
        return text
    return text.replace("</div>\n\n<script>", "</div>\n" + JS_LINK + "\n\n<script>")


def ensure_all_option(text: str) -> str:
    if '<option value="all">All captured data</option>' in text:
        return text
    anchor = '          <option value="10y">10 years</option>'
    if anchor not in text:
        raise RuntimeError("Could not locate price history range options")
    return text.replace(anchor, anchor + '\n          <option value="all">All captured data</option>', 1)


def collapse_table(text: str) -> str:
    new_block = '''      <details class="price-history-table-toggle">
        <summary>Captured records table</summary>
        <div class="price-history-table-wrap">
          <table class="price-history-table">
            <thead><tr><th>Settlement time</th><th>Price GBP/MWh</th><th>Settlement period</th><th>Captured UTC</th><th>Carbon / health</th></tr></thead>
            <tbody id="price-history-table-body"><tr><td colspan="5">Awaiting captured price history.</td></tr></tbody>
          </table>
        </div>
      </details>'''
    start = text.find('      <details class="price-history-table-toggle">')
    if start != -1:
        end = text.find('      </details>', start)
        if end == -1:
            raise RuntimeError("Could not locate end of existing price history details block")
        end += len('      </details>')
        return text[:start] + new_block + text[end:]
    old_4 = '''      <div class="price-history-table-wrap">
        <table class="price-history-table">
          <thead><tr><th>Settlement time</th><th>Price GBP/MWh</th><th>Captured UTC</th><th>Carbon g/kWh</th></tr></thead>
          <tbody id="price-history-table-body"><tr><td colspan="4">Awaiting captured price history.</td></tr></tbody>
        </table>
      </div>'''
    old_5 = '''      <div class="price-history-table-wrap">
        <table class="price-history-table">
          <thead><tr><th>Settlement time</th><th>Price GBP/MWh</th><th>Settlement period</th><th>Captured UTC</th><th>Carbon / health</th></tr></thead>
          <tbody id="price-history-table-body"><tr><td colspan="5">Awaiting captured price history.</td></tr></tbody>
        </table>
      </div>'''
    if old_4 in text:
        return text.replace(old_4, new_block, 1)
    if old_5 in text:
        return text.replace(old_5, new_block, 1)
    raise RuntimeError("Could not locate price history table block")


def patch_page() -> bool:
    text = read(PAGE)
    text = text.replace("UK LIVE GRID TRACKER V2", "UK LIVE GRID TRACKER V3")
    text = text.replace("This page uses isolated V2 feeds", "This page uses isolated V3 feeds")
    text = ensure_linked_css(text)
    text = ensure_js_link(text)
    text = ensure_all_option(text)
    text = collapse_table(text)
    if IMPORT_LINE in text:
        raise RuntimeError("Late CSS import still present")
    if CSS_LINK not in text:
        raise RuntimeError("Price history stylesheet link missing")
    if JS_LINK not in text:
        raise RuntimeError("Price history JS link missing")
    if '<option value="all">All captured data</option>' not in text:
        raise RuntimeError("All captured data option missing")
    return write_if_changed(PAGE, text)


def patch_css() -> bool:
    return write_if_changed(CSS, CSS_TEXT)


def patch_js() -> bool:
    return write_if_changed(JS, JS_TEXT)


def patch_diary() -> bool:
    text = read(DIARY)
    if DIARY_MARKER in text:
        return False
    return write_if_changed(DIARY, text.rstrip() + DIARY_ENTRY + "\n")


def main() -> None:
    changed = []
    if patch_page():
        changed.append(str(PAGE))
    if patch_css():
        changed.append(str(CSS))
    if patch_js():
        changed.append(str(JS))
    if patch_diary():
        changed.append(str(DIARY))
    if changed:
        print("Patched V3 price history correctness:")
        for path in changed:
            print(f"  {path}")
    else:
        print("V3 price history correctness patch already applied")


if __name__ == "__main__":
    main()
