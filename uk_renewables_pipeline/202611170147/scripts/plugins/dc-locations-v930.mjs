/* Existing DC records own the table; this accepted cartridge adds source locations. */
const host = document.getElementById('datacentreHost');
const manifestUrl = new URL('../../contracts/dc-locations.v930.json', import.meta.url);
const manifestHash = 'c6ad3c693b4ed76e8b0e5303f26db53136cc953ca2945f09a9a2007133c3b49f';
let work = null, attached = false;

async function pinned(url, expected, limit, exact = null) {
  const response = await fetch(url, {credentials:'omit', redirect:'error', cache:'force-cache', signal:AbortSignal.timeout(15000)});
  if (!response.ok || response.redirected) throw Error('Location input unavailable');
  const reader = response.body?.getReader();
  if (!reader) throw Error('Location input stream unavailable');
  const chunks = []; let length = 0;
  while (true) {
    const {done,value} = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > limit) {await reader.cancel();throw Error('Location input exceeds its bound');}
    chunks.push(value);
  }
  if (exact !== null && length !== exact) throw Error('Location input size changed');
  const bytes = new Uint8Array(length);let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk,offset);offset += chunk.byteLength;}
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  if (digest !== expected) throw Error('Location input identity changed');
  return bytes;
}

function ensureLocations() {
  if (!host?.querySelector('.ggdc-table') || attached || work) return work;
  host.dataset.locationsState = 'loading';
  work = (async()=>{
    const bytes = await pinned(manifestUrl,manifestHash,12000);
    const spec = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    if (spec.schema !== 'globalgrid2050.dc-location-cartridge.v1' ||
        !/^[a-f0-9]{40}$/.test(spec.producer.commit) ||
        JSON.stringify(Object.keys(spec.files).sort()) !== JSON.stringify(['actions.css','actions.mjs'])) throw Error('Unsupported location cartridge');
    const base = new URL('../../../../automation/dc_location_ui/'+spec.producer.commit+'/',import.meta.url);
    await Promise.all(Object.entries(spec.files).map(([name,pin])=>{
      if (!Number.isSafeInteger(pin.bytes) || pin.bytes < 1 || pin.bytes > 65536) throw Error('Invalid location cartridge bound');
      return pinned(new URL(name,base),pin.sha256,pin.bytes,pin.bytes);
    }));
    const module = await import(new URL('actions.mjs',base));
    if (!['url','sha256','bytes'].every(k=>module.INPUT[k]===spec.input[k])) throw Error('Location source contract changed');
    const transport = (url,options={})=>fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(15000)});
    const controller = await module.attachLocationActions(host,{pin:spec.input,transport,noteId:'dc-screening-note'});
    if (controller.sourceIds !== spec.expected.records) {controller.disconnect();throw Error('Location source population changed');}
    attached = true;host.dataset.locationsState = 'available';
    host.querySelector('.dc-location-status')?.remove();
  })().catch(()=>{
    host.dataset.locationsState = 'unavailable';
    if (!host.querySelector('.dc-location-status')) {
      const note = document.createElement('p');note.className='category-scope dc-location-status';
      note.textContent='Additional location data unavailable.';host.append(note);
    }
  }).finally(()=>{work=null;});
  return work;
}
window.addEventListener('pipeline-datacentre-ready',ensureLocations);
window.addEventListener('pipeline-category-changed',event=>{if(event.detail==='datacentre')void ensureLocations();});
void ensureLocations();
