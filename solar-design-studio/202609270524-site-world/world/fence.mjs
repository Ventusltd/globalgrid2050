// fence.mjs: perimeter and compound fences laid over the ground. Pure: no imports, no DOM.
//
// Local metres: x east, y north, z up. The ground is any function groundAt(x, y).
// A fence is a closed polygon (the last point joins the first). Posts stand at every corner, at both sides of
// every gate and at the chosen spacing between, measured along the ground, so no bay on a slope is longer than
// the spacing. Wire fences (deer) also get intermediate strainers at a maximum interval. The fence top follows
// the ground at a constant height. Solids are short axis-aligned boxes along the line, so a walker cannot pass
// through and the drone can only cross above the fence top. An open gate leaves its opening free.
//
// createFence({ polygon, type = 'mesh', height?, postSpacing?, strainerMaxM?, gates = [], groundAt, chunk? })
//   polygon: [[x, y], ...] with at least three distinct points, either winding.
//   gates:   [{ at, width, open? }] with at the gate centre as perimeter chainage from the first point (2D metres),
//            or [{ edge, offset, width, open? }] with offset along that edge from its first point.
//
// EVERY DIMENSION BELOW IS TYPICAL OR ASSUMED, NOT A DESIGN. Each value says which; check the standard before use.

const STEP = 0.25;            // sampling step along the ground, metres
const LINE_STEP = 1;          // wireframe draping step, metres
const EPS = 1e-9;

// Turn at a vertex below which it is a line post, not a corner (assumed, 15 degrees). FC Technical Guide 2 puts
// straining assemblies at major changes of direction; a traced or curved boundary has many small turns, and a real
// fence would not put a strainer and two struts at each. A long run of small turns is not treated as a corner.
export const CORNER_TURN_DEG = 15;
// Least distance from a gate post to a corner, metres (assumed): room for the corner strainer and its strut.
export const GATE_CLEAR_M = 0.5;

// Fence types:
//  - deer: woven or high-tensile wire on timber stakes. Forestry Commission Technical Guide 2, "Forest fencing"
//    (Trout and Pepper, 2006), which replaced FC Bulletin 102 (1992): Table 2 gives a maximum stake spacing of 10 m
//    for roe, muntjac and red, sika or fallow deer; Table 3, note 3, at least 1.8 m high for fallow, roe or muntjac
//    and 2 m for red and sika (areas over 5 ha or beside roads). Section 1: straining assemblies at major changes of
//    direction and ground contour; on long straight lines on flat ground up to 1000 m apart. The 1000 m interval here
//    is that upper figure (assumed as the default); strainers at hollows and crests are not added.
//  - palisade: steel palisade to BS 1722-12, stock heights 1.8, 2.0, 2.4 and 3.0 m; 2.4 m is the usual choice round
//    electrical compounds (typical). Posts at 2.75 m centres (typical panel length). Rigid panels: no strainers.
//  - mesh: welded open-mesh steel panels to BS 1722-14. Height 2.0 m and posts at 2.5 m centres (typical).
// rails: heights (fractions of the fence height) of the horizontal lines drawn between posts.
export const FENCE_TYPES = Object.freeze({
  deer:     { label: 'Deer fence (roe, fallow, muntjac)', height: 1.8, postSpacing: 10, strainerMaxM: 1000, tensioned: true,
              rails: [0.03, 0.5, 1], basis: 'FC Technical Guide 2 (2006): 1.8 m (Table 3), stakes 10 m maximum (Table 2), strainers at '
                + 'major changes of direction, up to 1000 m apart on straight flat lines (section 1)' },
  deerRedSika: { label: 'Deer fence (red, sika)', height: 2.0, postSpacing: 10, strainerMaxM: 1000, tensioned: true,
              rails: [0.03, 0.5, 1], basis: 'FC Technical Guide 2 (2006): 2 m for red and sika (Table 3, note 3), stakes 10 m '
                + 'maximum (Table 2), strainers at major changes of direction, up to 1000 m apart (section 1)' },
  palisade: { label: 'Security palisade', height: 2.4, postSpacing: 2.75, strainerMaxM: null, tensioned: false,
              rails: [0.03, 0.15, 0.85, 1], basis: 'BS 1722-12 heights; 2.4 m and 2.75 m centres typical' },
  mesh:     { label: 'Mesh panel fence', height: 2.0, postSpacing: 2.5, strainerMaxM: null, tensioned: false,
              rails: [0.03, 1], basis: 'BS 1722-14 panels; 2.0 m and 2.5 m centres typical' },
});

