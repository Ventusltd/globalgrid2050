/* Non-live host composition. Modules retain their own owners and evidence states. */
const tabs = [...document.querySelectorAll('.pipeline-tabs [role="tab"]')];
const panels = ['repdPanel', 'gridPanel', 'datacentrePanel'].map(id => document.getElementById(id));
let dcStarted = false;
let gridStarted = false;
let defaultApplied = false;

const dcInputs = Object.freeze({
  urls: {
    projects: 'global-datacentres/projects.json',
    official: 'global-datacentres/official-projects.json',
    groups: 'global-datacentres/project-groups.json',
    audit: 'global-datacentres/selection-audit.json',
    baseline: '../202611161747/global-datacentres/projects.json',
  },
  sha256: {
    projects: 'faf617d9979151b7d309554cb1cd59d343f70b9d60616f90db45e5c2a227d449',
    official: 'bcf6473bebe78e7a7dab566b1998ea51237d653c5a8584420690c2cea9a5180f',
    groups: 'b77afd5846a3c27697e49664fabb4c0020a81a88ccaa680fb5130f6d6d1b8970',
    audit: 'faa79b4651d62baee822b8e6f748e447d0b8aebbe1c8c13beafd81d973b1c592',
    baseline: '224b039d9801eea547ec4934b6e247f756ec7846e35c62ebe1774ef134597bae',
  },
});

async function pinnedBytes(url, expected) {
  const response = await fetch(url, {cache: 'no-store'});
  if (!response.ok) throw new Error('Preview input unavailable');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 2 * 1024 * 1024) throw new Error('Preview input exceeds bound');
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, '0')).join('');
  if (hex !== expected) throw new Error('Preview input identity changed');
  return bytes;
}

function text(tag, value) {
  const element = document.createElement(tag);
  element.textContent = value;
  return element;
}

async function loadGrid() {
  const host = document.getElementById('gridDirectory');
  host.replaceChildren(text('p', 'Loading official source directory…'));
  try {
    const bytes = await pinnedBytes('../../automation/news/grid_watch/sources.json',
      'd4ef4584859d712ac15c07e02b9e201cc693b65542ccdc204427c8a7b114ca62');
    const catalogue = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
    if (catalogue.schema !== 'globalgrid2050.grid_watch.sources.v1' || catalogue.sources.length !== 14) throw new Error('Invalid directory');
    const fragment = document.createDocumentFragment();
    fragment.appendChild(text('p', '14 source-directory entries · 0 approved project updates'));
    for (const source of catalogue.sources) {
      const url = new URL(source.url);
      if (url.protocol !== 'https:' || url.username || url.password || url.hostname !== source.hostname) throw new Error('Unsafe source');
      const row = text('article', '');
      row.className = 'grid-source';
      const link = text('a', source.publisher + ' · ' + source.operator);
      link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
      row.append(link, text('small', source.role.replaceAll('_', ' ') + ' · Rights ' + source.licence_state), text('p', source.coverage));
      fragment.appendChild(row);
    }
    host.replaceChildren(fragment);
    host.dataset.state = 'directory-only';
  } catch {
    host.replaceChildren(text('p', 'Grid source directory unavailable. No project updates displayed.'));
    host.dataset.state = 'unavailable';
  }
}

function activate(tab, focus = false) {
  for (const item of tabs) {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
  }
  const panel = document.getElementById(tab.getAttribute('aria-controls'));
  for (const item of panels) item.hidden = item !== panel;
  panel.setAttribute('aria-labelledby', tab.id);
  if (focus) tab.focus();
  if (['solar', 'bess'].includes(tab.dataset.view)) {
    document.querySelector('#tech [data-technology="' + tab.dataset.view + '"]')?.click();
  } else if (tab.dataset.view === 'grid' && !gridStarted) {
    gridStarted = true; void loadGrid();
  } else if (tab.dataset.view === 'datacentre' && !dcStarted) {
    dcStarted = true;
    const host = document.getElementById('datacentreHost');
    if (window.GGDataCentreUI) void window.GGDataCentreUI.mount(host, dcInputs);
    else host.replaceChildren(text('p', 'Data Centre records unavailable.'));
  }
}

for (const tab of tabs) {
  tab.addEventListener('click', () => activate(tab));
  tab.addEventListener('keydown', event => {
    let index = tabs.indexOf(tab);
    if (event.key === 'ArrowRight') index = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') index = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = tabs.length - 1;
    else return;
    event.preventDefault(); activate(tabs[index], true);
  });
}
function initialiseCategory() {
  if (defaultApplied) return;
  defaultApplied = true;
  queueMicrotask(() => {
    const technology = new URL(location.href).searchParams.get('technology');
    if (!technology || technology === 'solar') activate(document.getElementById('solarTab'));
    else if (technology === 'bess') activate(document.getElementById('bessTab'));
  });
}
window.addEventListener('pipeline-projects-rendered', initialiseCategory);
if (document.getElementById('tbody').dataset.complete === 'true') initialiseCategory();

let contextStarted = false;
const contextDisclosure = document.getElementById('contextDisclosure');
// This cache is explicitly preview-only: production must not self-grant source acceptance.
const contextPreview = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
contextDisclosure.hidden = !contextPreview;
contextDisclosure.addEventListener('toggle', async event => {
  if (!contextPreview || !event.target.open || contextStarted) return;
  contextStarted = true;
  const host = document.getElementById('contextHost');
  try {
    const expected = 'de0d205186ae2a30914711e1b25bacefc325f7c02efb880e4d5d5a6c070a87c1';
    const cache = '../../automation/v928_context/preview/';
    const manifestBytes = await pinnedBytes(cache + 'manifest.json',
      '8ee9770c0e22512879b93d73e4386521ca410f1ccf53069a7f8de6d7eccf8515');
    const manifest = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(manifestBytes));
    if (manifest.preview_only !== true || manifest.publication_authorized !== false ||
        manifest.files['transition-context.json'].sha256 !== expected) throw new Error('Unaccepted Context preview');
    const assets = Object.fromEntries(await Promise.all(Object.entries(manifest.files).map(async ([path, pin]) =>
      [path, await pinnedBytes(cache + path, pin.sha256)])));
    const bytes = assets['transition-context.json'];
    const [{renderContext}, {buildViewModel}, {renderFigures}] = await Promise.all([
      import('../../../../automation/v928_context/preview/render.mjs'),
      import('../../../../automation/v928_context/preview/figures/b460cb7f76172691b5ffb6d2a7f1a8e12057ba20/model.mjs'),
      import('../../../../automation/v928_context/preview/figures/b460cb7f76172691b5ffb6d2a7f1a8e12057ba20/render.mjs'),
    ]);
    host.replaceChildren();
    await renderContext(host, bytes, {expectedSha256: expected, figures: {buildViewModel, renderFigures}});
  } catch {
    host.replaceChildren(text('p', 'Context unavailable. No replacement figures or project associations displayed.'));
  }
});
