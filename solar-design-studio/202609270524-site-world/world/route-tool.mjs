// Route tool: a small state machine for drawing a route on the ground, in Walk or Drone view.
// It knows nothing about the DOM, trenches or cables; it only holds an ordered list of points in local
// metres [x, y, z] (east, north, up from the site origin). The page turns clicks into ground points and
// keys into calls; a layer draws state.points. Every change calls onChange(state) once.
//
// Rules:
//   addPoint   appends a point; ignored once the route is finished, or if it repeats the last point.
//   movePoint  moves an existing point (allowed before and after finishing) and selects it.
//   removeLast undoes the last point; ignored once the route is finished (clear starts again).
//   finish     closes the route; needs at least two points.
//   clear      empties the route and reopens it.
// Each method returns true if it changed the route, false if it was ignored.

const MAX_POINTS = 10000;   // one route; route-file.mjs caps a whole file at 100 000 points
const MAX_ABS_M = 1e6;      // local metres; anything further is a bad ground pick, not a route
const SAME_M = 0.01;        // a second click within 1 cm of the last point is a double click, not a point

export function createRouteTool({ onChange = () => {} } = {}) {
  let points = [], finished = false, selected = null;

  const snapshot = () => Object.freeze({
    points: Object.freeze(points.map(p => Object.freeze([...p]))),
    finished, selected
  });
  const changed = () => { onChange(snapshot()); return true; };

  return {
    get state() { return snapshot(); },

    addPoint(p) {
      if (finished || points.length >= MAX_POINTS) return false;
      const q = point(p);
      const last = points[points.length - 1];
      if (last && Math.hypot(q[0] - last[0], q[1] - last[1], q[2] - last[2]) < SAME_M) return false;
      points.push(q);
      selected = points.length - 1;
      return changed();
    },

    movePoint(i, p) {
      if (!Number.isInteger(i) || i < 0 || i >= points.length) return false;
      points[i] = point(p);
      selected = i;
      return changed();
    },

    removeLast() {
      if (finished || !points.length) return false;
      points.pop();
      selected = points.length ? points.length - 1 : null;
      return changed();
    },

    finish() {
      if (finished || points.length < 2) return false;
      finished = true;
      selected = null;
      return changed();
    },

    clear() {
      if (!points.length && !finished) return false;
      points = []; finished = false; selected = null;
      return changed();
    }
  };
}

// Copies and checks one point; throws on anything that is not three finite local-metre numbers.
function point(p) {
  if (!Array.isArray(p) || p.length !== 3) throw Error('a route point is [x, y, z] in metres');
  const q = p.map(Number);
  if (!q.every(v => Number.isFinite(v) && Math.abs(v) <= MAX_ABS_M)) throw Error('a route point needs finite metres within 1000 km of the origin');
  return q;
}

// Lines for the '?' panel while the route tool is active: [keys, meaning] pairs, so the page can render
// them as <dt>/<dd> like the rest of the panel. Plain British English.
export function describeControls({ touch = false } = {}) {
  return touch
    ? [
        ['Tap', 'the ground to add a point'],
        ['Undo', 'removes the last point'],
        ['Done', 'completes the route (two points or more)'],
        ['Clear', 'removes the route and starts again'],
        ['Snap', 'a cable point within 25 m of a substation or pylon moves onto it (ringed)']
      ]
    : [
        ['Click', 'the ground to add a point'],
        ['Backspace', 'removes the last point'],
        ['Enter', 'completes the route (two points or more)'],
        ['Esc', 'removes the route and starts again'],
        ['Snap', 'a cable point within 25 m of a substation or pylon moves onto it (ringed)']
      ];
}
