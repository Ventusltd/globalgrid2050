/* Bounded SHA-256 transport shared by optional source cartridges. */
export async function fetchPinned(url, expected, limit, exact = null) {
  const response = await fetch(url, {credentials:'omit', redirect:'error', cache:'force-cache', signal:AbortSignal.timeout(15000)});
  if (!response.ok || response.redirected) throw Error('Location input unavailable');
  const reader = response.body?.getReader();
  if (!reader) throw Error('Location input stream unavailable');
  const chunks = []; let length = 0;
  while (true) {
    const {done,value} = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > limit) {await reader.cancel();throw Error('Location input exceeds its bound');}
    chunks.push(value);
  }
  if (exact !== null && length !== exact) throw Error('Location input size changed');
  const bytes = new Uint8Array(length);let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk,offset);offset += chunk.byteLength;}
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  if (digest !== expected) throw Error('Location input identity changed');
  return bytes;
}
