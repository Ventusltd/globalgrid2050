// phases-slider.mjs: a small range slider over a phases.mjs timeline.
// The model (sliderModel) is pure; createPhaseSlider draws it into a container
// using the container's own document, so tests can pass a stub.

// timeline: createTimeline(...). Returns what the slider shows at `step`.
export function sliderModel(timeline, step) {
  const s = timeline.clamp(Math.round(Number(step) || 0));
  const snap = timeline.stateAt(s);
  const ticks = [];
  let acc = 0;
  for (const p of timeline.plan.phases) { ticks.push({ step: acc, name: p.name }); acc += p.steps; }
  return {
    min: 0, max: timeline.totalSteps, value: s, label: timeline.label(s), ticks, counts: snap.counts,
    summary: `${snap.counts.complete} complete, ${snap.items.length - snap.counts.planned - snap.counts.complete} in progress, ${snap.counts.planned} planned`
  };
}

// container: an element; onStep(stateAt result) is called on every change.
export function createPhaseSlider(container, timeline, onStep = () => {}) {
  const doc = container.ownerDocument;
  const wrap = doc.createElement('div');
  wrap.className = 'phase-slider';
  const input = doc.createElement('input');
  input.type = 'range';
  input.min = '0';
  input.max = String(timeline.totalSteps);
  input.step = '1';
  input.setAttribute('aria-label', 'Construction step');
  const caption = doc.createElement('div');
  caption.className = 'phase-slider-label';
  caption.setAttribute('aria-live', 'polite');
  wrap.appendChild(input);
  wrap.appendChild(caption);
  container.appendChild(wrap);

  function set(step) {
    const m = sliderModel(timeline, step);
    input.value = String(m.value);
    caption.textContent = `${m.label}. ${m.summary}.`;
    onStep(timeline.stateAt(m.value));
    return m;
  }
  input.addEventListener('input', () => set(input.value));
  set(0);
  return { set, element: wrap, destroy: () => wrap.remove() };
}
