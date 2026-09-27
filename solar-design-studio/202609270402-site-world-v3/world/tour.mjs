// Tours: record a walk or a drone flight, play it back smoothly, save it, and present it.
// Keyframes are held in British National Grid metres ({ e, n, z }), never in local metres, so a tour
// survives any origin rebase and plays the same on any machine. Playback is a pure function of the
// tour and the time: the same tour gives the same pose at the same time, every time.
// No DOM and no randomness; the caller supplies time, the origin and the frame gate.
import { toLocal, toBng } from './origin.mjs';

export const SCHEMA = 'world.tour.v1';
export const PLAY_FPS = 30;
const KINDS = ['walk', 'drone'];
// The national grid extent. Its south-west 10 km corner is open sea, so a point there is almost
// certainly local metres given by mistake and is refused too.
const GRID = { e: [0, 700000], n: [0, 1300000], sea: 10000 };
const HEX64 = /^[0-9a-f]{64}$/;
// A phone must be able to open any tour it is given, so files and their parts are capped by name.
export const LIMITS = Object.freeze({ fileBytes: 8 * 1024 * 1024, keyframes: 100000, caption: 280, name: 200 });
const TOP_FIELDS = ['schema', 'kind', 'name', 'keyframes', 'sha256'];
const KEY_FIELDS = ['t', 'e', 'n', 'z', 'yaw', 'pitch', 'caption', 'hold'];

// Quantise on the way in, so a saved tour reads back as the very same numbers (whole millimetres, no float noise).
const mm = x => Math.round(x * 1e3) / 1e3;
const rad = x => Math.round(x * 1e6) / 1e6;
const ms = x => Math.round(x * 1e3) / 1e3;
const TAU = 2 * Math.PI;
const turn = (from, to) => {
  const d = (to - from) % TAU;
  return d > Math.PI ? d - TAU : d < -Math.PI ? d + TAU : d;
};

// ---------- keyframes ----------

// One keyframe from a local pose and the origin it was taken under. Returns grid metres.
export function keyframe(t, origin, pose, { caption = '', hold = 0 } = {}) {
  const g = toBng(origin, pose.pos[0], pose.pos[1]);
  const k = { t: ms(t), e: mm(g.e), n: mm(g.n), z: mm(pose.pos[2]), yaw: rad(pose.yaw), pitch: rad(pose.pitch) };
  if (caption) k.caption = String(caption);
  if (hold > 0) k.hold = ms(hold);
  return k;
}

// Recorder. sample() is called every frame with the time in seconds since recording began;
// a keyframe is kept at most every `every` seconds. mark() pins a caption (and an optional hold)
// to a keyframe taken at that moment. stop() returns the tour.
export function createRecorder({ kind = 'walk', name = '', every = 0.25 } = {}) {
  if (!KINDS.includes(kind)) throw Error(`tour kind must be one of ${KINDS.join(', ')}`);
  const frames = [];
  let last = null;
  const push = k => {
    if (frames.length && k.t <= frames[frames.length - 1].t) {
      if (k.caption || k.hold) Object.assign(frames[frames.length - 1], pick(k, ['caption', 'hold']));
      return;
    }
    frames.push(k);
  };
  return {
    sample(t, origin, pose) {
      last = { t, origin: { ...origin }, pose: { pos: [...pose.pos], yaw: pose.yaw, pitch: pose.pitch } };
      if (!frames.length || t - frames[frames.length - 1].t >= every) push(keyframe(t, origin, pose));
    },
    mark(caption, hold = 0) {
      if (!last) throw Error('nothing recorded yet to caption');
      push(keyframe(last.t, last.origin, last.pose, { caption, hold }));
    },
    count: () => frames.length,
    stop() {
      if (last && frames.length && last.t > frames[frames.length - 1].t) push(keyframe(last.t, last.origin, last.pose));
      return makeTour({ kind, name, keyframes: frames });
    }
  };
}

const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, o[k]]));

