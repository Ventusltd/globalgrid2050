// body pack (world.pack.v1): how the viewer moves on foot. Walk, run (Shift held), jump (Space), stand and land on
// solids, and an optional footstep camera bob (off by default). One self-contained module: no imports.
//
// The jump is a port of the world's own Walk jump (same numbers, same rules): real gravity, a tap reaching
// V0^2/2G, a held press pushing a little higher, coyote time off an edge, a press buffer before touchdown, landing on
// measured ground or on a solid's top, and a critically damped landing dip. Running is new here.
//
// Deterministic: time is the sum of the fixed steps it is given; there is no clock and no random number.
// Local metres: x east, y north, z up. The pose is the eye: feet + EYE (+ landing dip, + bob when switched on).
// Everything here is ILLUSTRATIVE: a plausible, simple model of a person moving, not a biomechanical simulation.
//
// Numbers (SI):
//   G 9.81 m/s^2 (standard gravity, rounded). V0 3.0 m/s take-off: apex V0^2/2G = 0.459 m, air time 2 V0/G = 0.612 s.
//   Held past GRACE_S (0.1 s) the legs push PUSH m/s^2 more until the predicted apex reaches MAX_APEX_M (0.60 m).
//   COYOTE_S 0.1 s: a jump still starts just after walking off an edge. BUFFER_S 0.1 s: a press just before landing
//   jumps again on touchdown. Landing dips the eye about 1.4 cm per m/s of impact (cap 6 cm), critically damped
//   (OMEGA 45 rad/s: deepest at 22 ms, within 7 % by 120 ms).
//   WALK 1.4 m/s: a preferred adult walking speed in published gait studies (for example J. Appl. Physiol. 100,
//   2006). RUN_MIN 3.5 m/s to RUN_MAX 6.0 m/s: holding run, the wanted speed builds from a jog to a run along
//   1 - exp(-t / RUN_BUILD_S). Speed follows the wanted speed as v(t) = v_want (1 - exp(-t / tau)), the exponential
//   form measured for sprint starts (Proc. R. Soc. Lond. B 102, 1927); tau here (TAU_UP 0.6 s, TAU_DOWN 0.3 s) is
//   chosen for a casual start and stop, not measured.
//   Bob (off by default): the eye dips up to BOB_WALK_M (2 cm) walking and BOB_RUN_M (4 cm) running, once per step of
//   STEP_WALK_M (0.7 m) to STEP_RUN_M (1.4 m), eased back to level when still. Chosen values, not measured.

export const G = 9.81, V0 = 3.0, GRACE_S = 0.1, PUSH = 6.0, MAX_HOLD_S = 0.35, MAX_APEX_M = 0.6;
export const COYOTE_S = 0.1, BUFFER_S = 0.1;
export const OMEGA = 45, DIP_PER_MS = 1.43, DIP_MAX_M = 0.06, SETTLE_S = 0.15;
export const EYE = 1.7, BODY = Object.freeze({ radius: 0.3, below: 1.7, above: 0.1 });
export const STEP_UP_M = 0.05;   // a top this far above the feet still counts as underfoot (no stepping onto a table)
export const DROP_M = 0.3;       // a drop this small is walked down (a kerb); a bigger one is a fall
export const TOP_GAP_M = 1e-4;   // stand this far above a solid's top, so the body never counts as inside it
export const TELEPORT_M = 5;     // the world moved the viewer further than this in one step (Find, a tour): start there
export const WALK = 1.4, RUN_MIN = 3.5, RUN_MAX = 6.0, RUN_BUILD_S = 2.0, TAU_UP = 0.6, TAU_DOWN = 0.3;
export const BOB_WALK_M = 0.02, BOB_RUN_M = 0.04, STEP_WALK_M = 0.7, STEP_RUN_M = 1.4, BOB_EASE_S = 0.2;

