/* Observe completed original render snapshots; never invoke or replace calculations. */
(() => {
  'use strict';
  const box=document.getElementById('snapshot_box');if(!box)return;
  let epoch=0, revision=0, disposed=false;
  let state=Object.freeze({schema:'ventus.cable-render.v1',state:'pending',revision:0});
  const publish=value=>{state=Object.freeze(value);document.dispatchEvent(new CustomEvent('ventus:cable-render-state',{detail:state}));};
  const pending=()=>{epoch++;publish({schema:'ventus.cable-render.v1',state:'pending',revision});};
  const inputIds=new Set(['route_name','section_length','burial_depth','circuit_qty','max_per_row','cable_od','spacing_h','spacing_v','bend_factor']);
  const changeIds=new Set(['installation_condition','service_type','grouping_basis','formation_type','spacing_basis','lookup_cores','lookup_voltage','lookup_csa']);
  const onInput=event=>{if(inputIds.has(event.target.id))pending();};
  const onChange=event=>{if(changeIds.has(event.target.id))pending();};
  const completed=async()=>{
    const token=++epoch,text=box.textContent;
    try {
      const snapshot=JSON.parse(text);
      if(!snapshot.inputs || !snapshot.derived_geometry)throw Error('Snapshot fields missing');
      const canvases=['formation_canvas','trench_canvas','bend_canvas'].map(id=>document.getElementById(id));
      if(canvases.some(c=>!c || !c.width || !c.height))throw Error('Drawing canvas missing');
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
      if(disposed || token!==epoch)return;
      revision++;
      publish({schema:'ventus.cable-render.v1',state:'ready',revision,snapshotSha256:[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join(''),
        capturedAt:snapshot.captured_at,canvases:Object.freeze(canvases.map(c=>Object.freeze({id:c.id,width:c.width,height:c.height}))),scope:'Original geometry render completed; no electrical or construction acceptance.'});
    } catch(error) {if(!disposed && token===epoch)publish({schema:'ventus.cable-render.v1',state:'failed',revision,error:String(error)});}
  };
  Object.defineProperty(window,'CableGeometryRender',{value:Object.freeze({getState:()=>state}),writable:false,configurable:false});
  const observer=new MutationObserver(completed);observer.observe(box,{childList:true,characterData:true,subtree:true});
  document.addEventListener('input',onInput,true);document.addEventListener('change',onChange,true);window.addEventListener('resize',pending);
  window.addEventListener('pagehide',event=>{if(event.persisted)return;disposed=true;epoch++;observer.disconnect();document.removeEventListener('input',onInput,true);document.removeEventListener('change',onChange,true);window.removeEventListener('resize',pending);});
  completed();
})();
