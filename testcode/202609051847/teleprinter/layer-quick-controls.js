/** Extracted from GridAtlas installMobileTray/quickChip; existing engine controls remain authoritative. */
export const GRID_LAYER_IDS = Object.freeze(['400', '275', '220', '132', '66']);
export function toggleLayerGroup(boxes) {
  if (!boxes.length) return;
  const turnOn = boxes.some(box => !box.checked);
  for (const box of boxes) if (box.checked !== turnOn) box.click();
}
export function mountLayerQuickControls(doc = document) {
  const root = doc.getElementById('map-container');
  if (!root || doc.getElementById('codex-layer-quick-controls')) return () => {};
  const tray = doc.createElement('div');
  tray.id = 'codex-layer-quick-controls'; tray.setAttribute('role', 'group'); tray.setAttribute('aria-label', 'Map layers');
  const style = doc.createElement('style');
  style.textContent = '#codex-layer-quick-controls{position:absolute;left:max(10px,env(safe-area-inset-left));bottom:max(30px,env(safe-area-inset-bottom));display:flex;gap:5px;z-index:1001}#codex-layer-quick-controls button{min-width:64px;min-height:44px;padding:8px;color:#d9f5ff;background:#11252ee8;border:1px solid #56838c;border-radius:3px;font:12px monospace;cursor:pointer}#codex-layer-quick-controls button[aria-pressed="true"]{background:#34555d;border-color:#92d6e3}#codex-layer-quick-controls button:disabled{opacity:.5}';
  const commands = [['⚡ GRID', GRID_LAYER_IDS], ['◉ SUBS', ['subs']]].map(([label, ids]) => {
    const button = doc.createElement('button'); button.type = 'button'; button.textContent = label;
    button.dataset.layerCommand = ids.length > 1 ? 'grid' : 'subs';
    const boxes = () => ids.map(id => doc.querySelector('#scada-ui-container input[type="checkbox"][data-layer-id="'+id+'"]'));
    const reflect = () => {
      const inputs = boxes();
      button.disabled = inputs.some(input => !input);
      button.setAttribute('aria-pressed', String(!button.disabled && inputs.every(input => input.checked)));
      button.title = button.disabled ? 'Waiting for the layer controls' : label;
    };
    button.addEventListener('click', event => { event.stopPropagation(); toggleLayerGroup(boxes().filter(Boolean)); reflect(); });
    tray.appendChild(button); return {reflect};
  });
  const refresh = () => {
    // Replace only the two old chips, retaining other mobile tools and their handlers.
    for (const button of doc.querySelectorAll('#gridatlas-mobile-tray button')) {
      if (/^(?:⚡\s*Grid|◉\s*Subs)$/i.test(button.textContent.trim())) button.hidden = true;
    }
    for (const command of commands) command.reflect();
  };
  tray.addEventListener('click', event => event.stopPropagation());
  root.append(style, tray);
  const observer = new MutationObserver(refresh); observer.observe(root, {childList:true,subtree:true});
  doc.addEventListener('change', refresh); refresh();
  return () => { observer.disconnect(); doc.removeEventListener('change',refresh); tray.remove(); style.remove(); };
}
