// Input: keyboard, mouse and touch turned into one small state. Knows nothing about the world.
// Keys: W A S D or arrows move (left/right arrows turn), Shift held = slow and precise,
// C crouched, V raised, F aerial (Space / E up, Q down). Mouse: drag to look.
// Touch: left half of the screen is a thumbstick, right half looks.

const VIEW_KEYS = { KeyC: 'crouched', KeyV: 'raised', KeyF: 'aerial' };
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyQ', 'Space', 'ShiftLeft', 'ShiftRight',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const LOOK_PER_PX = 0.004, TURN_PER_S = 1.8, STICK_PX = 60;

export function attachInput(canvas, { onChange, onLook, onView }) {
  const keys = new Set();
  let stick = null, lookPtr = null, mouse = null;

  const set = (k, down) => { const had = keys.has(k); down ? keys.add(k) : keys.delete(k); if (had !== down) onChange(); };
  addEventListener('keydown', e => {
    if (e.target instanceof HTMLButtonElement && (e.code === 'Space' || e.code === 'Enter')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser shortcuts such as Ctrl+F alone
    if (VIEW_KEYS[e.code] && !e.repeat) { onView(VIEW_KEYS[e.code]); return; }
    if (MOVE_KEYS.has(e.code)) { set(e.code, true); e.preventDefault(); }
  });
  addEventListener('keyup', e => set(e.code, false));
  addEventListener('blur', () => { keys.clear(); stick = lookPtr = mouse = null; onChange(); });

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    if (e.pointerType === 'touch' && e.clientX < canvas.clientWidth / 2 && !stick) stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 };
    else if (e.pointerType === 'touch') lookPtr = { id: e.pointerId, x: e.clientX, y: e.clientY };
    else mouse = { x: e.clientX, y: e.clientY };
    onChange();
  });
  canvas.addEventListener('pointermove', e => {
    if (stick && e.pointerId === stick.id) { stick.dx = e.clientX - stick.x0; stick.dy = e.clientY - stick.y0; onChange(); return; }
    const p = lookPtr && e.pointerId === lookPtr.id ? lookPtr : mouse;
    if (!p) return;
    if (p === mouse && e.buttons === 0) { mouse = null; return; } // released outside the window
    onLook((e.clientX - p.x) * LOOK_PER_PX, -(e.clientY - p.y) * LOOK_PER_PX);
    p.x = e.clientX; p.y = e.clientY;
  });
  const up = e => {
    if (stick && e.pointerId === stick.id) stick = null;
    else if (lookPtr && e.pointerId === lookPtr.id) lookPtr = null;
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
        strafe: clamp(axis(['KeyD'], ['KeyA']) + s[0]),
        rise: axis(['Space', 'KeyE'], ['KeyQ']),
        turn: axis(['ArrowRight'], ['ArrowLeft']) * TURN_PER_S,
        slow: any(['ShiftLeft', 'ShiftRight'])
      };
    },
    active() { const i = this.get(); return !!(i.forward || i.strafe || i.rise || i.turn); }
  };
}

const clamp = v => Math.max(-1, Math.min(1, v));
