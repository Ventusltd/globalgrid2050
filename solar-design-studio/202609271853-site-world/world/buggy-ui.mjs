// buggy-ui.mjs: driving the site buggy (loaded on first use by buggy-mount.mjs). While mounted, the substrate hands
// each frame to this driver (api.setDriver): the physics steps at a fixed 120 Hz (buggy-physics.mjs) on the ground
// everyone stands on (api.heightAt: the LiDAR with the design's trenches cut in), the solids stop it, and the view
// is a chase camera or the driver's seat (C, or the chip in the readout). Keys: W / S or up / down drive and brake
// then reverse, A / D or left / right steer, Space brakes, E gets off. Phones: the joypad drives.
// A parked, settled buggy asks for no frames (0 fps); the buggy stays where it was left and is drawn there.

import { createBuggy, advance, parked, readout, params, GROUNDS, X, Y, PSI, V, Z, TH, PH } from './buggy-physics.mjs';
import { PITCH_LIMIT } from './views.mjs';

const TURN_PER_S = 1.8;                 // input.mjs: a full turn input reads 1.8 rad/s; the buggy reads it as full lock
const CHASE = { dist: 7, pitch: -0.22, aim: 0.8 }, SEAT = { fwd: -0.15, up: 1.0 }, EYE_WALK = 1.7;
const REACH_M = 8;                      // E within this of the parked buggy gets back on it; further, a new one comes
const COLOR = [1, 0.78, 0.45, 1];
const CSS = `#buggy-hud { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(var(--foot) + 8px); max-width: calc(100vw - 24px);
  box-sizing: border-box; background: var(--panel); border: 1px solid var(--edge); border-radius: 6px; padding: 4px 8px; font-size: 11px;
  display: flex; flex-wrap: wrap; gap: 2px 10px; align-items: center; }
#buggy-hud[hidden] { display: none; } #buggy-hud b { color: #ffc773; font-weight: 600; } #buggy-hud .dim { color: var(--dim); }
#buggy-hud .warn { flex-basis: 100%; color: #ffb27a; } #buggy-hud .danger { flex-basis: 100%; color: #ff5a5a; font-weight: 600; }
#buggy-hud .warn:empty, #buggy-hud .danger:empty { display: none; }
#buggy-hud button { background: none; color: var(--dim); border: 1px solid var(--edge); border-radius: 10px; font: inherit; padding: 1px 8px; cursor: pointer; }
@media (pointer: coarse) { #buggy-hud { bottom: auto; top: calc(var(--btn) + 40px); } #buggy-hud button { min-height: 32px; } }`;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dir = (yaw, pitch) => [Math.sin(yaw) * Math.cos(pitch), Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch)];

// The buggy as lines, relative to its body point; (a forward, b right, h up) in the body's frame, pitched and rolled.
export function buggyLines(bug) {
  const s = bug.s, sp = Math.sin(s[PSI]), cp = Math.cos(s[PSI]), th = s[TH], ph = s[PH], out = [];
  const P = (a, b, h) => [a * sp + b * cp, a * cp - b * sp, h + a * th - b * ph];
  const seg = (p, q) => out.push(...p, ...q);
  const box = (a0, a1, b, h0, h1) => { // an open frame: two side rectangles joined across
    for (const bb of [-b, b]) { seg(P(a0, bb, h0), P(a1, bb, h0)); seg(P(a0, bb, h1), P(a1, bb, h1)); seg(P(a0, bb, h0), P(a0, bb, h1)); seg(P(a1, bb, h0), P(a1, bb, h1)); }
    for (const [a, h] of [[a0, h0], [a1, h0], [a0, h1], [a1, h1]]) seg(P(a, -b, h), P(a, b, h));
  };
  const L = bug.P.length / 2, W = bug.P.width / 2;
  box(-L, L, W, -0.1, 0.25);            // chassis and bed sides
  box(0.55, L, W - 0.05, 0.25, 0.5);    // bonnet
  box(-0.55, 0.45, W - 0.05, 0.25, 1.55); // roll cage
  seg(P(0.45, -W + 0.05, 1.55), P(0.75, -W + 0.1, 0.5)); seg(P(0.45, W - 0.05, 1.55), P(0.75, W - 0.1, 0.5)); // windscreen posts
  const h = bug.last?.k?.h || [0, 0, 0, 0], a = bug.P.wheelbase / 2, b = bug.P.track / 2, r = 0.3;
  [[a, -b], [a, b], [-a, -b], [-a, b]].forEach(([wa, wb], i) => { // wheels stand on the ground under them
    const c = P(wa, wb, 0), cz = h[i] + r - s[Z];
    for (let k = 0; k < 10; k++) {
      const q = t => { const u = Math.cos(t) * r, w = Math.sin(t) * r; return [c[0] + u * sp, c[1] + u * cp, cz + w]; };
      seg(q(k * Math.PI / 5), q((k + 1) * Math.PI / 5));
    }
  });
  return new Float32Array(out);
}

