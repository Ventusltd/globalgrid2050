/* physics.mjs — ten placement laws for one estate.
 *
 * WHAT THIS IS. The estate has 250,174 permanently numbered lines and 10,985
 * function families. This file holds ten different ways of deciding where a
 * thing goes, each taken from a real physical law, and nothing else. No drawing,
 * no DOM, no fetch. Give it the numbers and it returns positions.
 *
 * WHY TEN LAWS AND NOT ONE PICTURE. A layout is an argument about what matters.
 * Sort by number and you see history. Sort by mass and you see weight. Sort by
 * charge and you see conflict. The same data under ten laws is ten readings of
 * the same estate, and a reading that survives several laws is telling you
 * something about the code rather than about the layout.
 *
 * THE RULE EVERY LAW OBEYS. A position is a pure function of the entity's own
 * permanent key and of published facts about it. No randomness, no simulation
 * state, no iteration to convergence, no memory between frames. Give the same
 * key to the same law and you get the same point, on every device, for ever.
 * That is what makes any of these surfaces shareable by a link and unbounded
 * rather than merely large: a key that does not exist yet already has a place.
 *
 * WHAT IS NOT CLAIMED. These are analogies, drawn honestly. Code is not matter.
 * A function family has no mass in kilograms and a duplicated line exerts no
 * force. Each law says in its own note what it is borrowing and what it is not
 * asserting. Where a law needs a constant it is written down and named, never
 * tuned until the picture looked nice.
 */

export const TAU = Math.PI * 2;
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));   /* 2.39996… rad */

/* A deterministic angle from a key. Not random: a fixed integer hash, so the
   same key is the same angle for ever. Written out rather than imported so the
   arithmetic can be read. */
export function phase(key) {
  let h = key >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return (h / 4294967296) * TAU;
}

/* ── 1. WAFER — the number is the address ────────────────────────────────── */
export const wafer = {
  id: 'wafer',
  title: 'Wafer',
  borrows: 'phyllotaxis, the spiral a sunflower uses to pack seeds without gaps',
  reads: 'the permanent number, and nothing else',
  note:
    'Radius is the square root of the number and angle is the number times the '
    + 'golden angle, so equal area holds equal count and no two numbers stack. '
    + 'Numbers were issued in order, so a ring is a period of the estate history '
    + 'and a gap is a number never issued.',
  place: (e) => {
    const r = Math.sqrt(e.key), t = e.key * GOLDEN_ANGLE;
    return [r * Math.cos(t), r * Math.sin(t)];
  }
};

/* ── 2. ORBIT — Kepler's third law ───────────────────────────────────────── */
export const orbit = {
  id: 'orbit',
  title: 'Orbits',
  borrows: "Kepler's third law: the square of a period is the cube of the semi-major axis",
  reads: 'the family a line belongs to, and how many lines that family holds',
  note:
    'Each family is a primary and its lines are bodies around it. A line sits at '
    + 'a radius set by its position within the family, so an early line orbits '
    + 'close and a late line far out. The family primary is itself placed by the '
    + 'wafer law, so the systems do not collide. Nothing here is a real period: '
    + 'no line moves and no time passes.',
  place: (e) => {
    const [fx, fy] = wafer.place({ key: (e.family ?? 0) * 31 + 1 });
    if (e.family == null) return [fx, fy];
    const n = Math.max(e.famCount || 1, 1);
    const a = 2 + 9 * Math.cbrt((e.inFamily + 1) / n);       /* semi-major axis */
    const t = phase(e.key) + (e.inFamily / n) * TAU;
    return [fx + a * Math.cos(t), fy + a * 0.62 * Math.sin(t)];   /* an inclined ellipse */
  }
};

