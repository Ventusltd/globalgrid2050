// Headset view: an optional WebXR immersive-vr session for the same line world. No libraries.
// The button stays hidden unless the browser says it can run an immersive-vr session; a session is only
// ever requested from a click. Nothing here runs, and nothing on the flat screen changes, until then.
// Each eye is drawn with the line renderer as the flat screen is: a rotation-only matrix, and every batch
// moved by (its origin - that eye) in doubles. The pose maths lives in xr-pose.mjs and is tested there.
// Controllers: left stick walks and strafes (Walk 8 m/s, Drone 25 m/s, as views.mjs); right stick flicks
// turn in 30 degree snaps (no smooth turning, which unsettles many people); in Drone, right stick up and
// down climbs and descends; A switches Walk and Drone; left grip held moves slowly and precisely.

import { VIEWS, blocked, setView } from './views.mjs';
import {
  enterRig, leaveRig, locomote, turnAbout, snapTurn, readControllers, movementInput, toWorld, eyeMatrix,
  chooseFrameRate, headsetBudget, adjustHeadset
} from './xr-pose.mjs';

const MAX_DT = 0.1, NEAR = 0.05, FAR = 5000;

// api: { lines, heightAt, solids(), collect(pos), fade, state(), leave(state) }
//   collect(pos) returns the batches the layers draw around a world position.
//   leave(state) hands the flat screen the viewer's place when the session ends.
export function attachHeadset(button, api, { xr = globalThis.navigator && navigator.xr } = {}) {
  if (!button) return null;
  button.hidden = true;
  if (!xr || typeof xr.isSessionSupported !== 'function' || typeof XRWebGLLayer === 'undefined') return null;
  let session = null;

  xr.isSessionSupported('immersive-vr').then(ok => { button.hidden = !ok; }, () => { button.hidden = true; });
  button.addEventListener('click', () => {
    if (session) { session.end().catch(() => {}); return; }
    start().catch(e => { button.title = 'Headset view could not start: ' + e.message; session = null; label(); });
  });
  const label = () => {
    button.textContent = session ? 'Leave headset view' : 'Headset view';
    button.setAttribute('aria-pressed', String(!!session));
  };

  async function start() {
    // Requested straight from the click, before any other await, so the user gesture still counts.
    const s = await xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
    session = s; label();
    const gl = api.lines.context();
    try {
      if (gl.makeXRCompatible) await gl.makeXRCompatible();
      let space, lift = 0;
      try { space = await s.requestReferenceSpace('local-floor'); }
      catch { space = await s.requestReferenceSpace('local'); lift = VIEWS.standing.eye; } // origin at the head
      const rate = chooseFrameRate(s.supportedFrameRates);
      if (rate && typeof s.updateTargetFrameRate === 'function') await s.updateTargetFrameRate(rate).catch(() => {});
      run(s, gl, space, lift);
    } catch (e) { s.end().catch(() => {}); throw e; }
  }

  function run(s, gl, space, lift) {
    let budget = headsetBudget(), scale = 0, rig = null, view = api.state().view, armed = true, toggleHeld = false;
    let last = null, head = null, orient = null;
    const layerFor = k => new XRWebGLLayer(s, gl, { framebufferScaleFactor: k, antialias: true, depth: true, alpha: false });
    const resize = () => { if (scale !== budget.scale) { scale = budget.scale; s.updateRenderState({ baseLayer: layerFor(scale), depthNear: NEAR, depthFar: FAR }); } };
    resize();

    s.addEventListener('end', () => {
      if (rig && head) api.leave(leaveRig(rig, head, orient, view));
      session = null; label();
    });

    function frame(t, f) {
      s.requestAnimationFrame(frame);
      const pose = f.getViewerPose(space), layer = s.renderState.baseLayer;
      if (!pose || !layer) return;
      head = xyz(pose.transform.position); orient = quat(pose.transform.orientation);
      if (!rig) rig = enterRig(api.state(), head, orient, api.heightAt, lift);
      const interval = last === null ? 0 : t - last, dt = Math.min(interval / 1000, MAX_DT);
      last = t;

      const c = readControllers(s.inputSources);
      if (c.toggle && !toggleHeld) view = switchView(view, rig, head, orient);
      toggleHeld = c.toggle;
      const snap = snapTurn(armed, c.right[0]);
      armed = snap.armed;
      if (snap.turn) rig = turnAbout(rig, head, snap.turn);
      rig = locomote(rig, head, orient, movementInput(c, view), dt, view, api.heightAt, api.solids(), lift);

      budget = adjustHeadset(budget, interval, s.frameRate);
      const batches = api.collect(toWorld(rig, head));
      pose.views.forEach((v, i) => {
        const vp = layer.getViewport(v);
        if (!vp) return;
        api.lines.draw(eyeMatrix(v.projectionMatrix, rig, quat(v.transform.orientation)), toWorld(rig, xyz(v.transform.position)),
          api.fade, batches, { framebuffer: layer.framebuffer, viewport: [vp.x, vp.y, vp.width, vp.height], clear: i === 0 });
      });
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      resize(); // a new eye-buffer size takes effect from the next frame
    }

    // Switching keeps the head where it is; like the flat screen, no standing up inside a solid.
    function switchView(current, r, h, o) {
      const next = current === 'aerial' ? 'standing' : 'aerial';
      const here = leaveRig(r, h, o, current), moved = setView(here, next, api.heightAt);
      return blocked(moved.pos, VIEWS[next].body, api.solids()) ? current : next;
    }

    s.requestAnimationFrame(frame);
  }

  label();
  return { active: () => !!session };
}

const xyz = p => [p.x, p.y, p.z];
const quat = q => [q.x, q.y, q.z, q.w];
