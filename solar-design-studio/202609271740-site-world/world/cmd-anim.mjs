// cmd-anim.mjs: short drawn explanations beside the typed bar. Each plays once when a value it shows changes (about 1.4 s
// between the old value and the new), then stops: no frame is drawn while nothing changes (0 fps). Canvas 2D, no imports.
//   tilt     side view of a table: the tilt arc, and the noon sun at midwinter and midsummer with its path between them
//   rows     three rows at the pitch: the midwinter noon shadow on the ground, the clear gap and the ground cover ratio
//   trench   the cross-section with its cables (trefoil or flat), bedding and cover; the bend radius drawn as an arc at a corner
//   loop     one string on its table tier: the loop between + and − conductors, standard and leapfrog, with areas in m²
// d, before: cmd-model.mjs derive() records. Illustrative, not to any site.

const C = { line: '#9cdbff', text: '#cfe9ff', dim: '#6f8ea6', warn: '#ff8a7a', sun: '#ffc773', cable: '#8cffa0', std: '#ff9d5c', lf: '#8cffa0',
  ground: '#56708a', fill: 'rgba(156,219,255,0.10)' };
const MS = 1400, ease = t => 1 - (1 - t) ** 3, mix = (a, b, t) => (Number.isFinite(a) ? a + (b - a) * t : b);
const f2 = v => v.toFixed(2), DEG = Math.PI / 180;

export function createAnim(canvas, { onFrame = () => {} } = {}) {
  const ctx = canvas.getContext('2d');
  let raf = 0, job = null;
  function size() {
    const r = canvas.getBoundingClientRect(), k = globalThis.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width * k)), h = Math.max(1, Math.round(r.height * k));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.setTransform(k, 0, 0, k, 0, 0);
    return [r.width, r.height];
  }
  function frame(now) {
    if (!job) return;
    const t = Math.min(1, (now - job.t0) / MS), [W, H] = size();
    ctx.clearRect(0, 0, W, H);
    DRAW[job.kind](ctx, W, H, job.a, job.b, ease(t));
    onFrame(job.kind, t);
    if (t < 1) raf = requestAnimationFrame(frame); else { raf = 0; job.done = true; }
  }
  return {
    play(kind, a, b) {
      if (!DRAW[kind] || !b) return false;
      cancelAnimationFrame(raf);
      job = { kind, a: a || b, b, t0: performance.now(), done: false };
      raf = requestAnimationFrame(frame);
      return true;
    },
    stop() { cancelAnimationFrame(raf); raf = 0; },
    running: () => !!raf,
    kind: () => job?.kind || null
  };
}

function label(ctx, s, x, y, color = C.text, align = 'left') { ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(s, x, y); }
function setup(ctx) { ctx.font = '11px system-ui, sans-serif'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]); }
function line(ctx, pts, color, w = 1.5, dash = []) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash); ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.setLineDash([]);
}
const tiltOf = d => (d.st.layout === 'south' ? d.st.tilt : d.st.tiltEw);

