(function(){
  var JSON_URL = "/uk_energy_tracking_v3/electricity_price_history.json";
  var ENABLE_CSV_FEED = true;
  var CSV_URL = "/data/electricity/elexon_system_prices_half_hourly.csv";

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
  function customDateWindow(){
    var f = document.getElementById("price-history-from"), t = document.getElementById("price-history-to");
    if(!f || !t || !f.value || !t.value) return null;
    var start = new Date(f.value + "T00:00:00Z");
    var end = new Date(t.value + "T23:59:59Z");
    if(isNaN(start) || isNaN(end) || end < start) return null;
    var max = 60 * 24 * 60 * 60 * 1000;
    if(end - start > max) end = new Date(start.getTime() + max);
    return {start:start, end:end, label:f.value + " to " + end.toISOString().slice(0,10)};
  }
  function cutoff(range){
    if(range === "all") return null;
    var now = Date.now(), days = 3650;
    if(range === "24h") days = 1;
    else if(range === "7d") days = 7;
    else if(range === "30d") days = 30;
    else if(range === "3m") days = 92;
    else if(range === "6m") days = 183;
    else if(range === "12m") days = 366;
    return new Date(now - days * 24 * 60 * 60 * 1000);
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
    if(r.priceHealth && r.priceHealth !== "ok") return "price: " + r.priceHealth;
    if(r.carbonHealth && r.carbonHealth !== "ok") return "carbon: " + r.carbonHealth;
    if(r.carbonGperKWh !== "" && r.carbonGperKWh != null) return r.carbonGperKWh + " g/kWh";
    if(r.carbonIndex) return String(r.carbonIndex);
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
      return '<tr class="' + ((r.priceHealth && r.priceHealth !== 'ok') ? 'price-warning' : '') + '"><td>' + dateLabel(r.priceTimeUTC) + ' ' + timeLabel(r.priceTimeUTC) + '</td><td>£' + fmt(Number(r.priceGBPperMWh), 2) + '</td><td>' + (r.settlementPeriod || '—') + '</td><td>' + dateLabel(r.capturedAtUTC) + ' ' + timeLabel(r.capturedAtUTC) + '</td><td>' + carbonHealthCell(r) + '</td></tr>';
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
  function mergeSystemAndCapturedRows(systemRows, capturedRows){
    var merged = {};
    (systemRows || []).forEach(function(r){ if(r.priceTimeUTC){ merged[r.priceTimeUTC] = Object.assign({}, r, {source:"Elexon BMRS System Prices", priceHealth:(r.priceHealth || "historical system price")}); } });
    (capturedRows || []).forEach(function(r){ if(r.priceTimeUTC){ merged[r.priceTimeUTC] = Object.assign({}, r, {source:(r.source || "V3 captured Elexon Market Index Price")}); } });
    return Object.keys(merged).sort(function(a,b){ return new Date(a) - new Date(b); }).map(function(k){ return merged[k]; });
  }

  function load(){
    var rangeEl = document.getElementById("price-history-range");
    var range = rangeEl ? rangeEl.value : "7d";
    Promise.all([loadJsonRows(), loadCsvRows()]).then(function(pair){
      var jsonRows = normaliseRows(pair[0]);
      var csvRows = normaliseRows(pair[1]);
      var allRows = mergeSystemAndCapturedRows(csvRows, jsonRows);
      var custom = customDateWindow();
      var cut = cutoff(range);
      var rows = custom ? allRows.filter(function(r){ var t = new Date(r.priceTimeUTC); return t >= custom.start && t <= custom.end; }) : (cut ? allRows.filter(function(r){ return new Date(r.priceTimeUTC) >= cut; }) : allRows);
      var activeRangeLabel = custom ? custom.label : range;
      var latest = allRows.length ? allRows[allRows.length - 1] : null;
      setText("ph-latest-price", latest ? "£" + fmt(Number(latest.priceGBPperMWh), 2) : "—");
      setText("ph-latest-time", latest ? dateLabel(latest.priceTimeUTC) + " " + timeLabel(latest.priceTimeUTC) : "—");
      setText("ph-row-count", String(allRows.length));
      setText("ph-source", csvRows.length ? "Historical Elexon System Prices plus V3 captured Market Index" : (latest && latest.source ? latest.source : "Elexon BMRS"));
      renderTable(rows, activeRangeLabel);
      draw(rows, activeRangeLabel);
    }).catch(function(){ draw([], range); renderTable([], range); });
  }
  document.addEventListener("DOMContentLoaded", function(){
    var rangeEl = document.getElementById("price-history-range");
    if(rangeEl) rangeEl.addEventListener("change", load);
    var f=document.getElementById("price-history-from"),to=document.getElementById("price-history-to"),cl=document.getElementById("price-history-clear-dates");
    if(f)f.addEventListener("change",load);
    if(to)to.addEventListener("change",load);
    if(cl)cl.addEventListener("click",function(){if(f)f.value="";if(to)to.value="";load();});
    load();
    setInterval(load, 5 * 60 * 1000);
    window.addEventListener("resize", load);
  });
})();
