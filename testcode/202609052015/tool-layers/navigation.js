import {observeToolReadiness} from './readiness.js';
/** Bind the visible shell to the current document, keeping original links intact. */
export function resolveToolDestination(href, registry, base) {
  const current=new URL(href,base);
  return registry.find(tool=>{const target=new URL(tool.entry,base);return target.origin===current.origin&&target.pathname===current.pathname;}) || null;
}
export function bindToolNavigation(layer,frame,title,status,registry,base,initial) {
  let disposeReadiness=observeToolReadiness(initial,frame,status);
  const loaded=()=>{
    disposeReadiness();delete status.dataset.timedOut;
    let href;try{href=frame.contentWindow.location.href;}catch{}
    const tool=href?resolveToolDestination(href,registry,base):null;
    layer.dispatchEvent(new Event('tool-document-changed'));
    if(tool){
      title.textContent=tool.title;frame.title=tool.title;layer.setAttribute('aria-label',tool.title);
      layer.dataset.currentTool=tool.id;layer.dataset.currentOwner=JSON.stringify(tool.owner);status.dataset.toolReadiness=tool.id;
      if(tool.id==='dc-ac-lv-topology-review'){
        status.dataset.interface='unreported';status.dataset.drawing='unreported';status.textContent='Page loaded; drawing readiness unreported';disposeReadiness=()=>{};
      }else disposeReadiness=observeToolReadiness(tool,frame,status,{startLoaded:true});
    }else{
      title.textContent='Linked page';frame.title='Linked page';layer.setAttribute('aria-label','Linked page');
      delete layer.dataset.currentTool;delete layer.dataset.currentOwner;delete status.dataset.toolReadiness;
      status.dataset.interface='unbound';status.dataset.drawing='unreported';status.textContent='Linked page outside the pinned tool registry';disposeReadiness=()=>{};
    }
  };
  frame.addEventListener('load',loaded);
  return ()=>{disposeReadiness();frame.removeEventListener('load',loaded);};
}
