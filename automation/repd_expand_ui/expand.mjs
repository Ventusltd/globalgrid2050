/** Expand the existing analytics nodes; never clone data, controls or listeners. */
export function mountRepdExpansion(doc = document) {
  const section = doc.getElementById('officialRegister');
  if (!section || section.querySelector('[data-repd-expand]')) return null;
  const dialog = doc.createElement('dialog');
  // An unsupported browser keeps its ordinary, usable dashboard.
  if (typeof dialog.showModal !== 'function') return null;
  dialog.className = 'repd-expand-dialog';
  dialog.setAttribute('aria-label', 'REPD pipeline analytics expanded view');
  const bar = doc.createElement('div');
  bar.className = 'repd-expand-bar';
  const title = doc.createElement('span');
  title.textContent = 'REPD PIPELINE ANALYTICS';
  const close = doc.createElement('button');
  close.type = 'button';
  close.className = 'btn repd-expand-close';
  close.textContent = 'CLOSE EXPANDED VIEW';
  close.setAttribute('aria-label', 'Close expanded REPD analytics and return to page');
  bar.append(title, close);
  dialog.append(bar);
  const trigger = doc.createElement('button');
  trigger.type = 'button';
  trigger.className = 'btn repd-expand-open';
  trigger.dataset.repdExpand = '';
  trigger.textContent = 'EXPAND ANALYTICS';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  const launcher = doc.createElement('div');
  launcher.className = 'repd-expand-launcher';
  launcher.append(trigger);
  const heading = section.querySelector('#pipelineHeading');
  if (heading) heading.after(launcher);
  else section.prepend(launcher);
  doc.body.append(dialog);
  let marker = null;
  let saved = null;
  let closingPositions = null;
  const win = doc.defaultView;
  const scrollPositions = () => [...section.querySelectorAll('*')]
    .filter(node => node.scrollLeft || node.scrollTop)
    .map(node => ({ node, left: node.scrollLeft, top: node.scrollTop }));
  const restorePositions = (positions) => positions.forEach(({node,left,top}) => {
    node.scrollLeft = left;
    node.scrollTop = top;
  });
  function restore() {
    if (!marker) return;
    const positions = closingPositions || scrollPositions();
    closingPositions = null;
    marker.replaceWith(section);
    marker = null;
    doc.documentElement.style.overflow = saved.htmlOverflow;
    doc.body.style.overflow = saved.bodyOverflow;
    trigger.setAttribute('aria-expanded', 'false');
    restorePositions(positions);
    trigger.focus({ preventScroll: true });
    win.scrollTo(saved.x, saved.y);
  }
  trigger.addEventListener('click', () => {
    if (dialog.open) return;
    saved = { x: win.scrollX, y: win.scrollY,
      htmlOverflow: doc.documentElement.style.overflow,
      bodyOverflow: doc.body.style.overflow };
    marker = doc.createComment('REPD analytics return position');
    const positions = scrollPositions();
    section.before(marker);
    dialog.append(section);
    try {
      dialog.showModal();
      restorePositions(positions);
      doc.documentElement.style.overflow = 'hidden';
      doc.body.style.overflow = 'hidden';
      trigger.setAttribute('aria-expanded', 'true');
      close.focus({ preventScroll: true });
    } catch (error) {
      restore();
      // Leave the normal dashboard usable if modal display is unavailable.
      console.warn('REPD expanded view unavailable', error);
    }
  });
  close.addEventListener('click', () => {
    closingPositions = scrollPositions();
    dialog.close();
  });
  dialog.addEventListener('cancel', () => { closingPositions = scrollPositions(); });
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll('button,input,select,textarea,a[href],summary,[tabindex]')]
      .filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length);
    const first = items[0], last = items.at(-1);
    if ((event.shiftKey && doc.activeElement === first)
        || (!event.shiftKey && doc.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  });
  // Native Escape/cancel also fires close. Nested note dialogs retain their own Escape.
  dialog.addEventListener('close', restore);
  return { dialog, trigger, close };
}

if (typeof document !== 'undefined') mountRepdExpansion();
