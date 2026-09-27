// What the ground under a route is: measured LiDAR, or a flat plane where none is loaded, said so plainly
// (code review 2, phone review 1). Never labels a flat stand-in as LiDAR. The Design panel's readout rows (pure) and its level profile.
import { measuredShare } from './snap.mjs';
import { BASIS } from './boq-assumptions.mjs';
import { formatNumber, formatLength } from './measure-format.mjs';

const SVG = 'http://www.w3.org/2000/svg';

// pts: [[x, y], ...] local metres. measuredAt(x, y) -> measured ground or NaN (null: no measure known, all taken as measured).
export function groundShareOf(pts, measuredAt) {
  if (!measuredAt || pts.length < 1) return { all: true, none: false, m: null };
  const m = pts.length > 1 ? measuredShare(pts, measuredAt) : { total: 1, known: Number.isFinite(measuredAt(pts[0][0], pts[0][1])) ? 1 : 0 };
  return { all: m.known >= m.total - 0.5, none: m.known <= 0.5 && m.total > 0, m };
}

// ['Ground', words, warn?] for the readout.
export function groundRowOf(pts, measuredAt) {
  const g = groundShareOf(pts, measuredAt);
  if (g.all) return ['Ground', `${BASIS.ground} · ${BASIS.datum}`];
  if (g.none) return ['Ground', 'flat ground assumed: no LiDAR loaded here, so levels, volumes and gradients are not measured', true];
  return ['Ground', `${BASIS.ground} on ${formatLength(g.m.known)} of ${formatLength(g.m.total)}; flat ground assumed beyond`, true];
}

// The level profile along the route (world.html #design-profile): ground level solid, trench floor dashed.
export function drawProfile(doc, m) {
  const box = doc.getElementById('design-profile-box'), svg = doc.getElementById('design-profile');
  box.hidden = !m;
  if (!m) return;
  const W = 300, H = 90, L = 4, R = 296, T = 14, B = 76, pr = m.profile;
  const lo = pr.min - m.depth, hi = Math.max(pr.max, lo + 0.5), len = Math.max(pr.length2d, 1e-6);
  const X = s => L + (s / len) * (R - L), Y = z => B - ((z - lo) / (hi - lo)) * (B - T);
  const line = (dz, cls) => {
    const el = doc.createElementNS(SVG, 'polyline');
    el.setAttribute('points', pr.pairs.map(([s, z]) => `${X(s).toFixed(1)},${Y(z - dz).toFixed(1)}`).join(' '));
    el.setAttribute('class', cls); return el;
  };
  const text = (x, y, s, anchor = 'start') => {
    const el = doc.createElementNS(SVG, 'text');
    Object.entries({ x, y, 'text-anchor': anchor }).forEach(([k, v]) => el.setAttribute(k, v));
    el.textContent = s; return el;
  };
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.replaceChildren(line(0, 'ground'), line(m.depth, 'floor'), text(L, 10, `${formatNumber(hi, 1)} m`),
    text(L, H - 2, `${formatNumber(lo, 1)} m`), text(R, H - 2, formatLength(pr.length2d), 'end'));
}