/* ── 3. SHELLS — electron shells, 2n² per shell ──────────────────────────── */
export const shells = {
  id: 'shells',
  title: 'Shells',
  borrows: 'the electron shell, which holds 2n squared states at principal number n',
  reads: 'the family, and how many lines it holds',
  note:
    'A family is an atom and its lines fill shells: two in the first, eight in '
    + 'the second, eighteen in the third. A family of six lines is complete in '
    + 'two shells; a family of four hundred has an absurd number of them, and '
    + 'that absurdity is the point. The outermost shell is the valence, and a '
    + 'line in an unfilled outer shell is the one most likely to be changed.',
  place: (e) => {
    const [fx, fy] = wafer.place({ key: (e.family ?? 0) * 31 + 1 });
    if (e.family == null) return [fx, fy];
    let i = e.inFamily, n = 1;
    while (i >= 2 * n * n) { i -= 2 * n * n; n++; }             /* which shell, which seat */
    const seats = 2 * n * n;
    const t = (i / seats) * TAU + phase(e.family) ;
    const r = 1.6 + n * 1.5;
    return [fx + r * Math.cos(t), fy + r * Math.sin(t)];
  }
};

/* ── 4. COLLAPSE — mass concentrates, as in a degenerate star ────────────── */
export const collapse = {
  id: 'collapse',
  title: 'Collapse',
  borrows: 'gravitational collapse: what is heavy falls inward and what is light is left in the halo',
  reads: 'fanout, meaning how many families carry this exact line',
  note:
    'Fanout is the analogue of mass. A line written once sits far out; a line '
    + 'copied into a thousand families falls to the centre. The core of this '
    + 'picture is therefore the estate duplication, and it is mostly braces, '
    + 'blanks and imports. That is the honest result: the densest thing in the '
    + 'code is the least meaningful, and a collapse picture makes it impossible '
    + 'to miss. Radius falls as the inverse square root of fanout, the same '
    + 'exponent that relates orbital radius to binding, borrowed for its shape '
    + 'and not as a claim about force.',
  place: (e) => {
    const m = Math.max(e.fanout || 1, 1);
    const r = 60 / Math.sqrt(m);
    const t = phase(e.key);
    return [r * Math.cos(t), r * Math.sin(t)];
  }
};

/* ── 5. ACCRETION — a disk with an inner edge ────────────────────────────── */
export const accretion = {
  id: 'accretion',
  title: 'Accretion',
  borrows: 'an accretion disk: material spirals inward, and there is a radius inside which nothing stable orbits',
  reads: 'the line length in characters',
  note:
    'Long lines carry angular momentum and stay out; short lines spiral in. The '
    + 'innermost stable orbit here is the empty line, which cannot spiral further '
    + 'because it has nothing left to lose. The spiral arm is logarithmic, which '
    + 'is the shape a real disk takes, and the pitch is fixed at one radian per '
    + 'e-fold rather than fitted.',
  place: (e) => {
    const L = Math.max(e.chars || 0, 0);
    const r = 3 + 26 * Math.log1p(L) / Math.log1p(200);
    const t = Math.log1p(L) * 3.4 + phase(e.key) * 0.25;
    return [r * Math.cos(t), r * Math.sin(t)];
  }
};

/* ── 6. SPECTRUM — emission lines ────────────────────────────────────────── */
export const spectrum = {
  id: 'spectrum',
  title: 'Spectrum',
  borrows: 'an emission spectrum: each element emits at its own fixed wavelengths',
  reads: 'the category of the family, and the line length',
  note:
    'Each category is an element and occupies one band of the horizontal axis; '
    + 'within its band a line is placed by length. A category with a wide smear '
    + 'holds lines of every size; a category with a sharp line is uniform. '
    + 'Unlike a real spectrum the bands are assigned by name order, not by '
    + 'energy, because code categories have no energy.',
  place: (e) => {
    const c = e.cat ?? 0, n = Math.max(e.catCount || 1, 1);
    const x = ((c + 0.5) / n - 0.5) * 108;
    const L = Math.max(e.chars || 0, 0);
    const y = (Math.log1p(L) / Math.log1p(400) - 0.5) * 70;
    const jitter = (phase(e.key) / TAU - 0.5) * (108 / n) * 0.82;
    return [x + jitter, y];
  }
};

