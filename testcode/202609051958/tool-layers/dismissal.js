/** Close a visible tool with Escape, including when focus is inside its same-origin app. */
export function bindLayerDismissal(layer, frame, close) {
  const handle = event => {
    if (event.key !== 'Escape' || event.defaultPrevented || layer.style.display === 'none') return;
    event.preventDefault(); close();
  };
  let child;
  const detachChild = () => { child?.removeEventListener('keydown', handle); child = undefined; };
  const loaded = () => {
    detachChild();
    try { child = frame.contentDocument; child?.addEventListener('keydown',handle); } catch { /* Cross-origin navigation keeps the parent close control. */ }
  };
  layer.addEventListener('keydown', handle);
  frame.addEventListener('load',loaded);
  return () => {detachChild(); layer.removeEventListener('keydown',handle); frame.removeEventListener('load',loaded);};
}
