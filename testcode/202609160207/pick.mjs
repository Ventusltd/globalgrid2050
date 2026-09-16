/* Which line is under the finger.
 *
 * WHAT WAS WRONG. The first version compared the tap against every point in the
 * estate — 250,174 distance tests per tap, and 283,231 by the next build. It is
 * the one place in the design whose cost grew with the estate, and it grew on
 * the interaction the whole page exists for.
 *
 * WHY A PLAIN GRID IS THE RIGHT ANSWER HERE, and not a quadtree or a k-d tree.
 * The wafer places key k at r = SPACING * sqrt(k), so the area inside radius r
 * holds exactly r^2 / SPACING^2 keys: every key owns pi * SPACING^2 of the
 * plane, everywhere, at every radius. The points are UNIFORMLY dense. A uniform
 * grid is optimal for uniform density and degenerate for clustered data, and
 * this is the one dataset that is uniform by construction. So the structure
 * that is usually the naive choice is here the correct one.
 *
 * WHAT IT COSTS. Two typed arrays and no objects: a start offset per cell and
 * one entry per point, both Uint32. For 283,231 points that is about 2.3 MB and
 * one O(n) pass, built from the positions the wafer has already computed. It is
 * never fetched, never refreshed and never invalidated, because a key's place
 * is a pure function of the key.
 */

/* Roughly this many points per cell. A tap reaches 22 px, so the search visits
   the cells a disc of that radius touches; sixteen keeps that handful small
   without making the cell table longer than the data it indexes. */
const PER_CELL = 16;

export function buildPickIndex(pos, n, spacing = 1) {
  /* Each key owns pi * spacing^2 of area, so a cell of side `size` holds
     size^2 / (pi * spacing^2) points on average. Solve that for PER_CELL. */
  const size = Math.sqrt(PER_CELL * Math.PI) * spacing;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 2], y = pos[i * 2 + 1];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const cols = Math.max(1, Math.ceil((maxX - minX) / size) + 1);
  const rows = Math.max(1, Math.ceil((maxY - minY) / size) + 1);

  /* Counting sort into cells: count, prefix-sum, place. Two passes, no objects,
     no allocation per point. */
  const counts = new Uint32Array(cols * rows + 1);
  const cellOf = i => {
    const cx = Math.min(cols - 1, Math.max(0, (pos[i * 2] - minX) / size | 0));
    const cy = Math.min(rows - 1, Math.max(0, (pos[i * 2 + 1] - minY) / size | 0));
    return cy * cols + cx;
  };
  for (let i = 0; i < n; i++) counts[cellOf(i) + 1]++;
  for (let c = 0; c < cols * rows; c++) counts[c + 1] += counts[c];
  const start = counts;                       /* now the start offset of each cell */
  const items = new Uint32Array(n);
  const fill = start.slice(0, cols * rows);
  for (let i = 0; i < n; i++) items[fill[cellOf(i)]++] = i;

  return { start, items, cols, rows, size, minX, minY, n, pos,
           bytes: start.byteLength + items.byteLength };
}

/* The index of the nearest point within `reach` world units of (wx, wy), or -1.
 *
 * It widens a ring of cells at a time and stops as soon as the best distance
 * found is closer than the nearest edge of the next ring — the usual guarantee,
 * and the reason this returns the same answer the full scan returned rather
 * than merely a nearby one. */
export function nearestAt(ix, wx, wy, reach) {
  const { start, items, cols, rows, size, minX, minY } = ix;
  const cx = Math.min(cols - 1, Math.max(0, (wx - minX) / size | 0));
  const cy = Math.min(rows - 1, Math.max(0, (wy - minY) / size | 0));
  const maxRing = Math.ceil(reach / size);
  let best = -1, bestD = reach * reach;

  for (let ring = 0; ring <= maxRing; ring++) {
    /* Everything in an earlier ring is closer than anything this ring can hold,
       so a hit inside (ring - 1) * size is already the answer. */
    if (best >= 0 && bestD < Math.pow((ring - 1) * size, 2)) break;
    const x0 = cx - ring, x1 = cx + ring, y0 = cy - ring, y1 = cy + ring;
    for (let gy = y0; gy <= y1; gy++) {
      if (gy < 0 || gy >= rows) continue;
      /* Only the perimeter of the ring is new; its interior was ring - 1. */
      const edge = (gy === y0 || gy === y1);
      for (let gx = x0; gx <= x1; gx += (edge ? 1 : (x1 - x0 || 1))) {
        if (gx < 0 || gx >= cols) continue;
        const c = gy * cols + gx;
        for (let p = start[c], e = start[c + 1]; p < e; p++) {
          const i = items[p];
          const dx = ix.pos[i * 2] - wx, dy = ix.pos[i * 2 + 1] - wy;
          const d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = i; }
        }
      }
    }
  }
  return best;
}
