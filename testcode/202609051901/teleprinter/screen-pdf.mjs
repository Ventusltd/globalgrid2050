/** Codex Teleprinter: lossless pixels with optional vector furniture outside the image. */
const enc = new TextEncoder();
const bytes = s => enc.encode(s);
const join = parts => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};
async function deflate(data) {
  return new Uint8Array(await new Response(new Blob([data]).stream()
    .pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
}
// Standard Helvetica advance widths in 1/1000 em, ASCII 32..126.
const advances = {
  regular: [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584],
  bold: [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584],
};
const windows1252 = new Map([[0x20ac,128],[0x201a,130],[0x0192,131],[0x201e,132],[0x2026,133],[0x2020,134],[0x2021,135],[0x02c6,136],[0x2030,137],[0x0160,138],[0x2039,139],[0x0152,140],[0x017d,142],[0x2018,145],[0x2019,146],[0x201c,147],[0x201d,148],[0x2022,149],[0x2013,150],[0x2014,151],[0x02dc,152],[0x2122,153],[0x0161,154],[0x203a,155],[0x0153,156],[0x017e,158],[0x0178,159]]);
function printable(value) {
  return [...String(value ?? '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ')].map(char => {
    const point = char.codePointAt(0);
    return char === '\n' || point >= 32 && point <= 126 || point >= 160 && point <= 255 || windows1252.has(point) ? char : `[U+${point.toString(16).toUpperCase()}]`;
  }).join('');
}
function textWidth(text, font, size) {
  return [...text].reduce((sum, char) => {
    const code = char.codePointAt(0);
    // A full em is a conservative bound for non-ASCII WinAnsi glyphs.
    return sum + (code >= 32 && code <= 126 ? advances[font][code - 32] : code === 183 ? 278 : code === 169 ? 737 : 1100);
  }, 0) * size / 1000;
}
function wrap(text, font, size, available) {
  const result = [];
  for (const paragraph of printable(text).split('\n')) {
    let remaining = paragraph;
    if (!remaining) { result.push(''); continue; }
    while (remaining) {
      let count = 0, used = 0, lastSpace = -1;
      for (const char of remaining) {
        const next = textWidth(char, font, size);
        if (used + next > available) break;
        used += next; count += char.length;
        if (char === ' ') lastSpace = count;
      }
      if (!count) throw new Error('The screen is too narrow for the header and footer text.');
      if (count < remaining.length && lastSpace > 0) count = lastSpace;
      result.push(remaining.slice(0, count));
      remaining = remaining.slice(count);
    }
  }
  return result;
}
function pdfString(text) {
  return '(' + [...text].map(char => {
    const point = char.codePointAt(0), code = windows1252.get(point) ?? point;
    return code >= 127 ? '\\' + code.toString(8).padStart(3, '0') : char === '(' || char === ')' || char === '\\' ? '\\' + char : char;
  }).join('') + ')';
}

/** Image coordinates use PDF's bottom-left origin; page width stays exactly width. */
export function getScreenPdfLayout(width, height, furniture) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > 14400 || height > 14400 || width * height > 40000000) throw new Error('The screen image has invalid dimensions.');
  if (!furniture) return { width, height, image: { x: 0, y: 0, width, height }, headerHeight: 0, footerHeight: 0, lines: [] };
  if (typeof furniture !== 'object') throw new Error('Header and footer settings must be an object.');
  const requestedScale = furniture.scale ?? 1;
  if (!Number.isFinite(requestedScale) || requestedScale <= 0) throw new Error('Header and footer scale must be positive.');
  const scale = Math.max(1, Math.min(2, requestedScale));
  const padding = 12 * scale;
  const available = width - padding * 2;
  if (available < 14 * scale) throw new Error('The screen is too narrow for the header and footer text.');
  const sections = [
    { band: 'header', font: 'bold', size: 12 * scale, text: furniture.brand ?? 'VENTUS  GLOBALGRID2050 · GRID ATLAS' },
    { band: 'header', font: 'regular', size: 14 * scale, text: furniture.title ?? 'Screen record' },
    { band: 'footer', font: 'regular', size: 10 * scale, text: furniture.credit ?? 'Data © OpenStreetMap contributors | © CARTO | EV data © Open Charge Map' },
    { band: 'footer', font: 'regular', size: 10 * scale, text: [furniture.generation ? `generation ${furniture.generation}` : '', furniture.capturedAt ?? new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')].filter(Boolean).join(' · ') },
    { band: 'footer', font: 'regular', size: 10 * scale, text: furniture.url ?? '' },
  ];
  const bands = { header: [], footer: [] };
  for (const section of sections) if (String(section.text).length) {
    for (const text of wrap(section.text, section.font, section.size, available)) bands[section.band].push({ text, font: section.font, size: section.size, leading: section.size * 1.35, band: section.band });
  }
  const headerHeight = Math.ceil(padding * 2 + bands.header.reduce((sum, line) => sum + line.leading, 0));
  const footerHeight = Math.ceil(padding * 2 + bands.footer.reduce((sum, line) => sum + line.leading, 0));
  const pageHeight = headerHeight + height + footerHeight;
  if (pageHeight > 14400) throw new Error('The image plus header and footer exceeds the PDF height limit.');
  const lines = [];
  for (const [band, top] of [['header', pageHeight], ['footer', footerHeight]]) {
    let cursor = top - padding;
    for (const line of bands[band]) {
      lines.push({ ...line, x: padding, y: cursor - line.size, width: textWidth(line.text, line.font, line.size) });
      cursor -= line.leading;
    }
  }
  return { width, height: pageHeight, image: { x: 0, y: footerHeight, width, height }, headerHeight, footerHeight, lines };
}

export async function screenPdf({ width, height, rgba, iccProfile, furniture }) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1
      || width > 14400 || height > 14400 || width * height > 40000000
      || !(rgba instanceof Uint8Array || rgba instanceof Uint8ClampedArray)
      || rgba.length !== width * height * 4) throw new Error('The screen image has invalid dimensions or pixels.');
  if (iccProfile && (!(iccProfile instanceof Uint8Array) || iccProfile.length < 128 || iccProfile.length > 4000000
      || new TextDecoder().decode(iccProfile.subarray(16,20)) !== 'RGB '
      || new TextDecoder().decode(iccProfile.subarray(36,40)) !== 'acsp')) throw new Error('The screenshot colour profile is invalid.');
  const rgb = new Uint8Array(width * height * 3);
  const alpha = new Uint8Array(width * height);
  let transparent = false;
  for (let p = 0; p < alpha.length; p++) {
    rgb.set(rgba.subarray(p * 4, p * 4 + 3), p * 3);
    alpha[p] = rgba[p * 4 + 3];
    if (alpha[p] !== 255) transparent = true;
  }
  const stream = (dict, data) => join([bytes(`<< ${dict} /Length ${data.length} >>\nstream\n`), data, bytes('\nendstream')]);
  const colourSpace = iccProfile ? '[/ICCBased 6 0 R]' : '/DeviceRGB';
  const maskId = iccProfile ? 7 : 6;
  const layout = getScreenPdfLayout(width, height, furniture);
  const regularFontId = 6 + Number(Boolean(iccProfile)) + Number(transparent);
  const boldFontId = regularFontId + 1;
  const fontResources = furniture ? ` /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >>` : '';
  let content = `q\n${width} 0 0 ${height} 0 ${layout.image.y} cm\n/Screen Do\nQ\n`;
  if (furniture) {
    content += `q\n1 1 1 rg\n0 0 ${width} ${layout.footerHeight} re f\n0 ${layout.footerHeight + height} ${width} ${layout.headerHeight} re f\n0.08 0.12 0.16 rg\n`;
    for (const line of layout.lines) content += `BT /${line.font === 'bold' ? 'F2' : 'F1'} ${line.size} Tf 1 0 0 1 ${line.x} ${line.y} Tm ${pdfString(line.text)} Tj ET\n`;
    content += 'Q\n';
  }
  const objects = [
    bytes('<< /Type /Catalog /Pages 2 0 R >>'),
    bytes('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    bytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${layout.height}] /Resources << /XObject << /Screen 4 0 R >>${fontResources} >> /Contents 5 0 R >>`),
    stream(`/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace ${colourSpace} /BitsPerComponent 8 /Interpolate false /Filter /FlateDecode${transparent ? ` /SMask ${maskId} 0 R` : ''}`, await deflate(rgb)),
    stream('', bytes(content))
  ];
  if (iccProfile) objects.push(stream('/N 3 /Alternate /DeviceRGB /Filter /FlateDecode', await deflate(iccProfile)));
  if (transparent) objects.push(stream(`/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, await deflate(alpha)));
  if (furniture) {
    objects.push(bytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));
    objects.push(bytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'));
  }
  const chunks = [bytes('%PDF-1.4\n%Teleprinter\n')];
  const offsets = [0];
  let length = chunks[0].length;
  objects.forEach((object, i) => {
    offsets.push(length);
    const chunk = join([bytes(`${i + 1} 0 obj\n`), object, bytes('\nendobj\n')]);
    chunks.push(chunk); length += chunk.length;
  });
  chunks.push(bytes(`xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`));
  return join(chunks);
}
