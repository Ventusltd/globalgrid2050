// Layer: ways. Roads and railways draped on the ground. Each road is drawn as its two kerb lines at the
// width its file gives (typical, assumed by class; nothing is measured); each railway track as its two
// rails at the gauge. No animation: the batches change only when new ground or a new origin arrives.
// Data comes from tools/features/cut_roads.py: roads.json (OS Open Roads) and rail.json (OS OpenMap -
// Local), both OGL v3.0, fetched through the substrate's hash check (api.fetchJSON). The two files are
// kept apart (an OpenStreetMap rail file, if ever used, is ODbL and stays in its own file too).
// File coordinates are British National Grid metres; the layer turns them into local metres from the
// live site origin. Heights come from ctx.heightAt, the ground. Quiet greys for a dark background.
//
// File (ggw-ways/1): { kind: 'roads'|'rail', licence, attribution, lines: [
//   roads: { class, width_m, pts: [[e, n], ...] }   rail: { tracks, gauge_m, track_spacing_m, pts } ] }

export const FILES = {
  roads: { path: 'ways/roads.json', sha256: '__WAYS_ROADS_SHA256__' },
  rail: { path: 'ways/rail.json', sha256: '__WAYS_RAIL_SHA256__' }
};
export function setFileSha(kind, sha) { FILES[kind].sha256 = sha; }

export const CLASSES = ['motorway', 'A', 'B', 'minor', 'local', 'track'];
export const DEFAULT_WIDTH = { motorway: 11, A: 7.3, B: 6.5, minor: 5.5, local: 4.8, track: 3 };
export const GAUGE_M = 1.435, TRACK_SPACING_M = 3.4;
export const STEP_M = 4, LIFT_M = 0.06, MITRE_LIMIT = 3;
// Greys, brighter and firmer for the bigger roads; rails a touch warmer.
export const COLORS = {
  motorway: [0.80, 0.80, 0.80, 0.60], A: [0.74, 0.74, 0.74, 0.52], B: [0.68, 0.68, 0.68, 0.46],
  minor: [0.62, 0.62, 0.62, 0.40], local: [0.56, 0.56, 0.56, 0.34], track: [0.50, 0.50, 0.50, 0.28],
  rail: [0.66, 0.64, 0.61, 0.50]
};

// Pure: a polyline offset sideways by d metres (positive = left of travel), mitred at the joints.
// A mitre longer than MITRE_LIMIT * |d| is cut to that length, so a hairpin cannot throw a spike.
export function offsetLine(pts, d) {
  const n = pts.length, out = [];
  if (n < 2) return out;
  const nrm = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], L = Math.hypot(dx, dy);
    nrm.push(L > 0 ? [-dy / L, dx / L] : null);
  }
  // Zero-length segments borrow the neighbouring normal.
  for (let i = 0; i < nrm.length; i++) if (!nrm[i]) nrm[i] = nrm[i - 1] || nrm.slice(i).find(Boolean) || [0, 1];
  for (let i = 0; i < n; i++) {
    let m;
    if (i === 0) m = nrm[0];
    else if (i === n - 1) m = nrm[n - 2];
    else {
      const a = nrm[i - 1], b = nrm[i], sx = a[0] + b[0], sy = a[1] + b[1], sl = Math.hypot(sx, sy);
      if (sl < 1e-9) m = a; // a full reversal: no mitre exists
      else {
        const ux = sx / sl, uy = sy / sl, cos = ux * a[0] + uy * a[1];
        const k = Math.min(1 / Math.max(cos, 1e-9), MITRE_LIMIT);
        m = [ux * k, uy * k];
      }
    }
    out.push([pts[i][0] + m[0] * d, pts[i][1] + m[1] * d]);
  }
  return out;
}

// Pure: the side lines of one way. Roads: two kerbs at +-width/2. Rail: two rails per track, tracks
// spread about the centreline at the track spacing.
export function edgeOffsets(line, kind) {
  if (kind === 'rail') {
    const tracks = Math.max(1, line.tracks | 0), g = line.gauge_m || GAUGE_M, s = line.track_spacing_m || TRACK_SPACING_M;
    const out = [];
    for (let t = 0; t < tracks; t++) {
      const c = (t - (tracks - 1) / 2) * s;
      out.push(c - g / 2, c + g / 2);
    }
    return out;
  }
  const w = line.width_m > 0 ? line.width_m : DEFAULT_WIDTH[line.class] || DEFAULT_WIDTH.local;
  return [-w / 2, w / 2];
}

// Pure: push a polyline as draped line segments (x,y,z pairs) relative to origin, split to <= step.
// known(x, y) says whether there is surveyed ground there: a piece with an end off it is left out (tester 7).
export function drape(out, pts, heightAt, { step = STEP_M, lift = LIFT_M, origin = [0, 0, 0], known = () => true } = {}) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const k = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    let px = ax, py = ay, pz = finite(heightAt(ax, ay)), pk = known(ax, ay);
    for (let j = 1; j <= k; j++) {
      const t = j / k, x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = finite(heightAt(x, y)), qk = known(x, y);
      if (pk && qk) out.push(px - origin[0], py - origin[1], pz + lift - origin[2], x - origin[0], y - origin[1], z + lift - origin[2]);
      px = x; py = y; pz = z; pk = qk;
    }
  }
  return out;
}

