/* Separate guard for the original classic-script Module Layout runtime. */
(() => {
  'use strict';
  const ids=['ml_draw_center','ml_pick_site'];
  const layers=['ml-boundary-fill','ml-boundary-line','ml-modules-fill','ml-modules-line'];
  const buttons=ids.map(id=>document.getElementById(id)).filter(Boolean);
  if(buttons.length!==ids.length)return;
  const note=document.createElement('p');note.id='ml-draw-readiness';note.setAttribute('role','status');
  buttons.at(-1).after(note);
  let map, timer, disposed=false;
  const capable=()=>{
    try {return typeof mlState!=='undefined' && !!mlState.map?.isStyleLoaded() && !!mlState.map.getSource('module-layout') && layers.every(id=>!!mlState.map.getLayer(id));}
    catch {return false;}
  };
  const reflect=()=>{
    const ready=capable();for(const button of buttons)button.disabled=!ready;
    note.textContent=ready?'Map ready for drawing':'Loading map before drawing';
    note.dataset.ready=String(ready);
  };
  const guard=event=>{
    const target=event.target.closest?.('button');
    if(!target || !ids.includes(target.id) || capable())return;
    event.preventDefault();event.stopImmediatePropagation();reflect();
  };
  const attach=()=>{
    if(disposed)return;
    if(typeof mlState!=='undefined' && mlState.map){map=mlState.map;map.on('styledata',reflect);map.on('idle',reflect);reflect();}
    else timer=setTimeout(attach,100);
  };
  const dispose=()=>{disposed=true;clearTimeout(timer);document.removeEventListener('click',guard,true);map?.off('styledata',reflect);map?.off('idle',reflect);note.remove();};
  document.addEventListener('click',guard,true);window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();});reflect();attach();
})();
