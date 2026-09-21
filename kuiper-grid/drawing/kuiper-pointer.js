// Native Kuiper pointer runtime, extracted from the public tests cartridge. See SOURCE-PROVENANCE.json.
// TOUCH. Every pointer that is down is held in one map, so one finger drags and two pinch, and a
// mouse is just a pointer with one finger. The pinch keeps the world point between the fingers
// under the fingers, which is the same rule the wheel already obeys, so zooming in on a phone and
// on a desktop land on the same key.
const ZMAX = 60;
let drag = null, moved = 0, pinch = null;
const pts = new Map();
function pinchNow(){ const v = [...pts.values()], a = v[0], b = v[1];
  return { d:Math.hypot(a.x-b.x, a.y-b.y), mx:(a.x+b.x)/2, my:(a.y+b.y)/2 }; }
cv.addEventListener('pointerdown', e => {
  pts.set(e.pointerId, { x:e.clientX, y:e.clientY });
  if (pts.size === 2) { const s = pinchNow(), w = toWorld(s.mx, s.my); pinch = { d0:s.d, z0:zoom, wx:w[0], wy:w[1] }; drag = null; moved = 99; }
  else if (pts.size === 1) { drag = [e.clientX, e.clientY]; moved = 0; }
});
addEventListener('pointermove', e => {
  if (pts.has(e.pointerId)) pts.set(e.pointerId, { x:e.clientX, y:e.clientY });
  if (pinch && pts.size >= 2) { const s = pinchNow(); if (pinch.d0 > 1) {
      zoom = Math.max(1e-4, Math.min(ZMAX, pinch.z0 * s.d / pinch.d0));
      cx = pinch.wx - (s.mx - innerWidth/2)/zoom; cy = pinch.wy + (s.my - innerHeight/2)/zoom;
      atHome = false; tween = null; dirty = true; } return; }
  if (!drag) return; moved += Math.abs(e.clientX-drag[0]) + Math.abs(e.clientY-drag[1]);
  cx -= (e.clientX-drag[0])/zoom; cy += (e.clientY-drag[1])/zoom; drag = [e.clientX, e.clientY];
  atHome = false; tween = null; dirty = true; });
function pointerGone(e){ pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (pts.size === 0) drag = null; }
