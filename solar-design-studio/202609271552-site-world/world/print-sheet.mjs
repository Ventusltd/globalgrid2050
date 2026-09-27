// The whole print sheet as one SVG string: plan, current view, north arrow, scale bar, National Grid
// references, title block and the credit for exactly the loaded layers. Pure: no DOM, no WebGL.
// Style after the GridAtlas print furniture: monospace, letter-spaced heading, the credit beneath the
// drawing and a stamp; here the stamp grows into a title block with the layers shown and the warning.

import { footerText, unknownLayers } from './attribution.mjs';
import { sheetLayout, fitCredit, wrapText } from './print-layout.mjs';
import {
  FONT, INK, MUTED, RULE, esc, inkFor, planPaths, viewPaths, northArrow, scaleBarSvg, gridSvg,
  planFrame, scaleBar, gridTicks, refAt, trueNorthOffset, bearingText,
} from './print-svg.mjs';

export const NOT_FOR_CONSTRUCTION = 'NOT FOR CONSTRUCTION';
export const CAVEAT = 'Illustrative only. Positions are converted to the British National Grid by a Helmert transformation '
  + '(about 3.5 m); nothing here is surveyed, designed or checked.';
export const NO_CREDIT = 'No third-party data is shown on this sheet.';
// The viewer's own drawing (the design) needs no third-party credit.
// This tool's own illustrative work (and lines derived from a credited layer, such as the overhead line zones from the
// grid): no third-party credit of its own.
const OWN_WORK = /^(design|plant|block|piles|pile|sld|module|cmd|follow|ohl-safety|zones)(-|$)/;
// Legend words for layer ids: numbered items fold into one entry, and no internal id reaches the sheet (user test H8).
const LEGEND_WORDS = [[/^design-trench/, 'Trenches'], [/^design-section/, 'Trench sections'], [/^design-cable/, 'Cables'], [/^design/, 'Design'],
  [/^plant-piles|^piles/, 'Piles'], [/^plant/, 'Solar plant'], [/^block-tables/, 'Solar block tables'], [/^block-strings/, 'Solar block strings'],
  [/^block-(dc|ac|mv|pull)/, 'Solar block cables'], [/^block/, 'Solar block'], [/^ohl-safety|^zones/, 'Overhead line zones'],
  [/^ground-grid/, 'Ground grid'], [/^grid/, 'Grid network'], [/^sld/, 'Single-line diagram'], [/^module/, 'Module detail']];
export function legendLabel(id) {
  const w = LEGEND_WORDS.find(([re]) => re.test(id));
  if (w) return w[1];
  const s = String(id).replace(/-\d+$/, '').replace(/[-_]+/g, ' ').trim();
  return s ? s[0].toUpperCase() + s.slice(1) : 'Lines';
}
// "202609262035" -> "26 September 2026, 20:35"; anything else is left off the sheet (never a raw stamp).
export function dataDate(g) {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(String(g || ''));
  if (!m) return '';
  return `${sheetDate(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`)}, ${m[4]}:${m[5]}`;
}

// 26 September 2026 (British order, month in words so it cannot be misread).
export function sheetDate(date) {
  const d = date instanceof Date ? date : new Date(date ?? Date.now());
  if (Number.isNaN(d.getTime())) throw Error('sheetDate needs a valid date');
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const f = v => (Math.round(v * 100) / 100).toString();
const t = (x, y, s, size, extra = '') => `<text x="${f(x)}" y="${f(y)}" font-size="${f(size)}"${extra}>${esc(s)}</text>`;
const rect = (r, extra = '') => `<rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}"${extra}/>`;
const clipDef = (id, r) => `<clipPath id="${id}">${rect(r)}</clipPath>`;
const stroke = (p, w) => `<path d="${p.d}" stroke="${p.stroke}" stroke-opacity="${f(p.opacity)}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;

// A small label with a white backing, so it reads over the drawing.
function tag(x, y, s, size = 2.1, extra = '') {
  const w = s.length * size * 0.6 + 2;
  return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(size + 1.6)}" fill="#fff" fill-opacity="0.9"/>`
    + t(x + 1, y + size + 0.5, s, size, ` fill="${INK}"${extra}`);
}

