// Layer: land. Agricultural Land Classification grade boundaries from land.json (cut per site by
// tools/features/cut_land.py from Natural England's open data), draped 4 cm above the ground in quiet,
// low-alpha earth tones: boundaries only, no fills, so the ground stays the picture.
//
// Post-1988 survey boundaries are drawn a little stronger than the provisional map's, which is mapped at
// about 1:250,000 and is only a guide. Edges that lie on the cut box are not drawn (they are not grade
// boundaries), and a boundary shared by two polygons is drawn once.
//
// land.json: { alc: { provisional: [{ grade, rings }], post1988: [{ grade, rings }] }, box: { e0, n0, e1, n1 },
//   not_a_grade: [..], attribution }. Rings are British National Grid metres; they become local metres from the
// live site origin here. Loaded through the substrate's hash check (api.fetchJSON with api.config.sha256).
// No imports: the file runs from a blob URL.

const INDEX_PATH = 'land/land.json';
let INDEX_SHA256 = '__LAND_JSON_SHA256__';
export function setIndexSha(sha) { INDEX_SHA256 = sha; }

export const LIFT_M = 0.04;  // just above the ground, below the water lines (5 cm)
export const STEP_M = 2;     // no draped segment longer than 2 m
export const BOX_EPS = 0.05; // an edge within 5 cm of the box side lies on it
// Muted tones on the dark background: better land a little greener, poorer land browner and greyer.
export const GRADE_COLOR = Object.freeze({
  'Grade 1': [0.46, 0.66, 0.42], 'Grade 2': [0.56, 0.68, 0.42], 'Grade 3': [0.66, 0.66, 0.44],
  'Grade 3a': [0.66, 0.68, 0.44], 'Grade 3b': [0.66, 0.62, 0.44], 'Grade 4': [0.64, 0.56, 0.44],
  'Grade 5': [0.58, 0.52, 0.46],
});
export const OTHER_COLOR = [0.55, 0.55, 0.55];
export const ALPHA = { post1988: 0.5, provisional: 0.3 };

const finite = h => (Number.isFinite(h) ? h : 0);

export function colorFor(grade, kind) {
  return [...(GRADE_COLOR[grade] || OTHER_COLOR), ALPHA[kind] ?? 0.3];
}

// Pure: is the segment a-b on a side of box?
export function onBox(a, b, box, eps = BOX_EPS) {
  if (!box) return false;
  const same = (u, v, s) => Math.abs(u - s) <= eps && Math.abs(v - s) <= eps;
  return same(a[0], b[0], box.e0) || same(a[0], b[0], box.e1) || same(a[1], b[1], box.n0) || same(a[1], b[1], box.n1);
}

// Pure: boundary polylines of one kind. Each ring is walked, box edges dropped, segments already drawn
// (by an earlier polygon, in either direction) skipped; runs of kept segments become polylines.
// Returns [{ grade, points: [[e, n], ...] }].
export function boundaryRuns(items, box, seen = new Set()) {
  const key = (a, b) => { const p = `${a[0]},${a[1]}`, q = `${b[0]},${b[1]}`; return p < q ? p + '|' + q : q + '|' + p; };
  const out = [];
  for (const it of items || []) {
    for (const ring of it.rings || []) {
      let run = null;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length], k = key(a, b);
        if (onBox(a, b, box) || seen.has(k) || (a[0] === b[0] && a[1] === b[1])) { if (run) out.push(run); run = null; continue; }
        seen.add(k);
        if (!run) run = { grade: it.grade, points: [[a[0], a[1]]] };
        run.points.push([b[0], b[1]]);
      }
      if (run) out.push(run);
    }
  }
  return out;
}

// Pure: all runs to draw, post-1988 first (so a shared edge takes the survey's colour), then provisional.
export function allRuns(land) {
  const notGrade = new Set(land.not_a_grade || ['', ' ', 'Not Surveyed']), seen = new Set();
  const survey = (land.alc?.post1988 || []).filter(p => !notGrade.has(p.grade));
  return [
    ...boundaryRuns(survey, land.box, seen).map(r => ({ ...r, kind: 'post1988' })),
    ...boundaryRuns(land.alc?.provisional || [], land.box, seen).map(r => ({ ...r, kind: 'provisional' })),
  ];
}

// The layer: runs are densified and draped by the shared library (api.lib.drape), which the substrate hash-checks.
export const LIB_VERSION = 1;

export function createLand() {
  let api = null, D = null, enabled = false, data = null, state = 'idle'; // idle | loading | ready | failed
  let runs = null, runsOrigin = null, cache = { version: null, batches: [] };
  const origin = () => (api && typeof api.origin === 'function' ? api.origin() : { e: 0, n: 0, id: 0 });

  function load() {
    if (state !== 'idle' || !api) return;
    const sha = api.config?.sha256 || INDEX_SHA256, path = api.config?.index || INDEX_PATH;
    if (!sha || sha.startsWith('__')) { state = 'failed'; layer.status = 'no land.json hash configured'; return; }
    state = 'loading';
    Promise.resolve().then(() => api.fetchJSON(path, sha)).then(j => {
      if (!j || !j.alc) throw Error('land.json has no alc section');
      data = j; state = 'ready';
      const n = (j.alc.provisional || []).length + (j.alc.post1988 || []).length;
      layer.status = `${n} land grade areas; provisional grades are mapped at about 1:250,000 and a survey decides`;
      api.invalidate({ ground: false });
    }).catch(e => { state = 'failed'; layer.status = 'land.json failed: ' + e.message; });
  }

  function localRuns() {
    const o = origin(), id = `${o.e},${o.n},${o.id}`;
    if (runs && runsOrigin === id) return runs;
    runs = allRuns(data).map((r, i) => ({ i, grade: r.grade, kind: r.kind,
      pts: D.densify(r.points.map(([e, n]) => [e - o.e, n - o.n]), STEP_M) }));
    runsOrigin = id;
    cache = { version: null, batches: [] };
    return runs;
  }

  const layer = {
    id: 'land',
    status: 'waiting for init',
    init(a) {
      if (!a.lib?.drape) { layer.status = 'refused: api.lib.drape not provided'; return; }
      api = a; D = a.lib.drape;
      if (a.config?.enabled) enabled = true;
      layer.status = 'ready to load'; load();
    },
    setEnabled(on) { enabled = !!on; api?.invalidate({ ground: false }); return enabled; },
    get enabled() { return enabled; },
    // ctx: { pos, heightAt, groundVersion }
    lines(ctx) {
      if (!api) return [];
      if (state === 'idle') load();
      if (state !== 'ready') return [];
      const rs = localRuns(), version = `land@${ctx.groundVersion || 0}@${runsOrigin}`;
      if (cache.version !== version || cache.heightAt !== ctx.heightAt) {
        cache = { version, heightAt: ctx.heightAt, batches: rs.map(r => {
          const o = [r.pts[0][0], r.pts[0][1], finite(ctx.heightAt(r.pts[0][0], r.pts[0][1]))];
          return { key: `land/${r.kind}/${r.i}`, version, origin: o, color: colorFor(r.grade, r.kind),
            positions: D.drapeSegments(r.pts, ctx.heightAt, LIFT_M, o, typeof ctx.known === 'function' ? ctx.known : undefined) };
        }) };
      }
      return cache.batches.slice();
    },
    // The loaded land.json, for the land cartridge (web/world/land.mjs) and the console.
    data: () => data,
    debug: () => ({ state, enabled, runs: runs ? runs.length : 0 }),
  };
  return layer;
}

export default createLand();
