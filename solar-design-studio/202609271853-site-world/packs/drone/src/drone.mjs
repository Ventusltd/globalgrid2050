// Drone pack (world.pack.v1, kind vehicle). A light multirotor model for our 3D worlds: thrust, quadratic drag and wind
// as a parameter, hover hold, height above the ground model, speed limits, a legal-height note, go-to, orbit and
// survey modes (a lawnmower pattern over a boundary with front and side overlap), and the camera footprint on the ground.
// The world's aerial view is the "view" mode: the viewer is the drone, and this pack reports its height and footprint.
//
// ILLUSTRATIVE. The flight model is a point mass with a tilt-limited thrust vector and a PI velocity controller.
// It is not a model of any particular aircraft, and nothing here is flight planning or legal advice.
// Self-contained: no imports. Deterministic: fixed steps only, no clock, no random numbers.

const G = 9.80665;                 // standard gravity, m/s^2
const RHO = 1.225;                 // air density at sea level in the ISO 2533 standard atmosphere, kg/m^3
const DEG = Math.PI / 180;

// Defaults. Every one is an assumption for an illustrative small multirotor and can be set in the world's pin config.
export const DEFAULTS = Object.freeze({
  mass: 1.2,            // kg
  cda: 0.03,            // drag coefficient x frontal area, m^2
  thrustRatio: 2.0,     // maximum thrust / weight
  maxTilt: 35,          // degrees from level
  maxSpeed: 15,         // horizontal speed limit, m/s
  climb: 5,             // m/s
  descent: 3,           // m/s
  hold: 30,             // default hover height above the ground, m
  ceiling: 120,         // legal height note, m above the surface (see LEGAL_NOTE)
  wind: [0, 0],         // [speed m/s, direction it blows FROM in degrees, 0 = north (+y), 90 = east (+x)]
  camera: { hfov: 73.7, vfov: 53.1, px: 5472 }, // nadir camera: fields of view in degrees, image width in pixels
  overlap: { front: 75, side: 65 },            // survey overlap, %
  skids: 0.15           // m from the centre down to the landing skids
});

export const LEGAL_NOTE = 'UK drone code, open category: keep below 120 m (400 ft) above the surface; check current rules';

// The world's own aerial view, which this pack takes over as its "view" mode (same speeds and clearance).
export const AERIAL_VIEW = Object.freeze({ speed: 25, slow: 5, clearance: 0.3 });

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };

// Top horizontal speed in still air when thrust is tilt-limited: the horizontal thrust m g tan(tilt) equals drag
// 0.5 rho CdA v^2. The same figure is the strongest steady wind the drone can hold station in.
export function terminalSpeed(p = DEFAULTS) {
  return Math.sqrt((2 * p.mass * G * Math.tan(p.maxTilt * DEG)) / (RHO * p.cda));
}

// Wind [speed, from degrees] as a velocity vector (the air moves TOWARDS from + 180).
export function windVector([speed, from]) {
  const a = from * DEG;
  return [-speed * Math.sin(a), -speed * Math.cos(a), 0];
}

// Ground footprint of a nadir camera at height h above flat ground: 2 h tan(fov / 2) each way.
export function footprint(h, cam = DEFAULTS.camera) {
  const w = 2 * h * Math.tan((cam.hfov * DEG) / 2), l = 2 * h * Math.tan((cam.vfov * DEG) / 2);
  return { w, l, gsd: w / cam.px }; // gsd: metres of ground per pixel across the image
}

