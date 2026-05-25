(function(){
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
  function draw(rows){
    var canvas = document.getElementById("price-history-canvas");
    if(!canvas) return;
    var ctx = canvas.getContext("2d");
    var w = canvas.width, h = canvas.height, pad = 54, rightPad = 28;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#070a10";
    ctx.fillRect(0, 0, w, h);
    if(rows.length < 2){
      ctx.fillStyle = "#a6adbb";
      ctx.font = "14px Courier New";
      ctx.fillText("Waiting for more captured electricity price history", pad, 42);
      return;
    }
    var vals = rows.map(function(r){ return Number(r.priceGBPperMWh); });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if(max === min) max = min + 1;
    var margin = (max - min) * 0.08;
    min -= margin;
    max += margin;
    function x(i){ return pad + (i / (rows.length - 1)) * (w - pad - rightPad); }
    function y(v){ return h - pad - ((v - min) / (max - min)) * (h - pad * 1.85); }
    ctx.strokeStyle = "#252b36";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#a6adbb";
    ctx.font = "12px Courier New";
    for(var g = 0; g < 5; g++){
      var value = max - (g * (max - min) / 4);
      var yy = y(value);
      ctx.beginPath();
      ctx.moveTo(pad, yy);
      ctx.lineTo(w - rightPad, yy);
      ctx.stroke();
      ctx.fillText("GBP " + fmt(value, 0), 8, yy + 4);
    }
    ctx.strokeStyle = "#ff00e6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    rows.forEach(function(r, i){
      var xx = x(i), yy = y(Number(r.priceGBPperMWh));
      if(i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    });
    ctx.stroke();
  }
  function renderTable(rows){
    var body = document.getElementById("price-history-table-body");
    if(!body) return;
    var latest = rows.slice(-12).reverse();
    if(!latest.length){
      body.innerHTML = '<tr><td colspan="4">Awaiting captured price history.</td></tr>';
      return;
    }
    body.innerHTML = latest.map(function(r){
      return '<tr><td>' + dateLabel(r.priceTimeUTC) + ' ' + timeLabel(r.priceTimeUTC) + '</td><td>GBP ' + fmt(Number(r.priceGBPperMWh), 2) + '</td><td>' + dateLabel(r.capturedAtUTC) + ' ' + timeLabel(r.capturedAtUTC) + '</td><td>' + (r.carbonGperKWh || '—') + '</td></tr>';
    }).join("");
  }
  function load(){
    var rangeEl = document.getElementById("price-history-range");
    var range = rangeEl ? rangeEl.value : "7d";
    fetch("/uk_energy_tracking_v3/electricity_price_history.json?t=" + Date.now(), {cache:"no-store"})
      .then(function(r){ return r.ok ? r.json() : {rows:[]}; })
      .then(function(data){
        var allRows = (data.rows || []).filter(function(r){ return r.priceTimeUTC && r.priceGBPperMWh !== "" && !isNaN(Number(r.priceGBPperMWh)); });
        var rows = allRows.filter(function(r){ return new Date(r.priceTimeUTC) >= cutoff(range); }).sort(function(a,b){ return new Date(a.priceTimeUTC) - new Date(b.priceTimeUTC); });
        var latest = rows.length ? rows[rows.length - 1] : null;
        setText("ph-latest-price", latest ? "GBP " + fmt(Number(latest.priceGBPperMWh), 2) : "—");
        setText("ph-latest-time", latest ? timeLabel(latest.priceTimeUTC) : "—");
        setText("ph-row-count", String(allRows.length));
        setText("ph-source", latest && latest.source ? latest.source : "Elexon BMRS");
        renderTable(rows);
        draw(rows);
      })
      .catch(function(){ draw([]); renderTable([]); });
  }
  document.addEventListener("DOMContentLoaded", function(){
    var rangeEl = document.getElementById("price-history-range");
    if(rangeEl) rangeEl.addEventListener("change", load);
    load();
    setInterval(load, 5 * 60 * 1000);
  });
})();