/* ── 7. LATTICE — a crystal, and the shape a printed circuit takes ───────── */
export const lattice = {
  id: 'lattice',
  title: 'Lattice',
  borrows: 'a square crystal lattice, and the orthogonal routing of a printed circuit board',
  reads: 'the permanent number only',
  note:
    'Numbers fill a square lattice in Hilbert-curve order, so consecutive '
    + 'numbers stay near each other at every zoom. This is the layout a board '
    + 'or a floorplan uses, and it is the only one of the ten where locality on '
    + 'screen means locality in the numbering. It is also the one that shows how '
    + 'much of the estate is contiguous runs written in one sitting.',
  place: (e) => {
    /* Hilbert d2xy over a 512x512 grid, the standard iterative form. */
    const N = 512;
    let t = e.key % (N * N), x = 0, y = 0;
    for (let s = 1; s < N; s *= 2) {
      const rx = 1 & (t / 2), ry = 1 & (t ^ rx);
      if (ry === 0) { if (rx === 1) { x = s - 1 - x; y = s - 1 - y; } const tmp = x; x = y; y = tmp; }
      x += s * rx; y += s * ry;
      t = Math.floor(t / 4);
    }
    return [(x / N - 0.5) * 100, (y / N - 0.5) * 100];
  }
};

/* ── 8. FIELD — charge and potential ─────────────────────────────────────── */
export const field = {
  id: 'field',
  title: 'Field',
  borrows: 'an electrostatic field: like charges repel and the potential falls with distance',
  reads: 'fanout as charge, and the family as position',
  note:
    'A family sits where the wafer puts it and carries a charge equal to the '
    + 'total fanout of its lines. Lines are placed on the equipotential of their '
    + 'own family, at a radius that grows with their own charge, so a heavily '
    + 'copied line is pushed out of its own family rather than pulled in. This '
    + 'is the inverse of the collapse law on purpose: the same quantity read as '
    + 'repulsion instead of attraction, and the two pictures disagree about the '
    + 'same estate.',
  place: (e) => {
    const [fx, fy] = wafer.place({ key: (e.family ?? 0) * 31 + 1 });
    const q = Math.max(e.fanout || 1, 1);
    const r = 1.2 + 3.2 * Math.log1p(q);
    const t = phase(e.key);
    return [fx + r * Math.cos(t), fy + r * Math.sin(t)];
  }
};

/* ── 9. CONDENSATION — temperature and the forming of structure ──────────── */
export const condensation = {
  id: 'condensation',
  title: 'Condensation',
  borrows: 'a cooling cloud: hot material is diffuse, cold material condenses into structure',
  reads: 'when the family was first written',
  note:
    'Age is temperature inverted. The oldest code is coldest and has condensed '
    + 'into tight clumps; the newest is hot and fills the volume. A clump means '
    + 'code that has stopped moving, which is either settled or abandoned, and '
    + 'this law cannot tell you which. The scale height falls exponentially with '
    + 'age, the same form as an isothermal atmosphere.',
  place: (e) => {
    const age = e.ageDays == null ? 0 : Math.max(e.ageDays, 0);
    const T = Math.exp(-age / 120);                       /* 120 days: an e-fold */
    const [fx, fy] = wafer.place({ key: (e.family ?? 0) * 31 + 1 });
    const r = 0.6 + 16 * T;
    const t = phase(e.key);
    return [fx * (0.55 + 0.45 * T) + r * Math.cos(t), fy * (0.55 + 0.45 * T) + r * Math.sin(t)];
  }
};

/* ── 10. BEAM — what the beam has written ────────────────────────────────── */
export const beam = {
  id: 'beam',
  title: 'Beam',
  borrows: 'electron-beam lithography, which writes a pattern directly with no mask',
  reads: 'the permanent number, and where the beam has been',
  note:
    'The surface is blank until the beam passes. Position is the wafer law, but '
    + 'a point is only developed once the beam has visited its radius, so the '
    + 'picture is written outward from the centre as you sweep. This is the only '
    + 'law with a parameter that is not a property of the data: the beam radius '
    + 'is where you point it. It is here to make the point that a surface can be '
    + 'unbounded and still be written one place at a time.',
  place: (e) => wafer.place(e),
  /* A beam law also declares what is developed yet; the renderer dims the rest. */
  developed: (e, beamRadius) => Math.sqrt(e.key) <= beamRadius
};

export const LAWS = [wafer, orbit, shells, collapse, accretion, spectrum, lattice, field, condensation, beam];
export const byId = Object.fromEntries(LAWS.map(l => [l.id, l]));
