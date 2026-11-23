// V9.60: REPD landscape-only overlay; reuses the existing gauges, filters and project table.
(() => {
  'use strict';
  const root=document.getElementById('officialRegister');
  const table=document.getElementById('repdScroll');
  if(!root||!table||document.getElementById('pnRepdWideToggle'))return;
  const orientation=window.matchMedia('(orientation: landscape)');
  const toggle=document.createElement('button');
  toggle.id='pnRepdWideToggle';
  toggle.type='button';
  toggle.setAttribute('aria-controls','officialRegister');
  toggle.setAttribute('aria-pressed','false');
  const icon=document.createElement('span');
  icon.className='pn-repd-icon';
  icon.setAttribute('aria-hidden','true');
  toggle.append(icon);
  const prompt=document.createElement('div');
  prompt.id='pnRepdWidePrompt';
  prompt.hidden=true;
  prompt.setAttribute('role','status');
  const note=document.createElement('span');
  note.textContent='Rotate your device to landscape for the full-width REPD dashboard and project columns.';
  const cancel=document.createElement('button');
  cancel.type='button';
  cancel.textContent='Cancel';
  prompt.append(note,cancel);
  root.append(toggle,prompt);

  let expanded=false,waiting=false,saved=null;
  const landscape=()=>orientation.matches && window.innerWidth>window.innerHeight;
  const siblings=()=>[...root.parentElement.children].filter(el=>el!==root);
  function refreshLabel(){
    const action=expanded?'Restore REPD dashboard':waiting?'Cancel landscape request':'Maximise REPD dashboard (landscape only)';
    icon.textContent=expanded?'⤡':'⤢';
    toggle.setAttribute('aria-label',action);
    toggle.title=action;
    toggle.setAttribute('aria-pressed',String(expanded));
  }
  function cancelRequest(){
    waiting=false;prompt.hidden=true;refreshLabel();
  }
  function enter(){
    if(expanded||!landscape())return;
    cancelRequest();
    const html=document.documentElement,body=document.body;
    saved={
      y:window.scrollY,rootScroll:root.scrollTop,tableX:table.scrollLeft,
      htmlOverflow:html.style.overflow,bodyOverflow:body.style.overflow,
      role:root.getAttribute('role'),modal:root.getAttribute('aria-modal'),
      inert:siblings().map(el=>[el,el.inert])
    };
    expanded=true;
    root.classList.add('pn-repd-wide');
    root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');
    for(const [el] of saved.inert)el.inert=true;
    html.classList.add('pn-repd-wide-open');
    html.style.overflow='hidden';
    body.style.overflow='hidden';
    refreshLabel();
    toggle.focus({preventScroll:true});
  }
  function restore(returnFocus=true){
    if(!expanded)return;
    expanded=false;
    root.classList.remove('pn-repd-wide');
    if(saved.role===null)root.removeAttribute('role');
    else root.setAttribute('role',saved.role);
    if(saved.modal===null)root.removeAttribute('aria-modal');
    else root.setAttribute('aria-modal',saved.modal);
    for(const [el,inert] of saved.inert)el.inert=inert;
    const y=saved.y,oldScroll=saved.rootScroll,tableX=saved.tableX;
    const html=document.documentElement,body=document.body;
    html.classList.remove('pn-repd-wide-open');
    html.style.overflow=saved.htmlOverflow;
    body.style.overflow=saved.bodyOverflow;
    saved=null;
    refreshLabel();
    if(returnFocus)toggle.focus({preventScroll:true});
    requestAnimationFrame(()=>{
      root.scrollTop=oldScroll;
      table.scrollLeft=tableX;
      window.scrollTo(0,y);
      requestAnimationFrame(()=>{
        table.scrollLeft=tableX;
        if(Math.abs(window.scrollY-y)>1)window.scrollTo(0,y);
      });
    });
  }
  function request(){
    if(expanded){restore();return;}
    if(waiting){cancelRequest();return;}
    if(landscape()){enter();return;}
    waiting=true;prompt.hidden=false;refreshLabel();
    cancel.focus({preventScroll:true});
  }
  function orientationChanged(){
    if(expanded&&!landscape())restore(false);
    if(waiting&&landscape())enter();
  }
  toggle.addEventListener('click',request);
  cancel.addEventListener('click',cancelRequest);
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    if(expanded){e.preventDefault();restore();}
    else if(waiting){e.preventDefault();cancelRequest();}
  });
  if(orientation.addEventListener)orientation.addEventListener('change',orientationChanged);
  else orientation.addListener(orientationChanged);
  window.addEventListener('resize',orientationChanged);
  window.addEventListener('pagehide',()=>{if(expanded)restore(false);cancelRequest();});
  refreshLabel();
})();
