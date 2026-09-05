/** Codex Teleprinter: lossless captured pixels, one page, no drawn furniture. */
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
export async function screenPdf({ width, height, rgba, iccProfile }) {
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
  const objects = [
    bytes('<< /Type /Catalog /Pages 2 0 R >>'),
    bytes('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    bytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Screen 4 0 R >> >> /Contents 5 0 R >>`),
    stream(`/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace ${colourSpace} /BitsPerComponent 8 /Interpolate false /Filter /FlateDecode${transparent ? ` /SMask ${maskId} 0 R` : ''}`, await deflate(rgb)),
    stream('', bytes(`q\n${width} 0 0 ${height} 0 0 cm\n/Screen Do\nQ\n`))
  ];
  if (iccProfile) objects.push(stream('/N 3 /Alternate /DeviceRGB /Filter /FlateDecode', await deflate(iccProfile)));
  if (transparent) objects.push(stream(`/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, await deflate(alpha)));
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
