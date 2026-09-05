import { printScreen } from './print-screen.js';
import { attachPrintSourceCode } from './print-source-code.js';
import { captureRuntimeSource } from './runtime-source.js';

/** The app supplies pinned source URLs; both engines remain authored in Teleprinter. */
export function mountTeleprinter({ manifestUrl, textUrl, expectedCommit, expectedRepository, appName = 'This app', printButtons }) {
  const host = document.createElement('div');
  host.id = 'codex-teleprinter';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
  :host{display:contents;font:16px system-ui;color:#eaf8ff}button{font:inherit;min-height:44px;padding:10px 14px;background:#d6f7ff;color:#102630;border:1px solid #77a4b1;border-radius:6px;cursor:pointer}button:disabled{opacity:.55}dialog{color:#eaf8ff;background:#10232d;border:1px solid #83aaba;border-radius:8px;width:min(560px,calc(100vw - 24px));max-height:85dvh;overflow:auto;padding:18px;font:16px system-ui}dialog::backdrop{background:#0008}h2{margin:0 0 12px;font-size:22px}.actions{display:flex;flex-wrap:wrap;gap:8px}p{line-height:1.45}textarea{font:14px monospace;min-height:160px}input{max-width:100%}summary{min-height:44px;cursor:pointer;padding:10px;box-sizing:border-box}.close{float:right;margin-left:12px}#status{overflow-wrap:anywhere}#file-nav{position:relative;z-index:10020;background:#10232d;border-bottom:1px solid #52707c;padding:0 12px;min-height:44px}#file-menu{width:max-content}#file-menu>summary{color:#eaf8ff;font-weight:600}#file-commands{position:absolute;z-index:1;display:grid;gap:4px;min-width:220px;padding:8px;background:#10232d;border:1px solid #83aaba;border-radius:5px;box-shadow:0 4px 12px #0006}#file-commands button{text-align:left}
  </style><dialog aria-label="Print options"><button class="close" id="close">Close</button><h2 id="dialog-title">Print options</h2><p id="name"></p><div class="actions"><button id="screen">Print PDF</button><button id="source">Print source code</button><button id="copy">Copy source code</button><button id="share" hidden>Share source code</button></div><p>Print PDF saves the screen as a digital PDF. Print source code saves a text file: attach it in ChatGPT, or use Copy source code and paste it into your chat.</p><p id="status" role="status" aria-live="polite"></p><details id="screenshot-options"><summary>Print a screenshot</summary><p>On a phone that cannot capture its own screen, take a screenshot first and choose it here.</p><input id="image" aria-label="Choose a screenshot" type="file" accept="image/png,image/jpeg,image/webp"><button id="image-print">Print selected screenshot</button></details><div id="fallback"></div></dialog>`;
  document.body.prepend(host);
  const el = id => shadow.getElementById(id);
  const dialog = shadow.querySelector('dialog');
  const status = el('status');
  el('name').textContent = appName;
  let sourceControls;
  let fallbackMenu;
  const shareSupported = typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
  const openDialog = title => {
    el('dialog-title').textContent = title;
    dialog.setAttribute('aria-label', title);
    if (!dialog.open) dialog.showModal();
  };
  const openSource = () => {
    openDialog('Print source code');
    el('screenshot-options').open = false;
    sourceControls?.();
    sourceControls = attachPrintSourceCode({button:el('source'),copyButton:el('copy'),shareButton:el('share'),status,fallbackContainer:el('fallback'),manifestUrl,textUrl,expectedCommit,expectedRepository,filename:`${appName}-screen-source-code.txt`,prepareSource:({bytes,manifest})=>captureRuntimeSource({baseBytes:bytes,baseManifest:manifest})});
    return sourceControls;
  };
  el('close').onclick = () => dialog.close();
  const capture = window.__codexTeleprinterCapture ? async () => {
    const value = await window.__codexTeleprinterCapture();
    return new Blob([Uint8Array.from(atob(value), char => char.charCodeAt(0))],{type:'image/png'});
  } : undefined;
  let printing = false;
  async function print(image) {
    if (printing) return;
    printing = true;
    dialog.close();
    try {
      const generation = document.documentElement.dataset.gridatlasGeneration || location.pathname.match(/\/testcode\/(\d+)\//)?.[1] || '';
      const attribution = [...document.querySelectorAll('.maplibregl-ctrl-attrib-inner')].map(node=>node.textContent.trim()).filter(Boolean).join(' | ');
      const furniture = {brand:appName==='GridAtlas'?'VENTUS  GLOBALGRID2050 · GRID ATLAS':'GLOBALGRID2050',title:appName==='GridAtlas'?'GlobalGrid2050 · Grid Atlas':appName,url:location.href,generation,capturedAt:new Date().toISOString(),credit:attribution || (appName==='GridAtlas'?'Data © OpenStreetMap contributors | © CARTO | EV data © Open Charge Map':'GlobalGrid2050'),scale:Math.min(devicePixelRatio||1,2)};
      const receipt = await printScreen({capture,image,furniture,filename:`${appName}-screen.pdf`});
      status.textContent = `PDF ready: ${receipt.width} × ${receipt.height} pixels. Check your downloads.`;
      host.dispatchEvent(new CustomEvent('teleprint',{detail:receipt}));
    } catch(error) { status.textContent = error.message; openDialog('Print options'); }
    finally { printing=false; }
  }
  el('screen').onclick = () => print();
  // The dialog can also be opened for screenshots; prepare source on demand there.
  el('source').onclick = () => { if (!sourceControls) sourceAction('download'); };
  el('copy').onclick = () => { if (!sourceControls) sourceAction('copy'); };
  el('share').onclick = () => { if (!sourceControls) sourceAction('share'); };
  el('share').hidden = !shareSupported;
  el('image-print').onclick = () => {
    const image = el('image').files[0];
    if (!image) { status.textContent='Choose a screenshot first.'; return; }
    print(image);
  };
  // Existing app File -> Print is the same engine, not a separate map-canvas route.
  const appPrint = event => {
    if (!printButtons) return;
    const button = event.composedPath().find(node=>node instanceof Element && node.matches(printButtons));
    if (!button || button.dataset.codexPrintCommand || !/\bprint\b/i.test(button.textContent)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    print();
  };
  document.addEventListener('click',appPrint,true);
  // File is the reader's existing home for both print commands. The Atlas menu
  // installs asynchronously, so attach once when its real Print control exists.
  const installedCommands = [];
  let menuObserver;
  let menuTimer;
  let installed = false;
  function closeFallbackMenu() { if (fallbackMenu) fallbackMenu.open = false; }
  async function sourceAction(action) {
    closeFallbackMenu();
    const current = openSource();
    const result = await current.ready;
    if (!result || sourceControls !== current || !dialog.open) return;
    if (action === 'download') el('source').click();
    else {
      const control = action === 'share' ? el('share') : el('copy');
      status.textContent += action === 'share' ? ' Tap Share source code to open your share options.' : ' Tap Copy source code to copy the prepared text.';
      control.focus();
    }
  }
  const screenshotAction = () => {
    closeFallbackMenu();
    openDialog('Print options');
    el('screenshot-options').open = true;
    el('image').focus();
  };
  const commandDefinitions = [
    ['source', 'Print source code', () => sourceAction('download')],
    ['copy', 'Copy source code', () => sourceAction('copy')],
    ['share', 'Share source code', () => sourceAction('share')],
    ['screenshot', 'Print a screenshot', screenshotAction],
  ];
  function makeCommand(id, label, action, model) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.codexPrintCommand = id;
    if (id === 'source') button.dataset.codexPrintSource = '1';
    if (model) {
      button.className = model.className;
      button.style.cssText = model.style.cssText;
      if (model.getAttribute('role') === 'menuitem') button.setAttribute('role', 'menuitem');
    }
    button.style.minHeight = '44px';
    button.textContent = label;
    button.hidden = id === 'share' && !shareSupported;
    if (button.hidden) button.style.display = 'none';
    button.addEventListener('click', event => { event.preventDefault(); action(); });
    installedCommands.push(button);
    return button;
  }
  function installFallbackFile() {
    if (installed) return;
    installed = true;
    menuObserver?.disconnect(); clearTimeout(menuTimer);
    const nav = document.createElement('nav');
    nav.id = 'file-nav'; nav.setAttribute('aria-label', 'File');
    fallbackMenu = document.createElement('details'); fallbackMenu.id = 'file-menu';
    const summary = document.createElement('summary'); summary.textContent = 'File';
    const commands = document.createElement('div'); commands.id = 'file-commands';
    commands.append(makeCommand('pdf', 'Print PDF', () => print()));
    for (const definition of commandDefinitions) commands.append(makeCommand(...definition));
    fallbackMenu.append(summary, commands); nav.append(fallbackMenu); shadow.prepend(nav);
    fallbackMenu.addEventListener('keydown', event => { if (event.key === 'Escape') { fallbackMenu.open = false; summary.focus(); } });
  }
  const installFileSource = () => {
    if (!printButtons || installed) return;
    const filePrint = [...document.querySelectorAll(printButtons)].find(button => !button.dataset.codexPrintCommand && /\bprint\b/i.test(button.textContent));
    if (!filePrint) return;
    installed = true;
    menuObserver?.disconnect(); clearTimeout(menuTimer);
    let previous = filePrint;
    for (const definition of commandDefinitions) {
      const button = makeCommand(...definition, filePrint);
      previous.insertAdjacentElement('afterend', button);
      previous = button;
    }
  };
  installFileSource();
  if (!printButtons) installFallbackFile();
  else if (!installed) {
    menuObserver = new MutationObserver(installFileSource);
    menuObserver.observe(document.body, {childList:true,subtree:true});
    menuTimer = setTimeout(installFallbackFile, 60000);
  }
  return () => { clearTimeout(menuTimer); menuObserver?.disconnect(); for (const command of installedCommands) command.remove(); document.removeEventListener('click',appPrint,true); sourceControls?.(); host.remove(); };
}
