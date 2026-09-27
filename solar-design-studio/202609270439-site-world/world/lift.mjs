// Up and Down (drone): hold to climb or sink; a quick tap moves TAP_M, so a tap is never lost.
export const TAP_MS = 250, TAP_M = 10;

// buttons: elements with data-lift="1" or "-1". setLift(dir): held climb rate (0 stops). tap(dir): one quick step.
export function attachLift(buttons, { setLift, tap, now = () => performance.now() }) {
  for (const b of buttons) {
    let down = 0;
    const hold = e => {
      e.preventDefault(); down = now();
      try { b.setPointerCapture(e.pointerId); } catch { /* synthetic or finished pointer */ }
      setLift(Number(b.dataset.lift));
    };
    const release = e => {
      if (!down) return;
      const quick = e.type === 'pointerup' && now() - down < TAP_MS;
      down = 0; setLift(0);
      if (quick) tap(Number(b.dataset.lift));
    };
    b.addEventListener('pointerdown', hold);
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(t, release);
  }
}
