// Input: keyboard, mouse and touch turned into one small state. Knows nothing about the world.
// Keys: W / S or up / down move, A / D or left / right turn, Shift held = slow and precise,
// F drone on and off (Space / E up, Q down). Mouse: drag to look.
// Touch: the joypad moves (up and down) and turns (sideways); dragging anywhere else looks.
// A press released within CLICK_PX of where it went down is a click: onClick(x, y) in canvas CSS pixels.

const VIEW_KEYS = { KeyF: 'aerial' };
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyQ', 'Space', 'ShiftLeft', 'ShiftRight',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const LOOK_PER_PX = 0.004, TURN_PER_S = 1.8, STICK_PX = 45, CLICK_PX = 4;

export function attachInput(canvas, pad, { onChange, onLook, onView, onClick = () => {} }) {
  const keys = new Set();
  let stick = null, lookPtr = null, mouse = null, lift = 0, press = null;

  const set = (k, down) => { const had = keys.has(k); down ? keys.add(k) : keys.delete(k); if (had !== down) onChange(); };
  addEventListener('keydown', e => {
    if (e.target instanceof HTMLButtonElement && (e.code === 'Space' || e.code === 'Enter')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser shortcuts such as Ctrl+F alone
    if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return; // typing in a form field
    if (VIEW_KEYS[e.code] && !e.repeat) { onView(VIEW_KEYS[e.code]); return; }
    if (MOVE_KEYS.has(e.code)) { set(e.code, true); e.preventDefault(); }
  });
  addEventListener('keyup', e => set(e.code, false));
  addEventListener('blur', () => { keys.clear(); stick = lookPtr = mouse = null; lift = 0; knob.style.transform = ''; onChange(); });

  // joypad: its centre is the rest position; the knob follows the thumb up to the rim
  const knob = pad.firstElementChild;
  const moveKnob = () => { knob.style.transform = stick ? `translate(${clampPx(stick.dx)}px, ${clampPx(stick.dy)}px)` : ''; };
  pad.addEventListener('pointerdown', e => {
    if (stick) return;
    capture(pad, e);
    const r = pad.getBoundingClientRect();
    stick = { id: e.pointerId, x0: r.left + r.width / 2, y0: r.top + r.height / 2, dx: 0, dy: 0 };
    stick.dx = e.clientX - stick.x0; stick.dy = e.clientY - stick.y0;
    moveKnob(); onChange(); e.preventDefault();
  });
  pad.addEventListener('pointermove', e => {
    if (!stick || e.pointerId !== stick.id) return;
    stick.dx = e.clientX - stick.x0; stick.dy = e.clientY - stick.y0; moveKnob(); onChange();
  });
  const release = e => { if (stick && e.pointerId === stick.id) { stick = null; moveKnob(); onChange(); } };
  pad.addEventListener('pointerup', release); pad.addEventListener('pointercancel', release);

  canvas.addEventListener('pointerdown', e => {
    capture(canvas, e);
    if (!press) press = { id: e.pointerId, x: e.clientX, y: e.clientY };
    if (e.pointerType === 'touch') lookPtr = { id: e.pointerId, x: e.clientX, y: e.clientY };
    else mouse = { x: e.clientX, y: e.clientY };
    onChange();
  });
  canvas.addEventListener('pointermove', e => {
    const p = lookPtr && e.pointerId === lookPtr.id ? lookPtr : mouse;
    if (!p) return;
    if (p === mouse && e.buttons === 0) { mouse = null; return; } // released outside the window
    onLook((e.clientX - p.x) * LOOK_PER_PX, -(e.clientY - p.y) * LOOK_PER_PX);
    p.x = e.clientX; p.y = e.clientY;
  });
  const up = e => {
    if (press && e.pointerId === press.id) {
      const click = e.type === 'pointerup' && Math.hypot(e.clientX - press.x, e.clientY - press.y) <= CLICK_PX;
      press = null;
      if (click) { const r = canvas.getBoundingClientRect(); onClick(e.clientX - r.left, e.clientY - r.top); }
    }
    if (lookPtr && e.pointerId === lookPtr.id) lookPtr = null;
    else mouse = null;
    onChange();
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);

  const any = list => list.some(k => keys.has(k));
  const axis = (plus, minus) => (any(plus) ? 1 : 0) - (any(minus) ? 1 : 0);
  return {
    // forward, strafe, rise in [-1, 1]; turn in radians per second; slow = precise movement
    get() {
      const s = stick ? [clamp(stick.dx / STICK_PX), clamp(-stick.dy / STICK_PX)] : [0, 0];
      return {
        forward: clamp(axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']) + s[1]),
        strafe: 0,
        rise: clamp(axis(['Space', 'KeyE'], ['KeyQ']) + lift),
        turn: clamp(axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']) + s[0]) * TURN_PER_S,
        slow: any(['ShiftLeft', 'ShiftRight'])
      };
    },
    active() { const i = this.get(); return !!(i.forward || i.strafe || i.rise || i.turn); },
    // held on-screen Up / Down buttons: +1, -1 or 0
    setLift(v) { if (lift !== v) { lift = v; onChange(); } }
  };
}

const clamp = v => Math.max(-1, Math.min(1, v));
const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ } };
const clampPx = v => Math.max(-STICK_PX, Math.min(STICK_PX, v));
