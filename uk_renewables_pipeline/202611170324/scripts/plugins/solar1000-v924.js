// V9.25 keeps the V9.24 selection, adding evidence to existing UK records.
// It does not create another project list or change official filters/exports.
import {loadEvidence, renderEvidence} from './evidence-v925.js';
import {loadCanonicalProjectsV9_5_1} from '../data/canonical-projects-v9-5-1.js';
const coverage = document.getElementById('evidenceCoverage');
const selection = coverage?.querySelector('[data-evidence-selection]');
const status = coverage?.querySelector('[data-evidence-status]');
const state = {loading:true,data:null};
let projects = new Map(), candidates = new Map();
function attachEvidence() {
  for (const row of document.querySelectorAll('#tbody > tr[id^="repd-"]')) {
    const id = row.id.slice(5), project = projects.get(id);
    const details = row.querySelector('.project-record');
    if (!project || !details || details.querySelector('[data-integrated-evidence]')) continue;
    details.querySelector('summary').textContent = 'PROJECT RECORD · SOURCES';
    const host = document.createElement('div');
    host.dataset.integratedEvidence = id;
    details.appendChild(host);
    renderEvidence(host,project,state);
    const inherited = candidates.get(id);
    if (inherited) {
      const note = document.createElement('p');
      note.className = 'v925-inherited-source';
      note.textContent = 'Inherited V9.24 source candidate - unverified. ';
      const url = new URL(inherited.source_url);
      if (url.protocol === 'https:' && !url.username && !url.password) {
        const link = document.createElement('a');
        link.href = url.href;link.target = '_blank';link.rel = 'noopener noreferrer';
        link.textContent = inherited.publisher;
        note.appendChild(link);
      }
      host.appendChild(note);
    }
  }
}
function refreshEvidence() {
  document.querySelectorAll('[data-integrated-evidence]').forEach(node=>node.remove());
  attachEvidence();
}
async function start() {
  if (!coverage) return;
  try {
    const [manifest,inherited,model] = await Promise.all([
      fetch('solar1000/manifest.json').then(r=>{if(!r.ok)throw Error('Manifest unavailable');return r.json();}),
      fetch('solar1000/candidates.json').then(r=>{if(!r.ok)throw Error('Inherited candidates unavailable');return r.json();}),
      loadCanonicalProjectsV9_5_1()
    ]);
    const ids = manifest.ids.map(String);
    if (ids.length!==1000 || new Set(ids).size!==1000 || manifest.selection!=='numeric-repd-ref-ascending' || ids.some((id,i)=>i&&Number(id)<=Number(ids[i-1]))) throw Error('Invalid pinned selection');
    const byId = new Map(model.projects.map(p=>[String(p.repd_ref),p]));
    projects = new Map(ids.map(id=>[id,byId.get(id)]));
    if ([...projects.values()].some(p=>!p||p.technology!=='solar') || model.projects.length!==7775 || inherited.length!==2 || manifest.independently_verified!==0) throw Error('Invalid source identities');
    candidates = new Map(inherited.map(c=>[String(c.repd_ref),c]));
    coverage.dataset.selectionCount = String(projects.size);
    selection.textContent = '1,000 selected of 3,604 solar projects; exact V9.24 membership retained. Evidence is shown inside project record details.';
    window.addEventListener('pipeline-projects-rendered',attachEvidence);
    attachEvidence();
    try {
      state.data = await loadEvidence(coverage.dataset.evidencePointer,ids);
      status.textContent = 'Evidence snapshot '+state.data.generatedAt+' / '+state.data.count+' provisional matches / 0 verified events / '+state.data.freshnessLabel;
    } catch {
      status.textContent = 'Evidence unavailable - no validated snapshot is available. Manual review required.';
    }
    state.loading = false;
    refreshEvidence();
  } catch {
    selection.textContent = 'Evidence selection unavailable. The official UK register remains available.';
    status.textContent = 'Evidence unavailable - source identity checks failed. Manual review required.';
  }
}
start();
