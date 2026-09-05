import { mountTeleprinter } from '../teleprinter/controls.js';
import { mountLayerQuickControls } from '../teleprinter/layer-quick-controls.js';
mountLayerQuickControls();
import { mountLayersPanelPolicy } from '../teleprinter/layers-panel-policy.js';
mountLayersPanelPolicy();
import { mountLayoutCommand } from '../teleprinter/layout-command.js';
import { mountToolLayers } from '../tool-layers/host.js';
mountToolLayers([{"id":"gis-sld-financial-sandbox","title":"GIS SLD Financial Sandbox","entry":"../layer-apps/solar-bess-topology-v7/gis-sld-financial-sandbox/index.html","owner":{"repository":"https://github.com/Ventusltd/gis-sld-sandbox.git","commit":"9fe7b2d920aaa11e95380de39b33fd98f04e9696","release":"202609051855","manifestSha256":"90190a0846717b5203305a8c08301fb26ed58e015b992272e0999272091a0916"}},{"id":"module-layout","title":"Module Layout","entry":"../layer-apps/solar-bess-topology-v7/module-layout/index.html","owner":{"repository":"https://github.com/Ventusltd/layout-tool.git","commit":"5c450e27e430d6eb5d80070f794a5660f30015a1","release":"202609051955","manifestSha256":"57cf6fbf60cd50a50b2c230aa14a081835e1b1728dfd0f0f2129887250988f5c"}},{"id":"cable-geometry-visualiser","title":"Cable Geometry","entry":"../layer-apps/solar-bess-topology-v7/cable-geometry-visualiser/index.html","owner":{"repository":"https://github.com/Ventusltd/cable-trench-or-drill.git","commit":"e6132475d1d369422f5ae98624c01ecb8c14f39e","release":"202609052001","manifestSha256":"a344ed826eeb29c37f2ebdefaf7699591dcdbf94320847f2d4e91a94a6c33193"}}], import.meta.url);
const base = new URL('../teleprinter/', import.meta.url);
try {
  const response = await fetch(new URL('atlas-source-pin.json', base), { cache: 'no-store', credentials: 'same-origin', redirect: 'error' });
  if (!response.ok) throw new Error('Source code is still being prepared.');
  const pin = await response.json();
  if (pin.generation !== '202609052008' || pin.app !== 'atlas' || !/^[a-f0-9]{40}$/.test(pin.commit) || pin.repository !== 'https://github.com/Ventusltd/testcode') throw new Error('The source code version could not be checked.');
  mountTeleprinter({ printButtons: 'button[data-gm-export]', appName: "GridAtlas", manifestUrl: new URL('atlas-source-code.manifest.json', base), textUrl: new URL('atlas-source-code.txt', base), expectedCommit: pin.commit, expectedRepository: pin.repository });
} catch (error) {
  const note = document.createElement('p'); note.setAttribute('role', 'status'); note.textContent = 'Print options: ' + error.message; document.body.append(note);
}
