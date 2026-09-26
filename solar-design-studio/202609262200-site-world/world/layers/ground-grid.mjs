// Layer: ground grid. A 1 m grid near the viewer and a 10 m grid to the horizon, draped on whatever
// ground the world has (flat until a terrain layer supplies heightAt). The grid follows the viewer in
// 10 m steps, so it looks endless but only ever holds a few thousand lines.

const MINOR = { spacing: 1, radius: 30, color: [156 / 255, 219 / 255, 1, 0.16] };  // #9cdbff
const MAJOR = { spacing: 10, radius: 400, color: [156 / 255, 219 / 255, 1, 0.42] };
const ORIGIN = { color: [1, 1, 1, 0.9], arm: 5 };
const FOLLOW = 10;
let cached = { version: null, batches: [] };

export default {
  id: 'ground-grid',
  // ctx: { pos, heightAt }
  lines({ pos, heightAt }) {
    const cx = Math.floor(pos[0] / FOLLOW) * FOLLOW, cy = Math.floor(pos[1] / FOLLOW) * FOLLOW;
    const version = cx + ',' + cy;
    if (cached.version === version && cached.heightAt === heightAt) return cached.batches; // rebuilt only on a new 10 m cell
    cached = { version, heightAt, batches: [
      { key: 'ground-grid/minor', version, color: MINOR.color, positions: grid(cx, cy, MINOR, heightAt) },
      { key: 'ground-grid/major', version, color: MAJOR.color, positions: grid(cx, cy, MAJOR, heightAt) },
      { key: 'ground-grid/origin', version: 'origin', color: ORIGIN.color, positions: origin(heightAt) }
    ] };
    return cached.batches;
  }
};

export function grid(cx, cy, { spacing, radius }, heightAt) {
  const n = Math.round(radius / spacing), out = [];
  for (let i = -n; i <= n; i++) {
    const a = i * spacing;
    for (let j = -n; j < n; j++) {
      const b0 = j * spacing, b1 = b0 + spacing;
      seg(out, cx + a, cy + b0, cx + a, cy + b1, heightAt); // north-south line
      seg(out, cx + b0, cy + a, cx + b1, cy + a, heightAt); // east-west line
    }
  }
  return new Float32Array(out);
}

function origin(heightAt) {
  const out = [], a = ORIGIN.arm, h = heightAt(0, 0);
  out.push(-a, 0, h, a, 0, h, 0, -a, h, 0, a, h, 0, 0, h, 0, 0, h + 2 * a);
  return new Float32Array(out);
}

function seg(out, x0, y0, x1, y1, heightAt) {
  out.push(x0, y0, heightAt(x0, y0), x1, y1, heightAt(x1, y1));
}