export function createFence({ polygon, type = 'mesh', height, postSpacing, strainerMaxM, gates = [], groundAt, chunk = 1 }) {
  const spec = FENCE_TYPES[type];
  if (!spec) throw new Error(`fence: unknown type ${type}; use ${Object.keys(FENCE_TYPES).join(', ')}`);
  if (typeof groundAt !== 'function') throw new Error('fence: groundAt(x, y) is required; the fence follows the ground');
  const H = height ?? spec.height, SP = postSpacing ?? spec.postSpacing;
  const SMAX = spec.tensioned ? (strainerMaxM ?? spec.strainerMaxM) : null;
  if (!(H > 0) || !(SP > 0) || !(chunk > 0)) throw new Error('fence: height, postSpacing and chunk must be positive');
  if (SMAX !== null && !(SMAX >= SP)) throw new Error('fence: strainerMaxM must be at least the post spacing');

  // Ring: drop repeats and a closing duplicate.
  if (!Array.isArray(polygon)) throw new Error('fence: polygon must be an array of [x, y]');
  const pts = [];
  for (const p of polygon) {
    const q = [Number(p[0]), Number(p[1])];
    if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) throw new Error('fence: polygon points must be finite');
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) > 1e-6) pts.push(q);
  }
  while (pts.length > 1 && Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]) <= 1e-6) pts.pop();
  if (pts.length < 3) throw new Error('fence: polygon needs three distinct points');
  let area2 = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area2 += a[0] * b[1] - b[0] * a[1]; }
  if (Math.abs(area2) < 1e-6) throw new Error('fence: polygon encloses no area');

  const n = pts.length, edges = [];
  let P = 0;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % n], len = Math.hypot(bx - ax, by - ay);
    edges.push({ ax, ay, dx: (bx - ax) / len, dy: (by - ay) / len, len, s0: P });
    P += len;
  }
  const perimeter2d = P;
  const wrap = (s) => ((s % P) + P) % P;
  function pointAt(s) {
    const c = wrap(s);
    let e = edges[n - 1];
    for (const g of edges) if (c < g.s0 + g.len) { e = g; break; }
    const t = Math.min(Math.max(c - e.s0, 0), e.len);
    return [e.ax + e.dx * t, e.ay + e.dy * t];
  }
  const zAt = (s) => { const [x, y] = pointAt(s); return groundAt(x, y); };

  // Corners: vertices that turn by at least CORNER_TURN_DEG.
  const cosTurn = Math.cos(CORNER_TURN_DEG * Math.PI / 180);
  const corners = [];
  for (let i = 0; i < n; i++) {
    const a = edges[(i - 1 + n) % n], b = edges[i];
    if (a.dx * b.dx + a.dy * b.dy < cosTurn) corners.push(b.s0);
  }

  // Gates: resolve, validate, sort.
  const gl = gates.map((g, k) => {
    let at = g.at;
    if (g.edge !== undefined) {
      const e = edges[g.edge];
      if (!e) throw new Error(`fence: gate ${k} names edge ${g.edge}; the polygon has ${n}`);
      at = e.s0 + Number(g.offset);
    }
    if (!Number.isFinite(at) || !(g.width > 0)) throw new Error(`fence: gate ${k} needs a finite position and a positive width`);
    const s = wrap(at), half = g.width / 2;
    if (g.width >= P / 2) throw new Error(`fence: gate ${k} is wider than half the perimeter`);
    for (const c of corners) {
      const d = Math.abs(wrap(c - s + P / 2) - P / 2);
      if (d < half + GATE_CLEAR_M - EPS) throw new Error(`fence: gate ${k} is within ${GATE_CLEAR_M} m of a corner; move it along the edge`);
    }
    return { index: k, at: s, width: g.width, open: !!g.open, sA: s - half, sB: s + half };
  }).sort((a, b) => a.at - b.at);
  for (let k = 0; k < gl.length; k++) {
    const a = gl[k], b = gl[(k + 1) % gl.length];
    const gap = k + 1 < gl.length ? b.sA - a.sB : b.sA + P - a.sB;
    if (gl.length > 1 && gap < 2 * GATE_CLEAR_M - EPS) throw new Error(`fence: gates ${a.index} and ${b.index} overlap or touch`);
  }

  // Stops: posts that end a run (corners and gate posts). Runs lie between stops, skipping gate openings.
  const stops = [...corners.map((s) => ({ s, kind: 'corner' }))];
  for (const g of gl) stops.push({ s: wrap(g.sA), kind: 'gate' }, { s: wrap(g.sB), kind: 'gate', opensBefore: g });
  if (!stops.length) stops.push({ s: 0, kind: 'end' });   // a smooth ring still needs one end post to tension from
  stops.sort((a, b) => a.s - b.s);
  const runs = [];
  for (let k = 0; k < stops.length; k++) {
    const a = stops[k], b = stops[(k + 1) % stops.length];
    const sb = k + 1 < stops.length ? b.s : b.s + P;
    if (b.opensBefore && Math.abs(wrap(b.opensBefore.sA) - a.s) < 1e-6) continue; // the gate opening itself
    runs.push({ sa: a.s, sb: sb === a.s ? a.s + P : sb });
  }

  // Samples along a stretch: 2D chainage and cumulative 3D length, vertices included exactly.
  function profile(sa, sb) {
    const marks = new Set([sa, sb]);
    const steps = Math.max(1, Math.ceil((sb - sa) / STEP));
    for (let k = 1; k < steps; k++) marks.add(sa + (sb - sa) * k / steps);
    for (const e of edges) for (const v of [e.s0, e.s0 + P]) if (v > sa && v < sb) marks.add(v);
    const s = [...marks].sort((a, b) => a - b), c = [0];
    let [px, py] = pointAt(s[0]), pz = groundAt(px, py);
    for (let k = 1; k < s.length; k++) {
      const [x, y] = pointAt(s[k]), z = groundAt(x, y);
      c.push(c[k - 1] + Math.hypot(x - px, y - py, z - pz));
      px = x; py = y; pz = z;
    }
    return { s, c, len: c.at(-1) };
  }
  const at3d = (pr, d) => {           // 2D chainage at 3D distance d along the profile
    let k = 1;
    while (k < pr.c.length - 1 && pr.c[k] < d) k++;
    const f = (d - pr.c[k - 1]) / Math.max(pr.c[k] - pr.c[k - 1], EPS);
    return pr.s[k - 1] + (pr.s[k] - pr.s[k - 1]) * Math.min(Math.max(f, 0), 1);
  };

  // Posts. Stops first, then strainers and line posts at equal 3D bays within each run.
  const posts = stops.map((st) => ({ s: st.s, kind: st.kind }));
  let fenceLen3d = 0, maxBay = 0;
  for (const r of runs) {
    const pr = profile(r.sa, r.sb);
    fenceLen3d += pr.len;
    const sections = SMAX ? Math.max(1, Math.ceil(pr.len / SMAX - EPS)) : 1;
    const perSection = Math.max(1, Math.ceil(pr.len / sections / SP - EPS));
    const bays = sections * perSection;
    maxBay = Math.max(maxBay, pr.len / bays);
    for (let k = 1; k < bays; k++) {
      posts.push({ s: wrap(at3d(pr, pr.len * k / bays)), kind: SMAX && k % perSection === 0 ? 'strainer' : 'line' });
    }
  }
  for (const p of posts) { const [x, y] = pointAt(p.s); p.x = x; p.y = y; p.z = groundAt(x, y); }
  posts.sort((a, b) => a.s - b.s);

  const count = (k) => posts.filter((p) => p.kind === k).length;
  const cornerN = count('corner'), gateN = count('gate'), midStrainers = count('strainer'), endN = count('end');
  // Struts (assumed practice): one per direction of pull. Gate strainers one; corner, intermediate and a ring's end
  // post (pulled from both sides) two.
  const tensioned = spec.tensioned;
  const counts = {
    posts: posts.length, cornerPosts: cornerN, gatePosts: gateN, linePosts: count('line'),
    strainers: tensioned ? cornerN + gateN + midStrainers + endN : 0, endStrainers: tensioned ? endN : 0,
    intermediateStrainers: tensioned ? midStrainers : 0,
    struts: tensioned ? gateN + 2 * (cornerN + midStrainers + endN) : 0,
    gates: gl.length,
  };

  // Perimeter 3D length including gate openings.
  const whole = profile(0, P);

  // Solids: chunks along each run, and closed gate leaves. Thickness assumed 0.1 m (post width).
  const T = 0.05;
  function boxOver(sa, sb) {
    const m = Math.max(1, Math.ceil((sb - sa) / STEP));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, lo = Infinity, hi = -Infinity;
    for (let k = 0; k <= m; k++) {
      const [x, y] = pointAt(sa + (sb - sa) * k / m), z = groundAt(x, y);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      lo = Math.min(lo, z); hi = Math.max(hi, z);
    }
    return { min: [x0 - T, y0 - T, lo - 0.5], max: [x1 + T, y1 + T, hi + H] };
  }
  function chunksOf(sa, sb, out, extra) {
    const cuts = [sa, sb];
    for (const e of edges) for (const v of [e.s0, e.s0 + P]) if (v > sa && v < sb) cuts.push(v);
    cuts.sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const m = Math.max(1, Math.ceil((cuts[i + 1] - cuts[i]) / chunk - EPS));
      for (let k = 0; k < m; k++) {
        const a = cuts[i] + (cuts[i + 1] - cuts[i]) * k / m, b = cuts[i] + (cuts[i + 1] - cuts[i]) * (k + 1) / m;
        out.push({ ...boxOver(a, b), ...extra });
      }
    }
  }
  function solids() {
    const out = [];
    for (const r of runs) chunksOf(r.sa, r.sb, out, { kind: 'fence' });
    for (const g of gl) if (!g.open) chunksOf(g.sA, g.sB, out, { kind: 'gate', gate: g.index });
    return out;
  }

  // Wireframe: gl.LINES pairs relative to origin o. Rails draped on the ground, posts upright, gates framed.
  function lines(o = [0, 0, 0]) {
    const v = [];
    const P3 = (s, up) => { const [x, y] = pointAt(s); return [x - o[0], y - o[1], groundAt(x, y) + up - o[2]]; };
    const L = (a, b) => v.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    for (const r of runs) {
      const cuts = [r.sa, r.sb];
      for (const e of edges) for (const w of [e.s0, e.s0 + P]) if (w > r.sa && w < r.sb) cuts.push(w);
      cuts.sort((a, b) => a - b);
      for (let i = 0; i < cuts.length - 1; i++) {
        const m = Math.max(1, Math.ceil((cuts[i + 1] - cuts[i]) / LINE_STEP - EPS));
        for (let k = 0; k < m; k++) {
          const a = cuts[i] + (cuts[i + 1] - cuts[i]) * k / m, b = cuts[i] + (cuts[i + 1] - cuts[i]) * (k + 1) / m;
          for (const f of spec.rails) L(P3(a, f * H), P3(b, f * H));
        }
      }
    }
    for (const p of posts) {
      const top = H * (p.kind === 'line' ? 1 : 1.05);        // strainers and gate posts drawn a little proud
      L([p.x - o[0], p.y - o[1], p.z - o[2]], [p.x - o[0], p.y - o[1], p.z + top - o[2]]);
    }
    for (const g of gl) {
      if (g.open) continue;                                    // an open gate is drawn as its posts only
      const a0 = P3(g.sA, 0.05), a1 = P3(g.sA, H * 0.95), b0 = P3(g.sB, 0.05), b1 = P3(g.sB, H * 0.95);
      L(a0, b0); L(a1, b1); L(a0, b1);                          // bottom, top and a diagonal brace
    }
    return new Float32Array(v);
  }

  // Inside the enclosed area (even-odd rule), for placing things within the compound.
  function inside(x, y) {
    let c = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }

  return {
    type, label: spec.label, basis: spec.basis, height: H, postSpacing: SP, strainerMaxM: SMAX,
    polygon: pts, areaM2: Math.abs(area2) / 2,
    perimeter2d, perimeter3d: whole.len, length3d: fenceLen3d, maxBay3d: maxBay,
    gates: gl.map((g) => ({ index: g.index, at: g.at, width: g.width, open: g.open, centre: pointAt(g.at), z: zAt(g.at) })),
    posts, counts, runs: runs.length,
    pointAt, inside, lines, solids,
  };
}
