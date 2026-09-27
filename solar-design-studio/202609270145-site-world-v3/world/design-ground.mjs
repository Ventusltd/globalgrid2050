// What the ground under a route is: measured LiDAR, or a flat plane where none is loaded, said so plainly
// (code review 2, phone review 1). Never labels a flat stand-in as LiDAR. Pure: the Design panel's readout rows.
import { measuredShare } from './snap.mjs';
import { BASIS } from './boq-assumptions.mjs';
import { formatLength } from './measure-format.mjs';

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