// The view: chase (behind and above, easing round to the heading) or the driver's seat. The walker's yaw and pitch
// carry what the mouse or a finger dragged; the camera eases back to the heading while the buggy moves.
export function cameraFor(bug, view, cam, dt, heightAt, userPitch) {
  const s = bug.s, moving = Math.abs(s[V]) > 0.3;
  let yaw = view.yaw;
  if (moving) yaw = wrap(yaw + wrap(s[PSI] - yaw) * Math.min(1, 3 * dt));
  if (cam === 'seat') {
    const sp = Math.sin(s[PSI]), cp = Math.cos(s[PSI]);
    const pos = [s[X] + SEAT.fwd * sp, s[Y] + SEAT.fwd * cp, s[Z] + SEAT.up + SEAT.fwd * s[TH]];
    return { pos, yaw, pitch: clamp(userPitch + Math.atan(s[TH]), -PITCH_LIMIT, PITCH_LIMIT) };
  }
  const pitch = clamp(view.pitch, -1.2, 0.2), d = dir(yaw, pitch), aim = [s[X], s[Y], s[Z] + CHASE.aim];
  const pos = [aim[0] - CHASE.dist * d[0], aim[1] - CHASE.dist * d[1], aim[2] - CHASE.dist * d[2]];
  pos[2] = Math.max(pos[2], heightAt(pos[0], pos[1]) + 0.6); // never under a hill behind
  return { pos, yaw, pitch };
}

