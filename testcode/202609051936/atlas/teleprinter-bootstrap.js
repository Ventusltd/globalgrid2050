import { mountTeleprinter } from '../teleprinter/controls.js';
import { mountLayerQuickControls } from '../teleprinter/layer-quick-controls.js';
mountLayerQuickControls();
import { mountLayersPanelPolicy } from '../teleprinter/layers-panel-policy.js';
mountLayersPanelPolicy();
import { mountLayoutCommand } from '../teleprinter/layout-command.js';
import { mountToolLayers } from '../tool-layers/host.js';
mountToolLayers([{"id":"gis-sld-financial-sandbox","title":"GIS SLD Financial Sandbox","entry":"../layer-apps/solar-bess-topology-v7/gis-sld-financial-sandbox/index.html","owner":{"repository":"https://github.com/Ventusltd/gis-sld-sandbox.git","commit":"9fe7b2d920aaa11e95380de39b33fd98f04e9696","release":"202609051855","manifestSha256":"90190a0846717b5203305a8c08301fb26ed58e015b992272e0999272091a0916"}},{"id":"module-layout","title":"Module Layout","entry":"../layer-apps/solar-bess-topology-v7/module-layout/index.html","owner":{"repository":"https://github.com/Ventusltd/layout-tool.git","commit":"e201075e052bfc71e7fef01f1360f319808cb78f","release":"202609051858","manifestSha256":"bb6d0a5cf4cf63d68b3d5cb02e55c27f1ccc0646135d7e39cdedbbe3da262796"}},{"id":"cable-geometry-visualiser","title":"Cable Geometry","entry":"../layer-apps/solar-bess-topology-v7/cable-geometry-visualiser/index.html","owner":{"repository":"https://github.com/Ventusltd/cable-trench-or-drill.git","commit":"76396fd3639dd86cddd21e392f29f43ab6d22f2d","release":"202609051921","manifestSha256":"a1b96236ba223bbbb8153538961bea677513a9fe3a877b9c61cd70d61128960e"}}], import.meta.url);
const base = new URL('../teleprinter/', import.meta.url);
try {
  const response = await fetch(new URL('atlas-source-pin.json', base), { cache: 'no-store', credentials: 'same-origin', redirect: 'error' });
  if (!response.ok) throw new Error('Source code is still being prepared.');
  const pin = await response.json();
  if (pin.generation !== '202609051936' || pin.app !== 'atlas' || !/^[a-f0-9]{40}$/.test(pin.commit) || pin.repository !== 'https://github.com/Ventusltd/testcode') throw new Error('The source code version could not be checked.');
  mountTeleprinter({ printButtons: 'button[data-gm-export]', appName: "GridAtlas", manifestUrl: new URL('atlas-source-code.manifest.json', base), textUrl: new URL('atlas-source-code.txt', base), expectedCommit: pin.commit, expectedRepository: pin.repository });
} catch (error) {
  const note = document.createElement('p'); note.setAttribute('role', 'status'); note.textContent = 'Print options: ' + error.message; document.body.append(note);
}
