import { printScreen } from './print-screen.js';
import { attachPrintSourceCode } from './print-source-code.js';
import { captureRuntimeSource } from './runtime-source.js';

/** The app supplies pinned source URLs; both engines remain authored in Teleprinter. */
export function mountTeleprinter({ manifestUrl, textUrl, expectedCommit, expectedRepository, appName = 'This app', printButtons }) {
  const host = document.createElement('div');
  host.id = 'codex-teleprinter';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
  :host{position:fixed;right:12px;bottom:64px;z-index:10020;font:16px system-ui;color:#eaf8ff}button{font:inherit;min-height:44px;padding:10px 14px;background:#d6f7ff;color:#102630;border:1px solid #77a4b1;border-radius:6px;cursor:pointer}button:disabled{opacity:.55}dialog{color:#eaf8ff;background:#10232d;border:1px solid #83aaba;border-radius:8px;width:min(560px,calc(100vw - 24px));max-height:85dvh;overflow:auto;padding:18px;font:16px system-ui}dialog::backdrop{background:#0008}h2{margin:0 0 12px;font-size:22px}.actions{display:flex;flex-wrap:wrap;gap:8px}p{line-height:1.45}textarea{font:14px monospace;min-height:160px}input{max-width:100%}summary{min-height:44px;cursor:pointer;padding-top:12px}.close{float:right;margin-left:12px}#status{overflow-wrap:anywhere}
  </style><button id="open">Teleprinter</button><dialog aria-label="Teleprinter"><button class="close" id="close">Close</button><h2>Teleprinter</h2><p id="name"></p><div class="actions"><button id="screen">Print</button><button id="source">Print source code</button><button id="copy">Copy source code</button><button id="share" hidden>Share source code</button></div><p>Print saves the screen as a digital PDF. Print source code saves a text file: attach it in ChatGPT, or use Copy source code and paste it into your chat.</p><p id="status" role="status" aria-live="polite"></p><details><summary>Print a screenshot</summary><p>On a phone that cannot capture its own screen, take a screenshot first and choose it here.</p><input id="image" aria-label="Choose a screenshot" type="file" accept="image/png,image/jpeg,image/webp"><button id="image-print">Print selected screenshot</button></details><div id="fallback"></div></dialog>`;
  document.body.append(host);
  const el = id => shadow.getElementById(id);
  const dialog = shadow.querySelector('dialog');
  const status = el('status');
  el('name').textContent = appName;
  let sourceControls;
  const openSource = () => {
    dialog.showModal();
    sourceControls?.();
    sourceControls = attachPrintSourceCode({button:el('source'),copyButton:el('copy'),shareButton:el('share'),status,fallbackContainer:el('fallback'),manifestUrl,textUrl,expectedCommit,expectedRepository,filename:`${appName}-screen-source-code.txt`,prepareSource:({bytes,manifest})=>captureRuntimeSource({baseBytes:bytes,baseManifest:manifest})});
    return sourceControls;
  };
  el('open').onclick = openSource;
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
    } catch(error) { status.textContent = error.message; dialog.showModal(); }
    finally { printing=false; }
  }
  el('screen').onclick = () => print();
  el('image-print').onclick = () => {
    const image = el('image').files[0];
    if (!image) { status.textContent='Choose a screenshot first.'; return; }
    print(image);
  };
  // Existing app File -> Print is the same engine, not a separate map-canvas route.
  const appPrint = event => {
    if (!printButtons) return;
    const button = event.composedPath().find(node=>node instanceof Element && node.matches(printButtons));
    if (!button || !/\bprint\b/i.test(button.textContent)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    print();
  };
  document.addEventListener('click',appPrint,true);
  // File is the reader's existing home for both print commands. The Atlas menu
  // installs asynchronously, so attach once when its real Print control exists.
  let fileSource;
  let menuObserver;
  const installFileSource = () => {
    if (!printButtons || fileSource) return;
    const filePrint = [...document.querySelectorAll(printButtons)].find(button => /\bprint\b/i.test(button.textContent));
    if (!filePrint) return;
    menuObserver?.disconnect();
    fileSource = document.createElement('button');
    fileSource.type = 'button';
    fileSource.dataset.codexPrintSource = '1';
    fileSource.className = filePrint.className;
    fileSource.style.cssText = filePrint.style.cssText;
    fileSource.style.minHeight = '44px';
    fileSource.textContent = 'Print source code';
    fileSource.addEventListener('click', async () => {
      const current = openSource();
      const result = await current.ready;
      if (result && sourceControls === current && dialog.open) el('source').click();
    });
    filePrint.insertAdjacentElement('afterend', fileSource);
  };
  installFileSource();
  if (printButtons && !fileSource) {
    menuObserver = new MutationObserver(installFileSource);
    menuObserver.observe(document.body, {childList:true,subtree:true});
  }
  return () => { menuObserver?.disconnect(); fileSource?.remove(); document.removeEventListener('click',appPrint,true); sourceControls?.(); host.remove(); };
}