export const apexOf = (v = V0, g = G) => (v * v) / (2 * g);
export const airTimeOf = (v = V0, g = G) => (2 * v) / g;
// The wanted running speed after holding run for t seconds.
export const runWant = (t, lo = RUN_MIN, hi = RUN_MAX) => lo + (hi - lo) * (1 - Math.exp(-Math.max(0, t) / RUN_BUILD_S));
// The eye's landing dip (m, negative = down) t seconds after touchdown at impact speed vi.
export function dipAt(t, vi) {
  if (!(t >= 0)) return 0;
  const v0 = Math.min(DIP_PER_MS * Math.abs(vi), DIP_MAX_M * OMEGA * Math.E);
  return -v0 * t * Math.exp(-OMEGA * t);
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = v => (Number.isFinite(v) ? v : 0);

// True when a body with its eye at [x, y, z] overlaps a solid box.
export function blocked([x, y, z], solids, body = BODY) {
  for (const b of solids) {
    if (x > b.min[0] - body.radius && x < b.max[0] + body.radius &&
        y > b.min[1] - body.radius && y < b.max[1] + body.radius &&
        z - body.below < b.max[2] && z + body.above > b.min[2]) return true;
  }
  return false;
}

// What the feet rest on at (x, y): the ground, or the highest solid top under the footprint that is not above the feet
// by more than STEP_UP_M.
export function supportAt(x, y, feetZ, heightAt, solids = [], radius = BODY.radius) {
  let s = num(heightAt(x, y)), onSolid = false;
  for (const b of solids) {
    if (x <= b.min[0] - radius || x >= b.max[0] + radius || y <= b.min[1] - radius || y >= b.max[1] + radius) continue;
    const top = b.max[2] + TOP_GAP_M;
    if (top > s && top <= feetZ + STEP_UP_M) { s = top; onSolid = true; }
  }
  return { z: s, onSolid };
}

// The body: pure state plus step(dt, input, heightAt, solids). input: { forward, strafe (-1..1), run, jump (held) }.
// yaw: radians from north towards east (forward is [sin yaw, cos yaw]).
export function createBody({ at = [0, 0, 0], yaw = 0, walk = WALK, runMin = RUN_MIN, runMax = RUN_MAX, bob = false } = {}) {
  let feet = [num(at[0]), num(at[1]), num(at[2])];
  let vel = [0, 0], t = 0, runT = 0, air = null, pressT = -Infinity, holding = false, dip = null;
  let jumps = 0, wasJump = false, bobOn = !!bob, dist = 0, bobAmp = 0, placed = false;
  const landings = [], events = [];

  const dipNow = () => (dip ? dipAt(t - dip.t0, dip.vi) : 0);
  const speed = () => Math.hypot(vel[0], vel[1]);
  const stepLen = () => STEP_WALK_M + (STEP_RUN_M - STEP_WALK_M) * clamp((speed() - walk) / (runMax - walk), 0, 1);
  const bobNow = () => (bobOn ? -bobAmp * (1 - Math.cos((2 * Math.PI * dist) / stepLen())) / 2 : 0);

  function place(p, heightAt, solids) {
    const guess = Number.isFinite(p[2]) ? p[2] - EYE : num(heightAt(p[0], p[1]));
    feet = [p[0], p[1], supportAt(p[0], p[1], guess, heightAt, solids).z]; vel = [0, 0]; air = null; dip = null; runT = 0; placed = true;
  }

  const takeOff = () => {
    air = { vz: V0, t0: t, feet0: feet[2], coyote: false, top: 0 };
    pressT = -Infinity; dip = null; jumps++;
    events.push({ topic: 'jumped', data: { t, speed: speed() } });
  };

  // Horizontal move by (dx, dy) at eye height z, sliding along solids; returns the new [x, y].
  function slide(dx, dy, z, solids) {
    const [x, y] = feet;
    if (!blocked([x + dx, y + dy, z], solids)) return [x + dx, y + dy];
    if (!blocked([x + dx, y, z], solids)) { vel[1] = 0; return [x + dx, y]; }
    if (!blocked([x, y + dy, z], solids)) { vel[0] = 0; return [x, y + dy]; }
    vel = [0, 0]; return [x, y];
  }

  function fly(dt, heightAt, solids) {
    const a = air, since = t - a.t0;
    let acc = -G;
    if (holding && !a.coyote && a.vz > 0 && since >= GRACE_S && since < MAX_HOLD_S && feet[2] - a.feet0 + a.vz * a.vz / (2 * G) < MAX_APEX_M) acc += PUSH;
    let vz = a.vz + acc * dt, z = feet[2] + a.vz * dt + 0.5 * acc * dt * dt;
    if (acc > -G && vz > 0) {                                           // pushing: never past MAX_APEX_M
      const over = z - a.feet0 + vz * vz / (2 * G) - MAX_APEX_M;
      if (over > 0) vz = Math.sqrt(Math.max(0, vz * vz - 2 * G * over));
    }
    const [x, y] = slide(vel[0] * dt, vel[1] * dt, z + EYE, solids);
    if (vz > 0 && blocked([x, y, z + EYE], solids)) { z = feet[2]; vz = 0; } // head against something above
    a.top = Math.max(a.top, z - a.feet0);
    const s = supportAt(x, y, Math.max(feet[2], z), heightAt, solids);
    if (vz <= 0 && z <= s.z) {                                          // touchdown on the ground or a solid top
      air = null; feet = [x, y, s.z]; dip = { t0: t + dt, vi: -vz };
      const land = { t: t + dt, airTime: t + dt - a.t0, apex: a.top, vi: -vz, onSolid: s.onSolid, feet: s.z };
      landings.push(land); if (landings.length > 8) landings.shift();
      events.push({ topic: 'landed', data: land });
    } else { a.vz = vz; feet = [x, y, z]; }
  }

  // One fixed step of dt seconds.
  function step(dt, input = {}, heightAt = () => 0, solids = []) {
    if (!placed) place([feet[0], feet[1], NaN], heightAt, solids);
    const jumpHeld = !!input.jump;
    if (jumpHeld && !wasJump) { holding = true; pressT = t; }
    if (!jumpHeld && wasJump) holding = false;
    wasJump = jumpHeld;
    if (input.yaw !== undefined && Number.isFinite(input.yaw)) yaw = input.yaw;

    // Wanted velocity from the move axes, the heading and the gait.
    const f = clamp(num(input.forward), -1, 1), sd = clamp(num(input.strafe), -1, 1), len = Math.hypot(f, sd);
    const running = !!input.run && len > 0;
    runT = running ? runT + dt : 0;
    const want = len > 0 ? (running ? runWant(runT, runMin, runMax) : walk) : 0;
    const k = len > 1 ? 1 / len : 1, s = Math.sin(yaw), c = Math.cos(yaw);
    const wx = (s * f + c * sd) * k * want, wy = (c * f - s * sd) * k * want;

    const t1 = t + dt;
    if (t1 - pressT <= BUFFER_S && (!air || (air.coyote && pressT - air.t0 <= COYOTE_S))) takeOff();
    if (air) {
      fly(dt, heightAt, solids); t = t1;
      if (!air && t - pressT <= BUFFER_S) takeOff();                    // pressed just before touchdown
      return;
    }
    // On the ground: speed eases towards the wanted velocity (exact exponential for a fixed target).
    const tau = Math.hypot(wx, wy) > speed() ? TAU_UP : TAU_DOWN, e = 1 - Math.exp(-dt / tau);
    vel[0] += (wx - vel[0]) * e; vel[1] += (wy - vel[1]) * e;
    if (!(len > 0) && speed() < 1e-3) vel = [0, 0];
    const [x0, y0] = feet;
    const [x, y] = slide(vel[0] * dt, vel[1] * dt, feet[2] + EYE, solids);
    const sup = supportAt(x, y, feet[2], heightAt, solids);               // measured ground always counts: hills are walked
    const moved = Math.hypot(x - x0, y - y0);
    t = t1;
    dist += moved;
    const amp = bobOn ? (BOB_WALK_M + (BOB_RUN_M - BOB_WALK_M) * clamp((speed() - walk) / (runMax - walk), 0, 1)) * (speed() > 0.05 ? 1 : 0) : 0;
    bobAmp += (amp - bobAmp) * (1 - Math.exp(-dt / BOB_EASE_S));
    if (bobAmp < 1e-5 && amp === 0) { bobAmp = 0; dist = 0; }
    if (feet[2] - sup.z > DROP_M + moved) {                              // walked off an edge: fall, with coyote time
      air = { vz: 0, t0: t, feet0: feet[2], coyote: true, top: 0 };
      feet = [x, y, feet[2]];
    } else feet = [x, y, sup.z];
    if (dip && t - dip.t0 > SETTLE_S) dip = null;
  }

  return {
    step,
    // Called between steps: keep the feet on what is underfoot (ground can stream in late).
    settle(heightAt = () => 0, solids = []) {
      if (!placed) { place([feet[0], feet[1], NaN], heightAt, solids); return; }
      if (air) return;
      feet[2] = supportAt(feet[0], feet[1], feet[2], heightAt, solids).z;
    },
    press() { holding = true; pressT = t; },
    release() { holding = false; },
    place,
    // Moves the body to (x, y); the next step or settle puts the feet on what is there.
    unplace(x, y) { feet = [x, y, feet[2]]; vel = [0, 0]; air = null; dip = null; pressT = -Infinity; runT = 0; placed = false; },
    setYaw(v) { if (Number.isFinite(v)) yaw = v; },
    setBob(v) { bobOn = !!v; if (!bobOn) { bobAmp = 0; dist = 0; } },
    eye: () => [feet[0], feet[1], feet[2] + EYE + dipNow() + bobNow()],
    feet: () => feet.slice(),
    speed,
    airborne: () => !!air,
    // Frames are needed while moving, in the air, while a press waits and while the eye settles after a landing.
    busy: () => speed() > 0 || !!air || t - pressT <= BUFFER_S || (!!dip && t - dip.t0 <= SETTLE_S) || bobAmp > 0,
    take: () => events.splice(0),
    state: () => ({ t, pos: feet.slice(), vel: vel.slice(), yaw, speed: speed(), runT, airborne: !!air, vz: air ? air.vz : 0, rise: air ? feet[2] - air.feet0 : 0,
      holding, jumps, dip: dipNow(), bob: bobNow(), bobOn, landings: landings.slice() })
  };
}

// ---------------------------------------------------------------- the pack

let api = null, on = true, body = null, cfg = {}, lastCtx = null, adopt = 'first', lastEmit = null, typed = { forward: 0, strafe: 0, run: false }, jumpTicks = 0;
const gait = b => (b.airborne() ? 'in the air' : b.speed() < 0.05 ? 'standing' : b.speed() > (cfg.walk ?? WALK) + 0.3 ? 'running' : 'walking');
const yawOf = dir => (Array.isArray(dir) && Math.hypot(dir[0], dir[1]) > 1e-9 ? Math.atan2(dir[0], dir[1]) : undefined);
const numbers = a => a.map(Number);

function make() {
  const c = cfg;
  body = createBody({
    at: Array.isArray(c.at) ? c.at : [0, 0, 0], yaw: Number.isFinite(c.yaw) ? c.yaw : 0,
    walk: Number.isFinite(c.walk) ? c.walk : WALK, runMin: Number.isFinite(c.runMin) ? c.runMin : RUN_MIN,
    runMax: Number.isFinite(c.runMax) ? c.runMax : RUN_MAX, bob: c.bob === true
  });
  lastCtx = null; adopt = Array.isArray(c.at) ? 'teleport' : 'first';
}

export default {
  id: 'body',
  init(a) {
    api = a;
    const c = a.config || {};
    cfg = {};
    if (Array.isArray(c.at) && c.at.length >= 2 && c.at.slice(0, 2).every(Number.isFinite)) cfg.at = [c.at[0], c.at[1], NaN];
    for (const k of ['yaw', 'walk', 'runMin', 'runMax']) if (Number.isFinite(c[k]) && (k === 'yaw' || c[k] > 0)) cfg[k] = c[k];
    if (!(cfg.runMin > (cfg.walk ?? WALK))) delete cfg.runMin;
    if (!(cfg.runMax >= (cfg.runMin ?? RUN_MIN))) delete cfg.runMax;
    if (c.bob === true) cfg.bob = true;
    if (c.input && typeof c.input === 'object') typed = { forward: clamp(num(c.input.forward), -1, 1), strafe: clamp(num(c.input.strafe), -1, 1), run: !!c.input.run };
    make();
    a.events.on('world/toggle', () => {});
  },
  setEnabled(v) { on = !!v; if (!on) { typed = { forward: 0, strafe: 0, run: false }; jumpTicks = 0; } },
  // One fixed step. ctx: { pos, dir, heightAt, solids?, input? }. The world's held keys come in ctx.input
  // ({ forward, strafe, run, jump }); without it, the typed commands drive the body.
  step(dt, ctx = {}) {
    if (!body) return;
    const heightAt = typeof ctx.heightAt === 'function' ? ctx.heightAt : () => 0;
    const solids = Array.isArray(ctx.solids) ? ctx.solids : [];
    // The world moved the viewer itself (Find, a tour, the first step): start from there.
    const p = Array.isArray(ctx.pos) && ctx.pos.slice(0, 3).every(Number.isFinite) ? ctx.pos : null;
    if (p && (adopt === 'first' || (lastCtx && Math.hypot(p[0] - lastCtx[0], p[1] - lastCtx[1]) > TELEPORT_M &&
        Math.hypot(p[0] - body.feet()[0], p[1] - body.feet()[1]) > TELEPORT_M))) { body.place([p[0], p[1], p[2]], heightAt, solids); adopt = 'teleport'; }
    if (p) lastCtx = p.slice(0, 3);
    const i = ctx.input && typeof ctx.input === 'object' ? ctx.input : typed;
    const input = { forward: i.forward, strafe: i.strafe, run: !!i.run, jump: !!i.jump || jumpTicks > 0, yaw: yawOf(ctx.dir) };
    if (jumpTicks > 0) jumpTicks--;
    const before = body.state();
    body.step(dt, input, heightAt, solids);
    if (api) {
      for (const e of body.take()) api.events.emit(e.topic, e.data);
      const eye = body.eye(), st = body.state();
      if (!lastEmit || Math.hypot(eye[0] - lastEmit[0], eye[1] - lastEmit[1], eye[2] - lastEmit[2]) > 1e-6 || st.airborne !== before.airborne) {
        lastEmit = eye;
        api.events.emit('pose', { pos: eye, yaw: st.yaw, speed: st.speed, gait: gait(body), airborne: st.airborne });
      }
    }
  },
  active() {
    if (!on || !body) return false;
    return body.busy() || typed.forward !== 0 || typed.strafe !== 0 || jumpTicks > 0;
  },
  hud() {
    if (!body) return [];
    const s = body.state(), g = gait(body);
    const lines = [{ id: 'gait', text: `${g}, ${s.speed.toFixed(1)} m/s${s.bobOn ? ', bob on' : ''}` }];
    if (s.airborne) lines.push({ id: 'jump', text: `jump ${s.rise.toFixed(2)} m, rising ${s.vz.toFixed(1)} m/s` });
    else if (s.landings.length) { const l = s.landings.at(-1); lines.push({ id: 'jump', text: `last jump ${l.apex.toFixed(2)} m high, ${l.airTime.toFixed(2)} s in the air` }); }
    return lines;
  },
  commands() {
    return [
      {
        verb: 'jump',
        run(args) {
          const w = (args[0] || '').toLowerCase();
          if (!w) { body.press(); body.release(); return `jump (${apexOf().toFixed(2)} m on level ground)`; }
          if (w === 'high') { jumpTicks = Math.round(MAX_HOLD_S / (api?.fixedDt || 1 / 60)); return `jump, held for ${MAX_APEX_M.toFixed(2)} m`; }
          throw Error('jump, or jump high (held for the full push)');
        }
      },
      {
        verb: 'run',
        run(args) {
          const w = (args[0] || '').toLowerCase();
          if (w === 'on' || (w === '' && !typed.run)) typed.run = true;
          else if (w === 'off' || w === '') typed.run = false;
          else throw Error('run, run on or run off');
          return typed.run ? `running: ${RUN_MIN}-${RUN_MAX} m/s while moving` : `walking: ${cfg.walk ?? WALK} m/s`;
        }
      },
      {
        verb: 'body',
        run(args) {
          const w = (args[0] || '').toLowerCase();
          if (!w) { const s = body.state(); return `${gait(body)} ${s.speed.toFixed(1)} m/s at ${s.pos.map(v => v.toFixed(1)).join(' ')} m`; }
          if (w === 'move') {
            const [f, s] = numbers(args.slice(1, 3));
            if (!Number.isFinite(f) || (args[2] !== undefined && !Number.isFinite(s))) throw Error('body move needs numbers from -1 to 1: body move 1  ·  body move 0 -1');
            typed.forward = clamp(f, -1, 1); typed.strafe = clamp(num(s), -1, 1);
            return `moving ${typed.forward} forward, ${typed.strafe} right`;
          }
          if (w === 'stop') { typed.forward = 0; typed.strafe = 0; typed.run = false; return 'stopping'; }
          if (w === 'bob') {
            const v = (args[1] || '').toLowerCase();
            if (v !== 'on' && v !== 'off') throw Error('body bob on or body bob off');
            body.setBob(v === 'on'); return `footstep bob ${v}`;
          }
          if (w === 'at') {
            const [x, y] = numbers(args.slice(1, 3));
            if (!Number.isFinite(x) || !Number.isFinite(y)) throw Error('body at needs two numbers in local metres: body at 10 20');
            body.unplace(x, y); adopt = 'teleport'; lastCtx = null;
            return `standing at ${x} ${y} m`;
          }
          throw Error('body, body move <forward> [right], body stop, body bob on|off or body at <x> <y>');
        }
      }
    ];
  },
  dispose() { api = null; body = null; lastCtx = null; adopt = 'first'; lastEmit = null; typed = { forward: 0, strafe: 0, run: false }; jumpTicks = 0; }
};
