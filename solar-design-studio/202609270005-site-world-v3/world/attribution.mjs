// Attribution small print, GridAtlas style: credit exactly the data that is on screen.
// Pure: no DOM, no fetch. Input is data/attribution.json (see ATTRIBUTION.md).

const SEP = ' · ';

// Source ids used by the loaded layers, in the stable order of attribution.sources.
export function sourcesFor(loadedLayerIds, attribution) {
  const wanted = new Set();
  for (const layerId of loadedLayerIds || []) {
    for (const sid of attribution.layers?.[layerId] || []) wanted.add(sid);
  }
  return Object.keys(attribution.sources || {}).filter((sid) => wanted.has(sid));
}

// Layer ids the attribution file does not know about (a new layer with no credit entry).
export function unknownLayers(loadedLayerIds, attribution) {
  return (loadedLayerIds || []).filter((id) => !(id in (attribution.layers || {})));
}

function fillYear(text, src, year) {
  const y = src.year ?? year ?? new Date().getUTCFullYear();
  return text.replaceAll('{year}', String(y));
}

function licenceOf(src, attribution) {
  return attribution.licences?.[src.licence] || { short: src.licence, long: src.licence, url: src.licence_url || null };
}

// One compact footer entry: the short form if given, else the required line, plus the
// licence short name when the text does not already name the licence.
export function footerEntry(src, attribution, year) {
  const lic = licenceOf(src, attribution);
  const text = fillYear(src.short || src.line, src, year); // required wording kept exact
  const named = [lic.short, lic.long].some((n) => n && text.includes(n));
  return named ? text : `${text} (${lic.short})`;
}

// One line for the bottom of the screen, for exactly the loaded layers.
export function footerText(loadedLayerIds, attribution, { year } = {}) {
  const seen = new Set();
  const out = [];
  for (const sid of sourcesFor(loadedLayerIds, attribution)) {
    const src = attribution.sources[sid];
    if (!src.on_screen) continue;
    const entry = footerEntry(src, attribution, year);
    if (seen.has(entry)) continue; // e.g. OS Open Rivers and OS Open Roads share one OS line
    seen.add(entry);
    out.push(entry);
  }
  return out.join(SEP);
}

// Longer list for the Controls/About panel: full required line, source, licence, links, layers.
export function aboutList(loadedLayerIds, attribution, { year } = {}) {
  const loaded = loadedLayerIds || [];
  return sourcesFor(loaded, attribution)
    .filter((sid) => attribution.sources[sid].on_screen)
    .map((sid) => {
      const src = attribution.sources[sid];
      const lic = licenceOf(src, attribution);
      const layers = loaded.filter((l) => (attribution.layers[l] || []).includes(sid));
      const notes = layers.map((l) => attribution.layer_notes?.[l]).filter(Boolean);
      return {
        id: sid,
        name: src.name,
        line: fillYear(src.line, src, year),
        licence: lic.short,
        licence_name: lic.long,
        licence_url: lic.url || src.licence_url || null,
        link: src.link,
        layers,
        notes: [...new Set(notes)],
      };
    });
}
