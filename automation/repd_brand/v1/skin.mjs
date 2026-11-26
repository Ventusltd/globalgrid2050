/**
 * Pipeline News / GlobalGrid2050 native REPD and GridAtlas SCADA visual skin.
 * NEW DONOR ONLY. No production import unless accepted and installed in a
 * NEW immutable PipelineNews edition. Published V9.73 remains byte-identical.
 *
 * Authority: REPD V9.73 rendered styles (styles/v7.css, repd-scan.css,
 * repd-expanded.css, hud-v955.css); GridAtlas SCADA reference is secondary:
 * Ventusltd/gridatlas/atlas/releases/202608300453-atlas-v9/ventusv8.css
 * GridAtlas atlas/current.json generation 202611222343 at audit.
 */
export const BRAND_SKIN = Object.freeze({
  schema: 'globalgrid2050.pipeline.repd-native-visual-parity.v1',
  pinnedReferenceEdition: 'uk_renewables_pipeline/202611222330/',
  scadaReference: 'Ventusltd/gridatlas/atlas/releases/202608300453-atlas-v9/ventusv8.css',
  semanticTechnologyColours: Object.freeze({
    solar: '#ffff00',
    bess: '#ffae00',
    wind_onshore: '#00ffff',
    wind_offshore: '#0066ff',
    interconnector: '#0066ff'
  }),
  preservedWarningTicker: '#ff3038',
  targetPanels: Object.freeze(['gridPanel','datacentrePanel','offtakersPanel','pricesPanel'])
});

const TOKEN_SET = Object.freeze({
  '--pn-repd-surface': 'surface',
  '--pn-repd-panel': 'panel',
  '--pn-repd-table-head-background': 'headingBackground',
  '--pn-repd-table-head-text': 'headingText',
  '--pn-repd-row-text': 'rowText',
  '--pn-repd-project-text': 'projectText',
  '--pn-repd-capacity-text': 'capacityText',
  '--pn-repd-border': 'border',
  '--pn-repd-active': 'active',
  '--pn-repd-muted': 'muted'
});

function cssValue(style, name) {
  return style.getPropertyValue(name).trim();
}
/** Read from actual native REPD elements only, NEVER from alternate custom theme. */
export function captureNativeRepdSkin(doc = document) {
  if (!doc?.defaultView || typeof doc.defaultView.getComputedStyle !== 'function') {
    throw new Error('Computed native REPD styles unavailable');
  }
  const find = selector => {
    const element=doc.querySelector(selector);
    if (!element) return null;
    return doc.defaultView.getComputedStyle(element);
  };
  const head=find('#repdScroll thead th');
  const body=find('#repdScroll tbody td');
  const project=find('#repdScroll tbody td.site');
  const capacity=find('#repdScroll tbody td.mw');
  const table=find('#repdScroll');
  const root=find(':root');
  if (!head || !table || !root || !body || !project || !capacity) return null;
  const skin = {
    surface: cssValue(root,'--bg'),
    panel: table.backgroundColor,
    headingBackground: head.backgroundColor,
    headingText: head.color,
    rowText: body.color,
    projectText: project.color,
    capacityText: capacity.color,
    border: cssValue(root,'--line'),
    active: cssValue(root,'--accent'),
    muted: cssValue(root,'--muted')
  };
  if (Object.values(skin).some(value=>!value)) throw new Error('Native REPD colour token missing');
  return Object.freeze(skin);
}
/**
 * Decorates separate source-backed category panel roots ONLY; never changes
 * the native REPD table, ticker, gauges, contents or source-specific status.
 * Calling this before source rows load returns waiting and makes no changes.
 */
export function mountRepdNativeSkin(doc = document) {
  const native = captureNativeRepdSkin(doc);
  if (!native) return Object.freeze({status:'waiting-for-repd'});
  const applied=[];
  for (const id of BRAND_SKIN.targetPanels) {
    const host=doc.getElementById(id);
    if (!host) continue;
    for (const [customProperty, key] of Object.entries(TOKEN_SET)) {
      host.style.setProperty(customProperty,native[key]);
    }
    host.classList.add('pn-repd-native-skin');
    host.dataset.repdBrandSource='v973-native';
    applied.push(id);
  }
  return Object.freeze({status:'mounted',applied:Object.freeze(applied),skin:native});
}
export function verifyRepdSkinTokens(doc=document) {
  const native=captureNativeRepdSkin(doc);
  if (!native) return {ok:false,reason:'native-repd-unavailable'};
  const mismatches=[];
  for (const id of BRAND_SKIN.targetPanels) {
    const host=doc.getElementById(id);
    if (!host || !host.classList.contains('pn-repd-native-skin')) continue;
    for (const [token,key] of Object.entries(TOKEN_SET)) {
      const actual=host.style.getPropertyValue(token).trim();
      if (actual!==native[key]) mismatches.push({panel:id,token,expected:native[key],actual});
    }
  }
  return {ok:mismatches.length===0,mismatches};
}
