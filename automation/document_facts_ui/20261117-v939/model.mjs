import {acceptedNotice} from '../../grid_notice_ui/20261117-v938/model.mjs';
export const bundleHash='e2af1d77b9cc49d5d202d4b8f814bcb9469c974193afea21cf9d186a0d722d0a';
export async function acceptedDocuments(bytes,notice){
 try{
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(bytes)))).map(n=>n.toString(16).padStart(2,'0')).join('');
  if(digest!==bundleHash)throw Error('Unreviewed extraction bytes');
  const reviewed=await acceptedNotice(notice);if(!reviewed)throw Error('Narrow fact-rights review required');
  const payload=JSON.parse(bytes);if(payload.schema!=='globalgrid2050.distilled-document-bundle.v1'||payload.documents.length!==2)throw Error('Unknown bundle');
  for(const doc of payload.documents){const source=reviewed.documents.find(d=>d.url===doc.source_url);if(!source||source.source_sha256!==doc.source_version||source.publisher!==doc.publisher||doc.project!=='planning:EN020026'||doc.status!=='machine-provisional')throw Error('Unreviewed source');}
  return payload;
 }catch{return null;}
}