// Build a tour in canonical form: fixed key order, times from zero, quantised values. Throws on bad input.
export function makeTour({ kind = 'walk', name = '', keyframes }) {
  if (!KINDS.includes(kind)) throw Error(`tour kind must be one of ${KINDS.join(', ')}`);
  if (!Array.isArray(keyframes) || keyframes.length < 2) throw Error('a tour needs at least two keyframes');
  if (keyframes.length > LIMITS.keyframes) throw Error(`a tour has ${keyframes.length} keyframes, over the limit of ${LIMITS.keyframes}`);
  if (String(name).length > LIMITS.name) throw Error(`the tour name is over ${LIMITS.name} characters`);
  const t0 = keyframes[0].t;
  const out = keyframes.map((k, i) => {
    for (const f of ['t', 'e', 'n', 'z', 'yaw', 'pitch']) {
      if (!Number.isFinite(k[f])) throw Error(`keyframe ${i}: ${f} is not a finite number`);
    }
    if ('x' in k || 'y' in k || 'pos' in k) throw Error(`keyframe ${i}: local coordinates are not accepted; use grid e and n`);
    if (k.e < GRID.e[0] || k.e > GRID.e[1] || k.n < GRID.n[0] || k.n > GRID.n[1] || (k.e < GRID.sea && k.n < GRID.sea)) {
      throw Error(`keyframe ${i}: ${k.e}, ${k.n} is not on the national grid (local metres?)`);
    }
    if (k.hold !== undefined && !(k.hold >= 0 && Number.isFinite(k.hold))) throw Error(`keyframe ${i}: hold must be zero or more`);
    if (k.caption && String(k.caption).length > LIMITS.caption) throw Error(`keyframe ${i}: caption is over ${LIMITS.caption} characters`);
    const c = { t: ms(k.t - t0), e: mm(k.e), n: mm(k.n), z: mm(k.z), yaw: rad(k.yaw), pitch: rad(k.pitch) };
    if (k.caption) c.caption = String(k.caption);
    if (k.hold > 0) c.hold = ms(k.hold);
    return c;
  });
  for (let i = 1; i < out.length; i++) {
    if (!(out[i].t > out[i - 1].t)) throw Error(`keyframe ${i}: time must increase`);
  }
  return { schema: SCHEMA, kind, name: String(name), keyframes: out };
}

// ---------- JSON with a SHA-256 ----------

const body = tour => JSON.stringify({ schema: SCHEMA, kind: tour.kind, name: tour.name, keyframes: tour.keyframes });

export async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// The hash covers the canonical body (everything but the hash itself), so re-exporting is stable.
export async function exportTour(tour) {
  const t = makeTour(tour);
  const sha = await sha256(body(t));
  return JSON.stringify({ ...t, sha256: sha }, null, 1);
}

// Parse, check the schema and the hash, and return the tour. Throws with a plain reason on any fault.
export async function importTour(text) {
  const bytes = new TextEncoder().encode(String(text)).length;
  if (bytes > LIMITS.fileBytes) throw Error(`tour file is ${bytes} bytes, over the limit of ${LIMITS.fileBytes}`);
  let raw;
  try { raw = JSON.parse(String(text).replace(/^﻿/, '')); } catch { throw Error('tour file is not valid JSON'); }
  if (raw?.schema !== SCHEMA) throw Error(`tour file schema is not ${SCHEMA}`);
  const extra = Object.keys(raw).filter(k => !TOP_FIELDS.includes(k));
  if (extra.length) throw Error(`tour file has unexpected fields: ${extra.join(', ')}`);
  if (!HEX64.test(String(raw.sha256 ?? '').toLowerCase())) throw Error('tour file has no valid sha256');
  const t = makeTour(raw);
  raw.keyframes.forEach((k, i) => {
    const odd = Object.keys(k).filter(f => !KEY_FIELDS.includes(f));
    if (odd.length) throw Error(`keyframe ${i} has unexpected fields: ${odd.join(', ')}`);
  });
  const sha = await sha256(body(t));
  if (sha !== raw.sha256.toLowerCase()) throw Error('tour file sha256 does not match its contents');
  return t;
}

// ---------- playback ----------

// Compile a tour into a timeline. Holds become a second keyframe in the same place; the first, last,
// captioned and held keyframes are stops, where the camera comes to rest as it does on arrival.
export function compile(tour) {
  const src = tour.keyframes;
  const pts = [];
  let shift = 0, yaw = src[0].yaw;
  src.forEach((k, i) => {
    yaw = i ? yaw + turn(pts[pts.length - 1].raw, k.yaw) : k.yaw; // unwrap, so each step turns the short way
    const stop = i === 0 || i === src.length - 1 || !!k.caption || k.hold > 0;
    const p = { t: k.t + shift, v: [k.e, k.n, k.z, yaw, k.pitch], raw: k.yaw, stop, caption: k.caption || '', src: i };
    pts.push(p);
    if (k.hold > 0) { shift += k.hold; pts.push({ ...p, t: k.t + shift, caption: '', held: true }); }
  });
  // Tangents: zero at stops, otherwise the time-weighted Catmull-Rom slope through the neighbours.
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    b.m = b.stop || !a || !c ? [0, 0, 0, 0, 0] : b.v.map((_, j) => (c.v[j] - a.v[j]) / (c.t - a.t));
  }
  const captions = pts.filter(p => p.caption).map(p => ({ t: p.t, text: p.caption, keyframe: p.src }));
  const stops = pts.filter(p => p.stop && !p.held).map(p => p.t);
  return Object.freeze({ tour, pts, captions, stops, duration: pts[pts.length - 1].t });
}

// Cubic Hermite between two points with the given tangents; u in [0, 1], h the span in seconds.
function hermite(a, b, u, h, j) {
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * a.v[j] + (u3 - 2 * u2 + u) * h * a.m[j] + (-2 * u3 + 3 * u2) * b.v[j] + (u3 - u2) * h * b.m[j];
}

