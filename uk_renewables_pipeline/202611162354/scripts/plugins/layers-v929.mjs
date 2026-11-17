/* Explicit accepted renderers; existing Pipeline owns category navigation/news. */
import {catalogue} from '../layers/catalogue.mjs';
import {createDataRegistry} from '../layers/registry.mjs';
import {mountLayerControls} from '../layers/controls.mjs';
import {renderers} from '../layers/views.mjs';
import {renderTicker} from '../layers/ticker.mjs';

const views = {
  grid: {host:'gridLayerHost', ids:['substations','grid-projects'], initial:'substations'},
  offtakers: {host:'offtakersLayerHost', ids:['offtakers'], initial:'offtakers'},
  prices: {host:'pricesLayerHost', ids:['prices'], initial:'prices'},
};
const mounted = new Map();
function mountCategory(id) {
  const spec = views[id];
  if (!spec || mounted.has(id)) return;
  const host = document.getElementById(spec.host);
  try {
    const composition = {...catalogue, layers:catalogue.layers.filter(layer=>spec.ids.includes(layer.id))};
    const registry = createDataRegistry(composition);
    mounted.set(id, mountLayerControls(host,{registry,renderers,initial:spec.initial}));
    // The existing outer category tab already supplies the single group control.
    host.querySelector('.pn-groups').hidden = true;
  } catch {
    host.textContent = 'This view is unavailable. Other Pipeline categories remain usable.';
    host.dataset.state = 'unavailable';
  }
}
window.addEventListener('pipeline-category-changed',event=>mountCategory(event.detail));
mountCategory(document.querySelector('.pipeline-tabs [aria-selected="true"]')?.dataset.view);

function updateTicker(doc) {
  const status = document.getElementById('newsStatus');
  const label = 'Latest available · ' + (status?.textContent || 'collection date unknown');
  renderTicker(document.getElementById('headlineTicker'),doc?.items || [],{snapshotLabel:label});
}
window.addEventListener('pipeline-feed-loaded',event=>updateTicker(event.detail));
updateTicker(window.pipelineHeadlineDocument);
