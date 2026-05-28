#!/usr/bin/env python3
"""
GlobalGrid2050 V5 UK grid frequency collector.

Purpose
- Fetch UK grid frequency records from Elexon where available.
- Keep a rolling 24 hour local CSV in uk_energy_tracking_v5/.
- Write a small live JSON snapshot for the page.
- Install a lightweight canvas chart panel into the V5 page on first run.

Notes
- GitHub scheduled workflows are not guaranteed at true 2 minute cadence.
- The workflow can take 2 samples per run, spaced by 120 seconds, while the
  script also requests a rolling Elexon source window and deduplicates by source
  timestamp so the local file remains a 24 hour frequency buffer.
"""

from __future__ import annotations

import csv
import json
import os
import re
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from statistics import mean
from typing import Any
from urllib.parse import urlencode

import requests

ROOT = Path(__file__).resolve().parent.parent
FOLDER = ROOT / "uk_energy_tracking_v5"
INDEX_FILE = FOLDER / "index.md"
CSV_FILE = FOLDER / "grid_frequency_history.csv"
JSON_FILE = FOLDER / "live_grid_frequency.json"
UI_FILE = FOLDER / "frequency-history-ui.js"
REPORT_DIR = ROOT / "gridbot_reports"
REPORT_FILE = REPORT_DIR / "uk_frequency_v5_report.md"

ELEXON = "https://data.elexon.co.uk/bmrs/api/v1"
TIMEOUT = 18
ROLLING_HOURS = int(os.getenv("GG_FREQUENCY_ROLLING_HOURS", "24"))
LOOKBACK_MINUTES = int(os.getenv("GG_FREQUENCY_LOOKBACK_MINUTES", "180"))
BURST_SAMPLES = max(1, min(int(os.getenv("GG_FREQUENCY_BURST_SAMPLES", "1")), 12))
SLEEP_SECONDS = max(0, min(int(os.getenv("GG_FREQUENCY_SLEEP_SECONDS", "120")), 300))

USER_AGENT = "GlobalGrid2050 frequency collector for public Elexon data"

