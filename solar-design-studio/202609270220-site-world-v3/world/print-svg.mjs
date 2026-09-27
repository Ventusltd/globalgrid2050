// Print sheet drawing: builds the sheet as one SVG string, in millimetres. Pure: no DOM, no WebGL,
// so the same call gives the same sheet in a test, a worker or the page.
// The plan is drawn from the very line batches the world draws, looked at straight down.
// The current view is either the captured frame (an image) or, if none is given, the same batches
// put through the same camera maths as the screen, drawn as vectors without terrain occlusion.

import { perspective, view, multiply } from './camera.mjs';
import { planFrame, planToPaper, scaleBar, gridTicks, refAt, trueNorthOffset, bearingText } from './print-layout.mjs';

export const FONT = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";
export const INK = '#111', MUTED = '#555', RULE = '#999';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f = v => (Math.round(v * 100) / 100).toString();

// Screen colours are light on black; paper is white. Keep the hue, darken it, and give faint lines
// a floor so they still print. Returns { stroke, opacity }.
export function inkFor(color) {
  const [r, g, b, a = 1] = color || [0.6, 0.6, 0.6, 1];
  const k = 0.55, hex = v => Math.round(Math.max(0, Math.min(1, v * k)) * 255).toString(16).padStart(2, '0');
  return { stroke: `#${hex(r)}${hex(g)}${hex(b)}`, opacity: Math.max(0.3, Math.min(1, a)) };
}

// Clips segment (x0,y0)-(x1,y1) to rectangle r (Liang-Barsky). Returns the clipped four numbers or null.
export function clipSegment(x0, y0, x1, y1, r) {
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dy = y1 - y0;
  for (const [p, q] of [[-dx, x0 - r.x], [dx, r.x + r.w - x0], [-dy, y0 - r.y], [dy, r.y + r.h - y0]]) {
    if (p === 0) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy];
}

// The plan: every line batch straight down, clipped to the drawing area. One path per batch.
export function planPaths(batches, frame, layout) {
  const out = [], d = layout.planDraw;
  for (const b of batches) {
    if (b.occluder || !b.positions) continue;
    const o = b.origin || [0, 0, 0], p = b.positions;
    let dstr = '';
    for (let i = 0; i + 5 < p.length; i += 6) {
      const [ax, ay] = planToPaper(frame, layout, p[i] + o[0], p[i + 1] + o[1]);
      const [bx, by] = planToPaper(frame, layout, p[i + 3] + o[0], p[i + 4] + o[1]);
      const c = clipSegment(ax, ay, bx, by, d);
      if (c) dstr += `M${f(c[0])} ${f(c[1])}L${f(c[2])} ${f(c[3])}`;
    }
    if (dstr) { const ink = inkFor(b.color); out.push({ key: b.key, d: dstr, ...ink }); }
  }
  return out;
}

