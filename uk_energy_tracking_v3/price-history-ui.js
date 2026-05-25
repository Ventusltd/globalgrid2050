(function(){
  var JSON_URL = "/uk_energy_tracking_v3/electricity_price_history.json";
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
  function cutoff(range){
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
  function parseCsv(text){
    var lines = text.trim().split(/\r?\n/);
    if(lines.length < 2) return [];
    var heads = lines[0].split(",").map(function(h){ return h.trim(); });
    return lines.slice(1).map(function(line){
      var cols = line.split(",");
      var row = {};
      heads.forEach(function(h, i){ row[h] = (cols[i] || "").trim(); });
      var price = row.systemBuyPriceGBPperMWh || row.systemSellPriceGBPperMWh || row.priceGBPperMWh || "";
      return {
        source: row.source || "Elexon BMRS System Prices",
        priceTimeUTC: row.periodStartUTC || row.priceTimeUTC || "",
        capturedAtUTC: row.fetchedAtUTC || row.capturedAtUTC || "",
        settlementDate: row.settlementDate || "",
        settlementPeriod: row.settlementPeriod || "",
        priceGBPperMWh: price,
        carbonGperKWh: row.carbonGperKWh || "",
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
    return fetch(CSV_URL + "?t=" + Date.now(), {cache:"no-store"})
      .then(function(r){ return r.ok ? r.text() : ""; })
      .then(parseCsv)
      .catch(function(){ return []; });
  }
  function draw(rows){
    var canvas = document.getElementById("price-history-canvas");
    if(!canvas) return;
    var ratio = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    if(rect.width){
      canvas.width = Math.max(600, Math.floor(rect.width * ratio));
      canvas.height = Math.floor(300 * ratio);
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
      ctx.fillText("Waiting for more captured electricity price history", pad, 42 * ratio);
      return;
    }
    var vals = rows.map(function(r){ return Number(r.priceGBPperMWh); });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if(max === min) max = min + 1;
    var margin = (max - min) * 0.10;
    min -= margin;
    max += margin;
    function x(i){ return pad + (i / (rows.length - 1)) * (w - pad - rightPad); }
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
      var xx = x(i), yy = y(Number(r.priceGBPperMWh));
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
  function renderTable(rows){
    var body = document.getElementById("price-history-table-body");
    if(!body) return;
    var latest = rows.slice(-12).reverse();
    if(!latest.length){
      body.innerHTML = '<tr><td colspan="5">Awaiting captured price history.</td></tr>';
      return;
    }
    body.innerHTML = latest.map(function(r){
      return '<tr><td>' + dateLabel(r.priceTimeUTC) + ' ' + timeLabel(r.priceTimeUTC) + '</td><td>£' + fmt(Number(r.priceGBPperMWh), 2) + '</td><td>' + (r.settlementPeriod || '—') + '</td><td>' + dateLabel(r.capturedAtUTC) + ' ' + timeLabel(r.capturedAtUTC) + '</td><td>' + (r.netImbalanceVolumeMWh || r.carbonGperKWh || '—') + '</td></tr>';
    }).join("");
  }
  function normaliseRows(rows){
    return (rows || []).filter(function(r){
      return r.priceTimeUTC && r.priceGBPperMWh !== "" && !isNaN(Number(r.priceGBPperMWh));
    }).sort(function(a,b){ return new Date(a.priceTimeUTC) - new Date(b.priceTimeUTC); });
  }
  function load(){
    var rangeEl = document.getElementById("price-history-range");
    var range = rangeEl ? rangeEl.value : "7d";
    Promise.all([loadJsonRows(), loadCsvRows()]).then(function(pair){
      var jsonRows = normaliseRows(pair[0]);
      var csvRows = normaliseRows(pair[1]);
      var allRows = csvRows.length > 1 ? csvRows : jsonRows;
      var rows = allRows.filter(function(r){ return new Date(r.priceTimeUTC) >= cutoff(range); });
      var latest = rows.length ? rows[rows.length - 1] : (allRows.length ? allRows[allRows.length - 1] : null);
      setText("ph-latest-price", latest ? "£" + fmt(Number(latest.priceGBPperMWh), 2) : "—");
      setText("ph-latest-time", latest ? dateLabel(latest.priceTimeUTC) + " " + timeLabel(latest.priceTimeUTC) : "—");
      setText("ph-row-count", String(allRows.length));
      setText("ph-source", latest && latest.source ? latest.source : "Elexon BMRS");
      renderTable(rows.length ? rows : allRows);
      draw(rows.length ? rows : allRows);
    }).catch(function(){ draw([]); renderTable([]); });
  }
  document.addEventListener("DOMContentLoaded", function(){
    var rangeEl = document.getElementById("price-history-range");
    if(rangeEl) rangeEl.addEventListener("change", load);
    load();
    setInterval(load, 5 * 60 * 1000);
  });
})();