// Lawnmower survey over a boundary polygon [[x, y], ...]. Lanes run along the longest edge; lane spacing is the
// footprint width times (1 - side overlap); photo spacing along a lane is the footprint length times (1 - front overlap).
export function planSurvey(boundary, { height = DEFAULTS.hold, camera = DEFAULTS.camera, overlap = DEFAULTS.overlap, maxLanes = 400 } = {}) {
  if (!Array.isArray(boundary) || boundary.length < 3) throw Error('a survey boundary needs at least three corners');
  const fp = footprint(height, camera);
  const spacing = fp.w * (1 - overlap.side / 100), photoStep = fp.l * (1 - overlap.front / 100);
  if (!(spacing > 0) || !(photoStep > 0)) throw Error('overlap must be below 100%');
  let best = 0, ang = 0;
  for (let i = 0; i < boundary.length; i++) {
    const [ax, ay] = boundary[i], [bx, by] = boundary[(i + 1) % boundary.length];
    const d = Math.hypot(bx - ax, by - ay);
    if (d > best) { best = d; ang = Math.atan2(by - ay, bx - ax); }
  }
  const c = Math.cos(ang), s = Math.sin(ang);
  const toU = ([x, y]) => [x * c + y * s, -x * s + y * c];      // u along the lanes, v across them
  const toXY = (u, v) => [u * c - v * s, u * s + v * c];
  const poly = boundary.map(toU);
  let vmin = Infinity, vmax = -Infinity;
  for (const [, v] of poly) { vmin = Math.min(vmin, v); vmax = Math.max(vmax, v); }
  const lanes = [], n = Math.max(1, Math.ceil((vmax - vmin) / spacing));
  if (n > maxLanes) throw Error(`the survey needs ${n} lanes, more than ${maxLanes}; fly higher or lower the side overlap`);
  const first = vmin + ((vmax - vmin) - (n - 1) * spacing) / 2;  // centre the lanes over the boundary
  for (let k = 0; k < n; k++) {
    const v = first + k * spacing, xs = [];
    for (let i = 0; i < poly.length; i++) {
      const [u1, v1] = poly[i], [u2, v2] = poly[(i + 1) % poly.length];
      if ((v1 <= v && v < v2) || (v2 <= v && v < v1)) xs.push(u1 + ((v - v1) / (v2 - v1)) * (u2 - u1));
    }
    xs.sort((a, b) => a - b);
    for (let j = 0; j + 1 < xs.length; j += 2) lanes.push({ v, u0: xs[j], u1: xs[j + 1] });
  }
  const waypoints = [];
  let length = 0, photos = 0;
  lanes.forEach((l, k) => {
    const [a, b] = k % 2 ? [l.u1, l.u0] : [l.u0, l.u1];
    waypoints.push(toXY(a, l.v), toXY(b, l.v));
    length += Math.abs(l.u1 - l.u0);
    photos += Math.floor(Math.abs(l.u1 - l.u0) / photoStep) + 1;
  });
  for (let i = 1; i < waypoints.length; i += 2) if (waypoints[i + 1]) length += Math.hypot(waypoints[i + 1][0] - waypoints[i][0], waypoints[i + 1][1] - waypoints[i][1]);
  return { heading: ang, spacing, photoStep, lanes: lanes.length, waypoints, length, photos, footprint: fp, height, overlap: { ...overlap } };
}

