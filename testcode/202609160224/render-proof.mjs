/* render-proof.mjs — proving the picture, not just the data.
 *
 * WHY THIS EXISTS, and it is not a test-coverage gap. Tonight testcode/202609160224
 * passed particles.check.mjs 6/6 honest and 3/6 mutated, and nest.check.mjs 6/6 and
 * 2/6, while rendering ZERO pixels at its default zoom. Both statements were true at
 * once and neither check was wrong: they examine bands, places, derivation and counts,
 * and the failure was in the raster. Not one proof in this estate asserted that a
 * pixel had ever reached a canvas.
 *
 * For an ordinary application that is a coverage gap. Here it is a category error.
 * We are building a graphical language: if the UI and the code are the same language,
 * the picture is not the presentation of the result, the picture IS the result. A
 * blank canvas is the language failing to speak while every check reports the grammar
 * is sound. (The argument is vikra-ac's, at 02:25Z; the implementation is the chair's.)
 *
 * WHY IT NEEDS NO GOLDEN IMAGE. Rendering is normally checked against a stored
 * baseline: brittle, machine-dependent, and a maintenance burden that rots. Not here,
 * because position is a pure function of the key —
 *
 *     r = sqrt(key)        theta = key x 2.39996...
 *
 * so given a camera, THE EXPECTED PICTURE IS COMPUTABLE WITHOUT RENDERING IT. We can
 * say in advance which pixel key 192,067 must occupy. The check and the thing checked
 * derive from the same formula, so they cannot drift apart.
 *
 * WHY IT IS A MODULE AND NOT PART OF ONE SURFACE. Every wafer in the estate places by
 * this law — the line wafer, the code wafer, the family wafer when it is built, and
 * each of the ten laws in 202609151413. One render proof serves all of them, the same
 * way lib.mjs is shared: the law is shared, so the proof of the law is shared.
 */

export const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/* The camera a surface is using, as plain numbers, so the proof needs no access to
   the page's internals — only what it would need to draw. */
export function project(key, cam) {
  const r = Math.sqrt(key), a = key * GOLDEN;
  return {
    x: cam.cx + Math.cos(a) * r * cam.scale * cam.zoom + cam.panX,
    y: cam.cy + Math.sin(a) * r * cam.scale * cam.zoom + cam.panY,
  };
}

const isGround = (d, o, g) => d[o] === g[0] && d[o + 1] === g[1] && d[o + 2] === g[2];

/* How many of these keys the camera can actually show. Derived, like everything
   else: project each key and count the ones that land on the canvas. This is what
   makes the liveness floor honest instead of a constant. */
export function onCamera(keys, cam, w, h) {
  let n = 0;
  for (const k of keys) {
    const p = project(k, cam);
    if (p.x >= 0 && p.y >= 0 && p.x < w && p.y < h) n++;
  }
  return n;
}

/* LEVEL 1 — LIVENESS. Did anything at all reach the canvas?
 *
 * The first version took a constant, and vikra-ac was right that it was far too
 * weak: keyCount/1000 is 250 pixels on a 1378x852 canvas — 0.02% of it — so a
 * projection that collapsed every particle into one corner would still light
 * hundreds of pixels and PASS. A check that a broken picture can satisfy is not
 * a check.
 *
 * The floor is now derived from the camera. Count how many keys the camera can
 * show, and require a twentieth of them to be lit: generous, because particles
 * overlap heavily at low zoom, and still tens of thousands at the default camera
 * where every key is on screen. At deep zoom, where few keys are visible, the
 * floor falls with them — so the same rule serves both without a special case. */
export function liveness(ctx, w, h, ground, keys, cam) {
  const expected = onCamera(keys, cam, w, h);
  const floor = Math.max(1, Math.floor(expected / 20));
  const d = ctx.getImageData(0, 0, w, h).data;
  let lit = 0;
  for (let o = 0; o < d.length; o += 4) if (!isGround(d, o, ground)) lit++;
  return {
    name: 'the canvas holds a picture',
    ok: lit >= floor,
    detail: lit.toLocaleString() + ' non-ground pixels of ' + (w * h).toLocaleString() +
      ' · ' + expected.toLocaleString() + ' keys are on camera, so the floor is ' +
      floor.toLocaleString() + ' (a twentieth)',
  };
}

