// Layer loader. The manifest lists layers in order; each layer file is fetched, its SHA-256 compared
// with the manifest, and only then imported. A layer whose hash differs is refused and named, never run.
// A layer is a module whose default export may offer:
//   lines(ctx)       -> [{ key, version, positions: Float32Array, color: [r,g,b,a] }]
//   heightAt(x, y)   -> ground height in metres (the first layer offering it is the ground)
// Layers are self-contained: no imports (they run from a blob URL). Positions are in local metres
// from the site origin, never national-grid coordinates, so 32-bit GPU floats stay exact.

export async function loadLayers(manifestUrl) {
  const base = new URL(manifestUrl, location.href);
  const res = await fetch(base, { cache: 'no-cache' });
  if (!res.ok) throw Error(`manifest HTTP ${res.status}`);
  const manifest = await res.json();
  const out = [];
  for (const entry of manifest.layers || []) {
    const url = new URL(entry.path, base);
    try {
      if (!entry.sha256) { out.push({ id: entry.id, status: 'refused: the manifest gives no hash' }); continue; }
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw Error(`HTTP ${res.status}`);
      const text = normalise(await res.text());
      const hash = await sha256(text);
      if (!hash) { out.push({ id: entry.id, status: 'refused: this browser cannot check hashes here (needs https)' }); continue; }
      if (hash !== entry.sha256) {
        out.push({ id: entry.id, status: `refused: file hash ${hash.slice(0, 12)} is not the manifest's ${entry.sha256.slice(0, 12)}` });
        continue;
      }
      const blob = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
      const mod = await import(blob);
      URL.revokeObjectURL(blob);
      out.push({ id: entry.id, status: 'loaded, hash matches', layer: mod.default });
    } catch (e) {
      out.push({ id: entry.id, status: 'failed: ' + e.message });
    }
  }
  return { generation: manifest.generation, layers: out };
}

// Line endings and a byte-order mark are normalised so a Windows checkout and the published file hash the same.
export const normalise = text => text.replace(/^﻿/, '').replace(/\r\n/g, '\n');

export async function sha256(text) {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
