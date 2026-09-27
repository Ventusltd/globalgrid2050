// Frame gate: draw only when something changed, and while moving no faster than the mode's target.
// Standing still costs nothing: no frame is requested until the next change.

export const TOLERANCE_MS = 2; // a display tick can land a little early; 2 ms keeps 20 and 30 fps even on 60 and 120 Hz

export function due(now, last, fps) {
  return now - last >= 1000 / fps - TOLERANCE_MS;
}

export function createFrameGate(draw, { raf = requestAnimationFrame, clock = () => performance.now() } = {}) {
  let dirty = false, moving = false, fps = 20, last = -Infinity, pending = false;
  const drawn = [];

  function tick(now) {
    pending = false;
    if (!dirty && !moving) return;
    if (!due(now, last, fps)) { schedule(); return; }
    const interval = now - last;
    last = now; dirty = false;
    drawn.push(now);
    while (drawn.length && drawn[0] < now - 1000) drawn.shift();
    draw(now, Number.isFinite(interval) ? interval : 0);
    if (moving) schedule();
  }
  function schedule() { if (!pending) { pending = true; raf(tick); } }

  return {
    invalidate() { dirty = true; schedule(); },
    // starting from still counts the first step as one frame, so a tap never jumps and never reads as late
    setMoving(on, targetFps) {
      if (targetFps) fps = targetFps;
      if (on && !moving) last = Math.max(last, clock() - 1000 / fps);
      moving = on;
      if (on) schedule();
    },
    // frames actually drawn in the last second; 0 when standing still
    fps() { const now = clock(); while (drawn.length && drawn[0] < now - 1000) drawn.shift(); return drawn.length; },
    target() { return fps; }
  };
}