// Pure: file lines -> { group: Float32Array } in local metres. group is the road class, or 'rail'.
export function buildWays(doc, originEN, heightAt, { origin = [0, 0, 0], step = STEP_M, lift = LIFT_M, known } = {}) {
  const kind = doc && doc.kind === 'rail' ? 'rail' : 'roads', groups = {};
  for (const line of (doc && doc.lines) || []) {
    if (!Array.isArray(line.pts) || line.pts.length < 2) continue;
    const local = line.pts.map(([e, n]) => [e - originEN.e, n - originEN.n]);
    const g = kind === 'rail' ? 'rail' : (CLASSES.includes(line.class) ? line.class : 'local');
    const out = (groups[g] ||= []);
    for (const d of edgeOffsets(line, kind)) drape(out, offsetLine(local, d), heightAt, { origin, step, lift, known });
  }
  for (const g in groups) groups[g] = new Float32Array(groups[g]);
  return groups;
}

const finite = h => (Number.isFinite(h) ? h : 0);

export function createWays() {
  let api = null;
  const docs = { roads: null, rail: null }, state = { roads: 'idle', rail: 'idle' };
  let cache = { version: null, heightAt: null, batches: [] }, dataVersion = 0;
  const now = () => (api && typeof api.origin === 'function' ? api.origin() : { e: 0, n: 0, id: 0 });

  function load(kind) {
    if (state[kind] !== 'idle' || !api) return;
    const cfg = api.config?.[kind] || {}, path = cfg.path || FILES[kind].path, sha = cfg.sha256 || FILES[kind].sha256;
    if (!sha || sha.startsWith('__')) { state[kind] = 'failed'; setStatus(`no ${kind}.json hash configured`); return; }
    state[kind] = 'loading';
    Promise.resolve().then(() => api.fetchJSON(path, sha)).then(j => {
      if (!j || !Array.isArray(j.lines)) throw Error(`${kind}.json has no lines list`);
      docs[kind] = j; state[kind] = 'ready'; dataVersion++;
      setStatus();
      api.invalidate({ ground: false });
    }).catch(e => { state[kind] = 'failed'; setStatus(`${kind}.json failed: ${e.message}`); });
  }

  function setStatus(msg) {
    const parts = ['roads', 'rail'].filter(k => docs[k]).map(k => `${docs[k].lines.length} ${k}`);
    layer.status = msg || (parts.length ? parts.join(', ') : 'loading');
  }

  const layer = {
    id: 'ways',
    status: 'waiting for init',
    init(a) { api = a; layer.status = 'ready to load'; load('roads'); load('rail'); },
    // Tests and tools may hand a file straight in (it skips the hash check, so the page never does this).
    setData(kind, doc) { docs[kind] = doc; state[kind] = 'ready'; dataVersion++; setStatus(); api?.invalidate({ ground: false }); },
    // What the attribution panel should show for the files actually loaded.
    get attribution() { return [...new Set(['roads', 'rail'].map(k => docs[k]?.attribution).filter(Boolean))]; },
    // ctx: { pos, heightAt, groundVersion }
    lines(ctx) {
      if (api) { load('roads'); load('rail'); }
      const o = now(), version = `${dataVersion}@${ctx.groundVersion || 0}@${o.e},${o.n}`;
      if (cache.version === version && cache.heightAt === ctx.heightAt) return cache.batches;
      const batches = [];
      for (const kind of ['roads', 'rail']) {
        const doc = docs[kind];
        if (!doc || !doc.lines.length) continue;
        // Batch origin: the middle of the file's lines, so positions stay small on the GPU.
        let sx = 0, sy = 0, c = 0;
        for (const l of doc.lines) for (const p of l.pts || []) { sx += p[0]; sy += p[1]; c++; }
        const cx = c ? sx / c - o.e : 0, cy = c ? sy / c - o.n : 0;
        const origin = [cx, cy, finite(ctx.heightAt(cx, cy))];
        const groups = buildWays(doc, o, ctx.heightAt, { origin, known: typeof ctx.known === 'function' ? ctx.known : undefined });
        for (const g of [...CLASSES, 'rail']) {
          if (groups[g] && groups[g].length) batches.push({ key: `ways/${g}`, version, origin, color: COLORS[g], positions: groups[g] });
        }
      }
      cache = { version, heightAt: ctx.heightAt, batches };
      return batches;
    },
    // For tests and the console.
    debug: () => ({ state: { ...state }, lines: { roads: docs.roads?.lines.length || 0, rail: docs.rail?.lines.length || 0 } })
  };
  return layer;
}

export default createWays();
