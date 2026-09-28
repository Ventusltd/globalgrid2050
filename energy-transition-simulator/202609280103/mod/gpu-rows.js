// gpu-rows: panel rows detected OFFLINE on the GPU (CuPy, NumPy witness: (local path))
// from Esri z17 imagery, saved as lon/lat polylines (mod/gpu-rows-6502.json), placed here in real coordinates through
// place-frame (WGS84 -> anchor tangent-plane metres) and revealed west to east as ten blocks, each with ONE buffer
// built once. Everything is an ESTIMATE from imagery, not a survey. Plain script; attaches to window.SIM.
(function () {
  'use strict';
  const BASE = (document.currentScript && document.currentScript.src.replace(/[^/]*$/, '')) || 'mod/';
  const H = 2.2, GROUPS = 10, STEP_MS = 350;
  let busy = false;
  async function run(btn) {
    const S = window.SIM, PF = window.__pf && window.__pf.PF; if (!S || !PF || busy) return; busy = true;
    try {
      btn.textContent = 'GPU rows: loading...';
      const doc = await (await fetch(BASE + 'gpu-rows-6502.json')).json();
      S.removeWhere(b => b.gpuRows);
      const [clon, clat] = doc.centre, an = PF.placeKey(clat, clon);
      const segs = doc.rows.map(([[lo0, la0], [lo1, la1]]) => { const a = PF.toLocal(an, la0, lo0, 0), b = PF.toLocal(an, la1, lo1, 0); return [a.x, a.y, b.x, b.y]; });
      let x0 = Infinity, x1 = -Infinity; for (const s of segs) { x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[0]); }
      const groups = Array.from({ length: GROUPS }, () => []);
      for (const [ax, ay, bx, by] of segs) {
        const g = groups[Math.min(GROUPS - 1, Math.floor((ax - x0) / (x1 - x0 + 1e-9) * GROUPS))];
        g.push([ax, ay, H, bx, by, H], [ax, ay, 0, ax, ay, H], [bx, by, 0, bx, by, H]);
      }
      S.map.easeTo({ center: [clon, clat], zoom: 15.6, pitch: 60, bearing: -30, duration: 1500 });
      S.info(`Panel rows ESTIMATED from satellite imagery (not measured): ${segs.length} runs, rows about ${doc.row_azimuth_deg_from_east.toFixed(1)} deg from east, ` +
        `repeat about ${doc.row_pitch_m} m (estimate). Detected on the GPU, NumPy witness identical (${doc.agreement.runs_cpu} = ${doc.agreement.runs_gpu} runs). ${doc.source}.`);
      for (let i = 0; i < GROUPS; i++) {
        const L = groups[i]; if (L.length) S.addBlock({ lon: an.lon, lat: an.lat, anchor: an, lines: L, buf: PF.wireBuffer(an, L), gpuRows: true, sat: true });
        btn.textContent = `GPU rows ${i + 1}/${GROUPS}`;
        await new Promise(r => setTimeout(r, STEP_MS));
      }
      S.map.easeTo({ bearing: 60, duration: 6000 });
      btn.textContent = `GPU rows (${segs.length})`;
    } catch (e) { btn.textContent = 'GPU rows: failed'; console.error(e); }
    busy = false;
  }
  function init() { if (!window.SIM) return setTimeout(init, 200); const b = window.SIM.addButton ? window.SIM.addButton('GPU rows', () => run(b)) : null; window.__gpuRows = () => run(b || { textContent: '' }); }
  init();
})();
