// Print: a sheet of the world on A3 or A4 landscape, as SVG, PNG or through the browser's own print.
// The sheet itself is built by print-sheet.mjs (pure); this file only touches the page.
//
// The current view is taken from the WebGL canvas INSIDE the frame that drew it: the world's context is
// made without preserveDrawingBuffer, so a read at any other time gives a blank, perfectly valid PNG
// (the lesson GridAtlas's print learnt the hard way). captureView therefore redraws and copies in one
// go, checks the copy is not blank, and returns null rather than a blank picture; the sheet then
// redraws the view as vectors from the same lines and says so on the sheet.

import { buildSheet, sheetDate } from './print-sheet.mjs';
import { PAPER } from './print-layout.mjs';

export { buildSheet, sheetDate, PAPER };

const SHEET_ID = 'world-print-sheet', STYLE_ID = 'world-print-css', PREVIEW_ID = 'world-print-preview';

// Redraws (if given a redraw function) and copies the canvas in the same task. Returns
// { href, width, height } or null when the copy is blank (every pixel pure black or transparent).
export function captureView(canvas, redraw) {
  if (typeof redraw === 'function') redraw();
  const w = canvas.width, h = canvas.height;
  if (!w || !h) return null;
  const copy = document.createElement('canvas');
  copy.width = w; copy.height = h;
  const g = copy.getContext('2d', { willReadFrequently: true });
  g.drawImage(canvas, 0, 0);
  const probe = document.createElement('canvas');
  probe.width = 64; probe.height = 64;
  const pg = probe.getContext('2d', { willReadFrequently: true });
  pg.drawImage(copy, 0, 0, 64, 64);
  const px = pg.getImageData(0, 0, 64, 64).data;
  let lit = false;
  for (let i = 0; i < px.length && !lit; i += 4) lit = px[i] + px[i + 1] + px[i + 2] > 0 && px[i + 3] > 0;
  return lit ? { href: copy.toDataURL('image/png'), width: w, height: h } : null;
}

// A file name that sorts by time and carries the paper: site-world-a3-20260926-2215.svg
export function sheetFileName(paper, ext, date = new Date()) {
  const p = n => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}`;
  return `site-world-${String(paper).toLowerCase()}-${stamp}.${ext}`;
}

function save(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click();
  // Revoking at once races the browser's own read of the blob on some builds.
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 30000);
}

export function downloadSvg(svg, name) {
  save(new Blob([svg], { type: 'image/svg+xml' }), name);
}

// Rasterises the sheet at `dpi` (150 by default: A3 is then 2480 x 1754 px) and resolves to a PNG blob.
export async function sheetPng(svg, paper = 'A3', dpi = 150) {
  const P = PAPER[paper], pxPerMM = dpi / 25.4;
  const w = Math.round(P.w * pxPerMM), h = Math.round(P.h * pxPerMM);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise((ok, fail) => { img.onload = ok; img.onerror = () => fail(Error('the sheet could not be drawn as an image')); img.src = url; });
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.drawImage(img, 0, 0, w, h);
    return await new Promise((ok, fail) => c.toBlob(b => (b ? ok(b) : fail(Error('the browser gave no PNG'))), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

export async function downloadPng(svg, paper, name, dpi) {
  save(await sheetPng(svg, paper, dpi), name);
}

// The print stylesheet: on paper only the sheet shows, at its true size, on a page of its own size.
export function printCss(paper = 'A3') {
  const P = PAPER[paper];
  return `#${SHEET_ID}{display:none}
