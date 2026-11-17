import {state} from '../core/state.js';
import {fetchPinned} from './verified-inputs.mjs';
const manifest = new URL('../../contracts/primary-notes.v932.json', import.meta.url);
const manifestHash = '4b208b67450c35c7c174b33d5a1f44b12a74665fe39f9c9ab5860d88db6601b2';
let pending = null, attempted = false;
function ensurePrimaryNotes() {
  const rows = state.canonicalModel?.projects;
  if (!rows || pending || attempted) return pending;
  attempted = true;
  document.documentElement.dataset.primaryNotesState = 'loading';
  pending = (async () => {
    const raw = await fetchPinned(manifest, manifestHash, 12000);
    const spec = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(raw));
    if (spec.schema !== 'globalgrid2050.primary-note-cartridge.v1' ||
        !/^[a-f0-9]{40}$/.test(spec.producer.commit) ||
        JSON.stringify(Object.keys(spec.files).sort()) !== JSON.stringify(['catalogue.mjs','model.mjs','notes.json']) ||
        spec.renderer.path !== 'automation/primary_note_ui/host-202611170324/brief.mjs') throw Error('Unsupported primary-note cartridge');
    const base = new URL('../../../../automation/primary_note_ui/' + spec.producer.commit + '/', import.meta.url);
    const checked = (url,pin) => {
      if (!Number.isSafeInteger(pin.bytes) || pin.bytes < 1 || pin.bytes > 65536 || !/^[a-f0-9]{64}$/.test(pin.sha256)) throw Error('Invalid primary-note bound');
      return fetchPinned(url,pin.sha256,pin.bytes,pin.bytes);
    };
    await Promise.all(Object.entries(spec.files).map(([name,pin]) => checked(new URL(name,base),pin)));
    const ui = new URL('../../../../' + spec.renderer.path, import.meta.url);
    await checked(ui,spec.renderer);
    const {buildPrimaryNotes} = await import(new URL('model.mjs',base));
    const index = buildPrimaryNotes(rows,{asOf:new Date().toISOString()});
    if (index.association_count !== spec.expected.associations || index.verified_count !== 0 || index.solar1000_verified_delta !== 0) throw Error('Primary-note counts changed');
    const view = await import(ui);
    window.pipelineMachineNotes.setPrimaryNotes(index,view,ref => rows.find(row => row.repd_ref === ref));
    document.documentElement.dataset.primaryNotesState = 'available';
  })().catch(() => {document.documentElement.dataset.primaryNotesState = 'unavailable';})
    .finally(() => {pending = null;});
  return pending;
}
window.addEventListener('pipeline-projects-rendered', ensurePrimaryNotes);
void ensurePrimaryNotes();