// opts:
//   paper        'A3' | 'A4'                 batches   the world's line batches (as given to lines.draw)
//   camera       { pos, yaw, pitch, fov?, label?, eyeHeight? }    origin  { e, n } National Grid metres
//   site         { name }  a neutral name      layerIds  ids of the loaded layers   attribution  data/attribution.json
//   date         Date or ISO string          generation  manifest generation stamp (optional)
//   viewImage    { href, width, height }: the captured frame; omit for a vector redraw of the view
//   extent       { x0, y0, x1, y1 } local metres to frame the plan (default: the batches' bounds, capped)
//   fade         metres at which lines vanish (the world's FADE_M)
// Returns { svg, meta }. meta repeats the facts on the sheet so a caller or a test can check them.
export function buildSheet(opts) {
  const { paper = 'A3', batches = [], camera, origin = { e: 0, n: 0 }, site = {}, layerIds = [], attribution,
    date, generation = '', viewImage = null, extent = null, fade = 450 } = opts || {};
  if (!camera || !Array.isArray(camera.pos)) throw Error('buildSheet needs the camera { pos, yaw, pitch }');
  if (!attribution) throw Error('buildSheet needs the attribution data; a sheet is never printed without its credit');
  const aspect = viewImage && viewImage.width > 0 ? viewImage.height / viewImage.width : camera.aspect;
  const L = sheetLayout(paper, { aspect });
  const frame = planFrame(L, { batches, extent, centre: extent ? null : [camera.pos[0], camera.pos[1]] });
  const ticks = gridTicks(frame, L, origin);
  const bar = scaleBar(frame, L);
  const ce = origin.e + frame.centre[0], cn = origin.n + frame.centre[1];
  const tn = trueNorthOffset(ce, cn);
  const centreRef = refAt(origin, frame.centre[0], frame.centre[1], 10);
  const eyeRef = refAt(origin, camera.pos[0], camera.pos[1], 10);
  // Credit what is loaded and what is drawn; anything drawn without a registered credit is named on the sheet.
  const legend = legendOf(batches);
  const creditIds = [...new Set([...layerIds, ...legend.map(e => e.name)])].filter(id => !OWN_WORK.test(id));
  const credit = footerText(creditIds, attribution, { year: dateYear(date) });
  const missing = unknownLayers(creditIds, attribution);
  const creditText = [credit || (missing.length ? '' : NO_CREDIT),
    missing.length ? `${missing.length === 1 ? 'One drawn layer has' : `${missing.length} drawn layers have`} no source credit registered here: check before issue.` : '']
    .filter(Boolean).join(' · ');
  const name = String(site.name || 'Unnamed site');
  const dateText = sheetDate(date);
  const heightOk = Number.isFinite(camera.eyeHeight);

  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${L.paper.w}mm" height="${L.paper.h}mm" `
      + `viewBox="0 0 ${L.paper.w} ${L.paper.h}" font-family="${esc(FONT)}" data-paper="${L.paper.name}" data-scale="${frame.scale}">`,
    `<title>${esc(`${name}: plan and view, ${L.paper.name} landscape`)}</title>`,
    `<defs>${clipDef('plan-clip', L.planDraw)}${clipDef('view-clip', L.view)}</defs>`,
    `<rect width="${L.paper.w}" height="${L.paper.h}" fill="#fff"/>`,
    rect(L.frame, ` fill="none" stroke="${INK}" stroke-width="0.5"`),
  ];

  // Plan
  out.push(rect(L.plan, ` fill="none" stroke="${INK}" stroke-width="0.3"`), rect(L.planDraw, ` fill="none" stroke="${INK}" stroke-width="0.2"`));
  out.push(gridSvg(ticks, L));
  out.push('<g clip-path="url(#plan-clip)">', ...planPaths(batches, frame, L).map(p => stroke(p, 0.15)));
  const [ex, ey] = [L.planDraw.x + L.planDraw.w / 2 + (camera.pos[0] - frame.centre[0]) / frame.mPerMM,
    L.planDraw.y + L.planDraw.h / 2 - (camera.pos[1] - frame.centre[1]) / frame.mPerMM];
  out.push(viewerMark(ex, ey, camera.yaw), '</g>');
  const d = L.planDraw;
  out.push(tag(d.x + 1.5, d.y + 1.5, 'PLAN · straight down, grid north up', 2.1, ' letter-spacing="0.15"'));
  // The north arrow on its own clear zone: opaque, outlined, a margin round the arrow (nothing drawn shows through).
  out.push(`<rect x="${f(d.x + d.w - 19)}" y="${f(d.y + 1)}" width="18" height="${L.small ? 25 : 28}" fill="#fff" stroke="${RULE}" stroke-width="0.2"/>`);
  out.push(northArrow(d.x + d.w - 9.5, d.y + 12, L.small ? 9 : 11, tn));
  out.push(`<rect x="${f(d.x + 2)}" y="${f(d.y + d.h - 12)}" width="${f(bar.mm + 10)}" height="10" fill="#fff" fill-opacity="0.9"/>`);
  out.push(scaleBarSvg(bar, d.x + 5, d.y + d.h - 8.5, frame.scale));

  // Current view
  const v = L.view;
  out.push(rect(v, ` fill="${viewImage ? '#0a0a0a' : '#fff'}" stroke="none"`), '<g clip-path="url(#view-clip)">');
  if (viewImage) {
    out.push(`<image x="${f(v.x)}" y="${f(v.y)}" width="${f(v.w)}" height="${f(v.h)}" preserveAspectRatio="xMidYMid meet" `
      + `href="${esc(viewImage.href)}" xlink:href="${esc(viewImage.href)}"/>`);
  } else {
    out.push(...viewPaths(batches, camera, v, { fade }).map(p => stroke(p, 0.18)));
  }
  out.push('</g>', rect(v, ` fill="none" stroke="${INK}" stroke-width="0.3"`));
  const how = viewImage ? 'the frame on screen when printed' : 'redrawn from the same lines; ground does not hide lines here';
  out.push(tag(v.x + 1.5, v.y + 1.5, 'CURRENT VIEW', 2.1, ' letter-spacing="0.15"'));
  const look = `${camera.label || 'View'} · looking ${bearingText(camera.yaw)}` + (heightOk ? ` · eye ${camera.eyeHeight.toFixed(1)} m above ground` : '');
  out.push(tag(v.x + 1.5, v.y + v.h - 9.2, look, 1.9), tag(v.x + 1.5, v.y + v.h - 4.8, how, 1.9));

  // Credit (under the plan): exactly the loaded layers' lines, never trimmed
  const c = L.credit, headSize = 2.2;
  out.push(rect(c, ` fill="none" stroke="${INK}" stroke-width="0.3"`));
  out.push(t(c.x + 2, c.y + 4, 'DATA SHOWN ON THIS SHEET', headSize, ` fill="${INK}" letter-spacing="0.4"`));
  const fit = fitCredit(creditText, c.w - 4, c.h - 7.5);
  fit.lines.forEach((line, i) => out.push(t(c.x + 2, c.y + 7 + fit.size * (1 + i * 1.3), line, fit.size, ` fill="${MUTED}"`)));

  // Title block (under the view)
  out.push(titleBlock(L, { name, dateText, frame, centreRef, eyeRef, generation, tn, legend }));
  out.push('</svg>');
  const meta = { paper: L.paper.name, scale: frame.scale, centreRef, eyeRef, credit, creditFits: fit.fits,
    creditComplete: missing.length === 0, creditMissing: missing, squares: ticks.squares,
    creditSize: fit.size, trueNorth: tn, gridSpacing: ticks.spacing, scaleBar: bar.label, date: dateText,
    view: viewImage ? 'image' : 'vector', layers: legend.map(e => e.name) };
  return { svg: out.join(''), meta };
}