/* LEVEL 2 — PLACEMENT. Is it the picture of THESE KEYS?
   Liveness passes on noise. This computes where each key must land from the law and
   requires a lit pixel within `tol` of it, which catches the whole family of
   projection bugs that look plausible and are wrong: a bad scale, a dropped pan
   offset, a sign error in y. */
export function placement(ctx, w, h, ground, keys, cam, tol = 1) {
  const d = ctx.getImageData(0, 0, w, h).data;
  const near = (px, py) => {
    for (let dy = -tol; dy <= tol; dy++) {
      for (let dx = -tol; dx <= tol; dx++) {
        const x = Math.round(px) + dx, y = Math.round(py) + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        if (!isGround(d, (y * w + x) * 4, ground)) return true;
      }
    }
    return false;
  };
  /* THE SKIP IS ONLY ALLOWED WHEN OFF-CAMERA IS LEGITIMATE.
     The first version skipped any sample key that projected off the canvas, which
     vikra-ac identified as the same defect shape as everything else tonight: a
     check quietly narrowing its own scope. At the DEFAULT camera every key is on
     screen by construction — the page's own footer says "250,174 on screen of
     250,174" — so a skip there cannot be legitimate and is itself the bug. Under
     the default camera an off-screen sample FAILS. Only a zoomed or panned camera
     may skip, because there off-screen is the honest answer. */
  const isDefault = cam.zoom === 1 && cam.panX === 0 && cam.panY === 0;
  const checked = [], missed = [], offCamera = [];
  for (const k of keys) {
    const p = project(k, cam);
    if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) { offCamera.push(k); continue; }
    checked.push(k);
    if (!near(p.x, p.y)) missed.push(k);
  }
  const illegalSkip = isDefault && offCamera.length > 0;
  return {
    name: 'the picture is the picture of these keys',
    ok: checked.length > 0 && missed.length === 0 && !illegalSkip,
    detail: illegalSkip
      ? offCamera.length + ' sampled keys projected OFF a default camera, where every key must be on screen: ' +
        offCamera.slice(0, 6).join(', ') + ' — the projection is wrong, not the sample'
      : checked.length === 0
        ? 'no sample key was on camera — the sample or the camera is wrong'
        : (checked.length - missed.length) + ' of ' + checked.length +
          ' sampled keys found a lit pixel within ' + tol + 'px of where the law puts them' +
          (missed.length ? ' · missing: ' + missed.slice(0, 6).join(', ') : '') +
          (offCamera.length ? ' · ' + offCamera.length + ' off-camera, allowed because zoom ' +
            cam.zoom.toFixed(2) + ' is not the default' : ''),
  };
}

/* LEVEL 3 — DERIVATION. Is the picture a pure function of the keys?
   `drawWith(order)` must render the same camera using the given iteration order. If
   reversing the order changes one byte, the raster depends on something other than
   the keys. This is the direct test of a claim the code makes and cannot otherwise
   defend: ties between two particles on one pixel are the COMMON case — vikra-ac
   measured 361 of 486 reachable channel-sums produced by more than one colour — so
   the tie-break is load-bearing. Today it is key order, which is derived. The day
   someone batches by nature or draws band by band, this fails loudly instead of the
   picture changing in silence. */
export function derivation(ctx, w, h, drawWith) {
  drawWith('ascending');
  const a = ctx.getImageData(0, 0, w, h).data.slice();
  drawWith('descending');
  const b = ctx.getImageData(0, 0, w, h).data;
  let first = -1, diff = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) { diff++; if (first < 0) first = i; }
  }
  drawWith('ascending');                 /* leave the canvas as the reader expects */
  return {
    name: 'the raster is a pure function of the keys',
    ok: diff === 0,
    detail: diff === 0
      ? 'reversing the iteration order changed no byte of ' + a.length.toLocaleString()
      : diff.toLocaleString() + ' bytes differ, first at offset ' + first +
        ' — the picture depends on draw order, not only on the keys',
  };
}

export function report(results) {
  let failed = 0;
  const lines = results.map((r) => {
    if (!r.ok) failed++;
    return (r.ok ? 'PASS  ' : 'FAIL  ') + r.name + '\n        ' + r.detail;
  });
  lines.push('\n' + (results.length - failed) + '/' + results.length + ' passed');
  return { text: lines.join('\n'), failed };
}
