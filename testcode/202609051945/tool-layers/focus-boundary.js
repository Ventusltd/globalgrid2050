/** Keep keyboard traversal within a same-origin tool without changing its internal tab order. */
export function bindFocusBoundary(layer, frame, close) {
  let child;
  const items = () => [...(child?.querySelectorAll('a[href],button,input,select,textarea,[tabindex]') || [])]
    .filter(node => !node.disabled && node.tabIndex >= 0 && !node.closest('[inert]') && node.getClientRects().length && child.defaultView.getComputedStyle(node).visibility !== 'hidden');
  const handle = event => {
    if(event.key !== 'Tab' || event.defaultPrevented || layer.style.display === 'none' || !child) return;
    const nodes=items(), first=nodes[0], last=nodes.at(-1);
    let target;
    if(event.target===close) target=event.shiftKey ? last : first;
    else if(event.shiftKey && event.target===first || !event.shiftKey && event.target===last) target=close;
    if(event.target===close && !target) target=close;
    if(target) {event.preventDefault();target.focus();}
  };
  const loaded = () => {
    child?.removeEventListener('keydown',handle); child=undefined;
    try {child=frame.contentDocument;child?.addEventListener('keydown',handle);} catch { /* Parent close remains keyboard accessible after cross-origin navigation. */ }
  };
  layer.addEventListener('keydown',handle);frame.addEventListener('load',loaded);
  return () => {child?.removeEventListener('keydown',handle);layer.removeEventListener('keydown',handle);frame.removeEventListener('load',loaded);};
}