function dateYear(date) {
  const d = date instanceof Date ? date : new Date(date ?? Date.now());
  return Number.isNaN(d.getTime()) ? undefined : d.getUTCFullYear();
}

// The viewer's position and heading on the plan: a small circle and a tick along the look direction.
function viewerMark(x, y, yaw) {
  const dx = Math.sin(yaw) * 4, dy = -Math.cos(yaw) * 4;
  return `<g stroke="#b00020" stroke-width="0.35" fill="none"><circle cx="${f(x)}" cy="${f(y)}" r="1.2"/>`
    + `<path d="M${f(x)} ${f(y)}L${f(x + dx)} ${f(y + dy)}"/></g>`;
}

// One legend entry per layer: batch keys are "layer/part", so the part before the slash names the layer.
export function legendOf(batches) {
  const seen = new Map();
  for (const b of batches || []) {
    if (b.occluder || !b.positions || !b.key) continue;
    const name = String(b.key).split('/')[0];
    if (!seen.has(name)) seen.set(name, inkFor(b.color));
  }
  return [...seen].map(([name, ink]) => ({ name, ...ink }));
}

function titleBlock(L, { name, dateText, frame, centreRef, eyeRef, generation, tn, legend: drawn }) {
  let legend = drawn;
  const r = L.title, out = [rect(r, ` fill="none" stroke="${INK}" stroke-width="0.3"`)];
  const x = r.x + 2.5, size = L.small ? 1.9 : 2.5, row = size * 1.5, cs = L.small ? 1.6 : 1.9;
  out.push(t(x, r.y + 4, 'SITE WORLD · PLAN AND VIEW', 1.9, ` fill="${MUTED}" letter-spacing="0.45"`));
  const nameSize = L.small ? 3.6 : 5.2;
  out.push(t(x, r.y + 5.5 + nameSize, wrapText(name, r.w - 5, nameSize)[0] || '', nameSize, ` fill="${INK}" font-weight="700"`));
  const rows = [
    ['Centre', centreRef || 'off the National Grid'],
    ['Viewer', eyeRef || 'off the National Grid'],
    ['Scale', `1:${frame.scale.toLocaleString('en-GB')} at ${L.paper.name} · grid north up`],
    ['North', tn === null ? 'off the National Grid' : Math.abs(tn) < 0.005 ? 'true north on grid north'
      : `true north ${Math.abs(tn).toFixed(2)}° ${tn >= 0 ? 'east' : 'west'} of grid north`],
    ['Date', dateText],
  ];
  if (dataDate(generation)) rows.push(['Data', `as of ${dataDate(generation)}`]);
  let y = r.y + 7 + nameSize + 3.2;
  for (const [k, val] of rows) {
    out.push(t(x, y, k.toUpperCase(), size * 0.9, ` fill="${MUTED}" letter-spacing="0.25"`), t(x + size * 6.5, y, val, size, ` fill="${INK}"`));
    y += row;
  }
  // The warning: a boxed band across the foot of the block, the caveat above it
  const bandH = L.small ? 6 : 7, by = r.y + r.h - bandH - 1.5;
  const cav = wrapText(CAVEAT, r.w - 5, cs), cavTop = by - 1.2 - (cav.length - 1) * cs * 1.3 - cs;
  // Layers between the rows and the caveat, in two columns, as many as there is room for
  out.push(`<path d="M${f(r.x)} ${f(y - size + 0.6)}H${f(r.x + r.w)}" stroke="${RULE}" stroke-width="0.15"/>`);
  y += 1.6;
  out.push(t(x, y, 'LAYERS DRAWN', size * 0.9, ` fill="${MUTED}" letter-spacing="0.25"`));
  y += row;
  const colW = (r.w - 5) / 2, fit = Math.max(0, Math.floor((cavTop - 2 - (y - size)) / row)) * 2;
  const byLabel = new Map();
  for (const e of legend) if (!byLabel.has(legendLabel(e.name))) byLabel.set(legendLabel(e.name), { ...e, name: legendLabel(e.name) });
  legend = [...byLabel.values()];
  const shown = legend.length > fit ? legend.slice(0, Math.max(0, fit - 1)) : legend;
  shown.forEach((e, i) => {
    const cx = x + (i % 2) * colW, cy = y + Math.floor(i / 2) * row;
    out.push(`<path d="M${f(cx)} ${f(cy - size * 0.35)}h5" stroke="${e.stroke}" stroke-opacity="${f(e.opacity)}" stroke-width="0.6"/>`,
      t(cx + 6.5, cy, e.name, size, ` fill="${INK}"`));
  });
  if (shown.length < legend.length) {
    const i = shown.length;
    out.push(t(x + (i % 2) * colW, y + Math.floor(i / 2) * row, `and ${legend.length - shown.length} more`, size, ` fill="${MUTED}"`));
  }
  if (!legend.length) out.push(t(x, y, 'none', size, ` fill="${MUTED}"`));
  cav.forEach((line, i) => out.push(t(x, by - 1.2 - (cav.length - 1 - i) * cs * 1.3, line, cs, ` fill="${MUTED}"`)));
  out.push(`<rect x="${f(r.x + 1.5)}" y="${f(by)}" width="${f(r.w - 3)}" height="${bandH}" fill="none" stroke="#b00020" stroke-width="0.5"/>`);
  out.push(t(r.x + r.w / 2, by + bandH / 2 + (L.small ? 1.3 : 1.5), NOT_FOR_CONSTRUCTION, L.small ? 3.4 : 4,
    ' fill="#b00020" font-weight="700" text-anchor="middle" letter-spacing="0.6"'));
  return out.join('');
}