// One drone: state plus a deterministic fixed step. Pure apart from its own state; the entry below wraps one.
export function createDrone(cfg = {}) {
  const p = { ...DEFAULTS, ...cfg, camera: { ...DEFAULTS.camera, ...(cfg.camera || {}) }, overlap: { ...DEFAULTS.overlap, ...(cfg.overlap || {}) } };
  const d = {
    p,
    pos: [0, 0, p.skids], vel: [0, 0, 0], thrust: [0, 0, 0], integ: [0, 0],
    mode: 'idle', airborne: false, hold: p.hold, target: null, orbit: null, survey: null, wp: 0,
    speedLimit: Math.min(p.maxSpeed, terminalSpeed(p)), steps: 0, t: 0, saturated: false, agl: 0, ground: 0
  };

  d.launch = (x, y, ground = 0) => {
    d.pos = [x, y, ground + p.skids]; d.vel = [0, 0, 0]; d.integ = [0, 0];
    d.airborne = true; d.mode = 'hover'; d.target = [x, y];
  };

  // The velocity this mode asks for, horizontal [vx, vy] in m/s.
  function wanted() {
    const [x, y] = d.pos, lim = d.speedLimit;
    const toward = ([tx, ty], stopAt = true) => {
      const dx = tx - x, dy = ty - y, r = Math.hypot(dx, dy);
      if (r < 1e-9) return [0, 0, r];
      const brake = G * Math.tan(p.maxTilt * DEG) * 0.5;       // plan to stop on half the available deceleration
      const v = stopAt ? Math.min(lim, Math.sqrt(2 * brake * r), 1.2 * r) : lim;
      return [(dx / r) * v, (dy / r) * v, r];
    };
    if (d.mode === 'hover' || d.mode === 'land' || d.mode === 'goto') { const [vx, vy] = toward(d.target); return [vx, vy]; }
    if (d.mode === 'orbit') {
      const { c, r, dir } = d.orbit, dx = x - c[0], dy = y - c[1], rr = Math.hypot(dx, dy) || 1e-9;
      const ux = dx / rr, uy = dy / rr, v = Math.min(lim, d.orbit.speed);
      const radial = clamp(1.0 * (r - rr), -lim, lim);
      return [-uy * v * dir + ux * radial, ux * v * dir + uy * radial];
    }
    if (d.mode === 'survey') {
      const wps = d.survey.waypoints, w = wps[d.wp];
      const last = d.wp === wps.length - 1;
      const [vx, vy, r] = toward(w, last);
      if (r < 1.0) { if (last) { d.mode = 'hover'; d.target = [x, y]; } else d.wp++; }
      return [vx, vy];
    }
    return [0, 0];
  }

  d.step = (dt, heightAt = () => 0) => {
    if (!d.airborne) return;
    d.steps++; d.t += dt;
    const m = p.mass, tmax = p.thrustRatio * m * G, tanT = Math.tan(p.maxTilt * DEG);
    const ground = heightAt(d.pos[0], d.pos[1]);
    const g0 = Number.isFinite(ground) ? ground : d.ground;
    d.ground = g0;
    // Vertical: hold height above the ground model; land: descend to the skids.
    const zWant = d.mode === 'land' ? g0 + p.skids - 1 : g0 + d.hold;
    const vzWant = clamp(1.2 * (zWant - d.pos[2]), -p.descent, p.climb);
    const [vxWant, vyWant] = wanted();
    // PI velocity controller. The integral learns the wind; it stops growing while the thrust is saturated.
    const kv = 2.5, ki = 0.8;
    const ex = vxWant - d.vel[0], ey = vyWant - d.vel[1];
    if (!d.saturated) { d.integ[0] += ex * dt; d.integ[1] += ey * dt; }
    const ax = kv * ex + ki * d.integ[0], ay = kv * ey + ki * d.integ[1];
    const az = 3.0 * (vzWant - d.vel[2]);
    // Thrust: vertical first, then the horizontal part within the tilt and total thrust limits.
    let tz = clamp(m * (G + az), 0, tmax * Math.cos(p.maxTilt * DEG));
    let tx = m * ax, ty = m * ay;
    const th = Math.hypot(tx, ty), thMax = Math.min(tz * tanT, Math.sqrt(Math.max(0, tmax * tmax - tz * tz)));
    d.saturated = th > thMax;
    if (d.saturated) { tx *= thMax / th; ty *= thMax / th; }
    d.thrust = [tx, ty, tz];
    // Forces: thrust, quadratic drag on the air-relative velocity, weight.
    const w = windVector(p.wind);
    const rx = d.vel[0] - w[0], ry = d.vel[1] - w[1], rz = d.vel[2] - w[2], rv = Math.hypot(rx, ry, rz);
    const k = 0.5 * RHO * p.cda * rv;
    const a = [(tx - k * rx) / m, (ty - k * ry) / m, (tz - k * rz) / m - G];
    // Semi-implicit Euler.
    for (let i = 0; i < 3; i++) { d.vel[i] += a[i] * dt; d.pos[i] += d.vel[i] * dt; }
    const floor = heightAt(d.pos[0], d.pos[1]);
    const gz = (Number.isFinite(floor) ? floor : g0) + p.skids;
    if (d.pos[2] < gz) {
      d.pos[2] = gz;
      if (d.vel[2] < 0) d.vel[2] = 0;
      if (d.mode === 'land') { d.airborne = false; d.mode = 'idle'; d.vel = [0, 0, 0]; d.integ = [0, 0]; }
    }
    d.agl = d.pos[2] - (Number.isFinite(floor) ? floor : g0);
  };

  d.hspeed = () => Math.hypot(d.vel[0], d.vel[1]);
  d.tilt = () => Math.atan2(Math.hypot(d.thrust[0], d.thrust[1]), d.thrust[2]) / DEG;
  return d;
}

