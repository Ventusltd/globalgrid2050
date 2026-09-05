/** Interface and drawing readiness are separate: DOM presence is not map completion. */
export function inspectToolReadiness(id, doc) {
  if(!doc || doc.readyState !== 'complete') return {interface:'loading',drawing:'pending',label:'Loading tool'};
  const identity={'module-layout':'#ml_status','cable-geometry-visualiser':'#route_name','gis-sld-financial-sandbox':'#btn_draw'}[id];
  if(identity && !doc.querySelector(identity))return {interface:'unrecognised',drawing:'unreported',label:'Tool interface not recognised'};
  if(id==='module-layout') {
    const ready=doc.querySelector('#ml_status')?.textContent.includes('Ready. Draw at map centre or pick a site.');
    return {interface:'loaded',drawing:ready?'ready':'pending',label:ready?'Map ready':'Loading map'};
  }
  if(id==='cable-geometry-visualiser') {
    const canvases=[...doc.querySelectorAll('canvas')];
    const expected=['formation_canvas','trench_canvas','bend_canvas'];
    const ready=canvases.length===3 && expected.every(id=>canvases.some(c=>c.id===id)) && canvases.every(canvas=>{
      try {const bytes=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
        let opaque=0;const colors=new Set();
        for(let i=0;i<bytes.length;i+=64) if(bytes[i+3]) {opaque++;colors.add(bytes[i]+','+bytes[i+1]+','+bytes[i+2]);}
        return opaque>=8 && colors.size>=2;
      } catch {return false;} return false;
    });
    return {interface:'loaded',drawing:ready?'ready':'pending',label:ready?'Drawings ready':'Loading drawings'};
  }
  if(id==='gis-sld-financial-sandbox' && doc.querySelector('#btn_draw')) return {interface:'loaded',drawing:'unreported',label:'Interface loaded'};
  return {interface:'unrecognised',drawing:'unreported',label:'Tool interface not recognised'};
}

export function observeToolReadiness(tool, frame, status, {timeout=30000,interval=200,startLoaded=false}={}) {
  let timer, mutation, disposed=false;
  const timedOut=()=>{if(disposed)return;status.textContent='Tool is taking longer to load';status.dataset.timedOut='true';};
  const started = () => {
    clearTimeout(timer);mutation?.disconnect();delete status.dataset.timedOut;const deadline=Date.now()+timeout;
    const check = () => {
      if(disposed)return;
      clearTimeout(timer);
      let result;
      try {const doc=frame.contentDocument;result=doc ? inspectToolReadiness(tool.id,doc) : {interface:'unavailable',drawing:'unreported',label:'Tool opened on another site'};} catch {result={interface:'unavailable',drawing:'unreported',label:'Tool opened on another site'};}
      status.textContent=result.label;status.dataset.interface=result.interface;status.dataset.drawing=result.drawing;
      if(result.drawing==='ready' || result.drawing==='unreported'){mutation?.disconnect();return;}
      if(Date.now()>=deadline){mutation?.disconnect();timedOut();return;}
      timer=setTimeout(check,interval);
    };
    try {const marker=frame.contentDocument?.querySelector('#ml_status');
      if(tool.id==='module-layout' && marker && globalThis.MutationObserver){mutation=new MutationObserver(check);mutation.observe(marker,{childList:true,characterData:true,subtree:true});}
    } catch { /* Inaccessible child is classified by check. */ }
    check();
  };
  const navigating=()=>{clearTimeout(timer);mutation?.disconnect();delete status.dataset.timedOut;status.dataset.interface='loading';status.dataset.drawing='pending';status.textContent='Loading tool';timer=setTimeout(timedOut,timeout);};
  status.setAttribute('role','status');navigating();
  frame.addEventListener('load',started);
  frame.addEventListener('tool-navigation-start',navigating);
  if(startLoaded)started();
  return () => {disposed=true;clearTimeout(timer);mutation?.disconnect();frame.removeEventListener('load',started);frame.removeEventListener('tool-navigation-start',navigating);};
}