// The current view as vectors: the screen's own camera (camera.mjs), each batch moved by its origin
// minus the eye, as lines.mjs does. Segments behind the near plane are cut there; distant lines fade
// in four bands as the shader fades them. Returns paths in the panel's box `r`.
export function viewPaths(batches, cam, r, { fade = 450, near = 0.05, far = 5000 } = {}) {
  const fov = cam.fov ?? 70 * Math.PI / 180;
  const m = multiply(perspective(fov, r.w / r.h, near, far), view([0, 0, 0], cam.yaw, cam.pitch));
  const eye = cam.pos, out = [];
  const clip = (x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[3] * x + m[7] * y + m[11] * z + m[15]];
  const toPaper = ([cx, cy, w]) => [r.x + (cx / w + 1) / 2 * r.w, r.y + (1 - cy / w) / 2 * r.h];
  for (const b of batches) {
    if (b.occluder || !b.positions) continue;
    const o = b.origin || [0, 0, 0], p = b.positions, bands = ['', '', '', ''];
    const off = [o[0] - eye[0], o[1] - eye[1], o[2] - eye[2]];
    for (let i = 0; i + 5 < p.length; i += 6) {
      const a = [p[i] + off[0], p[i + 1] + off[1], p[i + 2] + off[2]];
      const c = [p[i + 3] + off[0], p[i + 4] + off[1], p[i + 5] + off[2]];
      const dist = Math.hypot((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2);
      const alpha = 1 - dist / fade;
      if (alpha <= 0) continue;
      let pa = clip(...a), pc = clip(...c);
      if (pa[2] < near && pc[2] < near) continue;
      if (pa[2] < near || pc[2] < near) { // cut at the near plane
        const t = (near - pa[2]) / (pc[2] - pa[2]), cut = pa.map((v, k) => v + (pc[k] - v) * t);
        if (pa[2] < near) pa = cut; else pc = cut;
      }
      const [ax, ay] = toPaper(pa), [cx, cy] = toPaper(pc);
      const s = clipSegment(ax, ay, cx, cy, r);
      if (s) bands[Math.min(3, Math.floor((1 - alpha) * 4))] += `M${f(s[0])} ${f(s[1])}L${f(s[2])} ${f(s[3])}`;
    }
    const ink = inkFor(b.color);
    bands.forEach((d, k) => { if (d) out.push({ key: `${b.key}#${k}`, d, stroke: ink.stroke, opacity: Math.max(0.2, ink.opacity * (1 - k / 4)) }); });
  }
  return out;
}

const text = (x, y, s, size, extra = '') => `<text x="${f(x)}" y="${f(y)}" font-size="${f(size)}"${extra}>${esc(s)}</text>`;
const box = (r, extra = '') => `<rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}"${extra}/>`;
const path = (p, w) => `<path d="${p.d}" stroke="${p.stroke}" stroke-opacity="${f(p.opacity)}" stroke-width="${w}" fill="none"/>`;

// North arrow at (x, y), `size` mm tall, pointing up the sheet (grid north). tn: true north offset in degrees.
export function northArrow(x, y, size, tn) {
  const h = size, w = size * 0.42;
  const parts = [
    `<g transform="translate(${f(x)} ${f(y)})" stroke="${INK}" stroke-width="0.25">`,
    `<path d="M0 ${f(-h / 2)}L${f(w / 2)} ${f(h / 2)}L0 ${f(h / 4)}Z" fill="${INK}"/>`,
    `<path d="M0 ${f(-h / 2)}L${f(-w / 2)} ${f(h / 2)}L0 ${f(h / 4)}Z" fill="#fff"/>`,
    text(0, -h / 2 - 1.2, 'N', 3.2, ` text-anchor="middle" stroke="none" fill="${INK}" font-weight="700"`),
    text(0, h / 2 + 3, 'GRID', 1.8, ` text-anchor="middle" stroke="none" fill="${MUTED}" letter-spacing="0.3"`),
    '</g>'];
  if (tn !== null && tn !== undefined) {
    const say = Math.abs(tn) < 0.005 ? 'TN = GN' : `TN ${Math.abs(tn).toFixed(2)}° ${tn >= 0 ? 'E' : 'W'}`;
    parts.splice(parts.length - 1, 0, text(0, h / 2 + 5.4, say, 1.8, ` text-anchor="middle" stroke="none" fill="${MUTED}"`));
  }
  return parts.join('');
}

// Alternating black and white scale bar, left end at (x, y).
export function scaleBarSvg(bar, x, y, scale) {
  const h = 1.6, out = [`<g font-family="${FONT}" fill="${INK}">`];
  for (let i = 0; i < 4; i++) {
    const a = bar.ticks[i].mm, b = bar.ticks[i + 1].mm;
    out.push(`<rect x="${f(x + a)}" y="${f(y)}" width="${f(b - a)}" height="${h}" fill="${i % 2 ? '#fff' : INK}" stroke="${INK}" stroke-width="0.2"/>`);
  }
  for (const t of [bar.ticks[0], bar.ticks[2], bar.ticks[4]]) {
    const label = t === bar.ticks[4] ? bar.label : String(bar.m >= 1000 ? t.m / 1000 : t.m);
    out.push(text(x + t.mm, y - 0.9, label, 2, ' text-anchor="middle"'));
  }
  out.push(text(x, y + h + 2.8, `Scale 1:${scale.toLocaleString('en-GB')}`, 2, ` fill="${MUTED}"`), '</g>');
  return out.join('');
}

// Grid tick marks and their figures on the plan's border band; the 100 km square letters in the corner.
export function gridSvg(ticks, layout) {
  const d = layout.planDraw, p = layout.plan, out = [`<g font-family="${FONT}" fill="${MUTED}" font-size="1.9">`];
  out.push(`<g stroke="${RULE}" stroke-width="0.12" stroke-dasharray="0.6 1.2">`);
  for (const t of ticks.eastings) out.push(`<path d="M${f(t.x)} ${f(d.y)}V${f(d.y + d.h)}"/>`);
  for (const t of ticks.northings) out.push(`<path d="M${f(d.x)} ${f(t.y)}H${f(d.x + d.w)}"/>`);
  out.push('</g>');
  for (const t of ticks.eastings) {
    out.push(`<path d="M${f(t.x)} ${f(p.y)}V${f(d.y)}M${f(t.x)} ${f(d.y + d.h)}V${f(p.y + p.h)}" stroke="${INK}" stroke-width="0.2"/>`);
    out.push(text(t.x + 0.6, p.y + layout.band - 1.6, t.label, 1.9), text(t.x + 0.6, p.y + p.h - 1.4, t.label, 1.9));
  }
  for (const t of ticks.northings) {
    out.push(`<path d="M${f(p.x)} ${f(t.y)}H${f(d.x)}M${f(d.x + d.w)} ${f(t.y)}H${f(p.x + p.w)}" stroke="${INK}" stroke-width="0.2"/>`);
    out.push(text(p.x + 1, t.y - 0.6, t.label, 1.9), text(p.x + p.w - 1, t.y - 0.6, t.label, 1.9, ' text-anchor="end"'));
  }
  const sq = (ticks.squares || [...new Set([...ticks.eastings, ...ticks.northings].map(t => t.square))]).join('/');
  if (sq) out.push(text(p.x + 1, p.y + layout.band - 1.6, sq, 2.2, ` fill="${INK}" font-weight="700"`));
  out.push('</g>');
  return out.join('');
}

export { planFrame, scaleBar, gridTicks, refAt, trueNorthOffset, bearingText };