// ---------------------------------------------------------------- the entry the world loads

const RING = 12, ARM = 0.35, ROTOR = 0.14;
const C_BODY = [0.95, 0.95, 0.98, 1], C_ROTOR = [0.55, 0.8, 1, 0.9], C_STICK = [1, 0.8, 0.3, 0.7];
const C_PATH = [0.45, 1, 0.6, 0.8], C_FOOT = [1, 0.55, 0.25, 0.9], C_TRAIL = [0.8, 0.8, 1, 0.45];
const TRAIL = 120, TRAIL_EVERY = 15;   // one trail point every 0.25 s, 30 s of trail

let api = null, on = true, drone = null, cfg = {}, heightAt = () => 0, viewer = [0, 0, 1.7], viewing = false;
let planVersion = 0, trail = [], cache = new Map(), lastPose = -1;

function reset() {
  drone = createDrone(cfg); trail = []; planVersion++; cache = new Map(); lastPose = -1;
}

function batch(key, version, color, origin, fill, segs) {
  const hit = cache.get(key);
  if (hit && hit.version === version) return hit;
  const positions = new Float32Array(segs * 6);
  let i = 0;
  const seg = (a, b) => { positions.set([a[0] - origin[0], a[1] - origin[1], a[2] - origin[2], b[0] - origin[0], b[1] - origin[1], b[2] - origin[2]], i); i += 6; };
  fill(seg);
  const b = { key, version, color, origin, positions: i === positions.length ? positions : positions.slice(0, i) };
  cache.set(key, b);
  return b;
}

// Where the drone is for drawing and the HUD: the simulated drone, or the viewer in view mode.
function here() {
  if (viewing) return viewer;
  return drone.pos;
}

function heading() {
  if (drone.mode === 'survey') return drone.survey.heading;
  const s = drone.hspeed();
  return s > 0.5 ? Math.atan2(drone.vel[1], drone.vel[0]) : 0;
}

function aglAt(p) { const g = heightAt(p[0], p[1]); return Number.isFinite(g) ? p[2] - g : NaN; }