const DRAW = {
  tilt(ctx, W, H, a, b, t) {
    setup(ctx);
    const gy = H - 22, tilt = mix(tiltOf(a), tiltOf(b), t) * DEG, s = b.T.slope, sc = Math.min((W * 0.42) / s, (H - 50) / (s * 0.8 + b.st.edge));
    const x0 = W * 0.42, y0 = gy - b.st.edge * sc, x1 = x0 + s * sc * Math.cos(tilt), y1 = y0 - s * sc * Math.sin(tilt);
    line(ctx, [[8, gy], [W - 8, gy]], C.ground);
    line(ctx, [[x0, gy], [x0, y0]], C.dim, 2); line(ctx, [[x0 + (x1 - x0) * 0.7, gy], [x0 + (x1 - x0) * 0.7, y0 + (y1 - y0) * 0.7]], C.dim, 2);
    line(ctx, [[x0, y0], [x1, y1]], C.line, 4);
    ctx.strokeStyle = C.sun; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x0, y0, 26, -tilt, 0); ctx.stroke();
    line(ctx, [[x0, y0], [x0 + 34, y0]], C.dim, 1, [2, 2]);
    label(ctx, `${Math.round(mix(tiltOf(a), tiltOf(b), t))}°`, x0 + 30, y0 - 4, C.sun);
    // The noon sun: midwinter and midsummer, the day's path between them as an arc, rays onto the table's middle.
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.min(W * 0.36, H - 30);
    const ew = b.sun.winter * DEG, es = b.sun.summer * DEG;
    ctx.strokeStyle = C.sun; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(cx, cy, R * 0.8, Math.PI + ew * 0, Math.PI + es, false); ctx.stroke(); ctx.setLineDash([]);
    for (const [e, name] of [[ew, '21 Dec'], [es, '21 Jun']]) {
      const sx = cx - R * 0.8 * Math.cos(e), sy = cy - R * 0.8 * Math.sin(e);
      line(ctx, [[sx, sy], [cx, cy]], C.sun, 1, [4, 3]);
      ctx.fillStyle = C.sun; ctx.beginPath(); ctx.arc(sx, sy, 4, 0, 2 * Math.PI); ctx.fill();
      label(ctx, `${name} ${Math.round(e / DEG)}°`, sx - 4, sy - 7, C.sun, 'right');
    }
    label(ctx, `Panel angle ${Math.round(tiltOf(a))}° → ${Math.round(tiltOf(b))}°  ·  noon sun from the south`, 8, 14);
    label(ctx, `top edge ${f2(b.st.edge + b.T.rise)} m`, x1 + 6, y1 + 4, C.dim);
  },

  rows(ctx, W, H, a, b, t) {
    setup(ctx);
    const gy = H - 24, pitch = mix(a.T.pitch, b.T.pitch, t), depth = mix(a.T.depth, b.T.depth, t), rise = b.T.rise, edge = mix(a.st.edge, b.st.edge, t);
    const span = 2 * pitch + depth + 2, sc = Math.min((W - 24) / span, (H - 52) / (edge + rise + 0.5)), X = m => 12 + m * sc, Y = m => gy - m * sc;
    line(ctx, [[8, gy], [W - 8, gy]], C.ground);
    const el = b.sun.winter * DEG, sh = (edge + rise) / Math.tan(el);
    for (let k = 0; k < 3; k++) {
      const u = k * pitch;
      if (b.st.layout === 'south') {
        // Shadow of the top edge, grown along the ground as t runs.
        const reach = Math.min(sh, span) * t;
        ctx.fillStyle = 'rgba(255,138,122,0.16)'; ctx.beginPath();
        ctx.moveTo(X(u + depth), Y(edge + rise)); ctx.lineTo(X(u + depth + reach), Y(Math.max(0, edge + rise - reach * Math.tan(el))));
        ctx.lineTo(X(u + depth + reach), gy); ctx.lineTo(X(u), gy); ctx.closePath(); ctx.fill();
        line(ctx, [[X(u), Y(edge)], [X(u + depth), Y(edge + rise)]], C.line, 3);
      } else {
        line(ctx, [[X(u), Y(edge)], [X(u + depth / 2), Y(edge + rise)], [X(u + depth), Y(edge)]], C.line, 3);
      }
      line(ctx, [[X(u + depth * 0.2), gy], [X(u + depth * 0.2), Y(edge + rise * 0.2)]], C.dim, 1.5);
    }
    // Pitch and gap dimensions.
    line(ctx, [[X(0), gy + 10], [X(pitch), gy + 10]], C.dim, 1); label(ctx, `pitch ${f2(pitch)} m`, X(pitch / 2), gy + 21, C.text, 'center');
    const gap = pitch - depth;
    line(ctx, [[X(depth), Y(-0.3)], [X(pitch), Y(-0.3)]], b.shade.shaded ? C.warn : C.cable, 2);
    const gcr = b.gcr ?? depth / pitch;
    label(ctx, `Row spacing · GCR ${f2(mix(a.gcr ?? gcr, gcr, t))}  ·  clear gap ${f2(gap)} m  ·  21 Dec noon shadow ${f2(b.shade.shadowM)} m`, 8, 14,
      b.shade.shaded ? C.warn : C.text);
    // Coverage bar: the share of the ground under modules.
    const bw = 70, bx = W - bw - 10;
    ctx.strokeStyle = C.dim; ctx.strokeRect(bx, 22, bw, 7); ctx.fillStyle = C.line; ctx.fillRect(bx, 22, bw * Math.min(1, depth / pitch), 7);
    label(ctx, `${Math.round(100 * depth / pitch)} % of the ground in plan`, bx + bw, 40, C.dim, 'right');
  },

  trench(ctx, W, H, a, b, t) {
    setup(ctx);
    const depth = mix(a.st.depth, b.st.depth, t), width = mix(a.st.width, b.st.width, t), od = b.cable?.od || 0.05;
    const L = W * 0.55, sc = Math.min((L - 30) / Math.max(1.2, width + 0.6), (H - 40) / 1.6), gy = 30, cx = 14 + (L - 14) / 2;
    const X = m => cx + m * sc, Y = m => gy + m * sc;
    line(ctx, [[8, gy], [X(-width / 2), gy], [X(-width / 2), Y(depth)], [X(width / 2), Y(depth)], [X(width / 2), gy], [L - 4, gy]], C.line, 1.5);
    ctx.fillStyle = 'rgba(255,199,115,0.18)'; ctx.fillRect(X(-width / 2), Y(depth - 0.075 - b.trench.height), width * sc, (0.075 + b.trench.height) * sc);
    ctx.fillStyle = C.cable;
    for (const [u, v] of b.trench.centres) { ctx.beginPath(); ctx.arc(X(u), Y(depth - 0.075 - v), Math.max(2, od / 2 * sc), 0, 2 * Math.PI); ctx.fill(); }
    const cover = depth - 0.075 - b.trench.height;
    line(ctx, [[X(-width / 2) + 2, Y(cover - 0.1)], [X(width / 2) - 2, Y(cover - 0.1)]], C.sun, 1, [4, 3]);
    line(ctx, [[X(width / 2) + 8, gy], [X(width / 2) + 8, Y(cover)]], cover < 0.91 ? C.warn : C.dim, 1);
    label(ctx, `cover ${f2(cover)} m`, X(width / 2) + 12, Y(cover / 2), cover < 0.91 ? C.warn : C.text);
    label(ctx, `depth ${f2(depth)} m · width ${f2(width)} m`, cx, Y(depth) + 14, C.text, 'center');
    label(ctx, `${b.st.formation}, ${b.st.size} mm² ${b.st.metal === 'cu' ? 'Cu' : 'Al'}, OD ${(od * 1000).toFixed(1)} mm · tape dashed`, 8, 14);
    // Plan of a corner: the trench turns 90°; the cable follows an arc of the bend radius (installation), swept as t runs.
    const R = b.bend?.installM || 1, px = L + 18, py = H - 16, s2 = Math.min((W - px - 14) / (R + 1.2), (H - 46) / (R + 1.2));
    const tw = Math.max(width * s2, 8), ox = px, oy = py;
    ctx.fillStyle = C.fill;
    ctx.fillRect(ox, oy - (R + 1) * s2, tw, (R + 1) * s2); ctx.fillRect(ox, oy - (R + 1) * s2, (R + 1.2) * s2, tw);
    ctx.strokeStyle = C.cable; ctx.lineWidth = 2; ctx.beginPath();
    const acx = ox + tw / 2 + R * s2, acy = oy - (R + 1) * s2 + tw / 2 + R * s2;
    ctx.arc(acx, acy, R * s2, Math.PI, Math.PI + (Math.PI / 2) * t); ctx.stroke();
    line(ctx, [[acx, acy], [acx - R * s2 * Math.cos(Math.PI / 4), acy - R * s2 * Math.sin(Math.PI / 4)]], C.dim, 1, [2, 2]);
    label(ctx, `bend R ${f2(R)} m`, px, 14 + 14, C.cable);
    label(ctx, `(${b.bend?.installX ?? '–'} × OD, pulling)`, px, 14 + 28, C.dim);
  },

  loop(ctx, W, H, a, b, t) {
    setup(ctx);
    const L = b.loops, len = L.lengthM, sx = (W - 24) / len, sy = Math.min((H - 64) / 2.4, sx * 3), X = m => 12 + m * sx, Y = m => H - 30 - m * sy;
    for (let i = 0; i < b.mps; i++) { ctx.strokeStyle = 'rgba(111,142,166,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(X(i * 1.154), Y(2.384), 1.134 * sx, 2.384 * sy); }
    const draw = (poly, color, alpha, k) => {
      const n = Math.max(2, Math.round(poly.length * k));
      ctx.fillStyle = color.replace(')', `,${alpha})`).replace('rgb', 'rgba');
      if (k >= 1) { ctx.beginPath(); poly.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.closePath(); ctx.fill(); }
      line(ctx, poly.slice(0, n).map(([x, y]) => [X(x), Y(y)]), color, 1.6);
    };
    const t1 = Math.min(1, t * 2), t2 = Math.max(0, t * 2 - 1);
    draw(L.standard.poly, 'rgb(255,157,92)', 0.22, t1);
    if (t2 > 0) draw(L.leapfrog.poly, 'rgb(140,255,160)', 0.35, t2);
    label(ctx, `Loop between + and − of one ${b.mps}-module string (height drawn ×${(sy / sx).toFixed(1)})`, 8, 14);
    label(ctx, `standard ${L.standard.area.toFixed(1)} m²`, 8, 30, b.st.wiring === 'standard' ? C.std : C.dim);
    label(ctx, `leapfrog ${L.leapfrog.area.toFixed(1)} m²`, 150, 30, b.st.wiring === 'leapfrog' ? C.lf : C.dim);
    label(ctx, `routes on the table assumed`, W - 8, 30, C.dim, 'right');
  }
};
