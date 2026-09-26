// Layer: ground grid. A 1 m grid near the viewer and a 10 m grid to the horizon, draped on whatever
// ground the world has (flat until a terrain layer supplies heightAt). The grid follows the viewer in
// 10 m steps, so it looks endless but only ever holds a few thousand lines.
// Within 100 m of the viewer every segment is split to 2 m or less, so the grid follows real banks and
// ditches rather than bridging them. Batches carry an origin at the centre of the viewer's 10 m cell and
// positions relative to it, so they stay sharp on the GPU. The grid is rebuilt on a new cell or new ground.

const MINOR = { spacing: 1, radius: 30, color: [156 / 255, 219 / 255, 1, 0.16] };  // #9cdbff
const MAJOR = { spacing: 10, radius: 400, color: [156 / 255, 219 / 255, 1, 0.42] };
const ORIGIN = { color: [1, 1, 1, 0.9], arm: 5 };
const FOLLOW = 10;
export const DETAIL = { radius: 100, step: 2 }; // near the viewer, no segment is longer than 2 m
let cached = { version: null, batches: [] };

export default {
  id: 'ground-grid',
  // ctx: { pos, heightAt, groundVersion?, origin? }
  lines({ pos, heightAt, groundVersion = 0 }) {
    const cx = Math.floor(pos[0] / FOLLOW) * FOLLOW, cy = Math.floor(pos[1] / FOLLOW) * FOLLOW;
    const version = cx + ',' + cy + '@' + groundVersion;
    if (cached.version === version && cached.heightAt === heightAt) return cached.batches; // new cell or new ground only
    const mx = cx + FOLLOW / 2, my = cy + FOLLOW / 2, mz = finite(heightAt(mx, my));
    const origin = [mx, my, mz], opts = { origin, near: [mx, my] };
    cached = { version, heightAt, batches: [
      { key: 'ground-grid/minor', version, origin, color: MINOR.color, positions: grid(cx, cy, MINOR, heightAt, opts) },
      { key: 'ground-grid/major', version, origin, color: MAJOR.color, positions: grid(cx, cy, MAJOR, heightAt, opts) },
      { key: 'ground-grid/origin', version: 'origin@' + groundVersion, color: ORIGIN.color, positions: originMark(heightAt) }
    ] };
    return cached.batches;
  }
};

// Lines of the grid centred on (cx, cy). Positions are relative to opts.origin ([0, 0, 0] by default).
// Segments whose midpoint lies within DETAIL.radius of opts.near are split to DETAIL.step or less.
export function grid(cx, cy, { spacing, radius }, heightAt, { origin = [0, 0, 0], near = null } = {}) {
  const n = Math.round(radius / spacing), out = [];
  const pieces = spacing > DETAIL.step ? Math.ceil(spacing / DETAIL.step) : 1;
  for (let i = -n; i <= n; i++) {
    const a = i * spacing;
    for (let j = -n; j < n; j++) {
      const b0 = j * spacing, b1 = b0 + spacing;
      const ns = [cx + a, cy + b0, cx + a, cy + b1], ew = [cx + b0, cy + a, cx + b1, cy + a]; // north-south, east-west
      for (const [x0, y0, x1, y1] of [ns, ew]) {
        const k = pieces > 1 && near && Math.hypot((x0 + x1) / 2 - near[0], (y0 + y1) / 2 - near[1]) <= DETAIL.radius ? pieces : 1;
        for (let p = 0; p < k; p++) {
          const t0 = p / k, t1 = (p + 1) / k;
          seg(out, x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0, x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1, heightAt, origin);
        }
      }
    }
  }
  return new Float32Array(out);
}

function originMark(heightAt) {
  const out = [], a = ORIGIN.arm, h = finite(heightAt(0, 0));
  out.push(-a, 0, h, a, 0, h, 0, -a, h, 0, a, h, 0, 0, h, 0, 0, h + 2 * a);
  return new Float32Array(out);
}

function seg(out, x0, y0, x1, y1, heightAt, o) {
  out.push(x0 - o[0], y0 - o[1], finite(heightAt(x0, y0)) - o[2], x1 - o[0], y1 - o[1], finite(heightAt(x1, y1)) - o[2]);
}

const finite = h => (Number.isFinite(h) ? h : 0);