function parseXY(args, i, what) {
  const x = num(args[i]), y = num(args[i + 1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw Error(`${what} needs two numbers in local metres`);
  return [x, y];
}

function legal(h) {
  if (h > drone.p.ceiling) throw Error(`${h} m is above the ${drone.p.ceiling} m height note (${LEGAL_NOTE})`);
  if (h < 2) throw Error('hold at least 2 m above the ground');
  return h;
}

function status() {
  const p = here(), a = aglAt(p);
  return `drone ${viewing ? 'view' : drone.mode} at ${p[0].toFixed(1)} ${p[1].toFixed(1)} m, ${Number.isFinite(a) ? a.toFixed(1) : '?'} m above ground, ` +
    `${drone.hspeed().toFixed(1)} m/s, limit ${drone.speedLimit.toFixed(1)} m/s (illustrative)`;
}

function emit(topic, payload) { try { api?.events.emit(topic, payload); } catch (e) { api?.log?.(`drone: ${e.message}`); } }

export default {
  id: 'drone',
  init(a) {
    api = a;
    const c = a.config || {};
    cfg = {};
    for (const k of ['mass', 'cda', 'thrustRatio', 'maxTilt', 'maxSpeed', 'climb', 'descent', 'hold', 'ceiling', 'skids']) {
      if (Number.isFinite(c[k]) && c[k] > 0) cfg[k] = c[k];
    }
    if (cfg.ceiling > 120) cfg.ceiling = 120;   // the note never loosens past the open-category figure
    if (Array.isArray(c.wind) && c.wind.length === 2 && c.wind.every(Number.isFinite)) cfg.wind = [Math.max(0, c.wind[0]), c.wind[1]];
    if (c.camera && typeof c.camera === 'object') cfg.camera = c.camera;
    if (c.overlap && typeof c.overlap === 'object') cfg.overlap = c.overlap;
    reset();
    if (Array.isArray(c.launch) && c.launch.length === 2 && c.launch.every(Number.isFinite)) drone.launch(c.launch[0], c.launch[1], 0);
    a.events.on('world/pose', ({ pos } = {}) => { if (Array.isArray(pos) && pos.length === 3) viewer = [...pos]; });
  },
  setEnabled(v) { on = !!v; if (!on && drone) { viewing = false; } },
  step(dt, ctx = {}) {
    if (typeof ctx.heightAt === 'function') heightAt = ctx.heightAt;
    if (!drone.airborne) return;
    drone.step(dt, heightAt);
    if (drone.steps % TRAIL_EVERY === 0) { trail.push([...drone.pos]); if (trail.length > TRAIL) trail.shift(); }
    if (drone.steps % 6 === 0 && drone.steps !== lastPose) {
      lastPose = drone.steps;
      emit('pose', { pos: [...drone.pos], vel: [...drone.vel], agl: drone.agl, mode: drone.mode });
    }
  },
  active() { return on && !!drone && drone.airborne && !viewing; },
  lines(ctx = {}) {
    if (typeof ctx.heightAt === 'function') heightAt = ctx.heightAt;
    if (viewing && Array.isArray(ctx.pos)) viewer = [...ctx.pos];
    const out = [], p = here(), v = `${drone.steps}|${p.join(',')}|${viewing}|${ctx.groundVersion ?? ''}`;
    const g = heightAt(p[0], p[1]), gz = Number.isFinite(g) ? g : 0;
    if (!viewing) {
      const o = [...p];
      out.push(batch('body', v, C_BODY, o, seg => {
        seg([p[0] - ARM, p[1] - ARM, p[2]], [p[0] + ARM, p[1] + ARM, p[2]]);
        seg([p[0] - ARM, p[1] + ARM, p[2]], [p[0] + ARM, p[1] - ARM, p[2]]);
      }, 2));
      out.push(batch('rotors', v, C_ROTOR, o, seg => {
        for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const cx = p[0] + sx * ARM, cy = p[1] + sy * ARM;
          for (let i = 0; i < RING; i++) {
            const a0 = (i / RING) * 2 * Math.PI, a1 = ((i + 1) / RING) * 2 * Math.PI;
            seg([cx + ROTOR * Math.cos(a0), cy + ROTOR * Math.sin(a0), p[2] + 0.04], [cx + ROTOR * Math.cos(a1), cy + ROTOR * Math.sin(a1), p[2] + 0.04]);
          }
        }
      }, 4 * RING));
    }
    // Height stick from the drone down to the ground model.
    out.push(batch('stick', v, C_STICK, [p[0], p[1], gz], seg => seg([p[0], p[1], gz], [p[0], p[1], p[2]]), 1));
    // Camera footprint on the ground (nadir camera, sized from the height above the ground under the drone).
    const agl = p[2] - gz;
    if (agl > 1) {
      const f = footprint(agl, drone.p.camera), hd = heading(), c = Math.cos(hd), s = Math.sin(hd);
      const corner = (u, w) => { const x = p[0] + u * c - w * s, y = p[1] + u * s + w * c, h = heightAt(x, y); return [x, y, (Number.isFinite(h) ? h : gz) + 0.05]; };
      const q = [corner(f.l / 2, f.w / 2), corner(-f.l / 2, f.w / 2), corner(-f.l / 2, -f.w / 2), corner(f.l / 2, -f.w / 2)];
      out.push(batch('footprint', v, C_FOOT, [p[0], p[1], gz], seg => { for (let i = 0; i < 4; i++) seg(q[i], q[(i + 1) % 4]); }, 4));
    }
    // The plan: survey lanes or orbit circle, at flying height over the ground.
    const pv = `${planVersion}|${ctx.groundVersion ?? ''}`;
    const lift = (x, y) => { const h = heightAt(x, y); return [x, y, (Number.isFinite(h) ? h : gz) + drone.hold]; };
    if (!viewing && drone.mode === 'survey') {
      const w = drone.survey.waypoints, o = lift(w[0][0], w[0][1]);
      out.push(batch('plan', pv, C_PATH, o, seg => { for (let i = 0; i + 1 < w.length; i++) seg(lift(...w[i]), lift(...w[i + 1])); }, w.length - 1));
    } else if (!viewing && drone.mode === 'orbit') {
      const { c, r } = drone.orbit, n = 64, o = lift(c[0], c[1]);
      out.push(batch('plan', pv, C_PATH, o, seg => {
        for (let i = 0; i < n; i++) {
          const a0 = (i / n) * 2 * Math.PI, a1 = ((i + 1) / n) * 2 * Math.PI;
          seg(lift(c[0] + r * Math.cos(a0), c[1] + r * Math.sin(a0)), lift(c[0] + r * Math.cos(a1), c[1] + r * Math.sin(a1)));
        }
      }, n));
    }
    if (!viewing && trail.length > 1) {
      out.push(batch('trail', `${drone.steps - (drone.steps % TRAIL_EVERY)}|${trail.length}`, C_TRAIL, trail[0], seg => {
        for (let i = 0; i + 1 < trail.length; i++) seg(trail[i], trail[i + 1]);
      }, trail.length - 1));
    }
    return out;
  },
  hud() {
    const p = here(), a = aglAt(p), dp = drone.p;
    const mode = viewing ? 'view' : drone.mode;
    let what = `drone ${mode}, ${drone.hspeed().toFixed(1)} m/s, limit ${drone.speedLimit.toFixed(0)} m/s`;
    if (!viewing && drone.mode === 'survey') what += `, leg ${drone.wp}/${drone.survey.waypoints.length - 1}`;
    const over = Number.isFinite(a) && a > dp.ceiling;
    const height = `${Number.isFinite(a) ? a.toFixed(1) : '?'} m above ground` + (over ? `, ABOVE ${dp.ceiling} m note` : `, note ${dp.ceiling} m`);
    const holdable = terminalSpeed(dp);
    const wind = `wind ${dp.wind[0].toFixed(1)} m/s from ${dp.wind[1].toFixed(0)} deg, tilt ${drone.tilt().toFixed(0)} deg` +
      (dp.wind[0] > holdable ? ', too strong to hold' : '');
    const f = footprint(Math.max(0, Number.isFinite(a) ? a : 0), dp.camera);
    const foot = `footprint ${f.w.toFixed(0)} x ${f.l.toFixed(0)} m, ${(f.gsd * 100).toFixed(1)} cm/px, overlap ${dp.overlap.front}/${dp.overlap.side}%`;
    return [{ id: 'mode', text: what }, { id: 'height', text: height }, { id: 'wind', text: wind }, { id: 'camera', text: foot }];
  },
  commands() {
    return [{
      verb: 'drone',
      run(args) {
        const w = (args[0] || 'status').toLowerCase(), dp = drone.p;
        const need = () => { if (!drone.airborne) throw Error('launch first: drone launch'); };
        if (w === 'status') return status();
        if (w === 'launch') {
          const [x, y] = args.length >= 3 ? parseXY(args, 1, 'drone launch') : [viewer[0], viewer[1]];
          const g = heightAt(x, y);
          viewing = false; trail = []; drone.launch(x, y, Number.isFinite(g) ? g : 0);
          return `drone launched at ${x.toFixed(1)} ${y.toFixed(1)} m, climbing to ${drone.hold} m above ground (illustrative)`;
        }
        if (w === 'land') { need(); drone.mode = 'land'; drone.target = [drone.pos[0], drone.pos[1]]; planVersion++; return 'drone landing'; }
        if (w === 'hover') { need(); drone.mode = 'hover'; drone.target = [drone.pos[0], drone.pos[1]]; planVersion++; return 'drone holding position'; }
        if (w === 'hold') {
          const h = num(args[1]);
          if (!Number.isFinite(h)) throw Error('drone hold <metres above ground>, for example drone hold 50');
          drone.hold = legal(h); return `drone holds ${h} m above the ground model`;
        }
        if (w === 'goto') { need(); drone.target = parseXY(args, 1, 'drone goto'); drone.mode = 'goto'; planVersion++; return `drone flying to ${drone.target.join(' ')} m`; }
        if (w === 'speed') {
          const s = num(args[1]);
          if (!(s > 0)) throw Error('drone speed <m/s>, for example drone speed 8');
          const cap = Math.min(dp.maxSpeed, terminalSpeed(dp));
          drone.speedLimit = Math.min(s, cap);
          return `drone speed limit ${drone.speedLimit.toFixed(1)} m/s` + (s > cap ? ` (capped at ${cap.toFixed(1)} m/s)` : '');
        }
        if (w === 'wind') {
          const s = num(args[1]), from = num(args[2] ?? 0);
          if (!(s >= 0) || !Number.isFinite(from)) throw Error('drone wind <m/s> <from degrees>, for example drone wind 8 270');
          dp.wind = [s, ((from % 360) + 360) % 360];
          const hold = terminalSpeed(dp);
          return `wind ${s} m/s from ${dp.wind[1]} deg` + (s > hold ? `; above the ${hold.toFixed(1)} m/s this drone can hold against` : '');
        }
        if (w === 'orbit') {
          need();
          const c = parseXY(args, 1, 'drone orbit'), r = num(args[3]), sp = args[4] === undefined ? 5 : num(args[4]);
          if (!(r >= 5)) throw Error('drone orbit <x> <y> <radius m, at least 5> [speed m/s]');
          if (!(sp > 0)) throw Error('orbit speed must be above 0 m/s');
          drone.orbit = { c, r, speed: sp, dir: 1 }; drone.mode = 'orbit'; planVersion++;
          return `drone orbiting ${c.join(' ')} m at ${r} m radius, ${Math.min(sp, drone.speedLimit).toFixed(1)} m/s`;
        }
        if (w === 'overlap') {
          const f = num(args[1]), s = num(args[2]);
          if (!(f >= 0 && f < 95 && s >= 0 && s < 95)) throw Error('drone overlap <front %> <side %>, each 0 to 94, for example drone overlap 75 65');
          dp.overlap = { front: f, side: s }; return `survey overlap ${f}% front, ${s}% side`;
        }
        if (w === 'survey') {
          need();
          const ns = args.slice(1).map(num);
          if (ns.length < 6 || ns.length % 2 || !ns.every(Number.isFinite)) throw Error('drone survey x1 y1 x2 y2 x3 y3 ... (a boundary of at least three corners)');
          const b = [];
          for (let i = 0; i < ns.length; i += 2) b.push([ns[i], ns[i + 1]]);
          const plan = planSurvey(b, { height: drone.hold, camera: dp.camera, overlap: dp.overlap });
          drone.survey = plan; drone.wp = 0; drone.mode = 'survey'; planVersion++;
          const mins = plan.length / Math.min(drone.speedLimit, dp.maxSpeed) / 60;
          emit('survey', { lanes: plan.lanes, spacing: plan.spacing, photoStep: plan.photoStep, photos: plan.photos, length: plan.length, height: plan.height });
          return `survey: ${plan.lanes} lanes ${plan.spacing.toFixed(1)} m apart, ${plan.photos} photos, ${(plan.length / 1000).toFixed(2)} km, about ${mins.toFixed(0)} min (illustrative)`;
        }
        if (w === 'view') {
          viewing = !viewing;
          emit('view', { on: viewing, speed: AERIAL_VIEW.speed, slow: AERIAL_VIEW.slow, clearance: AERIAL_VIEW.clearance });
          return viewing ? 'drone view: you are the drone; height, legal note and footprint follow you' : 'drone view off';
        }
        throw Error('drone launch | land | hover | hold <m> | goto <x> <y> | speed <m/s> | wind <m/s> <from> | orbit <x> <y> <r> | survey <x y ...> | overlap <f> <s> | view | status');
      }
    }];
  },
  dispose() { api = null; drone = null; viewing = false; trail = []; cache = new Map(); }
};
