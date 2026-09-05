/** Transfer the printer's visible shadow UI without leaking its CSS into the app. */
export function cloneVisiblePrinterUi(liveDocument, clonedDocument) {
  const source = liveDocument.querySelector('#codex-teleprinter');
  const target = clonedDocument.querySelector('#codex-teleprinter');
  if (!source?.shadowRoot || !target) return;
  const wrapper = clonedDocument.createElement('div');
  wrapper.id = target.id;
  wrapper.style.display = 'contents';
  const view = liveDocument.defaultView;
  function copy(node) {
    if (node.nodeType !== 1) return node.cloneNode(true);
    if (node.tagName === 'STYLE' || node.tagName === 'SCRIPT' || (node.tagName === 'DIALOG' && !node.open)) return null;
    const result = node.cloneNode(false);
    const style = view.getComputedStyle(node);
    for (const property of style) result.style.setProperty(property, style.getPropertyValue(property));
    for (const child of node.childNodes) {
      // A closed details element displays only its summary; reconstruct that explicitly.
      if (node.tagName === 'DETAILS' && !node.open && !(child.nodeType === 1 && child.tagName === 'SUMMARY')) continue;
      const cloned = copy(child);
      if (cloned) result.appendChild(cloned);
    }
    return result;
  }
  for (const child of source.shadowRoot.childNodes) {
    const cloned = copy(child);
    if (cloned) wrapper.appendChild(cloned);
  }
  target.replaceWith(wrapper);
}
