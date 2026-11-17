/** Source-bound successor adapter. Never replaces official table rows or exports. */
import {parseArtifact,MAX_BYTES} from './adapter.mjs';
import {attachPriority} from './view.mjs';
const SHA=/^[a-f0-9]{64}$/;
function require(value,message){if(!value)throw new Error(message);}
async function digest(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');}
function ids(values,pattern,count){require(Array.isArray(values)&&values.length===count&&new Set(values).size===count&&values.every(v=>typeof v==='string'&&pattern.test(v)),'Invalid source identity inventory');return values;}
export async function parsePriorityBundle(priorityBytes,manifestBytes,expectedManifestSHA256){
  require(SHA.test(expectedManifestSHA256),'A pinned manifest SHA256 is required');
  require(manifestBytes.byteLength<=1024*1024&&priorityBytes.byteLength<=MAX_BYTES,'Priority bundle size exceeded');
  require(await digest(manifestBytes)===expectedManifestSHA256,'Manifest digest mismatch');
  const manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(manifestBytes));
  require(manifest.schema==='globalgrid2050.prospecting.export.v1'&&manifest.source_release==='202611161244'&&manifest.publication_state==='REVIEW_ARTIFACT','Unsupported priority manifest');
  require(manifest.official_count===7775&&manifest.solar_count===3604&&manifest.solar1000_count===1000,'Baseline counts changed');
  require(manifest.unranked_state==='OUTSIDE_RANKED_SUBSET'&&typeof manifest.rank_scope==='string','Rank scope missing');
  const inventory=manifest.inventory;
  const official=ids(inventory?.official_ids,/^REPD-[1-9]\d*$/,7775);
  const pilot=ids(inventory?.solar1000_ids,/^[1-9]\d*$/,1000);
  require(pilot.every((v,i)=>official.includes('REPD-'+v)&&(!i||Number(v)>Number(pilot[i-1]))),'Solar-1000 order or membership changed');
  const dc=ids(inventory?.data_centre_ids,/^DC-WD-Q[1-9]\d*$/,inventory?.data_centre_ids?.length);
  require(dc.length<=1000&&manifest.input_count===official.length+dc.length,'Input population mismatch');
  require(Object.keys(inventory).sort().join(',')==='data_centre_ids,official_ids,solar1000_ids','Unexpected inventory fields');
  const canonicalInventory=JSON.stringify({data_centre_ids:dc,official_ids:official,solar1000_ids:pilot},null,2)+'\n';
  require(await digest(new TextEncoder().encode(canonicalInventory))===manifest.inventory_sha256,'Inventory digest mismatch');
  require(manifest.files&&Object.keys(manifest.files).sort().join(',')==='priority.csv,priority.json','Unexpected bundle files');
  const record=manifest.files['priority.json'];
  require(record.bytes===priorityBytes.byteLength&&SHA.test(record.sha256),'Priority file receipt mismatch');
  const model=await parseArtifact(priorityBytes,record.sha256);
  require(model.as_of===manifest.as_of&&model.returned_count===manifest.ranked_count&&model.input_count===manifest.input_count&&model.profile_sha256===manifest.profile_sha256,'Priority model differs from manifest');
  const raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(priorityBytes));
  require(JSON.stringify(raw.input_receipts)===JSON.stringify(manifest.input_receipts),'Source receipt differs from manifest');
  const members=new Set([...official,...dc]);
  require(model.records.every(r=>members.has(r.id)),'Ranked identity not in source inventory');
  return {model,manifest,members,byId:new Map(model.records.map(row=>[row.id,row]))};
}
export function attachProjectPriority(host,projectId,bundle){
  const row=host.closest('[id^="repd-"], [data-project-id]');
  const identity=row?.id?.startsWith('repd-')?'REPD-'+row.id.slice(5):row?.dataset.projectId;
  require(identity===projectId,'Priority host identity mismatch');
  // Remove only this adapter's prior rendering. Existing project facts/actions stay intact.
  host.querySelector(':scope > [data-priority-id]')?.remove();
  host.querySelector(':scope > [data-priority-state]')?.remove();
  if(!bundle){const label=document.createElement('span');label.dataset.priorityState='UNAVAILABLE';label.textContent='Research priority unavailable';host.append(label);return;}
  require(bundle.members.has(projectId),'Project absent from bound source inventory');
  const priority=bundle.byId.get(projectId);
  if(priority){attachPriority(host,priority,bundle.model.as_of);return;}
  const label=document.createElement('span');label.dataset.priorityState='OUTSIDE_RANKED_SUBSET';label.textContent='Outside this research-priority subset';host.append(label);
}