@media print{
  @page{size:${P.name} landscape;margin:0}
  html,body{background:#fff!important;height:auto!important;overflow:visible!important;margin:0!important;padding:0!important}
  body>*:not(#${SHEET_ID}){display:none!important}
  #${SHEET_ID}{display:block!important;width:${P.w}mm;height:${P.h}mm;overflow:hidden;break-inside:avoid;page-break-after:avoid}
  #${SHEET_ID} svg{display:block;width:${P.w}mm;height:${P.h}mm}
}`;
}

// Sends the sheet to the browser's print dialogue, then tidies up. afterprint is not fired by every
// browser, notably some mobile ones, so the sheet is also removed on a timer; it is hidden on screen anyway.
export function printSheet(svg, paper = 'A3') {
  document.getElementById(SHEET_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement('style');
  style.id = STYLE_ID; style.textContent = printCss(paper);
  const host = document.createElement('div');
  host.id = SHEET_ID; host.innerHTML = svg;
  document.head.appendChild(style); document.body.appendChild(host);
  let done = false;
  const clean = () => { if (done) return; done = true; host.remove(); style.remove(); removeEventListener('afterprint', clean); };
  addEventListener('afterprint', clean);
  // A frame for the stylesheet to apply before the dialogue measures the page.
  setTimeout(() => window.print(), 60);
  setTimeout(clean, 20000);
  return clean;
}

// A preview over the world with Print, Save SVG, Save PNG, a paper choice and Close.
// make(paper) must return buildSheet's result for that paper; it is called again when the paper changes.
// Returns { close, sheet() } so a caller or a test can read what is shown.
export function openSheet(make, { paper = 'A3' } = {}) {
  document.getElementById(PREVIEW_ID)?.remove();
  const root = document.createElement('div');
  root.id = PREVIEW_ID;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Print sheet');
  root.style.cssText = 'position:fixed;inset:0;z-index:50;background:rgba(10,10,10,.94);display:flex;flex-direction:column;'
    + 'font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;color:#cfe9ff';
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 10px;border-bottom:1px solid #1c2c3a';
  const stage = document.createElement('div');
  stage.style.cssText = 'flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:10px;overflow:auto';
  const note = document.createElement('span');
  note.style.cssText = 'color:#6f8ea6;margin-left:auto;overflow-wrap:anywhere';
  let current = null;
  const button = (label, fn, extra = {}) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label;
    b.style.cssText = 'min-height:44px;padding:0 12px;background:#0a0a0a;color:#cfe9ff;border:1px solid #1c2c3a;border-radius:4px;font:inherit;cursor:pointer';
    Object.entries(extra).forEach(([k, v]) => b.setAttribute(k, v));
    b.addEventListener('click', fn); bar.appendChild(b); return b;
  };
  const papers = Object.keys(PAPER).map(p => button(p, () => show(p), { 'data-paper': p, 'aria-pressed': 'false' }));
  function show(p) {
    paper = p; current = make(p);
    stage.innerHTML = current.svg;
    const svg = stage.querySelector('svg');
    svg.removeAttribute('width'); svg.removeAttribute('height');
    svg.style.cssText = `max-width:100%;max-height:100%;width:100%;height:auto;aspect-ratio:${PAPER[p].w}/${PAPER[p].h};background:#fff;box-shadow:0 0 0 1px #1c2c3a`;
    for (const b of papers) b.setAttribute('aria-pressed', String(b.dataset.paper === p));
    note.textContent = `${p} landscape · 1:${current.meta.scale.toLocaleString('en-GB')} · view: ${current.meta.view === 'image' ? 'captured frame' : 'vector redraw'}`;
  }
  button('Print', () => printSheet(current.svg, paper), { 'data-print': 'print' });
  button('Save SVG', () => downloadSvg(current.svg, sheetFileName(paper, 'svg')), { 'data-print': 'svg' });
  button('Save PNG', () => downloadPng(current.svg, paper, sheetFileName(paper, 'png')), { 'data-print': 'png' });
  const close = () => { root.remove(); removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  button('Close', close, { 'data-print': 'close' });
  bar.appendChild(note);
  root.append(bar, stage);
  document.body.appendChild(root);
  addEventListener('keydown', onKey);
  show(paper);
  return { close, sheet: () => current };
}
