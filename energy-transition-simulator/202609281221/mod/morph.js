// mod/morph.js - the wire world flattened and raised: one number t in [0, 1] that scales every height.
// t = 0 is the flat drawing (towers are points, conductors lie on the ground, ducts rise to the surface); t = 1 is
// today's 3D exactly (nothing scaled). plan-view.js drives it: zoom in past the plan threshold and t eases 0 -> 1
// over MS with a cubic in-out curve while the pitch eases 0 -> 60; zoom out and the reverse happens.
// How: every custom layer keeps its own shader ("u * vec4(p, 1)", p anchor-relative, the anchor folded into u at
// its ground height). Scaling the third column of u by t scales p.z, so every block flattens onto its own ground.
// While t < 1 this module wraps each custom layer's render() (through a Proxy in place of the style layer's
// `implementation`, so a module that re-wraps the raw layer object's render, as wire-look does for 15 s after load,
// never sees the wrap: two wraps of one render would call each other for ever) and, for that call only, replaces gl.uniformMatrix4fv
// with one that (a) sets the layer's own u_zscale uniform when its program has one (the overlay's wire layer), or
// (b) scales column 2 of the matrix. At t = 1 the wrap returns to the layer's render at once: no cost, no change.
// The layers plan HIDES (the wire, its grid, the streamed ground) would pop in at full strength at t = 0, so for the ids
// in fadeIn(ids) the wrap also fades them: over the first FADE of t (30 %) every draw call of such a layer blends
// CONSTANT_ALPHA / ONE_MINUS_CONSTANT_ALPHA with alpha t / FADE (a plain mix of the layer over what is behind it), the
// layer's own blendFunc / enable(BLEND) recorded, not applied, until the call returns, and depth writes off (a faded
// line that wrote depth would still cut the draped terrain behind it to black; they stay off until t = 1, so the cut
// fringes of today's 3D return with everything else at the end, not mid-morph). Exact for opaque and premultiplied
// (ONE, ONE_MINUS_SRC_ALPHA) lines. A layer that blends SRC_ALPHA with one uniform colour `c` (the streamed ground) is
// mixed to c's alpha instead, which is its own result exactly at the end of the fade; one without such a uniform is
// left as it draws itself (a mix to 1 would end opaque).
// Nothing here edits another module's file; the wrap is runtime only and removable (SIM.morph.release()).
// Test hook: SIM.morph = { set(t), animate(to, ms, onFrame) -> Promise, cancel(), fadeIn(ids), state(), ease(x), release() }.
// state().frame counts the matrix calls since the last set() (this frame); state().totals counts them since load.
(function () {
  'use strict';
  const MS = 1200, FADE = 0.3;
  const fresh = t => ({ t, calls: 0, uniform: 0, matrix: 0, faded: 0 });
  const st = { t: 1, active: false, wrapped: [], frame: fresh(1), totals: fresh(1), anim: null, frames: 0, fade: new Set() };
  let map;
  const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;           // cubic in-out
  function wait(n) { const S = window.SIM; if (S && S.map) init(S); else if (n < 400) setTimeout(() => wait(n + 1), 50); }

  // The per-call interceptor: called in place of gl.uniformMatrix4fv while a wrapped layer renders at t < 1.
  const count = k => { st.frame[k]++; st.totals[k]++; };
  function scaled(gl, orig, loc, tr, m) {
    count('calls');
    const pr = gl.getParameter(gl.CURRENT_PROGRAM), zl = pr ? gl.getUniformLocation(pr, 'u_zscale') : null;
    if (zl) { count('uniform'); gl.uniform1f(zl, st.t); return orig.call(gl, loc, tr, m); }
    count('matrix');
    const r = new Float32Array(m);                     // column-major mat4: column 2 = indices 8..11
    if (tr) { r[2] *= st.t; r[6] *= st.t; r[10] *= st.t; r[14] *= st.t; } else { r[8] *= st.t; r[9] *= st.t; r[10] *= st.t; r[11] *= st.t; }
    return orig.call(gl, loc, tr, r);
  }
  // The fade-in for one render call: the layer's blend calls are recorded, and at each of its draw calls the mix
  // CONSTANT_ALPHA / ONE_MINUS_CONSTANT_ALPHA at alpha a is set instead (or the layer's own SRC_ALPHA blend, untouched).
  // Returns the function that puts the GL methods back.
  function fading(gl, a) {
    const o = { enable: gl.enable, disable: gl.disable, blendFunc: gl.blendFunc, blendFuncSeparate: gl.blendFuncSeparate, drawArrays: gl.drawArrays, drawElements: gl.drawElements, depthMask: gl.depthMask };
    const want = { on: gl.getParameter(gl.BLEND), s: gl.getParameter(gl.BLEND_SRC_RGB), d: gl.getParameter(gl.BLEND_DST_RGB), sa: gl.getParameter(gl.BLEND_SRC_ALPHA), da: gl.getParameter(gl.BLEND_DST_ALPHA), dm: gl.getParameter(gl.DEPTH_WRITEMASK) };
    const own = () => want.on && want.s === gl.SRC_ALPHA;            // a translucent layer (SRC_ALPHA)
    const cAlpha = () => { try { const pr = gl.getParameter(gl.CURRENT_PROGRAM), l = pr && gl.getUniformLocation(pr, 'c'), v = l && gl.getUniform(pr, l); return v && v.length === 4 ? v[3] : null; } catch (e) { return null; } };
    const arm = () => {
      o.enable.call(gl, gl.BLEND); o.depthMask.call(gl, false);
      const sa = own() ? cAlpha() : 1;
      if (sa == null) o.blendFuncSeparate.call(gl, want.s, want.d, want.sa, want.da);   // alpha unknown: its own blend
      else { gl.blendColor(0, 0, 0, a * sa); o.blendFuncSeparate.call(gl, gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA, gl.ZERO, gl.ONE); count('faded'); }
    };
    gl.enable = c => (c === gl.BLEND ? (want.on = true) : o.enable.call(gl, c));
    gl.disable = c => (c === gl.BLEND ? (want.on = false) : o.disable.call(gl, c));
    gl.blendFunc = (s, d) => { want.s = want.sa = s; want.d = want.da = d; };
    gl.blendFuncSeparate = (s, d, sa, da) => { want.s = s; want.d = d; want.sa = sa; want.da = da; };
    gl.depthMask = v => { want.dm = !!v; };
    gl.drawArrays = (...x) => { arm(); return o.drawArrays.apply(gl, x); };
    gl.drawElements = (...x) => { arm(); return o.drawElements.apply(gl, x); };
    return () => {
      Object.assign(gl, o);
      (want.on ? gl.enable : gl.disable).call(gl, gl.BLEND); gl.blendFuncSeparate(want.s, want.d, want.sa, want.da); gl.depthMask(want.dm);   // as the layer left it
    };
  }
  const alpha = () => Math.max(0, Math.min(1, st.t / FADE));
  function wrap(id) {
    const L = map.getLayer(id); const impl = L && L.implementation; if (!impl || impl.__morphProxy || typeof impl.render !== 'function') return false;
    // The layer's CURRENT render, read at each call (another module may wrap it later), with the raw object as `this`.
    const w = function (gl, args) {
      if (st.t >= 1 || !st.active) return impl.render.call(impl, gl, args);
      const orig = gl.uniformMatrix4fv; gl.uniformMatrix4fv = (loc, tr, m) => scaled(gl, orig, loc, tr, m);
      const undo = st.fade.has(id) ? fading(gl, alpha()) : null;   // for the whole morph: depth writes stay off until t = 1
      try { return impl.render.call(impl, gl, args); } finally { gl.uniformMatrix4fv = orig; undo && undo(); }
    };
    const proxy = new Proxy(impl, { get: (t, k) => (k === 'render' ? w : k === '__morphProxy' ? true : k === '__morphRaw' ? t : Reflect.get(t, k)), set: (t, k, v) => Reflect.set(t, k, v) });
    L.implementation = proxy; st.wrapped.push(id); return true;
  }
  // Every custom layer in the live order (the overlay's wire, the procedural ghost, the trench wires, the streamed
  // ground, the survey grid). Other modules may wrap the same render later (wire-look does); the interceptor works from
  // inside, whichever order the wraps ended up in, because it reads the program that is current at the call.
  function wrapAll() {
    const ids = map.getLayersOrder ? map.getLayersOrder() : (map.style && map.style._order) || [];
    for (const id of ids) { const L = map.getLayer(id); if (L && L.type === 'custom') wrap(id); }
  }
  function release() { for (const id of st.wrapped) { const L = map.getLayer(id), impl = L && L.implementation; if (impl && impl.__morphProxy) L.implementation = impl.__morphRaw; } st.wrapped = []; st.active = false; }

  function set(t) {
    t = Math.max(0, Math.min(1, +t || 0)); st.t = t; st.frame = fresh(t); st.totals.t = t;
    if (t < 1) { st.active = true; wrapAll(); } else st.active = false;
    st.frames++; map.triggerRepaint();
  }
  function cancel() { if (st.anim) { cancelAnimationFrame(st.anim.raf); const a = st.anim; st.anim = null; a.resolve(false); } }
  // The layers whose appearance fades in over the first FADE of t (plan names the ones it hides in the flat drawing).
  function fadeIn(ids) { st.fade = new Set(ids || []); }
  // Eases t from its current value to `to` over ms with the cubic; onFrame(e, t) each frame (e = eased progress 0..1).
  function animate(to, ms, onFrame) {
    cancel(); const from = st.t, t0 = performance.now(), D = ms == null ? MS : ms;
    return new Promise(resolve => {
      const a = { resolve, raf: 0, from, to, t0 };
      st.anim = a;
      const step = () => {
        if (st.anim !== a) return;
        const x = Math.min(1, (performance.now() - t0) / D), e = ease(x);
        set(from + (to - from) * e); try { onFrame && onFrame(e, st.t, x); } catch (err) { console.warn('morph frame', err); }
        if (x < 1) a.raf = requestAnimationFrame(step); else { st.anim = null; resolve(true); }
      };
      a.raf = requestAnimationFrame(step);
    });
  }
  function init(S) {
    if (S.morph) return; map = S.map;
    map.on('style.load', () => { st.wrapped = []; if (st.active) setTimeout(wrapAll, 100); });
    S.morph = { set, animate, cancel, release, ease, fadeIn, MS, FADE,
      state: () => ({ t: +st.t.toFixed(4), active: st.active, animating: !!st.anim, wrapped: st.wrapped.slice(), frame: Object.assign({}, st.frame), totals: Object.assign({}, st.totals), frames: st.frames, alpha: +alpha().toFixed(3), fade: Array.from(st.fade) }) };
  }
  wait(0);
})();
