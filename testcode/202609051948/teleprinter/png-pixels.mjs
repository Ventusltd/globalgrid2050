/** Decode PNG sample bytes without browser color conversion or alpha premultiplication.
 * PNG specification: https://www.w3.org/TR/png-3/ (chunks, filters, iCCP).
 */
const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const MAX_PIXELS = 40000000;
const MAX_INPUT = 256 * 1024 * 1024;
const MAX_PROFILE = 4 * 1024 * 1024;
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function fail(reason) { throw new Error(`PNG screenshot: ${reason}`); }
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const value of bytes) crc = crcTable[(crc ^ value) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
async function inflate(parts, limit, exact = false) {
  const reader = new Blob(parts).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.length > limit - size) fail('decompressed data exceeds its permitted length');
      size += value.length;
      chunks.push(value);
    }
    if (exact && size !== limit) fail('decompressed pixel data has the wrong length');
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (error.message?.startsWith('PNG screenshot:')) throw error;
    fail('compressed data is corrupt or incomplete');
  } finally { reader.releaseLock(); }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}
function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Unsupported valid PNG sample formats return null; invalid/corrupt PNGs throw. */
export async function decodePngPixels(input) {
  if (input instanceof Blob) {
    if (input.size > MAX_INPUT) fail('file is too large');
    input = await input.arrayBuffer();
  }
  const bytes = input instanceof Uint8Array ? input : input instanceof ArrayBuffer ? new Uint8Array(input) : null;
  if (!bytes) fail('expected PNG bytes or a Blob');
  if (bytes.length > MAX_INPUT) fail('file is too large');
  if (bytes.length < 8 || SIGNATURE.some((value, index) => bytes[index] !== value)) fail('invalid or truncated PNG signature');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8, width, height, depth, color, interlace, channels;
  let seenHeader = false, seenPalette = false, seenData = false, endedData = false, seenEnd = false;
  let unsupported = false, profileParts, transparentColor, seenTransparency = false;
  const dataParts = [];
  while (offset < bytes.length) {
    if (bytes.length - offset < 12) fail('truncated chunk header');
    const length = view.getUint32(offset);
    if (length > 0x7fffffff || length > bytes.length - offset - 12) fail('truncated or oversized chunk');
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    if ([...typeBytes].some(value => value < 65 || value > 122 || (value > 90 && value < 97)) || (typeBytes[2] & 32)) fail('invalid chunk type');
    const type = String.fromCharCode(...typeBytes);
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== view.getUint32(offset + 8 + length)) fail(`CRC mismatch in ${type}`);
    if (!seenHeader && type !== 'IHDR') fail('IHDR must be the first chunk');
    if (seenData && type !== 'IDAT') endedData = true;
    if (type === 'IHDR') {
      if (seenHeader || length !== 13) fail('invalid or duplicate IHDR');
      seenHeader = true;
      const ihdr = new DataView(body.buffer, body.byteOffset, body.byteLength);
      width = ihdr.getUint32(0); height = ihdr.getUint32(4);
      depth = body[8]; color = body[9]; interlace = body[12];
      const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      if (!width || !height || width > 0x7fffffff || height > 0x7fffffff || width * height > MAX_PIXELS) fail('image dimensions exceed the supported limit');
      if (!depths[color]?.includes(depth) || body[10] !== 0 || body[11] !== 0 || interlace > 1) fail('invalid PNG image format');
      channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color];
      unsupported = depth !== 8 || ![2, 6].includes(color) || interlace !== 0;
    } else if (type === 'PLTE') {
      if (seenPalette || seenData || !length || length % 3 || length > 768 || color === 0 || color === 4 || (color === 3 && length / 3 > 2 ** depth)) fail('invalid palette');
      seenPalette = true;
    } else if (type === 'IDAT') {
      if (endedData || (color === 3 && !seenPalette)) fail('invalid IDAT order');
      seenData = true; dataParts.push(body);
    } else if (type === 'iCCP') {
      if (profileParts || seenPalette || seenData) fail('invalid ICC profile order');
      const separator = body.indexOf(0);
      const name = body.subarray(0, separator);
      if (separator < 1 || separator > 79 || body[separator + 1] !== 0 || length <= separator + 2 || name[0] === 32 || name[name.length - 1] === 32 || name.some((value, index) => !((value >= 32 && value <= 126) || value >= 161) || (value === 32 && name[index - 1] === 32))) fail('invalid ICC profile chunk');
      profileParts = [body.subarray(separator + 2)];
    } else if (type === 'tRNS') {
      if (seenTransparency || seenData || color === 4 || color === 6 || (color === 0 && length !== 2) || (color === 2 && length !== 6) || (color === 3 && (!seenPalette || !length || length > 256))) fail('invalid transparency chunk');
      seenTransparency = true;
      if (color === 2) {
        const trns = new DataView(body.buffer, body.byteOffset, body.byteLength);
        transparentColor = [trns.getUint16(0), trns.getUint16(2), trns.getUint16(4)];
      }
    } else if (type === 'IEND') {
      if (!seenData || length !== 0 || offset + 12 !== bytes.length) fail('invalid IEND or trailing data');
      seenEnd = true;
    } else if (!(typeBytes[0] & 32) || ['acTL', 'fcTL', 'fdAT'].includes(type)) unsupported = true;
    offset += length + 12;
  }
  if (!seenHeader || !seenData || !seenEnd) fail('PNG is incomplete');
  const passes = interlace ? [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]] : [[0, 0, 1, 1]];
  const layouts = passes.map(([x, y, dx, dy]) => ({ width: Math.max(0, Math.ceil((width - x) / dx)), height: Math.max(0, Math.ceil((height - y) / dy)) })).filter(pass => pass.width && pass.height).map(pass => ({ ...pass, stride: Math.ceil(pass.width * channels * depth / 8) }));
  const expectedLength = layouts.reduce((sum, pass) => sum + (pass.stride + 1) * pass.height, 0);
  const raw = await inflate(dataParts, expectedLength, true);
  let scan = 0;
  for (const pass of layouts) for (let row = 0; row < pass.height; row++) {
    if (raw[scan] > 4) fail('unknown scanline filter');
    scan += pass.stride + 1;
  }
  const iccProfile = profileParts ? await inflate(profileParts, MAX_PROFILE) : undefined;
  if (iccProfile && !iccProfile.length) fail('empty ICC profile');
  if (unsupported) return null;
  const stride = width * channels;
  const rgba = new Uint8Array(width * height * 4);
  let previous = new Uint8Array(stride), current = new Uint8Array(stride);
  scan = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[scan++];
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? current[x - channels] : 0, b = previous[x], c = x >= channels ? previous[x - channels] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : paeth(a, b, c);
      current[x] = (raw[scan++] + predictor) & 255;
    }
    for (let x = 0; x < width; x++) {
      const source = x * channels, target = (y * width + x) * 4;
      rgba[target] = current[source]; rgba[target + 1] = current[source + 1]; rgba[target + 2] = current[source + 2];
      rgba[target + 3] = channels === 4 ? current[source + 3] : transparentColor && transparentColor.every((value, channel) => value === current[source + channel]) ? 0 : 255;
    }
    [previous, current] = [current, previous];
  }
  return { width, height, rgba, ...(iccProfile ? { iccProfile } : {}) };
}
