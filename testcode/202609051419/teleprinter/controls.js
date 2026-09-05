import { printScreen } from './print-screen.js';
import { attachPrintSourceCode } from './print-source-code.js';

/** The app supplies pinned source URLs; both engines remain authored in Teleprinter. */
export function mountTeleprinter({ manifestUrl, textUrl, expectedCommit, expectedRepository, appName = 'This app' }) {
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
  el('open').onclick = () => {
    dialog.showModal();
    sourceControls ||= attachPrintSourceCode({button:el('source'),copyButton:el('copy'),shareButton:el('share'),status,fallbackContainer:el('fallback'),manifestUrl,textUrl,expectedCommit,expectedRepository,filename:`${appName}-source-code.txt`});
  };
  el('close').onclick = () => dialog.close();
  const capture = window.__codexTeleprinterCapture ? async () => {
    const value = await window.__codexTeleprinterCapture();
    return new Blob([Uint8Array.from(atob(value), char => char.charCodeAt(0))],{type:'image/png'});
  } : undefined;
  async function print(image) {
    dialog.close();
    try {
      const receipt = await printScreen({capture,image,filename:`${appName}-screen.pdf`});
      status.textContent = `PDF ready: ${receipt.width} × ${receipt.height} pixels. Check your downloads.`;
      host.dispatchEvent(new CustomEvent('teleprint',{detail:receipt}));
    } catch(error) { status.textContent = error.message; dialog.showModal(); }
  }
  el('screen').onclick = () => print();
  el('image-print').onclick = () => {
    const image = el('image').files[0];
    if (!image) { status.textContent='Choose a screenshot first.'; return; }
    print(image);
  };
  return () => { sourceControls?.(); host.remove(); };
}