// The pose at time t (seconds from the start) in grid metres: { e, n, z, yaw, pitch }.
// Times before the start or after the end give the first or last pose exactly.
export function gridPoseAt(line, t) {
  const p = line.pts;
  const at = v => ({ e: v[0], n: v[1], z: v[2], yaw: v[3], pitch: v[4] });
  if (!(t > p[0].t)) return at(p[0].v);
  if (t >= line.duration) return at(p[p.length - 1].v);
  let lo = 0, hi = p.length - 1; // binary search: p[lo].t <= t < p[hi].t
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (p[mid].t <= t) lo = mid; else hi = mid; }
  const a = p[lo], b = p[hi], h = b.t - a.t, u = (t - a.t) / h;
  return at(a.v.map((_, j) => hermite(a, b, u, h, j)));
}

// The same pose in local metres under the current origin, ready for the camera: { pos, yaw, pitch }.
export function poseAt(line, t, origin) {
  const g = gridPoseAt(line, t);
  const [x, y] = toLocal(origin, g.e, g.n);
  return { pos: [x, y, g.z], yaw: g.yaw, pitch: g.pitch };
}

// The caption showing at time t: from its keyframe until the next captioned keyframe, or `showFor`
// seconds, whichever is sooner. Returns { text, index } or null.
export function captionAt(line, t, { showFor = 6 } = {}) {
  const cs = line.captions;
  for (let i = cs.length - 1; i >= 0; i--) {
    if (cs[i].t <= t) {
      const until = Math.min(cs[i + 1]?.t ?? Infinity, cs[i].t + showFor);
      return t < until ? { text: cs[i].text, index: i } : null;
    }
  }
  return null;
}

// ---------- player and presentation ----------

// Player. apply(pose, t) receives the local pose for each drawn frame; getOrigin() gives the current
// origin. gate is a frame gate (frame-gate.mjs): while playing it runs at 30 fps at most, and when
// paused or finished it is told to stop, so an idle tour draws nothing at all.
// The caller's draw routine calls player.frame(now); now is in milliseconds, as from the gate.
export function createPlayer(tour, { gate, getOrigin, apply = () => {}, onCaption = () => {}, onEnd = () => {}, clock = () => performance.now(), showFor = 6 } = {}) {
  const line = compile(tour);
  let playing = false, t = 0, startedAt = 0, shown;
  const show = () => {
    const c = captionAt(line, t, { showFor });
    const key = c ? c.index : -1;
    if (key !== shown) { shown = key; onCaption(c ? c.text : '', c); }
  };
  const draw = () => { apply(poseAt(line, t, getOrigin()), t); show(); };
  const self = {
    line,
    get playing() { return playing; },
    get time() { return t; },
    play() {
      if (playing) return;
      if (t >= line.duration) t = 0;
      playing = true; startedAt = clock() - t * 1000;
      gate?.setMoving(true, PLAY_FPS);
    },
    pause() {
      if (!playing) return;
      t = Math.min(line.duration, (clock() - startedAt) / 1000);
      playing = false;
      gate?.setMoving(false);
      gate?.invalidate(); // one last frame at the exact paused time, then nothing
    },
    toggle() { playing ? self.pause() : self.play(); },
    // Jump to a time in seconds; keeps playing if it was.
    seek(s) {
      if (!Number.isFinite(s)) return; // a bad time is ignored, never played forever
      t = Math.max(0, Math.min(line.duration, s));
      if (playing) startedAt = clock() - t * 1000;
      else gate?.invalidate();
    },
    // Presentation steps: go to the next or previous stop (a captioned or held keyframe, or an end).
    next() { const s = line.stops.find(x => x > t + 1e-9); self.seek(s ?? line.duration); },
    previous() { const s = [...line.stops].reverse().find(x => x < t - 1e-9); self.seek(s ?? 0); },
    // Called from the gate's draw. Works out the tour time from the clock, applies the pose.
    frame(now = clock()) {
      if (!Number.isFinite(now)) now = clock();
      if (playing) {
        t = Math.min(line.duration, (now - startedAt) / 1000);
        if (t >= line.duration) { playing = false; gate?.setMoving(false); draw(); onEnd(); return; }
      }
      draw();
    }
  };
  return self;
}

// Presentation mode: play a saved tour for a meeting. Takes the tour file's text, checks its hash,
// and returns a player whose captions go to captionEl (any object with textContent and hidden) or
// onCaption. Keys: space plays or pauses, right and left arrows step between stops, Escape ends.
export async function present(text, { captionEl, onCaption, onExit = () => {}, autoplay = true, ...opts } = {}) {
  const tour = await importTour(text);
  const player = createPlayer(tour, {
    ...opts,
    onCaption(textNow, c) {
      if (captionEl) { captionEl.textContent = textNow; captionEl.hidden = !textNow; }
      onCaption?.(textNow, c);
    }
  });
  player.key = code => {
    if (code === ' ' || code === 'Space') player.toggle();
    else if (code === 'ArrowRight') player.next();
    else if (code === 'ArrowLeft') player.previous();
    else if (code === 'Escape') { player.pause(); onExit(); }
    else return false;
    return true;
  };
  if (autoplay) player.play();
  return player;
}
