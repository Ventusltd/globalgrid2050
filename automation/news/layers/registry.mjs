/* A data-plane extension of Pipeline's existing plugin host, not a script loader. */
const HEX = /^[a-f0-9]{64}$/;
const ID = /^[a-z][a-z0-9-]{0,63}$/;
export function validateRegistry(manifest) {
  if (manifest?.schema !== 'globalgrid2050.pipeline-layers.v1' || !Array.isArray(manifest.layers)) throw Error('Unsupported layer registry');
  const ids = new Set();
  for (const layer of manifest.layers) {
    if (!ID.test(layer.id) || ids.has(layer.id)) throw Error('Invalid or duplicate layer id');
    ids.add(layer.id);
    if (![layer.label, layer.group, layer.owner, layer.renderer].every(x => typeof x === 'string' && x.length > 0 && x.length <= 160)) throw Error('Layer metadata is incomplete');
    if (layer.data) {
      const u = new URL(layer.data.url);
      if (u.protocol !== 'https:' || u.username || u.password || u.hash || !HEX.test(layer.data.sha256)) throw Error('Invalid pinned data source');
      if (!Number.isSafeInteger(layer.data.maxBytes) || layer.data.maxBytes < 1 || layer.data.maxBytes > 8 * 1024 * 1024) throw Error('Layer exceeds browser byte policy');
      if (!Number.isSafeInteger(layer.data.rows) || layer.data.rows < 0 || layer.data.rows > 25000) throw Error('Layer exceeds browser row policy');
      if (typeof layer.data.schema !== 'string' || !layer.data.schema) throw Error('Missing source schema');
    }
  }
  return manifest;
}
export async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function readBounded(response, maxBytes) {
  if (Number(response.headers.get('content-length')) > maxBytes) throw Error('Data exceeds byte budget');
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > maxBytes) throw Error('Data exceeds byte budget');
    return bytes;
  }
  const parts = []; let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw Error('Data exceeds byte budget');
      parts.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return bytes;
}
export function createDataRegistry(manifest, {fetchImpl = globalThis.fetch, timeoutMs = 20000} = {}) {
  validateRegistry(manifest);
  // Copy the accepted composition. Later caller mutation cannot repin loaded data.
  const freeze = value => { for (const item of Object.values(value)) if (item && typeof item === 'object') freeze(item); return Object.freeze(value); };
  const layers = freeze(structuredClone(manifest.layers));
  const cache = new Map();
  return {
    layers,
    async load(id) {
      const layer = layers.find(x => x.id === id);
      if (!layer) throw Error('Unknown layer');
      if (!layer.data) return null;
      // Validation belongs to the complete accepted contract, not merely its bytes.
      const key = JSON.stringify([layer.data.url, layer.data.sha256, layer.data.schema, layer.data.rows, layer.data.maxBytes]);
      if (!cache.has(key)) {
        const work = (async () => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          try {
            const response = await fetchImpl(layer.data.url, {signal: controller.signal, redirect: 'error', cache: 'force-cache', credentials: 'omit'});
            if (!response.ok || response.redirected) throw Error('Source unavailable');
            const bytes = await readBounded(response, layer.data.maxBytes);
            if (await sha256(bytes) !== layer.data.sha256) throw Error('Source integrity changed');
            const payload = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
            if (layer.data.schema !== 'geojson.FeatureCollection' || payload.type !== 'FeatureCollection' || !Array.isArray(payload.features) || payload.features.length !== layer.data.rows) throw Error('Source schema/count mismatch');
            return payload;
          } finally { clearTimeout(timer); }
        })();
        cache.set(key, work);
        work.catch(() => { if (cache.get(key) === work) cache.delete(key); });
      }
      // Renderers never share mutable source objects.
      return structuredClone(await cache.get(key));
    },
    clear() { cache.clear(); }
  };
}