FREQUENCY_UI = r'''// GlobalGrid2050 V5 frequency chart. Loaded after page content is present.
(function(){
  var CSV_URL = "/uk_energy_tracking_v5/grid_frequency_history.csv";
  var LIVE_URL = "/uk_energy_tracking_v5/live_grid_frequency.json";
  var REFRESH_MS = 120000;

  function $(id){ return document.getElementById(id); }
  function setText(id, value){ var el=$(id); if(el) el.textContent=value; }
  function parseCsv(text){
    return text.trim().split(/\r?\n/).slice(1).map(function(line){
      var parts=line.split(",");
      if(parts.length<4) return null;
      var hz=parseFloat(parts[1]);
      if(!isFinite(hz)) return null;
      return {t:parts[0], hz:hz, captured:parts[2], source:parts[3], status:parts.slice(4).join(",")};
    }).filter(Boolean);
  }
  function timeLabel(iso){
    if(!iso) return "—";
    var d=new Date(iso);
    if(isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit",day:"2-digit",month:"short"});
  }
  function fetchText(url){ return fetch(url+"?t="+Date.now(),{cache:"no-store"}).then(function(r){ if(!r.ok) throw new Error(String(r.status)); return r.text(); }); }
  function fetchJson(url){ return fetch(url+"?t="+Date.now(),{cache:"no-store"}).then(function(r){ if(!r.ok) throw new Error(String(r.status)); return r.json(); }); }
  function draw(rows){
    var canvas=$("frequency-history-canvas");
    if(!canvas) return;
    var ctx=canvas.getContext("2d");
    var rect=canvas.getBoundingClientRect();
    var dpr=window.devicePixelRatio||1;
    var w=Math.max(360, Math.floor(rect.width*dpr));
    var h=Math.max(260, Math.floor(rect.height*dpr));
    canvas.width=w; canvas.height=h;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle="#070a10"; ctx.fillRect(0,0,w,h);
    var padL=54*dpr, padR=18*dpr, padT=22*dpr, padB=42*dpr;
    var plotW=w-padL-padR, plotH=h-padT-padB;
    ctx.strokeStyle="rgba(255,255,255,.10)"; ctx.lineWidth=1*dpr;
    ctx.strokeRect(padL,padT,plotW,plotH);
    [49.8,49.9,50.0,50.1,50.2].forEach(function(v){
      var y=padT+(50.2-v)/(0.4)*plotH;
      ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+plotW,y); ctx.stroke();
      ctx.fillStyle=v===50.0?"#00ffff":"#9aa3b6"; ctx.font=(11*dpr)+"px Courier New"; ctx.fillText(v.toFixed(1),8*dpr,y+4*dpr);
    });
    if(!rows.length){
      ctx.fillStyle="#9aa3b6"; ctx.font=(14*dpr)+"px Courier New"; ctx.fillText("Awaiting frequency records",padL+20*dpr,padT+40*dpr); return;
    }
    var values=rows.map(function(r){return r.hz;});
    var min=Math.min.apply(null, values.concat([49.8]));
    var max=Math.max.apply(null, values.concat([50.2]));
    var span=Math.max(0.2, max-min);
    min-=span*0.08; max+=span*0.08;
    ctx.strokeStyle="#00ff88"; ctx.lineWidth=2*dpr; ctx.beginPath();
    rows.forEach(function(r,i){
      var x=padL+(rows.length===1?0.5:i/(rows.length-1))*plotW;
      var y=padT+(max-r.hz)/(max-min)*plotH;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
    ctx.strokeStyle="rgba(0,255,255,.55)"; ctx.setLineDash([6*dpr,6*dpr]);
    var y50=padT+(max-50)/(max-min)*plotH;
    ctx.beginPath(); ctx.moveTo(padL,y50); ctx.lineTo(padL+plotW,y50); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle="#9aa3b6"; ctx.font=(11*dpr)+"px Courier New";
    ctx.fillText(timeLabel(rows[0].t),padL,padT+plotH+24*dpr);
    ctx.fillText(timeLabel(rows[rows.length-1].t),Math.max(padL,padL+plotW-150*dpr),padT+plotH+24*dpr);
  }
  function refresh(){
    Promise.all([fetchText(CSV_URL).catch(function(){return "";}), fetchJson(LIVE_URL).catch(function(){return null;})]).then(function(res){
      var rows=res[0]?parseCsv(res[0]):[]; var live=res[1]||{};
      draw(rows);
      var latest=live.latest||rows[rows.length-1]||{};
      setText("frequency-latest", latest.frequency_hz!=null?Number(latest.frequency_hz).toFixed(3):latest.hz!=null?Number(latest.hz).toFixed(3):"—");
      setText("frequency-records", String(live.record_count||rows.length||0));
      setText("frequency-updated", live.updated_utc?timeLabel(live.updated_utc):"Awaiting update");
      setText("frequency-window", live.window_hours?live.window_hours+" hours":"24 hours");
      setText("frequency-minmax", live.min_hz!=null&&live.max_hz!=null?Number(live.min_hz).toFixed(3)+" to "+Number(live.max_hz).toFixed(3)+" Hz":"—");
    });
  }
  window.addEventListener("resize", function(){ refresh(); });
  refresh(); setInterval(refresh, REFRESH_MS);
})();
'''

