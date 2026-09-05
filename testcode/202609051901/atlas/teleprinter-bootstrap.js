import { mountTeleprinter } from '../teleprinter/controls.js';
import { mountLayerQuickControls } from '../teleprinter/layer-quick-controls.js';
mountLayerQuickControls();
import { mountLayersPanelPolicy } from '../teleprinter/layers-panel-policy.js';
mountLayersPanelPolicy();
import { mountLayoutCommand } from '../teleprinter/layout-command.js';
import { mountToolLayers } from '../tool-layers/host.js';
mountToolLayers([{"id":"gis-sld-financial-sandbox","title":"GIS SLD Financial Sandbox","entry":"../layer-apps/solar-bess-topology-v7/gis-sld-financial-sandbox/index.html"}], import.meta.url);
const base = new URL('../teleprinter/', import.meta.url);
try {
  const response = await fetch(new URL('atlas-source-pin.json', base), { cache: 'no-store', credentials: 'same-origin', redirect: 'error' });
  if (!response.ok) throw new Error('Source code is still being prepared.');
  const pin = await response.json();
  if (pin.generation !== '202609051901' || pin.app !== 'atlas' || !/^[a-f0-9]{40}$/.test(pin.commit) || pin.repository !== 'https://github.com/Ventusltd/testcode') throw new Error('The source code version could not be checked.');
  mountTeleprinter({ printButtons: 'button[data-gm-export]', appName: "GridAtlas", manifestUrl: new URL('atlas-source-code.manifest.json', base), textUrl: new URL('atlas-source-code.txt', base), expectedCommit: pin.commit, expectedRepository: pin.repository });
} catch (error) {
  const note = document.createElement('p'); note.setAttribute('role', 'status'); note.textContent = 'Print options: ' + error.message; document.body.append(note);
}
