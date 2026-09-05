/** Separate Layout entry point. Reuses the selected project's existing layout command. */
export function selectedLayoutControl(doc = document) {
  return [...doc.querySelectorAll('.neon-layout')].find(control => control.isConnected && !control.disabled) || null;
}
export function mountLayoutCommand(doc = document) {
  const root = doc.getElementById('map-container');
  if (!root || doc.getElementById('codex-layout-command')) return () => {};
  const wrapper = doc.createElement('div'); wrapper.id = 'codex-layout-command';
  const button = doc.createElement('button'); button.type = 'button'; button.textContent = '▦ Layout';
  button.title = 'Open the selected project’s layout';
  const status = doc.createElement('span'); status.setAttribute('role','status');
  const style = doc.createElement('style');
  style.textContent = '#codex-layout-command{position:absolute;right:12px;top:68px;z-index:1001;display:flex;align-items:flex-end;flex-direction:column;gap:4px;max-width:230px}#codex-layout-command button{min-height:44px;padding:8px 14px;color:#d9f5ff;background:#11252eee;border:1px solid #56838c;border-radius:3px;font:12px monospace;cursor:pointer}#codex-layout-command span:not(:empty){padding:6px;background:#11252eee;color:#d9f5ff;font:12px system-ui}';
  button.addEventListener('click', event => {
    event.stopPropagation();
    const command = selectedLayoutControl(doc);
    if (!command) { status.textContent = 'Select a project with a nearby grid connection to open its layout.'; return; }
    status.textContent = '';
    command.click();
  });
  wrapper.addEventListener('click',event=>event.stopPropagation());
  wrapper.append(button,status); root.append(style,wrapper);
  return () => { wrapper.remove(); style.remove(); };
}