FREQUENCY_SECTION = r'''

  <section id="grid-frequency-panel">
    <h2 class="section-title">Grid Frequency 24 Hour Trace</h2>
    <div class="trend-panel">
      <div class="price-history-actions">
        <strong style="color:#00ffff;letter-spacing:.12em;text-transform:uppercase;">UK grid frequency from Elexon</strong>
        <a href="/uk_energy_tracking_v5/grid_frequency_history.csv" download>Download frequency CSV</a>
      </div>
      <div class="unit-panel"><strong>Unit:</strong> Hertz (Hz). Frequency is held close to 50 Hz. This 24 hour trace is for situational awareness and grid behaviour learning only.</div>
      <canvas id="frequency-history-canvas" width="900" height="300" style="width:100%;height:300px;display:block;border:1px solid rgba(255,255,255,.05);background:#070a10;touch-action:auto;"></canvas>
      <div class="oil-stats-grid" style="margin-top:10px;">
        <div class="oil-stat"><div class="oil-stat-label">Latest frequency</div><div class="oil-stat-value"><span id="frequency-latest">—</span> Hz</div></div>
        <div class="oil-stat"><div class="oil-stat-label">Visible records</div><div class="oil-stat-value" id="frequency-records">—</div></div>
        <div class="oil-stat"><div class="oil-stat-label">Window</div><div class="oil-stat-value" id="frequency-window">24 hours</div></div>
        <div class="oil-stat"><div class="oil-stat-label">Min to max</div><div class="oil-stat-value" id="frequency-minmax">—</div></div>
      </div>
      <div class="scada-credit" id="frequency-updated" style="margin-top:10px;">Awaiting frequency update.</div>
    </div>
  </section>
'''


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_z(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_time(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(float(value), timezone.utc)
    text = str(value).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M"):
            try:
                dt = datetime.strptime(str(value), fmt).replace(tzinfo=timezone.utc)
                break
            except ValueError:
                dt = None
        if dt is None:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def http_json(url: str) -> Any:
    r = requests.get(url, timeout=TIMEOUT, headers={"Accept": "application/json", "User-Agent": USER_AGENT})
    r.raise_for_status()
    return r.json()


def build_candidate_urls(start: datetime, end: datetime) -> list[str]:
    start_min = start.strftime("%Y-%m-%dT%H:%MZ")
    end_min = end.strftime("%Y-%m-%dT%H:%MZ")
    start_sec = iso_z(start)
    end_sec = iso_z(end)
    return [
        f"{ELEXON}/datasets/FREQ?" + urlencode({"publishDateTimeFrom": start_min, "publishDateTimeTo": end_min, "format": "json"}),
        f"{ELEXON}/datasets/FREQ?" + urlencode({"from": start_min, "to": end_min, "format": "json"}),
        f"{ELEXON}/balancing/system-frequency?" + urlencode({"from": start_sec, "to": end_sec, "format": "json"}),
        f"{ELEXON}/balancing/system/frequency?" + urlencode({"from": start_sec, "to": end_sec, "format": "json"}),
    ]


def extract_rows(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        rows = payload.get("data") or payload.get("items") or payload.get("results") or []
    else:
        rows = payload
    if isinstance(rows, dict):
        rows = [rows]
    if not isinstance(rows, list):
        return []
    out: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        lower = {str(k).lower(): v for k, v in row.items()}
        freq = None
        for key in ("frequency", "systemfrequency", "frequencyhz", "systemfrequencyhz", "value", "frequencyvalue"):
            if key in lower and lower[key] not in (None, ""):
                try:
                    candidate = float(lower[key])
                    if 45 <= candidate <= 55:
                        freq = candidate
                        break
                except (TypeError, ValueError):
                    pass
        source_dt = None
        for key in ("publishtime", "publishdatetime", "starttime", "datetime", "time", "timestamp", "settlementdate"):
            if key in lower:
                source_dt = parse_time(lower[key])
                if source_dt:
                    break
        if freq is None:
            numeric_values = []
            for value in row.values():
                try:
                    val = float(value)
                    if 45 <= val <= 55:
                        numeric_values.append(val)
                except (TypeError, ValueError):
                    continue
            if numeric_values:
                freq = numeric_values[0]
        if freq is not None:
            if source_dt is None:
                source_dt = utc_now()
            out.append({
                "source_time_utc": iso_z(source_dt),
                "frequency_hz": round(freq, 4),
                "captured_utc": iso_z(utc_now()),
                "source": "Elexon",
                "status": "ok",
            })
    return out


def fetch_frequency_rows() -> tuple[list[dict[str, Any]], list[str]]:
    end = utc_now()
    start = end - timedelta(minutes=LOOKBACK_MINUTES)
    errors: list[str] = []
    for url in build_candidate_urls(start, end):
        try:
            payload = http_json(url)
            rows = extract_rows(payload)
            if rows:
                return rows, errors
            errors.append(f"no rows: {url}")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{type(exc).__name__}: {exc} :: {url}")
    return [], errors


def read_existing() -> list[dict[str, Any]]:
    if not CSV_FILE.exists():
        return []
    rows = []
    with CSV_FILE.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                rows.append({
                    "source_time_utc": row.get("source_time_utc") or row.get("timestamp_utc") or "",
                    "frequency_hz": round(float(row.get("frequency_hz") or row.get("hz") or 0), 4),
                    "captured_utc": row.get("captured_utc") or "",
                    "source": row.get("source") or "Elexon",
                    "status": row.get("status") or "ok",
                })
            except ValueError:
                continue
    return rows


def write_outputs(rows: list[dict[str, Any]], errors: list[str]) -> None:
    FOLDER.mkdir(parents=True, exist_ok=True)
    cutoff = utc_now() - timedelta(hours=ROLLING_HOURS)
    dedup: dict[str, dict[str, Any]] = {}
    for row in rows:
        ts = row.get("source_time_utc") or row.get("captured_utc")
        dt = parse_time(ts)
        if not dt or dt < cutoff:
            continue
        key = iso_z(dt)
        row["source_time_utc"] = key
        dedup[key] = row
    final = [dedup[k] for k in sorted(dedup.keys())]
    with CSV_FILE.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["source_time_utc", "frequency_hz", "captured_utc", "source", "status"])
        writer.writeheader()
        writer.writerows(final)
    values = [float(r["frequency_hz"]) for r in final]
    latest = final[-1] if final else None
    snapshot = {
        "updated_utc": iso_z(utc_now()),
        "window_hours": ROLLING_HOURS,
        "record_count": len(final),
        "latest": latest,
        "min_hz": round(min(values), 4) if values else None,
        "max_hz": round(max(values), 4) if values else None,
        "avg_hz": round(mean(values), 4) if values else None,
        "source": "Elexon",
        "errors": errors[-4:],
    }
    JSON_FILE.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
    print(f"Frequency records retained: {len(final)}")
    if latest:
        print(f"Latest frequency: {latest['frequency_hz']} Hz at {latest['source_time_utc']}")
    if errors:
        print("::warning::Frequency fetch issues: " + " | ".join(errors[-2:]))


def ensure_ui_assets() -> None:
    FOLDER.mkdir(parents=True, exist_ok=True)
    UI_FILE.write_text(FREQUENCY_UI, encoding="utf-8")
    if not INDEX_FILE.exists():
        print("::warning::V5 index.md missing, UI section not installed")
        return
    text = INDEX_FILE.read_text(encoding="utf-8")
    changed = False
    if "id=\"grid-frequency-panel\"" not in text:
        marker = "  <section>\n    <h2 class=\"section-title\">Commodity Price Signals</h2>"
        if marker in text:
            text = text.replace(marker, FREQUENCY_SECTION + "\n" + marker, 1)
            changed = True
        else:
            text = text.replace("</div>\n\n<div id=\"price-history-fullscreen-overlay\"", FREQUENCY_SECTION + "\n</div>\n\n<div id=\"price-history-fullscreen-overlay\"", 1)
            changed = True
    script_tag = "<script src='/uk_energy_tracking_v5/frequency-history-ui.js?v=20260528a'></script>"
    if "frequency-history-ui.js" not in text:
        text = text.replace("<script src='/uk_energy_tracking_v5/price-history-ui.js", script_tag + "\n<script src='/uk_energy_tracking_v5/price-history-ui.js", 1)
        changed = True
    if "<strong>Grid frequency</strong>" not in text and "Generation mix & demand" in text:
        text = text.replace(
            "<p><strong>Generation mix & demand</strong> — Elexon BMRS Insights, used under the BMRS Data Licence Terms.</p>",
            "<p><strong>Generation mix, demand and grid frequency</strong> — Elexon BMRS Insights, used under the BMRS Data Licence Terms.</p>",
            1,
        )
        changed = True
    if changed:
        INDEX_FILE.write_text(text, encoding="utf-8")
        print("Installed V5 frequency chart panel into index.md")
    else:
        print("V5 frequency chart panel already installed")


def write_report(errors: list[str]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    live = json.loads(JSON_FILE.read_text(encoding="utf-8")) if JSON_FILE.exists() else {}
    lines = [
        "# UK Frequency V5 GridBot Report",
        "",
        f"Updated UTC: {iso_z(utc_now())}",
        f"Rolling window hours: {ROLLING_HOURS}",
        f"Records retained: {live.get('record_count', 0)}",
        f"Latest: {json.dumps(live.get('latest'), ensure_ascii=False)}",
        f"Min Hz: {live.get('min_hz')}",
        f"Max Hz: {live.get('max_hz')}",
        f"Average Hz: {live.get('avg_hz')}",
        "",
        "## Recent fetch issues",
    ]
    lines.extend([f"- {e}" for e in errors[-8:]] or ["- none"])
    REPORT_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_once() -> list[str]:
    existing = read_existing()
    fetched, errors = fetch_frequency_rows()
    if not fetched:
        errors.append("No frequency records fetched in this run. Existing 24 hour file preserved and trimmed.")
    write_outputs(existing + fetched, errors)
    return errors


def main() -> None:
    ensure_ui_assets()
    all_errors: list[str] = []
    for i in range(BURST_SAMPLES):
        print(f"Frequency sample pass {i + 1} of {BURST_SAMPLES}")
        all_errors.extend(run_once())
        if i < BURST_SAMPLES - 1:
            time.sleep(SLEEP_SECONDS)
    write_report(all_errors)


if __name__ == "__main__":
    main()