// deps: { api (substrate: state, setPose, setView, setDriver, heightAt, measuredAt, solids, origin, hooks, resumeGate), doc, chip }
export function createDriver({ api, doc = document, chip = null }) {
  let bug = null, mounted = false, cam = 'chase', over = {}, brake = false, userPitch = -0.08, lastOutPitch = 0;
  let seen = null, version = 0, cached = null, lastInput = {}, was = false;
  const heightAt = (x, y) => api.heightAt(x, y);
  const style = doc.createElement('style'); style.textContent = CSS; doc.head.append(style);
  const hud = doc.createElement('div'); hud.id = 'buggy-hud'; hud.hidden = true; hud.setAttribute('role', 'status');
  hud.innerHTML = '<b>Buggy</b><span class="read"></span><button type="button" class="cam"></button><span class="danger"></span><span class="warn"></span>';
  doc.body.append(hud);
  const camBtn = hud.querySelector('.cam');
  camBtn.addEventListener('click', () => { swapCam(); (doc.getElementById('view') || doc.body).focus?.(); });
  const typing = t => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || t?.isContentEditable;
  addEventListener('keydown', e => {
    if (!mounted || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    if (e.code === 'Space') { brake = true; api.gate.invalidate(); }
    if (e.code === 'KeyC' && !e.repeat) swapCam();
  });
  addEventListener('keyup', e => { if (e.code === 'Space') brake = false; });
  addEventListener('blur', () => { brake = false; });

  // setOrigin moves the site origin under us: the buggy keeps its place in the world.
  function follow() {
    const o = api.origin();
    if (bug && seen && (o.e !== seen.e || o.n !== seen.n)) { bug.s[X] -= o.e - seen.e; bug.s[Y] -= o.n - seen.n; version++; }
    seen = o;
  }
  function swapCam() {
    cam = cam === 'chase' ? 'seat' : 'chase';
    if (mounted) api.setPose({ pitch: cam === 'chase' ? CHASE.pitch : 0 });
    userPitch = -0.08; lastOutPitch = api.state().pitch;
    writeHud(); api.gate.invalidate();
  }
  function mount() {
    if (mounted) return;
    if (api.state().view !== 'standing') api.setView('standing');
    follow();
    const st = api.state();
    if (!bug || bug.tipped || Math.hypot(bug.s[X] - st.pos[0], bug.s[Y] - st.pos[1]) > REACH_M) { // a tipped one is righted
      bug = bug?.tipped && Math.hypot(bug.s[X] - st.pos[0], bug.s[Y] - st.pos[1]) <= REACH_M
        ? createBuggy(bug.s[X], bug.s[Y], bug.s[PSI], heightAt, over) : createBuggy(st.pos[0], st.pos[1], st.yaw, heightAt, over);
      version++;
    }
    mounted = true;
    api.setPose({ yaw: bug.s[PSI], pitch: cam === 'chase' ? CHASE.pitch : 0 });
    lastOutPitch = api.state().pitch; userPitch = -0.08;
    api.setDriver(driver);
    chip?.setAttribute('aria-pressed', 'true'); if (chip) chip.textContent = 'Get off';
    hud.hidden = false; writeHud();
  }
  // Getting off: the walker stands beside the driver's door, facing the way the buggy faces.
  function dismount(place = true) {
    if (!mounted) return;
    mounted = false; brake = false;
    api.setDriver(null);
    if (place && bug) {
      const s = bug.s, sp = Math.sin(s[PSI]), cp = Math.cos(s[PSI]), x = s[X] - 1.4 * cp, y = s[Y] + 1.4 * sp;
      api.setPose({ pos: [x, y, heightAt(x, y) + EYE_WALK], yaw: s[PSI], pitch: -0.12 });
    }
    chip?.setAttribute('aria-pressed', 'false'); if (chip) chip.textContent = 'Buggy';
    hud.hidden = true; api.gate.invalidate();
  }
  function writeHud() {
    if (!bug || hud.hidden) return;
    const r = readout(bug), P = bug.P, g = over.ground ? GROUNDS[over.ground].label : 'dry grass';
    const measured = Number.isFinite(api.measuredAt?.(bug.s[X], bug.s[Y]));
    hud.querySelector('.read').textContent = `${r.kmh.toFixed(0)} km/h (limit ${P.maxKmh}) · ${r.heading.toFixed(0).padStart(3, '0')}° ${r.compass} · ` +
      `gradient ${r.gradient.toFixed(0)} % (along ${r.along >= 0 ? '+' : ''}${r.along.toFixed(0)} %, side ${r.side.toFixed(0)} %) · ` +
      `${g}, grip ${P.mu} · ${measured ? 'LiDAR ground' : 'ground not measured here'} · illustrative`;
    hud.querySelector('.warn').textContent = r.warn.join(' · ');
    hud.querySelector('.danger').textContent = r.danger.join(' · ');
    camBtn.textContent = cam === 'chase' ? 'Seat view (C)' : 'Chase view (C)';
  }
  // Each frame while mounted (the substrate's draw calls this instead of the walk step).
  function frame(state, inp, intervalMs) {
    follow();
    lastInput = { forward: inp.forward || 0, steer: (inp.turn || 0) / TURN_PER_S, brake };
    const dt = Math.min(intervalMs / 1000, 0.1);
    if (advance(bug, lastInput, dt, heightAt, api.solids())) version++;
    if (cam === 'seat') { userPitch = clamp(userPitch + (state.pitch - lastOutPitch), -1.2, 1.2); }
    const c = cameraFor(bug, state, cam, dt, heightAt, userPitch);
    lastOutPitch = c.pitch;
    writeHud();
    const now = !parked(bug, lastInput);
    if (was && !now) queueMicrotask(() => api.resumeGate()); // settled: the frame gate stops asking for frames
    was = now;
    return { ...state, ...c };
  }
  const driver = { frame, moving: () => mounted && !!bug && !parked(bug, lastInput) };
  api.hooks.before.add(() => { if (mounted && api.state().view !== 'standing') dismount(false); }); // Drone takes over
  api.hooks.batches.add(() => {
    if (!bug) return [];
    follow();
    if (!cached || cached.version !== version) cached = { version, positions: buggyLines(bug) };
    return [{ key: 'buggy', version, positions: cached.positions, color: COLOR, origin: [bug.s[X], bug.s[Y], bug.s[Z]] }];
  });

  function command(p) {
    if (p.act === 'toggle') { mounted ? dismount() : mount(); return mounted ? onText() : 'Off the buggy; it stays parked where you left it.'; }
    if (p.act === 'on') { mount(); return onText(); }
    if (p.act === 'off') { dismount(); return 'Off the buggy; it stays parked where you left it.'; }
    if (p.act === 'seat' || p.act === 'chase') { if (cam !== p.act) swapCam(); return `${p.act === 'seat' ? "Driver's seat" : 'Chase'} view.`; }
    if (p.act === 'speed') over = { ...over, maxKmh: p.value };
    if (p.act === 'grip') over = { ...over, mu: p.value };
    if (p.act === 'ground') over = { ...over, ground: p.value, mu: GROUNDS[p.value].mu, crr: GROUNDS[p.value].crr };
    if (bug) { bug.P = params(over); writeHud(); }
    const P = params(over);
    return `Buggy: top speed ${P.maxKmh} km/h, ${over.ground ? GROUNDS[over.ground].label : 'dry grass'} grip ${P.mu}, rolling resistance ${P.crr} (assumed, illustrative).`;
  }
  const onText = () => { const P = bug.P; return `On the buggy: W / S or the pad drive, A / D steer, Space brakes, C swaps seat and chase views, E gets off. ` +
    `Top speed ${P.maxKmh} km/h, turning circle ${P.turnCircleM} m, grip ${P.mu} (assumed, illustrative).`; };

  return {
    toggle: () => (mounted ? dismount() : mount()), mount, dismount, command,
    debug: () => ({ mounted, loaded: true, cam, parked: bug ? parked(bug, lastInput) : null, steps: bug?.steps ?? 0,
      state: bug ? Array.from(bug.s) : null, readout: bug ? readout(bug) : null, params: bug ? { maxKmh: bug.P.maxKmh, mu: bug.P.mu, crr: bug.P.crr } : null })
  };
}
